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

// ---- Sales Order Revisions (2026-11-09) ----
import { sorRefreshFailed, sorRefreshNote, sorRefreshRunning } from "./discount-refresh";

test("SOR refresh notes: totals with the change, the printed warning kept, failures say what to do", () => {
  assert.equal(sorRefreshRunning("SOR513").state, "running");
  const done = sorRefreshNote({ ok: true, newTotal: 2673.42, deltaTotal: 1551.76 }, "SOR513", null);
  assert.deepEqual(done, { state: "done", text: "SOR513 recalculated in NetSuite, discounts included. Proposed total $2,673.42 (+$1,551.76 vs the order)." });
  const down = sorRefreshNote({ ok: true, newTotal: 900, deltaTotal: -100.5 }, "SOR1", null);
  assert.match(down.text, /\(-\$100\.50 vs the order\)/);
  const printed = sorRefreshNote({ ok: true, newTotal: 10, deltaTotal: 1 }, "SOR1", "SOR1 was printed on 11/9/2026. Reprint it and have it signed again before Update Sales Order.");
  assert.equal(printed.state, "warn");
  assert.match(printed.text, /recalculated .* Reprint it/);
  assert.match(sorRefreshNote({ ok: false, error: "not draft" }, "SOR1", null).text, /did not recalculate SOR1 \(not draft\)\. Open it in NetSuite and press Next/);
  assert.match(sorRefreshFailed("SOR1", null, null).text, /may still finish/);
  for (const t of [done.text, printed.text, sorRefreshFailed("SOR1", "x.", "w").text]) assert.ok(!t.includes(String.fromCharCode(0x2014)));
});
