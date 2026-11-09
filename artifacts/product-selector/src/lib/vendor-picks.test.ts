// node --import tsx --test artifacts/product-selector/src/lib/vendor-picks.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { SpecialOrderProductLine } from "@workspace/api-client-react";
import { collDesc, missingDetails, parsePicksMessage, prefillFromPick, productLineForPick, productLinesForPick, quoteInputFromPick, registrableDomain, suggestType, vendorSites } from "./vendor-picks";

const line = (id: string, name: string, websiteUrl: string | null): SpecialOrderProductLine => ({
  id, name, netsuiteItemId: `item-${id}`, sku: `SP-${name}`, websiteUrl, categories: [], costMultiplier: 1, retailMultiplier: 1, crdMultiplier: 1,
});
const lines = [
  line("88", "DELTA", "https://www.deltafaucet.com/"),
  line("808", "KOHLER", "https://www.us.kohler.com/us/"),
  line("699", "FOREMOST BATH", "https://craftandmain.com/"),
  line("383", "FOREMOST T&S DOORS", "https://craftandmain.com/"),
  line("1", "NO SITE", null),
];
const pick = {
  id: "5d8c1f8e-1d9b-4a63-9f43-0d6a3c2b1a77", pickedAt: "2026-11-04T15:00:00.000Z",
  pageUrl: "https://www.kohler.com/en/products/x", vendorDomain: "kohler.com",
  name: "Cairn sink", model: "K-28000-CM6", color: "Matte White", price: 523.99, imageUrl: "https://kohler.scene7.com/a", quantity: 2,
};
const msg = (picks: unknown) => ({ source: "consumers-quote-helper", type: "vendor-picks", picks });

test("only well-formed picks from the extension are accepted", () => {
  assert.equal(parsePicksMessage({ source: "someone-else", type: "vendor-picks", picks: [pick] }), null);
  assert.equal(parsePicksMessage(msg("nope")), null);
  assert.deepEqual(parsePicksMessage(msg([pick])), [pick]);
  const bad = [
    { ...pick, id: "x" },
    { ...pick, pageUrl: "javascript:alert(1)" },
    { ...pick, name: "", model: "" },
  ];
  assert.deepEqual(parsePicksMessage(msg(bad)), []);
  const [fixed] = parsePicksMessage(msg([{ ...pick, price: -5, quantity: 0, imageUrl: "http://x.test/a", name: "A\u0000B".padEnd(400, "x") }]))!;
  assert.equal(fixed.price, null);
  assert.equal(fixed.quantity, 1);
  assert.equal(fixed.imageUrl, "");
  assert.equal(fixed.name.length, 300);
  assert.ok(fixed.name.startsWith("A B"));
});

test("explicit visit provenance survives parsing, auto-add and manual product-line selection", () => {
  const [parsed] = parsePicksMessage(msg([{ ...pick, visitId: "visit-12345678" }]))!;
  assert.equal(parsed.visitId, "visit-12345678");
  assert.equal(quoteInputFromPick(parsed, lines[1], []).vendorPick?.visitId, "visit-12345678");
  assert.equal(prefillFromPick(parsed, lines).vendorPick?.id, pick.id);
  assert.equal(prefillFromPick(parsed, lines).vendorPick?.visitId, "visit-12345678");
  const [invalid] = parsePicksMessage(msg([{ ...pick, visitId: "<bad>" }]))!;
  assert.equal(invalid.visitId, undefined);
});

test("a pick is matched to product lines by the vendor's main domain", () => {
  assert.equal(registrableDomain("www.us.kohler.com"), "kohler.com");
  assert.deepEqual(productLinesForPick(pick, lines).map(l => l.name), ["KOHLER"]);
  const foremost = { ...pick, vendorDomain: "craftandmain.com" };
  assert.deepEqual(productLinesForPick(foremost, lines).map(l => l.name), ["FOREMOST BATH", "FOREMOST T&S DOORS"]);
});

test("the prefill sets the product line only when one line matches", () => {
  const p = prefillFromPick(pick, lines);
  assert.equal(p.netsuiteItemId, "item-808");
  assert.equal(p.model, "K-28000-CM6");
  assert.equal(p.description, "Cairn sink");
  assert.equal(p.color, "Matte White");
  assert.equal(p.listPrice, 523.99);
  assert.equal(p.quantity, 2);
  const two = prefillFromPick({ ...pick, vendorDomain: "craftandmain.com" }, lines);
  assert.equal(two.netsuiteItemId, undefined);
  assert.deepEqual(two.candidateNames, ["FOREMOST BATH", "FOREMOST T&S DOORS"]);
});

