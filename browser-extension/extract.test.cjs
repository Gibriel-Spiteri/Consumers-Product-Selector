// node --test browser-extension/extract.test.cjs
// Fixtures follow the shapes Delta and Kohler product pages used on 2026-11-04.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const X = require("./consumers-quote-helper/extract.js");

const ld = obj => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

test("a single Product (Delta) gives model, color, price and image", () => {
  const html = ld({
    "@context": "https://schema.org", "@type": "Product", name: "Single Handle Pull-Down Kitchen Faucet",
    sku: "19867LF-CZ", mpn: "19867LF-CZ", color: "Champagne Bronze", image: ["https://www.deltafaucet.com/img/19867LF-CZ.png"],
    offers: { "@type": "Offer", priceCurrency: "USD", price: "449.00", url: "https://www.deltafaucet.com/kitchen/product/19867LF-CZ.html" },
  });
  const { blocks, meta } = X.scanHtml(html);
  const r = X.extract(blocks, meta, "https://www.deltafaucet.com/kitchen/product/19867LF-CZ.html");
  assert.equal(r.items.length, 1);
  assert.deepEqual(r.items[0], {
    name: "Single Handle Pull-Down Kitchen Faucet", model: "19867LF-CZ", color: "Champagne Bronze", price: 449,
    currency: "USD", priceIsList: false, imageUrl: "https://www.deltafaucet.com/img/19867LF-CZ.png",
  });
});

test("a ProductGroup (Kohler) gives one item per color, and the URL's model is preselected", () => {
  const variant = (sku, color) => ({ "@type": "Product", sku, color, image: [`https://kohler.scene7.com/${sku}`],
    offers: { "@type": "Offer", price: 523.99, priceCurrency: "USD" } });
  const html = ld({ "@type": "ProductGroup", name: "Cairn® 27-1/2\" undermount single-bowl kitchen sink", sku: "K-28000", productGroupID: "K-28000",
    variesBy: ["https://schema.org/color"], hasVariant: [variant("K-28000-CM1", "Matte Black"), variant("K-28000-CM6", "Matte White")] });
  const { blocks } = X.scanHtml(html);
  const r = X.extract(blocks, {}, "https://www.kohler.com/en/products/x?skuId=K-28000-CM6");
  assert.deepEqual(r.items.map(i => [i.model, i.color, i.price]), [["K-28000-CM1", "Matte Black", 523.99], ["K-28000-CM6", "Matte White", 523.99]]);
  assert.equal(r.items[0].name, "Cairn® 27-1/2\" undermount single-bowl kitchen sink");
  assert.equal(r.selected, 1);
});

test("a list price in priceSpecification wins over the selling price", () => {
  const r = X.extract([JSON.stringify({ "@type": "Product", name: "Faucet", sku: "F-1", offers: { price: "215.00",
    priceSpecification: [{ "@type": "UnitPriceSpecification", priceType: "https://schema.org/ListPrice", price: 449 }] } })], {}, "https://x.test/");
  assert.equal(r.items[0].price, 449);
  assert.equal(r.items[0].priceIsList, true);
});

test("@graph, malformed blocks and duplicates are handled", () => {
  const blocks = ["{not json", JSON.stringify({ "@graph": [{ "@type": "WebPage" }, { "@type": ["Product"], name: "Sink", sku: "S-1" }, { "@type": "Product", name: "Sink", sku: "S-1" }] })];
  const r = X.extract(blocks, {}, "https://x.test/");
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].model, "S-1");
});

test("Open Graph is the fallback when there is no JSON-LD product", () => {
  const html = '<meta property="og:type" content="product"><meta property="og:title" content="Cairn Sink | K-28000 | KOHLER">' +
    '<meta property="og:price:amount" content="523.99"><meta property="og:image" content="https://kohler.scene7.com/a.jpg">';
  const { blocks, meta } = X.scanHtml(html);
  const r = X.extract(blocks, meta, "https://www.kohler.com/p");
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].name, "Cairn Sink");
  assert.equal(r.items[0].price, 523.99);
});

test("non-product pages give nothing; text is cleaned and capped at 300 characters", () => {
  assert.equal(X.extract([JSON.stringify({ "@type": "Organization", name: "Delta" })], { "og:type": "website" }, "https://x.test/").items.length, 0);
  const r = X.extract([JSON.stringify({ "@type": "Product", name: "A\u0007 <b>bold</b>&amp; " + "x".repeat(400), sku: "M" })], {}, "https://x.test/");
  assert.ok(r.items[0].name.startsWith("A bold & x"));
  assert.equal(r.items[0].name.length, 300);
  assert.equal(X.extract([JSON.stringify({ "@type": "Product", name: "P", image: "http://insecure.test/a.png" })], {}, "https://x.test/").items[0].imageUrl, "");
});

test("vendor domains: subdomains count as the main domain", () => {
  assert.equal(X.registrableDomain("www.us.kohler.com"), "kohler.com");
  assert.equal(X.registrableDomain("craftandmain.com"), "craftandmain.com");
  assert.equal(X.registrableDomain("shop.vendor.co.uk"), "vendor.co.uk");
});
