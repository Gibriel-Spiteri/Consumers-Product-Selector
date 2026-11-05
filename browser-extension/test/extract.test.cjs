// node --test browser-extension/test/extract.test.cjs
// Fixtures follow the shapes Delta and Kohler product pages used on 2026-11-04.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const X = require("../consumers-quote-helper/extract.js");

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
    currency: "USD", priceIsList: false, imageUrl: "https://www.deltafaucet.com/img/19867LF-CZ.png", collection: "",
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

// The fixtures below follow the shapes of each vendor's product pages on 2026-11-04 (checked in Chrome).
const page = (head, body) => `<html><head>${head}</head><body><nav>Home Products</nav>${body}<footer>Contact us</footer></body></html>`;
const run = (html, url) => {
  const { blocks, meta, page: p } = X.scanHtml(html);
  return X.extract(blocks, meta, url, p);
};

test("Flusso: a UPC in mpn is skipped for the model in sku", () => {
  const r = X.extract([JSON.stringify({ "@type": "Product", name: "Hole In Glass Center Mount Glass Clamp", sku: "10.FGC.4003CP",
    model: "10.FGC.4003CP", mpn: "702338186523", color: "Chrome", offers: { price: 60, priceCurrency: "USD" } })], {}, "https://www.flussofaucets.com/products/10FGC4003CP/");
  assert.equal(r.items[0].model, "10.FGC.4003CP");
  assert.equal(r.items[0].price, 60);
  assert.equal(X.extract([JSON.stringify({ "@type": "Product", name: "X", gtin12: "1", mpn: "702338186523" })], {}, "https://x.test/").items[0].model, "702338186523");
});

test("Neptune: the full model number and the price come from the page when its product data has the base model only", () => {
  const html = page(ld({ "@type": "Product", name: "Monza 39 x 59 in. Pivot Tub Shield", sku: "220086", mpn: "220086" }),
    "<div>Monza 39 x 59 in. Pivot Tub Shield <a>Where to buy</a></div>" + "<p>Info Technical Specs</p>".repeat(30) +
    "<h1>Monza 39 x 59 in. Pivot Tub Shield</h1><p>INTERNET SKU: 220086</p><p>MODEL NUMBER: 220086-900-084-000</p>" +
    "<p>Frame Finish: Chrome</p><strong>MSRP* USD$ 1,253.00</strong><section>Related <b>MSRP* USD$ 1,834.00</b></section>");
  const r = run(html, "https://produitsneptune.com/product/monza/220086/220086-900-084-000");
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].model, "220086-900-084-000");
  assert.equal(r.items[0].price, 1253);
  // The longer page model is used only when the address confirms it.
  assert.equal(run(html, "https://produitsneptune.com/product/monza/220086").items[0].model, "220086");
});

test("TOTO: Open Graph product completed from the page text; add-on prices are skipped", () => {
  const html = page('<meta property="og:type" content="product"><meta property="og:title" content="Drake&reg; Two-piece Toilet, 1.28 GPF | TOTO USA">' +
    '<meta property="og:image" content="https://assets.totousa.com/CST776CEG/images/CST776CEG_01.webp">',
    '<h1 class="page-title">DRAKE&reg; TWO-PIECE TOILET, 1.28 GPF</h1><div>SKU: CST776CEG#01</div><div>MSRP LIST PRICE <span>$</span>445.00</div>' +
    "<ul><li>Sedona Beige [+$54.00]</li><li>Cotton [+$48.00]</li></ul>");
  const r = run(html, "https://www.totousa.com/drake-two-piece-128-gpf-elongated-bowl?color=cotton");
  assert.deepEqual([r.items[0].name, r.items[0].model, r.items[0].price], ["Drake® Two-piece Toilet, 1.28 GPF", "CST776CEG#01", 445]);
  assert.ok(r.items[0].imageUrl.startsWith("https://assets.totousa.com/"));
});

test("Top Knobs: microdata gives the model, Open Graph the price", () => {
  const html = page('<meta property="og:type" content="product"><meta property="og:title" content="Barrow Knob">' +
    '<meta property="product:price:amount" content="10.15"><meta property="product:price:currency" content="USD">',
    '<div itemscope itemtype="http://schema.org/Product"><h1 itemprop="name">Barrow Knob 1 1/4 Inch Brushed Satin Nickel</h1>' +
    '<div>Item Number <span itemprop="sku">TK1050BSN</span></div><span class="price">$10.15</span></div>');
  const r = run(html, "https://www.topknobs.com/barrow-knob.html?finish_tk=13603");
  assert.deepEqual([r.items[0].name, r.items[0].model, r.items[0].price], ["Barrow Knob 1 1/4 Inch Brushed Satin Nickel", "TK1050BSN", 10.15]);
});

