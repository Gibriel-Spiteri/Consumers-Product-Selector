// Consumers QuickAdd (Consumers Quote Helper until 1.5.0): reads a vendor product page's own product data: schema.org JSON-LD and microdata, then
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
  const MIN_TYPE_SCORE = 2; // a Type guess needs a word in the product name, or two in the breadcrumbs or address

  function text(value) {
    if (value == null) return "";
    const s = String(Array.isArray(value) ? value[0] ?? "" : value)
      .replace(/<\/?(sub|sup)\b[^>]*>/gi, "") // Delta's "Touch<sub>2</sub>O" is one word, not "Touch 2 O"
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
    // const raw = typeof first === "object" && first ? first.url || first.contentUrl : first;
    let raw = typeof first === "object" && first ? first.url || first.contentUrl : first;
    // 1.5.3 (sweep 11/5): Flusso writes "flussofaucets.com/media/..." with no scheme, which resolved under the page.
    if (typeof raw === "string" && /^[a-z0-9-]+(?:\.[a-z0-9-]+)+\//i.test(raw)) raw = `https://${raw}`;
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
  // const isBarcode = value => /^\d{8}$|^\d{12,14}$/.test(value);
  // Also with a dashed check digit: Flusso's Caso K.1200CR has mpn "716894070509-7" (Gib 11/5).
  const isBarcode = value => /^(?:\d{8}|\d{12,14})(?:-\d)?$/.test(value);

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
      // const p = number(offer && (offer.price ?? offer.lowPrice));
      // 1.5.3: a range (AggregateOffer lowPrice to a different highPrice) is not one price.
      const ranged = offer && offer.price == null && offer.highPrice != null && number(offer.highPrice) !== number(offer.lowPrice);
      const p = ranged ? null : number(offer && (offer.price ?? offer.lowPrice));
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
    // const isProduct = /product/i.test(meta["og:type"] || "") || meta["og:price:amount"] || meta["product:price:amount"];
    // 1.5.3 (sweep 11/5): "product" only; a Shopify collection page says "product.group" (Craft & Main).
    const isProduct = /^(og:)?product$/i.test(String(meta["og:type"] || "").trim()) || meta["og:price:amount"] || meta["product:price:amount"];
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
    // Case-blind: a site can style the title in capitals ("With", "In") that its own text does not use.
    const lower = all.toLowerCase();
    const key = heading.toLowerCase();
    // const at = heading ? all.indexOf(heading) : -1;
    const at = key ? lower.indexOf(key) : -1;
    if (at < 0) return null; // no heading: not a product page as far as we can tell (Fleurco's configurator, Avance)
    const afters = [];
    // for (let i = at; i >= 0 && afters.length < 3; i = all.indexOf(heading, i + heading.length)) {
    for (let i = at; i >= 0 && afters.length < 3; i = lower.indexOf(key, i + key.length)) {
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
  // const MODEL_LABEL = /\b(model(?:\s*(?:#|no\.?|number))?|sku|item\s*(?:#|no\.?|number)|part\s*(?:#|no\.?|number)|article\s*(?:#|no\.?|number)|product\s*(?:code|#|no\.?|number))\s*[:#]?\s*([A-Z0-9][A-Z0-9.\-\/#]{1,40})/gi;
  // 1.5.3 (sweep 11/5): a bare "model" needs its ":" or "#" ("Model: 32665003"); prose like "The model 8160 is
  // available in 8 finishes" (a Richelieu family page) is not a label.
  const MODEL_LABEL = /\b(model\s*(?:#|no\.?|number)|model(?=\s*[:#])|sku|item\s*(?:#|no\.?|number)|part\s*(?:#|no\.?|number)|article\s*(?:#|no\.?|number)|product\s*(?:code|#|no\.?|number))\s*[:#]?\s*([A-Z0-9][A-Z0-9.\-\/#]{1,40})/gi;

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

  // A price as printed. Cents in superscript lose their point in the page's text: Delta's "$1,242<sup>00</sup>"
  // reads "$1,24200"; a last group of five digits after a comma is read as dollars and cents.
  function printedPrice(raw) {
    const s = String(raw);
    const m = /^(\d{1,3}(?:,\d{3})*),(\d{3})(\d{2})$/.exec(s);
    return number(m ? `${m[1].replace(/,/g, "")}${m[2]}.${m[3]}` : s);
  }

  // The first price shortly after the heading. "+$54.00" is an add-on (TOTO's colors), not the price.
  // function pagePrice(win) {
  //   if (!win) return null;
  //   for (const after of win.afters) {
  //     for (const m of after.slice(0, PRICE_AFTER_HEADING).matchAll(/(^|[^+\d])\$\s?(\d[\d,]*(?:\.\d{2})?)/g)) {
  //       const p = printedPrice(m[2]);
  //       if (p) return p;
  //     }
  //   }
  //   return null;
  // }
  // 1.5.3 (sweep 11/5): a price that starts inside the window is read to its end (Brizo's "$1,185.00" was cut to $1),
  // and a range ("$680.00 - $1,061.00", "$191.00 through $301.00") or a "from" price is not the item's price: none
  // is taken, so the customer picks the finish and the panel reads the single price then.
  function pagePrice(win) {
    if (!win) return null;
    for (const after of win.afters) {
      for (const m of after.slice(0, PRICE_AFTER_HEADING + 20).matchAll(/(^|[^+\d])\$\s?(\d[\d,]*(?:\.\d{2})?)/g)) {
        if (m.index >= PRICE_AFTER_HEADING) break;
        const end = m.index + m[0].length;
        if (/^\s*(?:-|\u2013|\u2014|to|through)\s*\$/i.test(after.slice(end, end + 15))) return null;
        if (/\b(?:from|starting at|as low as)\s*$/i.test(after.slice(Math.max(0, m.index - 20), m.index + m[1].length))) return null;
        const p = printedPrice(m[2]);
        if (p) return p;
      }
    }
    return null;
  }

  // The page says the item is discontinued, next to its name (Elkay, TOTO colors; 1.5.3): the panel warns.
  function discontinued(page) {
    const win = textWindow(page);
    return !!win && /\bdiscontinued\b/i.test(win.after.slice(0, PRICE_AFTER_HEADING));
  }

  // ---- Collection, breadcrumbs and the special-order Type (1.3.0) ---------------------------------------------

  const plain = s => text(s).replace(/[®™]/g, "").trim();

  // The collection: a short heading that is not the product's name (Brizo's h1 "Virage®" above "Sensori Valve
  // Trim"), else a trademarked first word or two of the name ("Cairn® 27-1/2...", "Drake® Two-piece..."). Delta's
  // comes from its own rule. Empty when the page does not say; the customer or rep can type it.
  function guessCollection(item, page) {
    // const heading = plain(page && page.heading);
    // The heading as written (Brizo styles "Virage" in capitals), and never a model number (Elkay's h1 is the model).
    const heading = plain(page && (page.headingText || page.heading));
    const name = plain(item.name);
    if (heading && !/\d/.test(heading) && heading.split(/\s+/).length <= 3 && name && !name.toLowerCase().startsWith(heading.toLowerCase())) return heading;
    const m = /^([A-Z][A-Za-z0-9'&.-]*(?:\s[A-Z][A-Za-z0-9'&.-]*){0,2})\s?[®™]/.exec(text(item.name));
    return m ? m[1].trim() : "";
  }

  // A finish named at the end of the product name, when the page gives no color (Jim, 11/5): "128mm Austin Pull -
  // Satin Nickel", "Barrow Knob 1 1/4 Inch Brushed Satin Nickel", "... with Clear glass in Chrome". The trailing words
  // must all be finish words and include a color or metal, so "Elongated Bowl" or "Matte" alone is not a finish.
  const FINISH_COLOR = new Set(["chrome", "nickel", "bronze", "brass", "gold", "black", "white", "stainless", "steel",
    "copper", "pewter", "silver", "graphite", "gunmetal", "iron", "biscuit", "almond", "bone", "cotton", "grey", "gray",
    "taupe", "ivory", "champagne", "platinum", "titanium", "aluminum", "zinc", "onyx", "slate", "sand", "cream"]);
  const FINISH_WORD = new Set([...FINISH_COLOR, "matte", "polished", "brushed", "satin", "oil", "rubbed", "antique",
    "aged", "venetian", "spotshield", "lumicoat", "arctic", "vibrant", "french", "honey", "dark", "light", "warm",
    "flat", "gloss", "glossy", "natural", "tuscan", "english", "moderne", "luxe", "pvd", "brilliance", "and", "&"]);
  function guessFinish(name) {
    const words = text(name).replace(/[®™]/g, "").split(/\s+/).filter(Boolean);
    let i = words.length;
    while (i > 0 && FINISH_WORD.has(words[i - 1].toLowerCase().replace(/[^a-z&]/g, ""))) i--;
    const tail = words.slice(i);
    while (tail.length && /^(and|&)$/i.test(tail[0])) tail.shift();
    return tail.some(w => FINISH_COLOR.has(w.toLowerCase().replace(/[^a-z]/g, ""))) ? tail.join(" ") : "";
  }

  // NetSuite's Coll/Desc as reps type it: the collection, then the description ("Altado Two Handle Widespread
  // Bathroom Faucet"). The collection is left out when the description already names it ("Cairn 27-1/2..." or
  // "128mm Austin Pull - Satin Nickel"). Same rule as the Product Selector's collDesc (src/lib/vendor-picks.ts).
  // function collDesc(collection, description) {
  //   const c = String(collection || "").replace(/[®™]/g, "").trim();
  //   const d = text(description);
  //   if (!c) return d;
  //   const named = new RegExp(`(^|[^a-z0-9])${c.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`);
  //   if (named.test(d.replace(/[®™]/g, "").toLowerCase())) return d;
  //   return `${c} ${d}`.trim().slice(0, MAX_TEXT);
  // }
  // 1.5.3 (sweep 11/5): no ® or ™ anywhere, and a brand is not a collection (Delta's ".collection-name" can be just
  // "DELTA®", Brizo's heading just "Brizo®", which gave "Delta MultiChoice...").
  const BRAND = /^(delta|brizo|kohler|grohe|toto|elkay|franke|icera|flusso|fleurco|bain\s*ultra|bainultra|john\s*boos|boos|richelieu|top\s*knobs|laurey|mng(?:\s*hardware)?|sofia|craft\s*(?:\+|&|and)?\s*main)$/i;
  function collDesc(collection, description) {
    let c = String(collection || "").replace(/[®™]/g, "").replace(/\s+/g, " ").trim();
    if (BRAND.test(c)) c = "";
    const d = text(description).replace(/[®™]/g, "").replace(/\s+/g, " ").trim();
    if (!c) return d;
    const named = new RegExp(`(^|[^a-z0-9])${c.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`);
    if (named.test(d.toLowerCase())) return d;
    return `${c} ${d}`.trim().slice(0, MAX_TEXT);
  }

  // The product name for Coll/Desc without what has its own field (1.5.3, sweep 11/5): the model number ("Pescara
  // Undermount Sink - PTX110-17") and the finish at the end ("... Undermount Sink Greystone", "128mm Austin Pull -
  // Satin Nickel"). The name as it was when nothing would be left.
  function descName(name, model, color) {
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    let n = text(name).replace(/[®™]/g, "").replace(/^\s*discontinued\s*[-:]\s*/i, ""); // the panel warns instead
    const m = text(model);
    if (m.length >= 4) n = n.replace(new RegExp(`\\s*[-,(]?\\s*(?<![A-Za-z0-9])${esc(m)}(?![A-Za-z0-9])\\.?\\)?`, "i"), " ");
    const c = text(color).replace(/[®™]/g, "");
    if (c) n = n.replace(new RegExp(`(?:\\s+-\\s*|,\\s*|\\s+in\\s+|\\s+)${esc(c)}\\s*$`, "i"), "");
    n = n.replace(/\s+/g, " ").replace(/[\s,-]+$/, "").trim();
    return n || text(name).replace(/[®™]/g, "");
  }

  // The vendor's breadcrumbs ("Kitchen / Sink Faucets / Pull-Down"): JSON-LD BreadcrumbList, else the page's own
  // breadcrumb links (page.crumbs), else the product's category.
  function breadcrumbs(blocks, page) {
    const names = [];
    let productCategory = "";
    const walk = o => {
      if (!o || typeof o !== "object") return;
      if (Array.isArray(o)) return o.forEach(walk);
      const t = types(o);
      if (t.includes("BreadcrumbList")) {
        for (const li of [].concat(o.itemListElement || [])) names.push(text(li && (li.name || (li.item && li.item.name))));
        return;
      }
      if ((t.includes("Product") || t.includes("ProductGroup")) && o.category && !productCategory) productCategory = text(o.category);
      if (o["@graph"]) walk(o["@graph"]);
    };
    for (const raw of blocks || []) {
      try {
        walk(typeof raw === "string" ? JSON.parse(raw) : raw);
      } catch {}
    }
    const list = (names.length ? names : [].concat((page && page.crumbs) || []).map(text))
      .filter(n => n && !/^home$/i.test(n));
    const unique = [...new Set(list)];
    return (unique.length ? unique.join(" / ") : productCategory).slice(0, MAX_TEXT);
  }

  // Words, singular: "Pull-Down Kitchen Faucets" -> pull, down, kitchen, faucet. "Bathroom" counts as the Types'
  // "BATH" (Delta's "Two Handle Widespread Bathroom Faucet" is a BATH FAUCET, 11/5).
  // const SAME_WORD = { bathroom: "bath" };
  // function words(s) {
  //   return String(s).toLowerCase().split(/[^a-z]+/).filter(w => w.length > 1)
  //     .map(w => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
  //     .map(w => SAME_WORD[w] || w);
  // }
  // 1.5.3 (sweep 11/5): two-word names count as one word ("hand shower" is a HANDSHOWER, "shower head" a SHOWERHEAD),
  // bath accessories by their names ("towel bar", "toilet paper holder"), "freestanding bath" and "bathtub" as a tub,
  // "-ies" as "-y", and a lavatory (not a lavatory faucet) as a bath sink.
  const COMPOUND = [
    [/\bhand[\s-]+showers?\b/gi, "handshower"],
    [/\bshower[\s-]+heads?\b|\brain[\s-]*heads?\b/gi, "showerhead"],
    [/\btub\s*(?:\/|&|and)?\s*shower\s+doors?\b/gi, "tub door"], // Craft & Main's "Sliding Tub Shower Door" is a TUB DOOR
    [/\btub\s+(?:enclosures?|screens?|shields?)\b/gi, "tub door"], // Fleurco's "Tub enclosure"
    [/\bshower\s+(?:enclosures?|screens?)\b/gi, "shower door"],
    [/\b(?:toilet\s+paper|tissue)\s+holders?\b|\btowel\s+(?:bars?|rings?|shel(?:f|ves)|hooks?)\b|\brobe\s+hooks?\b|\bgrab\s+bars?\b|\bsoap\s+(?:dish(?:es)?|dispensers?)\b/gi, "accessory"],
    [/\b(freestanding|alcove|drop-in|undermount|soaking|corner)\s+bath\b(?!\s*(?:faucet|filler|sink|room))/gi, "$1 tub"],
    [/\blavator(?:y|ies)\b(?!\s+faucets?)/gi, "bath sink"],
    [/\b(?:bar|prep)(?:\s*\/\s*(?:bar|prep))?\s+faucets?\b/gi, "bar prep"], // Brizo's "Prep Faucet" is KITCHEN - BAR/PREP
    // 1.5.6 (sweep 2, 11/6): a pot filler is a kitchen faucet, not a TUB FILLER (Flusso P.1000); a shower set (valve, trim,
    // head and hand shower) is ordered as the shower faucet (Flusso 250.7100).
    // [/\bpot\s+fillers?\b/gi, "kitchen faucet"],
    // Kept as its own word too, so a line with a POT FILLER Type (Brizo) still picks it; a tub filler is a tub faucet
    // where the line has no TUB FILLER Type (Brizo T70367 got KITCHEN - POT FILLER).
    [/\bpot\s+fillers?\b/gi, "potfiller kitchen faucet"],
    [/\btub\s+fillers?\b/gi, "tubfiller tub faucet"],
    // A "bathroom sink faucet" is a faucet, not a sink; its "faucet handles" are ordered as the faucet (Kohler bundles).
    [/\bsink\s+faucets?\b/gi, "faucet"],
    // An Elkay "Sink Kit" (sink with grid and drain, one SKU) is the sink, not a part of one ("kit" after a fixture).
    [/\bsink\s+kits?\b/gi, "sink"],
    [/\bfaucet\s+handles?\b/gi, "faucet"],
    // [/\bshower\s+(?:sets?|systems?)\b/gi, "shower faucet"],
    [/\bshower\s+(?:sets?|systems?|bundles?)\b/gi, "shower faucet"], // Grohe's "Thermostatic Shower Bundle"
    // A shower or valve trim is ordered as the shower faucet where the line has no trim Type (Grohe 29137000, Delta
    // T14462); a line with a VALVE TRIM Type still picks it (its words say trim too).
    [/\btub\s*(?:\/|&|and)\s*shower\s+trims?\b/gi, "tub shower faucet trim"],
    [/\b(?:valve|shower)\s+trims?\b/gi, "shower faucet trim"],
  ];
  const SAME_WORD = { bathroom: "bath", bathtub: "tub", accessorie: "accessory" };
  function words(s) {
    let x = String(s);
    for (const [re, to] of COMPOUND) x = x.replace(re, to);
    return x.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 1)
      .map(w => (w.length > 4 && w.endsWith("ies") ? `${w.slice(0, -3)}y` : w))
      .map(w => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
      .map(w => SAME_WORD[w] || w);
  }
  // A part named after the fixture it fits is not the fixture: a toilet seat is not a TOILET, a sink grid not a SINK.
  const PART_AFTER = new Set(["seat", "lid", "lever", "tank", "grid", "strainer", "kit", "cover", "bracket", "cartridge",
    "basket", "flange", "rack", "mat", "caddy", "handle", "part"]);

  // The product line's special-order Type that fits: words of the Type found in the product name count 2, in the
  // breadcrumbs or address 1. It needs at least 2 (one word in the name, or two elsewhere): a lone breadcrumb word
  // is too weak (John Boos "Boos Blocks > Carts" is not BUTCHER BLOCK). No guess on a tie, for order-form Types or
  // MISCELLANEOUS. Same rule as the Product Selector's suggestType (artifacts/product-selector/src/lib/vendor-picks.ts).
  // function suggestType(pick, typeList) {
  //   let path = "";
  //   try {
  //     path = decodeURIComponent(new URL(String(pick.pageUrl)).pathname);
  //   } catch {}
  //   const nameWords = new Set(words(pick.name || ""));
  //   const otherWords = new Set([...words(path), ...words(pick.category || "")]);
  //   // The Type's last word is its main noun (BASE, DOOR, FAUCET, SINK, TRIM) and must be there too: a shower door is
  //   // not a SHOWER BASE just because both say "shower" (Neptune has no shower-door Type, live check 11/5).
  //   const head = t => { const w = words(t.name); return w[w.length - 1]; };
  //   const scored = (typeList || [])
  //     .filter(t => !t.requiresAttachment && !/^misc/i.test(String(t.name).trim()))
  //     .filter(t => nameWords.has(head(t)) || otherWords.has(head(t)))
  //     .map(t => ({ t, score: [...new Set(words(t.name))].reduce((s, w) => s + (nameWords.has(w) ? 2 : otherWords.has(w) ? 1 : 0), 0) }))
  //     .filter(s => s.score >= MIN_TYPE_SCORE)
  //     .sort((a, b) => b.score - a.score);
  //   if (!scored.length || (scored.length > 1 && scored[1].score === scored[0].score)) return null;
  //   return scored[0].t;
  // }
  // 1.5.3 (sweep 11/5; 1.5.2 got 16 of 34 sweep pages wrong or blank, this gets 1): only the main part of the name
  // counts as the name ("X with Hand Shower", "X - Less Handles", "X, 1.2 gpm"), the product's own slug at the end of
  // the address does not count, a Type whose main noun is in the name beats one found only in the breadcrumbs, and a
  // tie goes to the Type with fewer missing words, then to the main noun that comes last ("sink faucet" is a FAUCET).
  // opts.orderForms: the panel may suggest an order-form Type too (Bain Ultra's AIR TUB); the customer sees it.
  function suggestType(pick, typeList, opts) {
    let path = "";
    try {
      path = decodeURIComponent(new URL(String(pick.pageUrl)).pathname).split("/").filter(Boolean).slice(0, -1).join("/");
    } catch {}
    const full = String(pick.name || "");
    const head = t => { const w = words(t.name); return w[w.length - 1]; };
    const allowed = (typeList || [])
      .filter(t => (!t.requiresAttachment || (opts && opts.orderForms)) && !/^misc/i.test(String(t.name).trim()));
    // The main part of the name; the whole name when that part is just a collection ("Caso - ... Kitchen Faucet"), not
    // when it describes something no Type fits ("Elongated Toilet with Seat, Left-Hand Trip Lever" is no TRIP LEVER).
    const mainList = words(full.split(/\s+(?:with|w\/)\s+|\s+-\s+|,\s*/i)[0]);
    // const nameList = allowed.some(t => mainList.includes(head(t))) || mainList.length > 2 ? mainList : words(full);
    // 1.5.6 (sweep 2): a main part that names an accessory (a towel bar) decides too: Top Knobs' "Edwardian Towel Bar with
    // Oval Backplate" is no BACKPLATES.
    const nameList = allowed.some(t => mainList.includes(head(t))) || mainList.length > 2 || mainList.includes("accessory") ? mainList : words(full);
    const nameWords = new Set(nameList);
    const otherWords = new Set([...words(path), ...words(pick.category || "")]);
    // The Type's last word is its main noun (BASE, DOOR, FAUCET, SINK, TRIM) and must be there too: a shower door is
    // not a SHOWER BASE just because both say "shower" (live check 11/5). A part after it ("Toilet Seat") is not it.
    const inName = t => { const i = nameList.lastIndexOf(head(t)); return i >= 0 && !PART_AFTER.has(nameList[i + 1]); };
    const partOf = t => { const i = nameList.lastIndexOf(head(t)); return i >= 0 && PART_AFTER.has(nameList[i + 1]); };
    // let cands = allowed.filter(t => !partOf(t) && (inName(t) || otherWords.has(head(t))));
    // 1.5.6 (sweep 2, 11/6): a Type for the other room is not it: a kitchen soap dispenser (Flusso K.A100, "Kitchen >
    // Kitchen Accessories") is no BATH ACCESSORY. Only when the item names one room and not the other.
    const said = new Set([...nameWords, ...otherWords]);
    const otherRoom = t => { const w = words(t.name); return (said.has("kitchen") && !said.has("bath") && w.includes("bath") && !w.includes("kitchen")) ||
      (said.has("bath") && !said.has("kitchen") && w.includes("kitchen") && !w.includes("bath")); };
    let cands = allowed.filter(t => !partOf(t) && !otherRoom(t) && (inName(t) || otherWords.has(head(t))));
    if (cands.some(inName)) cands = cands.filter(inName);
    const scored = cands.map(t => {
      const ws = [...new Set(words(t.name))];
      // const score = ws.reduce((s, w) => s + (nameWords.has(w) ? 2 : otherWords.has(w) ? 1 : 0), 0);
      // A one-word Type named in the breadcrumbs counts in full (Fleurco's "LED Mirrors" is a MIRROR).
      const score = ws.reduce((s, w) => s + (nameWords.has(w) ? 2 : otherWords.has(w) ? (ws.length === 1 ? 2 : 1) : 0), 0);
      const missing = ws.filter(w => !nameWords.has(w) && !otherWords.has(w)).length;
      return { t, score, missing, pos: nameList.lastIndexOf(head(t)) };
    })
      .filter(s => s.score >= MIN_TYPE_SCORE)
      .sort((a, b) => b.score - a.score || a.missing - b.missing || b.pos - a.pos);
    if (!scored.length) return null;
    const [a, b] = scored;
    if (b && a.score === b.score && a.missing === b.missing && a.pos === b.pos) return null;
    return a.t;
  }

  // The page switched to another finish without a new page load: the address now ends in another model of the same
  // family (Delta: /9190TL-DST.html -> /9190TL-PN-DST.html) while the product data still describes the first one.
  function staleFor(item, pageUrl) {
    const fromUrl = urlModel(pageUrl);
    const model = String(item.model || "").toUpperCase();
    if (!fromUrl || !model || fromUrl === model || String(pageUrl).toUpperCase().includes(model)) return "";
    let common = 0;
    while (common < Math.min(fromUrl.length, model.length) && fromUrl[common] === model[common]) common++;
    return common >= 4 ? fromUrl : "";
  }

  // An item from the page's text alone, when the page has no product data: it needs a model next to the name, or
  // a model in the address on a page that shows a price or calls itself a product.
  function fromPageText(page, meta, pageUrl) {
    const win = textWindow(page);
    if (!win) return [];
    const price = number(meta["product:price:amount"] || meta["og:price:amount"]) || pagePrice(win);
    const labeled = pageModel(win).value;
    const fromUrl = labeled ? "" : urlModel(pageUrl);
    // const looksLikeProduct = price != null || /product/i.test(meta["og:type"] || "");
    const looksLikeProduct = price != null || /^(og:)?product$/i.test(String(meta["og:type"] || "").trim()); // 1.5.3
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
    // return { items, selected: pickDefault(items, pageUrl) };
    // The finish the customer switched to wins over product data that still describes the first one: the model from
    // the address (or the "Model" label next to the name), the price the page shows now, and no color until known.
    if (items.length === 1) {
      const fresh = staleFor(items[0], pageUrl);
      if (fresh) {
        const win = textWindow(page);
        const labeled = pageModel(win);
        const livePrice = number(page && page.microdata && page.microdata.offers && page.microdata.offers.price) || pagePrice(win);
        items = [{
          ...items[0],
          model: labeled.isModel && labeled.value.toUpperCase() === fresh ? labeled.value : fresh,
          color: "",
          stale: true, // its name may still name the first finish: no finish guessed from it
          price: livePrice,
          priceIsList: false,
        }];
      }
    }
    // items = items.map(it => ({ ...it, collection: it.collection || guessCollection(it, page) }));
    items = items.map(it => ({ ...it, color: it.color || (it.stale ? "" : guessFinish(it.name)), collection: it.collection || guessCollection(it, page) }));
    return { items, selected: pickDefault(items, pageUrl), category: breadcrumbs(blocks, page) };
  }

  // 1.5.7 (Gib 11/6, "add a report issue button to the extension"): the panel's report, shaped like the Product Selector's
  // own Report Issue (POST /api/cases { subject, detail, employee }), which opens a NetSuite case for IT. What the
  // customer typed, the vendor page, what the panel read, the QuickAdd version and the browser; no customer details.
  // 1.5.9 (Gib 11/6, "The report an issue fields don't match the original report an issue"): the panel's form is now the
  // Product Selector's Report Issue window field for field (Issue, a brief summary, and Detail), so the case is built the
  // same way: the Issue is the case title as typed, the Detail is the description as typed, and the browser line is the
  // site's "<user agent> | viewport <w>x<h>" with the QuickAdd version after it. What the panel read follows the Detail
  // under "Sent from the Consumers QuickAdd panel." (the NetSuite email's QuickAdd marker); the form does not show it.
  // There is no "Reported by" line: the case is the signed-in rep's, as on the site.
  function issueReport(r) {
    const s = v => text(v).slice(0, 500);
    const issue = text(r && r.issue).slice(0, 300);
    const typed = String(r && r.detail || "").replace(/\r/g, "").trim().slice(0, 10000);
    if (!issue || !typed) return null;
    const fields = r.fields || {};
    const read = [["Type", fields.type], ["Model", fields.model], ["Color / finish", fields.color], ["Collection / Description", fields.description],
      ["List price", fields.price], ["Quantity", fields.quantity], ["Product line", fields.line]].filter(([, v]) => text(v)).map(([k, v]) => `${k}: ${s(v)}`);
    const parts = (Array.isArray(r.parts) ? r.parts : []).slice(0, 20).map((p, i) => `Part ${i + 1}: ${[p.model, p.type, p.color, p.description, p.price ? `$${p.price}` : ""].map(s).filter(Boolean).join(" | ")}`);
    const context = [
      "Sent from the Consumers QuickAdd panel.",
      `Vendor page: ${s(r.pageUrl)}`,
      `QuickAdd version: ${s(r.version)}`,
      r.message ? `Panel message: ${s(r.message)}` : "",
      "",
      read.length || parts.length ? "What the panel read:" : "The panel had nothing read.",
      ...read, ...parts,
    ].filter((line, i, a) => line !== "" || (a[i - 1] !== "" && i > 0)).join("\n");
    // The Product Selector takes at most 10,000 characters of detail: the typed Detail always fits, the panel's part is
    // cut to what is left.
    const room = 10000 - typed.length - 2;
    const detail = room > 40 ? `${typed}\n\n${context.slice(0, room)}` : typed;
    const viewport = r.viewport && r.viewport.width ? ` | viewport ${Math.round(r.viewport.width)}×${Math.round(r.viewport.height)}` : "";
    return {
      subject: issue, detail,
      pageUrl: String(r.pageUrl || "").slice(0, 2000),
      browserInfo: `${String(r.userAgent || r.browser || "")}${viewport} | QuickAdd ${s(r.version)}`.slice(0, 500),
    };
  }

  // 1.5.7 / 1.5.8 version (one "What went wrong?" box and an optional name). Kept for reference.
  function issueReport158(r) {
    const s = v => text(v).slice(0, 500);
    const what = String(r && r.text || "").replace(/\r/g, "").trim().slice(0, 4000);
    if (!what) return null;
    const domain = (() => { try { return registrableDomain(new URL(String(r.pageUrl)).hostname); } catch { return ""; } })();
    const first = what.split("\n")[0].slice(0, 120);
    const fields = r.fields || {};
    const read = [["Type", fields.type], ["Model", fields.model], ["Color / finish", fields.color], ["Collection / Description", fields.description],
      ["List price", fields.price], ["Quantity", fields.quantity], ["Product line", fields.line]].filter(([, v]) => text(v)).map(([k, v]) => `${k}: ${s(v)}`);
    const parts = (Array.isArray(r.parts) ? r.parts : []).slice(0, 20).map((p, i) => `Part ${i + 1}: ${[p.model, p.type, p.color, p.description, p.price ? `$${p.price}` : ""].map(s).filter(Boolean).join(" | ")}`);
    const detail = [
      what,
      "",
      "Sent from the Consumers QuickAdd panel.",
      r.reporter ? `Reported by: ${s(r.reporter)}` : "",
      `Vendor page: ${s(r.pageUrl)}`,
      `QuickAdd version: ${s(r.version)}`,
      // `Browser: ${s(r.browser)}`, // 1.5.8: the Product Selector adds the browser and the page itself
      r.message ? `Panel message: ${s(r.message)}` : "",
      "",
      read.length || parts.length ? "What the panel read:" : "The panel had nothing read.",
      ...read, ...parts,
    ].filter((line, i, a) => line !== "" || (a[i - 1] !== "" && i > 0)).join("\n");
    // return { subject: `QuickAdd issue (${domain || "vendor site"}): ${first}`.slice(0, 300), detail, employee: null };
    // 1.5.8: the Product Selector's Report Issue body (IssueReportInput); the background adds requestId and browserLogs.
    return { subject: `QuickAdd issue (${domain || "vendor site"}): ${first}`.slice(0, 300), detail: detail.slice(0, 9000),
      pageUrl: String(r.pageUrl || "").slice(0, 2000), browserInfo: `${s(r.browser)} (QuickAdd ${s(r.version)})`.slice(0, 500) };
  }

  const api = {
    extract, scanHtml, fromJsonLd, fromOpenGraph, fromPageText, fillGaps, blankItem, urlModel, labeledModels,
    registrableDomain, pickDefault, text, number, suggestType, printedPrice, breadcrumbs, guessFinish, collDesc,
    descName, discontinued, words, guessCollection, // 1.5.3
    issueReport, // 1.5.7
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ConsumersExtract = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
