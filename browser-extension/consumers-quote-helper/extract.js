// Consumers Quote Helper: reads a vendor product page's own product data: schema.org JSON-LD and microdata, then
// Open Graph, then the page's visible text around its heading (model labels such as "SKU:" or "Model#:", the model
// at the end of the address, the first price after the heading).
// Pure functions with no DOM or extension APIs, so vendor.js uses them in the page and the tests run them in Node.
// Loaded as a classic content script before vendor.js; also require()-able.
(function (root) {
  "use strict";

  const MAX_TEXT = 300; // NetSuite Model / Coll/Desc / Color are Free-Form Text, 300 characters
  const TEXT_BEFORE_HEADING = 300; // some sites (John Boos) print "Model#:" just above the product name
  const TEXT_AFTER_HEADING = 1500;
  const PRICE_AFTER_HEADING = 400; // further down are related products and add-ons with their own prices

  function text(value) {
    if (value == null) return "";
    const s = String(Array.isArray(value) ? value[0] ?? "" : value)
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
      .replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
    return s.slice(0, MAX_TEXT);
  }

  function number(value) {
    if (value == null || value === "") return null;
    const n = Number(String(value).replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
  }

  function imageUrl(image, base) {
    const first = Array.isArray(image) ? image[0] : image;
    const raw = typeof first === "object" && first ? first.url || first.contentUrl : first;
    if (!raw) return "";
    try {
      const url = new URL(String(raw), base);
      return url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function types(o) {
    return [].concat(o && o["@type"] ? o["@type"] : []).map(String);
  }

  // A barcode (UPC/EAN/GTIN), not a model number. Flusso puts its UPC in mpn and the model in sku.
  const isBarcode = value => /^\d{8}$|^\d{12,14}$/.test(value);

  // The first model-number candidate that is not a barcode; a barcode only when nothing else is given.
  function firstModel(candidates) {
    const values = candidates
      .map(c => (c && typeof c === "object" ? c.name || c.model || c.sku || "" : c))
      .map(text)
      .filter(Boolean);
    return values.find(v => !isBarcode(v)) || values[0] || "";
  }

  // The first offer's price; a list price in priceSpecification wins when the vendor gives one.
  function offerPrice(offers) {
    const list = [].concat(offers || []);
    for (const offer of list) {
      for (const spec of [].concat(offer && offer.priceSpecification ? offer.priceSpecification : [])) {
        if (/ListPrice|SRP|MSRP/i.test(String(spec.priceType || ""))) {
          const p = number(spec.price);
          if (p) return { price: p, currency: text(spec.priceCurrency || offer.priceCurrency) || "USD", isList: true };
        }
      }
    }
    for (const offer of list) {
      const p = number(offer && (offer.price ?? offer.lowPrice));
      if (p) return { price: p, currency: text(offer.priceCurrency) || "USD", isList: false };
    }
    return { price: null, currency: "USD", isList: false };
  }

  function toItem(o, group, base) {
    const offer = offerPrice(o.offers || (group && group.offers));
    // const model = text(o.mpn || o.sku || o.model || o.productID || (group && (group.productGroupID || group.sku)));
    const model = firstModel([o.mpn, o.sku, o.model, o.productID, group && group.productGroupID, group && group.sku]);
    return {
      name: text(o.name || (group && group.name)),
      model,
      color: text(o.color),
      price: offer.price,
      currency: offer.currency,
      priceIsList: offer.isList,
      imageUrl: imageUrl(o.image || (group && group.image), base),
    };
  }

  // Every Product (and each ProductGroup variant) found in the page's JSON-LD blocks. A block is the script's
  // text, or an object already parsed (the page's schema.org microdata, shaped like a JSON-LD Product).
  function fromJsonLd(blocks, pageUrl) {
    const items = [];
    const seen = new Set();
    const add = (item) => {
      if (!item.name && !item.model) return;
      const key = `${item.model}|${item.color}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push(item);
    };
    const walk = (o, group) => {
      if (!o || typeof o !== "object") return;
      if (Array.isArray(o)) return o.forEach(x => walk(x, group));
      const t = types(o);
      if (t.includes("ProductGroup")) {
        for (const v of [].concat(o.hasVariant || [])) walk(v, o);
        if (!o.hasVariant) add(toItem(o, null, pageUrl));
        return;
      }
      if (t.includes("Product")) {
        add(toItem(o, group, pageUrl));
        return;
      }
      if (o["@graph"]) walk(o["@graph"], group);
    };
    // for (const raw of blocks) {
    for (const raw of blocks || []) {
      try {
        // walk(JSON.parse(raw), null);
        walk(typeof raw === "string" ? JSON.parse(raw) : raw, null);
      } catch {
        // a malformed block is skipped; the others still count
      }
    }
    return items;
  }

  const ogTitle = meta => text(meta["og:title"]).replace(/\s*\|.*$/, "");

  // Open Graph product tags, used only when the page has no JSON-LD or microdata product.
  function fromOpenGraph(meta, pageUrl) {
    const isProduct = /product/i.test(meta["og:type"] || "") || meta["og:price:amount"] || meta["product:price:amount"];
    if (!isProduct) return [];
    return [{
      // name: text(meta["og:title"]).replace(/\s*\|.*$/, ""),
      name: ogTitle(meta),
      model: text(meta["product:retailer_item_id"] || meta["product:mfr_part_no"] || ""),
      color: text(meta["product:color"] || ""),
      price: number(meta["product:price:amount"] || meta["og:price:amount"]),
      currency: text(meta["product:price:currency"] || meta["og:price:currency"]) || "USD",
      priceIsList: false,
      imageUrl: imageUrl(meta["og:image"], pageUrl),
    }].filter(i => i.name);
  }

  // ---- The page's visible text around its heading -------------------------------------------------------------
  // page = { heading: the first h1's text, text: the page's visible text }, both with spaces collapsed.

  // The text just before and after the heading. Some sites print the name more than once (Neptune repeats it in a
  // bar above the product), so `afters` holds the text after each of the first three places it appears.
  function textWindow(page) {
    const all = String((page && page.text) || "");
    const heading = String((page && page.heading) || "").replace(/\s+/g, " ").trim();
    const at = heading ? all.indexOf(heading) : -1;
    if (at < 0) return null; // no heading: not a product page as far as we can tell (Fleurco's configurator, Avance)
    const afters = [];
    for (let i = at; i >= 0 && afters.length < 3; i = all.indexOf(heading, i + heading.length)) {
      afters.push(all.slice(i, i + TEXT_AFTER_HEADING));
    }
    return {
      before: all.slice(Math.max(0, at - TEXT_BEFORE_HEADING), at),
      after: afters[0],
      afters,
    };
  }

  // "Model#: CHY-CUCD15WC" (John Boos), "MODEL NUMBER: 220086-900-084-000" (Neptune), "SKU: CST776CEG#01" (TOTO),
  // "Item Number TK1050BSN" (Top Knobs), "Part Number 85414" (Strategic Brands), "Article Number 115.0731.726"
  // (Franke). The value must hold a digit, so "ITEM DETAILS" is not one.
  const MODEL_LABEL = /\b(model(?:\s*(?:#|no\.?|number))?|sku|item\s*(?:#|no\.?|number)|part\s*(?:#|no\.?|number)|article\s*(?:#|no\.?|number)|product\s*(?:code|#|no\.?|number))\s*[:#]?\s*([A-Z0-9][A-Z0-9.\-\/#]{1,40})/gi;

  function labeledModels(s) {
    const found = [];
    for (const m of String(s).matchAll(MODEL_LABEL)) {
      const value = m[2].replace(/[.\-\/#]+$/, "");
      if (/\d/.test(value) && value.length >= 3) found.push({ value, isModel: /^model/i.test(m[1]) });
    }
    return found;
  }

  // The model printed next to the product name: a "Model ..." label after the heading first, then any other label
  // after it, then the label closest above it.
  function pageModel(win) {
    if (!win) return { value: "", isModel: false };
    const after = labeledModels(win.after);
    const before = labeledModels(win.before);
    return after.find(m => m.isModel) || after[0] || before[before.length - 1] || { value: "", isModel: false };
  }

  // A model number at the end of the address: /product/T66T030-PC (Brizo), /ectru24179rt (Elkay),
  // /220086-900-084-000 (Neptune). A slug of words ("1-1-4-knob-precision-polished-nickel") is not one.
  function urlModel(pageUrl) {
    let last = "";
    try {
      last = decodeURIComponent(new URL(String(pageUrl)).pathname.split("/").filter(Boolean).pop() || "");
    } catch {
      return "";
    }
    const value = last.replace(/\.(html?|aspx|php)$/i, "").replace(/^sku-/i, "");
    if (!/^[A-Za-z0-9][A-Za-z0-9.#-]{3,39}$/.test(value) || !/\d/.test(value)) return "";
    const parts = value.split("-");
    if (parts.length > 5 || parts.some(p => /^[A-Za-z]{5,}$/.test(p))) return "";
    return value.toUpperCase();
  }

  // The first price shortly after the heading. "+$54.00" is an add-on (TOTO's colors), not the price.
  function pagePrice(win) {
    if (!win) return null;
    for (const after of win.afters) {
      for (const m of after.slice(0, PRICE_AFTER_HEADING).matchAll(/(^|[^+\d])\$\s?(\d[\d,]*(?:\.\d{2})?)/g)) {
        const p = number(m[2]);
        if (p) return p;
      }
    }
    return null;
  }

  // An item from the page's text alone, when the page has no product data: it needs a model next to the name, or
  // a model in the address on a page that shows a price or calls itself a product.
  function fromPageText(page, meta, pageUrl) {
    const win = textWindow(page);
    if (!win) return [];
    const price = number(meta["product:price:amount"] || meta["og:price:amount"]) || pagePrice(win);
    const labeled = pageModel(win).value;
    const fromUrl = labeled ? "" : urlModel(pageUrl);
    const looksLikeProduct = price != null || /product/i.test(meta["og:type"] || "");
    const model = labeled || (looksLikeProduct ? fromUrl : "");
    if (!model) return [];
    return [{
      name: ogTitle(meta) || text(page.heading),
      model,
      color: "",
      price,
      currency: text(meta["product:price:currency"] || meta["og:price:currency"]) || "USD",
      priceIsList: false,
      imageUrl: imageUrl(meta["og:image"], pageUrl),
    }];
  }

  // A single item from product data, completed from the rest of the page: the price from Open Graph or the text
  // (Top Knobs, TOTO, Neptune), the model from the text or the address (TOTO, Elkay), and Neptune's full model
  // number ("220086-900-084-000", also in its address) where its product data only has the base model ("220086").
  function fillGaps(item, page, meta, pageUrl) {
    const win = textWindow(page);
    const out = { ...item };
    const labeled = pageModel(win);
    const base = out.model.toUpperCase();
    const full = labeled.value.toUpperCase();
    if (!out.model || isBarcode(out.model)) {
      out.model = labeled.value || urlModel(pageUrl) || out.model;
    } else if (labeled.isModel && full.length > base.length && full.startsWith(base) &&
      String(pageUrl).toUpperCase().includes(full)) {
      out.model = labeled.value;
    }
    if (out.price == null) {
      const p = number(meta["product:price:amount"] || meta["og:price:amount"]) || pagePrice(win);
      if (p) {
        out.price = p;
        out.priceIsList = false;
      }
    }
    if (!out.name) out.name = ogTitle(meta) || text(page && page.heading);
    if (!out.imageUrl) out.imageUrl = imageUrl(meta["og:image"], pageUrl);
    return out;
  }

  // What the customer types in when the page has nothing to read (Fleurco's configurator, Avance's door styles).
  function blankItem(meta, page, title, pageUrl) {
    const m = meta || {};
    return {
      // The whole title: Avance's starts with the site name ("Avance Cabinetry | Benton Bourbon | ...").
      name: text(page && page.heading) || text(m["og:title"]) || text(title),
      model: "",
      color: "",
      price: null,
      currency: "USD",
      priceIsList: false,
      imageUrl: imageUrl(m["og:image"], pageUrl),
    };
  }

  // The variant the page is showing: one whose model appears in the URL, else the first one.
  function pickDefault(items, pageUrl) {
    if (!items.length) return -1;
    const url = String(pageUrl || "").toUpperCase();
    const hit = items.findIndex(i => i.model && url.includes(i.model.toUpperCase()));
    return hit >= 0 ? hit : 0;
  }

  // The vendor's main domain, so us.kohler.com and www.kohler.com both count as kohler.com.
  function registrableDomain(host) {
    const parts = String(host || "").toLowerCase().replace(/\.$/, "").split(".").filter(Boolean);
    if (parts.length <= 2) return parts.join(".");
    const twoPartTld = /^(co|com|net|org|gov|ac)\.[a-z]{2}$/.test(parts.slice(-2).join("."));
    return parts.slice(twoPartTld ? -3 : -2).join(".");
  }

  const ENTITIES = { nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", reg: "®", trade: "™", copy: "©" };
  function decode(s) {
    return String(s)
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
  }
  const visible = html => decode(String(html)
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

  // An attribute's value in a tag, in either kind of quote, so content="D'Amico" keeps its apostrophe.
  function attrValue(tag, names) {
    const m = String(tag).match(new RegExp(`\\s(?:${names})=(?:"([^"]*)"|'([^']*)')`, "i"));
    return m ? m[1] ?? m[2] : undefined;
  }

  // schema.org Product microdata from raw HTML: the first value of each property after the Product's itemtype.
  function microdataFromHtml(html) {
    const at = String(html).search(/itemtype=["'][^"']*schema\.org\/Product["']/i);
    if (at < 0) return null;
    const rest = String(html).slice(at);
    const prop = name => {
      const m = rest.match(new RegExp(`<[^>]*itemprop=["']${name}["'][^>]*>`, "i"));
      if (!m) return "";
      const value = attrValue(m[0], "content|src|href");
      if (value != null) return decode(value);
      const inner = rest.slice(m.index + m[0].length).match(/^([^<]*)/);
      return inner ? decode(inner[1]).trim() : "";
    };
    return {
      "@type": "Product", name: prop("name"), sku: prop("sku"), mpn: prop("mpn"), model: prop("model"),
      color: prop("color"), image: prop("image"), offers: { price: prop("price"), priceCurrency: prop("priceCurrency") },
    };
  }

  // JSON-LD script bodies, meta tags, microdata and visible text from raw HTML (used when the live DOM has none,
  // and in tests).
  function scanHtml(html) {
    const blocks = [];
    for (const m of String(html).matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) blocks.push(m[1]);
    const meta = {};
    for (const m of String(html).matchAll(/<meta\s+[^>]*>/gi)) {
      // const tag = m[0];
      // const key = (tag.match(/(?:property|name)=["']([^"']+)["']/i) || [])[1];
      // const content = (tag.match(/content=["']([^"']*)["']/i) || [])[1];
      const key = attrValue(m[0], "property|name");
      const content = attrValue(m[0], "content");
      if (key && content != null && !(key in meta)) meta[key] = decode(content);
    }
    const h1 = String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
    const body = String(html).match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
    const page = { heading: h1 ? visible(h1[1]) : "", text: visible(body ? body[1] : html), microdata: microdataFromHtml(html) };
    // return { blocks, meta };
    return { blocks, meta, page };
  }

  // page (optional) = { heading, text, microdata }. Microdata counts only when there is no JSON-LD product: Delta
  // has both, and its microdata Product has no model.
  function extract(blocks, meta, pageUrl, page) {
    // 1.0.0: JSON-LD, then Open Graph only.
    // const items = fromJsonLd(blocks, pageUrl);
    // const all = items.length ? items : fromOpenGraph(meta || {}, pageUrl);
    // return { items: all, selected: pickDefault(all, pageUrl) };
    const m = meta || {};
    let items = fromJsonLd(blocks, pageUrl);
    if (!items.length && page && page.microdata) items = fromJsonLd([page.microdata], pageUrl);
    if (!items.length) items = fromOpenGraph(m, pageUrl);
    if (!items.length) items = fromPageText(page, m, pageUrl);
    else if (items.length === 1) items = [fillGaps(items[0], page, m, pageUrl)];
    return { items, selected: pickDefault(items, pageUrl) };
  }

  const api = {
    extract, scanHtml, fromJsonLd, fromOpenGraph, fromPageText, fillGaps, blankItem, urlModel, labeledModels,
    registrableDomain, pickDefault, text, number,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ConsumersExtract = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