test("Delta: with JSON-LD present, the page's microdata is not a second item", () => {
  const html = page(ld({ "@type": "Product", name: "Single Handle Pull-Down Kitchen Faucet", sku: "19867LF-CZ", offers: { price: 449 } }),
    '<div itemscope itemtype="https://schema.org/Product"><h1 itemprop="name">Single Handle Pull-Down Kitchen Faucet in Champagne Bronze</h1>' +
    '<meta itemprop="price" content="449"></div>');
  const r = run(html, "https://www.deltafaucet.com/kitchen/product/19867LF-CZ.html");
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].model, "19867LF-CZ");
});

test("Brizo and Elkay: the model at the end of the address on a product page", () => {
  const brizo = page('<meta property="og:type" content="productPage"><meta property="og:title" content="SENSORI&reg; THERMOSTATIC VALVE TRIM">',
    "<h1>Virage&reg;</h1><p>SENSORI&reg; THERMOSTATIC VALVE TRIM</p><p>Product(s) Shown: SENSORI THERMOSTATIC VALVE TRIM T66T030-PC $952.00</p>" +
    "<p>LIST PRICE AS SHOWN (US $): $1,451.00</p><p>ITEM DETAILS</p>");
  const b = run(brizo, "https://www.brizo.com/bath/product/T66T030-PC");
  assert.deepEqual([b.items[0].name, b.items[0].model, b.items[0].price], ["SENSORI® THERMOSTATIC VALVE TRIM", "T66T030-PC", 952]);
  const elkay = page('<meta property="og:type" content="product"><meta property="og:title" content="Crosstown 18 Gauge Undermount Sink">',
    "<h1>ECTRU24179RT</h1><p>Crosstown 18 Gauge Stainless Steel Single Bowl Undermount Sink</p><button>Show List Price</button>");
  const e = run(elkay, "https://www.elkay.com/products/sinks/materials/stainless-steel/ectru24179rt");
  assert.deepEqual([e.items[0].model, e.items[0].price], ["ECTRU24179RT", null]);
});

test("John Boos, Icera, Strategic Brands and Franke: no product data, the model label next to the name", () => {
  const boos = run(page('<meta property="og:title" content="Cherry Cucina D\'Amico Wine Cart">',
    "<p>BOOS BLOCKS&gt;CARTS</p><p>Model#: CHY-CUCD15WC</p><h1>Cherry Cucina D'Amico Wine Cart</h1><p>$2,878.00</p><p>WEIGHT 125 lb</p>"),
    "https://www.johnboos.com/products/cherry-cucina-damico-wine-cart");
  assert.deepEqual([boos.items[0].name, boos.items[0].model, boos.items[0].price], ["Cherry Cucina D'Amico Wine Cart", "CHY-CUCD15WC", 2878]);
  const icera = run(page("", "<h1>ANTIGUA Undermount Lavatory, 17&#8243;</h1><p>SKU: 1022.000.01 Category: Undermount Sinks</p><p>Gloss White $229.00</p>"),
    "https://icerabath.com/product/antigua-undermount-lavatory/");
  assert.deepEqual([icera.items[0].name, icera.items[0].model, icera.items[0].price], ["ANTIGUA Undermount Lavatory, 17″", "1022.000.01", 229]);
  const sbi = run(page("", "<h1>1 1/4\" Knob - Precision - Polished Nickel</h1><p>Part Number 85414</p><p>Please log in to order products.</p>"),
    "https://strategicbrandsincorporated.com/85414/1-1-4-knob-precision-polished-nickel");
  assert.deepEqual([sbi.items[0].model, sbi.items[0].price], ["85414", null]);
  const franke = run(page('<meta property="og:type" content="website"><meta property="og:title" content="Mythos Masterpiece Pull-Down, MMX-PD-CPR">',
    "<h1>Mythos Masterpiece Pull-Down, MMX-PD-CPR</h1><p>Article Number 115.0731.726</p><p>Product finish Copper</p>"),
    "https://www.franke.com/us/en/home-solutions/products/kitchen-faucets/product-detail-page.html/115.0731.726.html");
  assert.deepEqual([franke.items[0].name, franke.items[0].model], ["Mythos Masterpiece Pull-Down, MMX-PD-CPR", "115.0731.726"]);
});