test("the extension is told every product line's website", () => {
  assert.deepEqual(vendorSites(lines).map(s => s.websiteUrl), [
    "https://www.deltafaucet.com/", "https://www.us.kohler.com/us/", "https://craftandmain.com/", "https://craftandmain.com/",
  ]);
});

// Picks go straight onto the quote list (2026-11-04). Type names are the product lines' real NetSuite Types.
const types = (...names: string[]) => names.map((name, i) => ({ id: String(i + 1), name: name.replace(/\*$/, ""), requiresAttachment: name.endsWith("*") }));
const DELTA = types("BATH ACCESSORY", "BATH FAUCET", "DIVERTER", "HANDSHOWER", "KITCHEN FAUCET", "MISCELLANEOUS", "ROUGH", "SHOWERHEAD", "TRIP LEVER", "TUB / SHOWER FAUCET", "TUB FILLER");
const KOHLER = types("ACCESSORY", "BATH FAUCET", "BATH SINK", "KITCHEN FAUCET", "KITCHEN SINK", "MEDICINE CABINET", "SHOWER BASE", "TOILET", "TUB");
const TOTO = types("BATH FAUCET", "BATH SINK", "BIDET", "KITCHEN FAUCET", "MISCELLANEOUS", "SOAKER*", "TOILET", "WHIRLPOOL*");
const TOP_KNOBS = types("BACKPLATES", "KNOBS", "MISCELLANEOUS", "PULLS");
const RICHELIEU = types("KNOB", "MISC", "PULL", "SCREWS");
const FLEURCO = types("BATH TUB", "MIRROR", "MISCELLANEOUS", "SHOWER BASE", "SHOWER DOOR", "SHOWER WALL", "TOWEL BAR", "TUB DOOR");
const ELKAY = types("BATH FAUCET", "BATH SINK", "KITCHEN FAUCET", "KITCHEN SINK", "MISCELLANEOUS");
const BRIZO = types("BATH - LAVATORY FAUCET", "KITCHEN - KITCHEN FAUCET", "SHOWER SYSTEM - VALVE ROUGH", "SHOWER SYSTEM - VALVE TRIM", "SHOWER SYSTEM - DIVERTER/VOLUME CONTROL TRIM", "SHOWER SYSTEM - HANDSHOWER");
const guess = (name: string, pageUrl: string, list: ReturnType<typeof types>) => suggestType({ name, pageUrl }, list)?.name ?? null;

test("the Type is suggested from the product name and the vendor's address", () => {
  assert.equal(guess("Single Handle Pull-Down Kitchen Faucet", "https://www.deltafaucet.com/kitchen/product/19867LF-CZ.html", DELTA), "KITCHEN FAUCET");
  assert.equal(guess("Cairn 27-1/2\" undermount single-bowl kitchen sink", "https://www.kohler.com/en/products/kitchen-sinks/shop-kitchen-sinks/cairn-28000", KOHLER), "KITCHEN SINK");
  assert.equal(guess("Drake Two-piece Toilet, 1.28 GPF, Elongated Bowl", "https://www.totousa.com/drake-two-piece-128-gpf-elongated-bowl", TOTO), "TOILET");
  assert.equal(guess("Barrow Knob 1 1/4 Inch Brushed Satin Nickel", "https://www.topknobs.com/barrow-knob.html", TOP_KNOBS), "KNOBS");
  // The address also says "pulls-and-knobs"; the name decides.
  assert.equal(guess("Modern Metal Pull - 5632", "https://www.richelieu.com/us/en/category/decorative-hardware/cabinet-hardware-pulls-and-knobs/pulls/contemporary-metal-pull-5632/1166124/sku-BP56325128195", RICHELIEU), "PULL");
  assert.equal(guess("Horizon, Clear Glass (8mm)", "https://fleurco.com/shower-doors/horizon-sliding-inline", FLEURCO), "SHOWER DOOR");
  assert.equal(guess("SENSORI THERMOSTATIC VALVE TRIM", "https://www.brizo.com/bath/product/T66T030-PC", BRIZO), "SHOWER SYSTEM - VALVE TRIM");
});

