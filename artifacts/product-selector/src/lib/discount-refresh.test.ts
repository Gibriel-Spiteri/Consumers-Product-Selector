// node --import tsx --test artifacts/product-selector/src/lib/discount-refresh.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { discountNoteFor, discountRefreshFailed, discountRefreshRunning } from "./discount-refresh";

test("each engine outcome reads as staff words, with the estimate number", () => {
  assert.deepEqual(discountRefreshRunning("ES241850").state, "running");
  assert.equal(discountNoteFor({ status: "repriced", warning: null }, "ES241850").state, "done");
  assert.match(discountNoteFor({ status: "repriced" }, "ES241850").text, /^Discounts recalculated on ES241850/);
  assert.equal(discountNoteFor({ status: "saved" }, "ES241850").state, "done");
  assert.match(discountNoteFor({ status: "saved" }, "ES241850").text, /no line discounts to reprice/);
  assert.equal(discountNoteFor({ status: "notsaved" }, "ES241850").state, "warn");
  assert.equal(discountNoteFor({ status: "unknown" }, "ES241850").state, "warn");
  assert.equal(discountNoteFor({}, "ES241850").state, "warn");
});

test("the engine's own note wins and is shown as a warning", () => {
  const note = discountNoteFor({ status: "repriced", warning: "Discount BN26 was not applied: No eligible items for this discount." }, "ES241850");
  assert.equal(note.state, "warn");
  assert.equal(note.text, "Check the discounts on ES241850 in NetSuite: Discount BN26 was not applied: No eligible items for this discount.");
});

test("a failed refresh says what to do in NetSuite", () => {
  assert.match(discountRefreshFailed("ES241850", "NetSuite could not recalculate the discounts on this estimate.").text, /Apply All on its Discounts tab/);
  assert.match(discountRefreshFailed("ES241850", null).text, /may still finish/);
  for (const t of [discountRefreshRunning("ES1").text, discountRefreshFailed("ES1", null).text, discountNoteFor({ status: "saved" }, "ES1").text]) {
    assert.ok(!t.includes(String.fromCharCode(0x2014)), "no em dashes");
  }
});
