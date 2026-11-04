// node --import tsx --test artifacts/product-selector/src/lib/vendor-picks.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { SpecialOrderProductLine } from "@workspace/api-client-react";
import { parsePicksMessage, prefillFromPick, productLinesForPick, registrableDomain, vendorSites } from "./vendor-picks";

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