test("no Type is guessed on a tie, for order-form Types or MISCELLANEOUS", () => {
  assert.equal(guess("Crosstown 18 Gauge Single Bowl Undermount Sink", "https://www.elkay.com/products/sinks/materials/stainless-steel/ectru24179rt", ELKAY), null);
  assert.equal(guess("Nexus Soaker Tub", "https://www.totousa.com/soaker", TOTO), null);
  assert.equal(guess("Miscellaneous part", "https://www.topknobs.com/x", TOP_KNOBS), null);
  assert.equal(guess("Benton Bourbon", "https://www.avancecabinetry.com/cabinetry/benton/benton-bourbon-kitchen", KOHLER), null);
});

test("11/7 (case 143567): a repair part that no Type fits is MISCELLANEOUS; one that fits keeps its Type", () => {
  assert.equal(guess("Flange - Shower", "https://www.deltafaucet.com/parts/product/RP52144.html", DELTA), "MISCELLANEOUS");
  assert.equal(suggestType({ name: "Flange - Shower", pageUrl: "https://www.deltafaucet.com/x/RP52144.html", category: "Parts / Repair Parts" }, DELTA)?.name, "MISCELLANEOUS");
  assert.equal(guess("Diverter", "https://www.deltafaucet.com/parts/product/RP12345.html", DELTA), "DIVERTER");
  assert.equal(guess("Flange - Shower", "https://www.deltafaucet.com/bathroom/product/x.html", DELTA), null);
  assert.equal(guess("Flange - Shower", "https://www.kohler.com/parts/x", KOHLER), null); // no MISCELLANEOUS Type: none
});

test("a pick becomes a quote-list line, with what the vendor page left out marked as missing", () => {
  const delta = line("88", "DELTA", "https://www.deltafaucet.com/");
  const input = quoteInputFromPick({ ...pick, vendorDomain: "deltafaucet.com", pageUrl: "https://www.deltafaucet.com/kitchen/product/9190TL-DST.html",
    name: "Touch2O Kitchen Faucet with Touchless Technology", model: "9190TL-DST", color: "Chrome", price: 999, quantity: 1 }, delta, DELTA);
  assert.equal(input.netsuiteId, "item-88");
  assert.equal(input.priceBasis, "retail");
  assert.deepEqual(input.details, { productLineId: "88", productLineName: "DELTA", typeId: "5", typeName: "KITCHEN FAUCET",
    model: "9190TL-DST", description: "Touch2O Kitchen Faucet with Touchless Technology", color: "Chrome", listPrice: 999 });
  assert.deepEqual(missingDetails({ specialOrder: input.details, vendorPick: input.vendorPick }), []);

  const elkay = quoteInputFromPick({ ...pick, vendorDomain: "elkay.com", pageUrl: "https://www.elkay.com/products/sinks/ectru24179rt",
    name: "Crosstown Undermount Sink", model: "ECTRU24179RT", color: "", price: null }, line("9", "ELKAY", "https://www.elkay.com/"), ELKAY);
  assert.equal(elkay.details.listPrice, 0);
  assert.deepEqual(missingDetails({ specialOrder: elkay.details, vendorPick: elkay.vendorPick }), ["Type", "Color", "List price"]);
  // Once the rep saves the line, the price is no longer missing.
  assert.deepEqual(missingDetails({ specialOrder: { ...elkay.details, typeId: "4", color: "Stainless" }, vendorPick: { ...elkay.vendorPick!, priceMissing: false } }), []);
  // Lines typed in by the rep never count as missing anything.
  assert.deepEqual(missingDetails({}), []);
});

