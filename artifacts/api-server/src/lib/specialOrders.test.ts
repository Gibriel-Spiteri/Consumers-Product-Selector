import { test } from "node:test";
import assert from "node:assert/strict";
import type { SpecialOrderDetails } from "@workspace/api-zod";
import { EstimateItemsSchema as AddEstimateItemsBody, positiveId, specialOrderLine, SpecialOrderValidationError } from "./specialOrders";

const productLine = { id: "88", name: "DELTA", netsuiteItemId: "81317", sku: "SP-DELTA" };
const type = { id: "3071", name: "BATH FAUCET", requiresAttachment: false, classId: "20" };
const details: SpecialOrderDetails = {
  productLineId: "88", productLineName: "DELTA", typeId: "3071", typeName: "BATH FAUCET",
  model: "  TEST-MODEL ", description: " Test collection ", color: " Chrome ", listPrice: 123.45,
};

test("special-order fields map to their NetSuite columns, preserving manually entered list price", () => {
  const line = specialOrderLine("81317", 3, details, productLine, type);
  assert.deepEqual(line, {
    item: { id: "81317" }, quantity: 3,
    custcol_specord_prodline: { id: "88" },
    custcol_specord_type: { id: "3071" },
    custcol_specord_class: { id: "20" },
    custcol_specord_model: "TEST-MODEL",
    custcol_specord_style: "Test collection",
    custcol_specord_color: "Chrome",
    custcol_list_selling_rate: 123.45,
    custcol_list_selling_amt: 370.35,
  });
  assert.equal("rate" in line, false, "List price must not replace selling rate");
  assert.equal("price" in line, false, "Leave NetSuite price level sourcing intact");
});

test("model/color variants sharing one SP item remain distinct lines", () => {
  const a = specialOrderLine("81317", 1, details, productLine, type);
  const b = specialOrderLine("81317", 2, { ...details, model: "OTHER", color: "Black" }, productLine, type);
  assert.equal(a.item.id, b.item.id);
  assert.notEqual(a.custcol_specord_model, b.custcol_specord_model);
  assert.notEqual(a.custcol_specord_color, b.custcol_specord_color);
});

test("membership mismatches and blank specifications are rejected", () => {
  for (const input of [
    { ...details, productLineId: "99" }, { ...details, typeId: "99" },
    { ...details, model: "   " }, { ...details, description: "\n" }, { ...details, color: "" },
  ]) {
    assert.throws(() => specialOrderLine("81317", 1, input, productLine, type), SpecialOrderValidationError);
  }
  assert.throws(() => specialOrderLine("999", 1, details, productLine, type), SpecialOrderValidationError);
});

test("no type class is invented when NetSuite has none", () => {
  const line = specialOrderLine("81317", 1, details, productLine, { ...type, classId: null });
  assert.equal("custcol_specord_class" in line, false);
});

test("shared request contract accepts mixed regular and special-order lines", () => {
  const result = AddEstimateItemsBody.safeParse({ items: [
    { netsuiteId: "120446", quantity: 2 },
    { netsuiteId: "81317", quantity: 1, specialOrder: details },
  ] });
  assert.equal(result.success, true);
});

test("invalid identifiers, quantities and prices fail before any NetSuite write", () => {
  for (const netsuiteId of ["", "0", "-1", "1 OR 1=1", "1.2", "NaN"]) {
    assert.equal(AddEstimateItemsBody.safeParse({ items: [{ netsuiteId, quantity: 1 }] }).success, false);
    assert.throws(() => positiveId(netsuiteId), SpecialOrderValidationError);
  }
  assert.throws(() => positiveId("99999999999999999999999"), SpecialOrderValidationError);
  for (const quantity of [0, -1, 1.5, NaN, Infinity, 1000001]) {
    assert.equal(AddEstimateItemsBody.safeParse({ items: [{ netsuiteId: "81317", quantity }] }).success, false);
  }
  for (const listPrice of [-1, NaN, Infinity, 100000000]) {
    assert.equal(AddEstimateItemsBody.safeParse({
      items: [{ netsuiteId: "81317", quantity: 1, specialOrder: { ...details, listPrice } }],
    }).success, false);
  }
  assert.equal(AddEstimateItemsBody.safeParse({ items: [] }).success, false);
  assert.equal(AddEstimateItemsBody.safeParse({
    items: [{ netsuiteId: "81317", quantity: 1, specialOrder: { ...details, color: undefined } }],
  }).success, false);
});