test("pages without a product give nothing: no heading, words in the address, labels without a number", () => {
  assert.equal(run(page('<meta property="og:title" content="Avance Cabinetry | Benton Bourbon">', "<p>DOOR: SHAKER FINISH: LIGHT BROWN STAIN</p>"),
    "https://www.avancecabinetry.com/cabinetry/benton/benton-bourbon-kitchen").items.length, 0);
  assert.equal(run(page("", "<h1>Knobs</h1><p>ITEM DETAILS</p><p>200 item(s) found</p>"),
    "https://strategicbrandsincorporated.com/category/Knobs/knobs").items.length, 0);
  assert.equal(run(page("", "<h1>Kitchen Sinks</h1><p>From $199.00</p>"), "https://www.franke.com/us/en/kitchen-sinks.html").items.length, 0);
  assert.equal(X.urlModel("https://strategicbrandsincorporated.com/85414/1-1-4-knob-precision-polished-nickel"), "");
  assert.equal(X.urlModel("https://www.topknobs.com/barrow-knob.html"), "");
  assert.equal(X.urlModel("https://www.richelieu.com/us/en/x/1166124/sku-BP56325128195"), "BP56325128195");
  assert.equal(X.urlModel("https://www.deltafaucet.com/kitchen/product/19867LF-CZ.html"), "19867LF-CZ");
});

test("the blank item for pages with nothing to read keeps the page's name", () => {
  const blank = X.blankItem({ "og:title": "Avance Cabinetry | Benton Bourbon | Shaker Light Brown Cabinets", "og:image": "https://static.wixstatic.com/a.jpg" },
    { heading: "", text: "" }, "ignored", "https://www.avancecabinetry.com/cabinetry/benton/benton-bourbon");
  assert.equal(blank.name, "Avance Cabinetry | Benton Bourbon | Shaker Light Brown Cabinets");
  assert.equal(blank.model, "");
  assert.equal(blank.imageUrl, "https://static.wixstatic.com/a.jpg");
  assert.equal(X.blankItem({}, { heading: "Horizon In-line" }, "Horizon | Fleurco").name, "Horizon In-line");
});

// 1.3.0: the finish the customer switched to, and the special-order fields (Type, Collection, Description).
test("Delta: after a finish change the address and the live page win over the first finish's product data", () => {
  const blocks = [JSON.stringify({ "@type": "Product", name: "Touch<sub>2</sub>O® Technology Kitchen Faucet with Touchless Technology",
    sku: "9190TL-DST", mpn: "9190TL-DST", category: "Pull-Down", offers: { price: "999.00", priceCurrency: "USD" } })];
  const first = X.extract(blocks, {}, "https://www.deltafaucet.com/kitchen/product/9190TL-DST.html", { heading: "", text: "", microdata: null });
  assert.deepEqual([first.items[0].name, first.items[0].model, first.items[0].price], ["Touch2O® Technology Kitchen Faucet with Touchless Technology", "9190TL-DST", 999]);
  const page = { heading: "", text: "", microdata: { "@type": "Product", offers: { price: "1242.00" } } };
  const after = X.extract(blocks, {}, "https://www.deltafaucet.com/kitchen/product/9190TL-PN-DST.html", page);
  assert.deepEqual([after.items[0].model, after.items[0].price, after.items[0].color], ["9190TL-PN-DST", 1242, ""]);
  // An unrelated address is not a finish change.
  assert.equal(X.extract(blocks, {}, "https://www.deltafaucet.com/kitchen/product/B1234-XX.html", page).items[0].model, "9190TL-DST");
});

test("a price with its cents in superscript reads as dollars and cents", () => {
  assert.equal(X.printedPrice("1,24200"), 1242);
  assert.equal(X.printedPrice("2,878.00"), 2878);
  assert.equal(X.printedPrice("445"), 445);
});

test("collection: a short heading above the name, or the trademarked first word of the name", () => {
  const brizo = X.extract([], { "og:type": "productPage", "og:title": "SENSORI® THERMOSTATIC VALVE TRIM" }, "https://www.brizo.com/bath/product/T66T030-PC",
    { heading: "Virage®", text: "Virage® SENSORI® THERMOSTATIC VALVE TRIM T66T030-PC $952.00" });
  assert.equal(brizo.items[0].collection, "Virage");
  const kohler = X.extract([JSON.stringify({ "@type": "Product", name: "Cairn® 27-1/2\" undermount single-bowl kitchen sink", sku: "K-28000-CM6" })], {}, "https://www.kohler.com/x");
  assert.equal(kohler.items[0].collection, "Cairn");
  const plain = X.extract([JSON.stringify({ "@type": "Product", name: "Barrow Knob 1 1/4 Inch", sku: "TK1050BSN" })], {}, "https://www.topknobs.com/x");
  assert.equal(plain.items[0].collection, "");
});