// 1.3.0: the extension sends the Type, product line, Collection and Description chosen on the vendor page.
test("the Type and product line chosen in the extension are used; Collection and Description make Coll/Desc", () => {
  const foremost = [line("699", "FOREMOST BATH", "https://craftandmain.com/"), line("383", "FOREMOST T&S DOORS", "https://craftandmain.com/")];
  const fpick = { ...pick, vendorDomain: "craftandmain.com", pageUrl: "https://craftandmain.com/p/1" };
  assert.equal(productLineForPick(fpick, foremost), null);
  assert.equal(productLineForPick({ ...fpick, productLineId: "383" }, foremost)?.name, "FOREMOST T&S DOORS");
  assert.equal(productLineForPick({ ...fpick, productLineId: "88" }, foremost), null); // not one of this site's lines

  const delta = line("88", "DELTA", "https://www.deltafaucet.com/");
  const dpick = { ...pick, vendorDomain: "deltafaucet.com", pageUrl: "https://www.deltafaucet.com/kitchen/product/9190TL-PN-DST.html",
    name: "Touch2O® Technology Kitchen Faucet with Touchless Technology", model: "9190TL-PN-DST", color: "Polished Nickel", price: 1242,
    typeId: "2", typeName: "BATH FAUCET", collection: "Broderick", description: "Touch2O® Technology Kitchen Faucet with Touchless Technology" };
  const input = quoteInputFromPick(dpick, delta, DELTA);
  assert.equal(input.details.typeName, "BATH FAUCET"); // the customer's choice wins over the guess
  assert.equal(input.details.description, "Broderick Touch2O® Technology Kitchen Faucet with Touchless Technology");
  // A Type id that is not one of the line's falls back to the guess.
  assert.equal(quoteInputFromPick({ ...dpick, typeId: "999" }, delta, DELTA).details.typeName, "KITCHEN FAUCET");
  // 11/5 (extension 1.5.3): an order-form Type chosen in the panel is kept (the push sends "Per Attached Order Form").
  const toto = line("118", "TOTO FIXTURES", "https://www.totousa.com/");
  const soak = quoteInputFromPick({ ...pick, vendorDomain: "totousa.com", pageUrl: "https://www.totousa.com/flotation-tub",
    name: "Flotation Tub with Zero Dimension", model: "ABY994#01", color: "Cotton", price: 9000, typeId: "6", typeName: "SOAKER" }, toto, TOTO);
  assert.deepEqual([soak.details.typeId, soak.details.typeName, soak.details.model], ["6", "SOAKER", "ABY994#01"]);
  assert.equal(collDesc("Cairn®", "Cairn 27-1/2\" undermount single-bowl kitchen sink"), "Cairn 27-1/2\" undermount single-bowl kitchen sink");
  assert.equal(collDesc("", "Drake Two-piece Toilet"), "Drake Two-piece Toilet");
  assert.equal(collDesc("Austin", "128mm Austin Pull - Satin Nickel"), "128mm Austin Pull - Satin Nickel");
  // Extension 1.4.1 sends the one Coll/Desc value with an empty collection: used as is.
  assert.equal(quoteInputFromPick({ ...dpick, collection: undefined, description: "Altado Two Handle Widespread Bathroom Faucet" }, delta, DELTA).details.description,
    "Altado Two Handle Widespread Bathroom Faucet");
  // The breadcrumbs help the guess: "Pull-Down" alone in the name, "Kitchen / Sink Faucets" in the crumbs.
  assert.equal(suggestType({ name: "Broderick Pull-Down", pageUrl: "https://www.deltafaucet.com/p/9190TL-DST.html", category: "Kitchen / Sink Faucets / Pull-Down" }, DELTA)?.name, "KITCHEN FAUCET");
});

test("the new pick fields are taken only when well-formed", () => {
  const raw = { ...pick, productLineId: "88", typeId: "5", typeName: "KITCHEN FAUCET", collection: "Broderick", description: "Faucet", category: "Kitchen" };
  const [p] = parsePicksMessage(msg([raw]))!;
  assert.deepEqual([p.productLineId, p.typeId, p.typeName, p.collection, p.description, p.category], ["88", "5", "KITCHEN FAUCET", "Broderick", "Faucet", "Kitchen"]);
  const [q] = parsePicksMessage(msg([{ ...raw, productLineId: "88; drop", typeId: "<b>", collection: 7 }]))!;
  assert.deepEqual([q.productLineId, q.typeId, q.collection], [undefined, undefined, undefined]);
  assert.deepEqual(vendorSites([{ ...line("88", "DELTA", "https://www.deltafaucet.com/"), types: [{ id: "5", name: "KITCHEN FAUCET", requiresAttachment: false }] }])[0].types,
    [{ id: "5", name: "KITCHEN FAUCET", requiresAttachment: false }]);
});
