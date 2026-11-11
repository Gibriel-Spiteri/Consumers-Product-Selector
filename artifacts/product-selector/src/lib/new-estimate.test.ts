import { test } from "node:test";
import assert from "node:assert/strict";
import { createdMessage, parsePending, popupFeatures, readEstimateCreatedMessage } from "./new-estimate";

const expected = { origin: "https://1212804.app.netsuite.com", token: "A".repeat(43) };
const good = { source: "consumers-netsuite", type: "cps-estimate-created", token: "A".repeat(43), estimateId: "4242", tranId: "ES241900" };

test("the pop-up's message counts only from NetSuite's origin, for this hand-off", () => {
  assert.deepEqual(readEstimateCreatedMessage({ origin: expected.origin, data: good }, expected), { estimateId: "4242", tranId: "ES241900" });
  assert.equal(readEstimateCreatedMessage({ origin: "https://evil.example", data: good }, expected), null);
  assert.equal(readEstimateCreatedMessage({ origin: "https://1212804-sb1.app.netsuite.com", data: good }, expected), null);
  assert.equal(readEstimateCreatedMessage({ origin: expected.origin, data: { ...good, token: "B".repeat(43) } }, expected), null);
  assert.equal(readEstimateCreatedMessage({ origin: expected.origin, data: { ...good, type: "other" } }, expected), null);
  assert.equal(readEstimateCreatedMessage({ origin: expected.origin, data: { ...good, estimateId: "1 OR 1=1" } }, expected), null);
  assert.equal(readEstimateCreatedMessage({ origin: expected.origin, data: "cps-estimate-created" }, expected), null);
  assert.equal(readEstimateCreatedMessage({ origin: "", data: good }, { ...expected, origin: "" }), null);
});

test("pop-up size fits small screens and is centered", () => {
  assert.equal(popupFeatures(1920, 1080), "popup=yes,width=1100,height=900,left=410,top=90,resizable=yes,scrollbars=yes");
  assert.match(popupFeatures(800, 600), /width=720,height=500/);
});

test("a kept hand-off is used only when it is whole and recent", () => {
  const now = 1_000_000_000_000;
  const p = { token: "A".repeat(43), netsuiteOrigin: expected.origin, snapshot: [{ productId: 1 }], skipped: [], startedAt: now - 60_000 };
  assert.deepEqual(parsePending(JSON.stringify(p), now), p);
  assert.equal(parsePending(JSON.stringify({ ...p, startedAt: now - 25 * 3600_000 }), now), null);
  assert.equal(parsePending(JSON.stringify({ ...p, token: "short" }), now), null);
  assert.equal(parsePending(JSON.stringify({ ...p, snapshot: "x" }), now), null);
  assert.equal(parsePending("{not json", now), null);
  assert.equal(parsePending(null, now), null);
});

test("success line", () => {
  assert.equal(createdMessage("ES241900", "Jane Smith", 3), "Created estimate ES241900 for Jane Smith with 3 items from your Quote List");
  assert.equal(createdMessage("ES241900", "", 1), "Created estimate ES241900 with 1 item from your Quote List");
});
