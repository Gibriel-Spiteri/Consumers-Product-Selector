// Consumers Quote Helper: reads a vendor product page's own product data (schema.org JSON-LD, then Open Graph).
// Pure functions with no DOM or extension APIs, so vendor.js uses them in the page and the tests run them in Node.
// Loaded as a classic content script before vendor.js; also require()-able.
(function (root) {
  "use strict";

  const MAX_TEXT = 300; // NetSuite Model / Coll/Desc / Color are Free-Form Text, 300 characters

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
    const model = text(o.mpn || o.sku || o.model || o.productID || (group && (group.productGroupID || group.sku)));
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

  // Every Product (and each ProductGroup variant) found in the page's JSON-LD blocks.
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
    for (const raw of blocks) {
      try {
        walk(JSON.parse(raw), null);
      } catch {
        // a malformed block is skipped; the others still count
      }
    }
    return items;
  }

  // Open Graph product tags, used only when the page has no JSON-LD product.
  function fromOpenGraph(meta, pageUrl) {
    const isProduct = /product/i.test(meta["og:type"] || "") || meta["og:price:amount"] || meta["product:price:amount"];
    if (!isProduct) return [];
    const name = text(meta["og:title"]).replace(/\s*\|.*$/, "");
    return [{
      name,
      model: text(meta["product:retailer_item_id"] || meta["product:mfr_part_no"] || ""),
      color: text(meta["product:color"] || ""),
      price: number(meta["product:price:amount"] || meta["og:price:amount"]),
      currency: text(meta["product:price:currency"] || meta["og:price:currency"]) || "USD",
      priceIsList: false,
      imageUrl: imageUrl(meta["og:image"], pageUrl),
    }].filter(i => i.name);
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

  // JSON-LD script bodies and meta tags from raw HTML (used when the live DOM has none, and in tests).
  function scanHtml(html) {
    const blocks = [];
    for (const m of String(html).matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) blocks.push(m[1]);
    const meta = {};
    for (const m of String(html).matchAll(/<meta\s+[^>]*>/gi)) {
      const tag = m[0];
      const key = (tag.match(/(?:property|name)=["']([^"']+)["']/i) || [])[1];
      const content = (tag.match(/content=["']([^"']*)["']/i) || [])[1];
      if (key && content != null && !(key in meta)) meta[key] = content;
    }
    return { blocks, meta };
  }

  function extract(blocks, meta, pageUrl) {
    const items = fromJsonLd(blocks, pageUrl);
    const all = items.length ? items : fromOpenGraph(meta || {}, pageUrl);
    return { items: all, selected: pickDefault(all, pageUrl) };
  }

  const api = { extract, scanHtml, fromJsonLd, fromOpenGraph, registrableDomain, pickDefault, text, number };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ConsumersExtract = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
