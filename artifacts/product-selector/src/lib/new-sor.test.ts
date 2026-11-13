import { test } from "node:test";
import assert from "node:assert/strict";
import { createdSorMessage, newAttemptId, orderDigits, parsePendingSor } from "./new-sor";

test("order search input: SO number with or without the letters", () => {
  assert.equal(orderDigits("SO714729"), "714729");
  assert.equal(orderDigits("so 714 729"), "714729");
  assert.equal(orderDigits("714729"), "714729");
  assert.equal(orderDigits("#714"), "714");
  assert.equal(orderDigits("SOR61"), null);
  assert.equal(orderDigits("ES241894"), null);
  assert.equal(orderDigits(""), null);
});

test("attempt ids are accepted by the server's format", () => {
  const id = newAttemptId();
  assert.match(id, /^[A-Za-z0-9-]{16,64}$/);
  assert.notEqual(newAttemptId(), id);
});

test("success line", () => {
  assert.equal(createdSorMessage("SOR520", "SO714729", 3), "Created SOR520 on SO714729 with 3 items from your Quote List");
  assert.equal(createdSorMessage("SOR520", "SO714729", 1), "Created SOR520 on SO714729 with 1 item from your Quote List");
});

test("a kept Create is used only when it is whole and recent", () => {
  const now = 1_000_000_000_000;
  const p = { attemptId: "0f8fad5b-d9cb-469f-a165-70867728950e", soId: "6755848", soTranId: "SO712469", snapshot: [{ productId: 1 }], startedAt: now - 1000 };
  assert.deepEqual(parsePendingSor(JSON.stringify(p), now), p);
  assert.equal(parsePendingSor(JSON.stringify({ ...p, startedAt: now - 25 * 3600_000 }), now), null);
  assert.equal(parsePendingSor(JSON.stringify({ ...p, attemptId: "x" }), now), null);
  assert.equal(parsePendingSor(JSON.stringify({ ...p, soId: "SO1" }), now), null);
  assert.equal(parsePendingSor("nope", now), null);
});
