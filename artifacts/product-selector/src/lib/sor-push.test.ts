// node --import tsx --test artifacts/product-selector/src/lib/sor-push.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { sorDigits } from "./sor-push";

test("the SOR search box takes SOR or Sales Order numbers, like the server", () => {
  assert.equal(sorDigits("SOR230"), "230");
  assert.equal(sorDigits("sor 230"), "230");
  assert.equal(sorDigits("SO714882"), "714882");
  assert.equal(sorDigits("714882"), "714882");
  assert.equal(sorDigits("ES241850"), null);
  assert.equal(sorDigits(""), null);
});