test("breadcrumbs and the Type guess the panel preselects", () => {
  const crumbs = JSON.stringify({ "@type": "BreadcrumbList", itemListElement: [{ name: "Home" }, { name: "Kitchen" }, { name: "Sink Faucets" }, { name: "Pull-Down" }] });
  const r = X.extract([crumbs, JSON.stringify({ "@type": "Product", name: "Touch2O Technology Kitchen Faucet", sku: "9190TL-DST" })], {}, "https://www.deltafaucet.com/kitchen/product/9190TL-DST.html");
  assert.equal(r.category, "Kitchen / Sink Faucets / Pull-Down");
  assert.equal(X.breadcrumbs([], { crumbs: ["Kitchen", "Sink Faucets", "Pull-Down", "Kitchen"] }), "Kitchen / Sink Faucets / Pull-Down");
  const delta = ["BATH FAUCET", "KITCHEN FAUCET", "KITCHEN SINK", "MISCELLANEOUS", "ROUGH"].map((name, i) => ({ id: String(i + 1), name, requiresAttachment: false }));
  assert.equal(X.suggestType({ name: "Touch2O Technology Kitchen Faucet", pageUrl: "https://www.deltafaucet.com/kitchen/product/9190TL-DST.html", category: r.category }, delta).name, "KITCHEN FAUCET");
  assert.equal(X.suggestType({ name: "Undermount Sink", pageUrl: "https://x.test/sinks/a1", category: "" }, [
    { id: "1", name: "KITCHEN SINK", requiresAttachment: false }, { id: "2", name: "BATH SINK", requiresAttachment: false }]), null);
  assert.equal(X.suggestType({ name: "Soaker tub", pageUrl: "https://x.test/", category: "" }, [{ id: "1", name: "SOAKER", requiresAttachment: true }]), null);
  // The Type's main noun must be there: a shower door is not a SHOWER BASE (Neptune, 11/5).
  assert.equal(X.suggestType({ name: "Belaya 6mm Pivot Shower Door", pageUrl: "https://produitsneptune.com/product/belaya/220333", category: "" },
    ["ACCESSORIES", "FAUCETS", "FREE STANDING TUB", "SHOWER BASE", "TUB"].map((name, i) => ({ id: String(i), name, requiresAttachment: false }))), null);
  // "Bathroom" is the Types' "BATH" (Delta 35442, 11/5).
  assert.equal(X.suggestType({ name: "Two Handle Widespread Bathroom Faucet", pageUrl: "https://www.deltafaucet.com/bathroom/product/35442-MPU-DST.html", category: "Bathroom / Sink Faucets / Widespread" }, delta).name, "BATH FAUCET");
});

test("a finish at the end of the product name fills an empty color (Jim, 11/5)", () => {
  assert.equal(X.guessFinish("128mm Austin Pull - Satin Nickel"), "Satin Nickel");
  assert.equal(X.guessFinish("1 1/4\" Knob - Precision - Polished Nickel"), "Polished Nickel");
  assert.equal(X.guessFinish("Barrow Knob 1 1/4 Inch Brushed Satin Nickel"), "Brushed Satin Nickel");
  assert.equal(X.guessFinish("Monza Pivot Tub Shield with Clear glass in Chrome"), "Chrome");
  assert.equal(X.guessFinish("Drake® Two-piece Toilet, 1.28 GPF, Elongated Bowl"), "");
  assert.equal(X.guessFinish("Crosstown 18 Gauge Stainless Steel Single Bowl Undermount Sink"), "");
  assert.equal(X.guessFinish("Antigua Undermount Lavatory Matte"), "");
  const r = X.extract([JSON.stringify({ "@type": "Product", name: "Barrow Knob 1 1/4 Inch Brushed Satin Nickel", sku: "TK1050BSN" })], {}, "https://www.topknobs.com/x");
  assert.equal(r.items[0].color, "Brushed Satin Nickel");
  // A color the product data gives is kept.
  assert.equal(X.extract([JSON.stringify({ "@type": "Product", name: "Knob in Chrome", sku: "K1", color: "Matte Black" })], {}, "https://x.test/").items[0].color, "Matte Black");
});

test("vendor domains: subdomains count as the main domain", () => {
  assert.equal(X.registrableDomain("www.us.kohler.com"), "kohler.com");
  assert.equal(X.registrableDomain("craftandmain.com"), "craftandmain.com");
  assert.equal(X.registrableDomain("shop.vendor.co.uk"), "vendor.co.uk");
});
