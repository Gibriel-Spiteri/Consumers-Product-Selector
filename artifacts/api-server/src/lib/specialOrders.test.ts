import { test } from "node:test";
import assert from "node:assert/strict";
import type { SpecialOrderDetails } from "@workspace/api-zod";
import {
  EstimateItemsSchema as AddEstimateItemsBody, fillSpecialOrderOptions, positiveId, specialOrderEarnRate, specialOrderLine,
  specialOrderRate, SpecialOrderValidationError, type EstimatePricingContext, type SpecialOrderPricing,
} from "./specialOrders";

const productLine = { id: "88", name: "DELTA", netsuiteItemId: "81317", sku: "SP-DELTA" };
const type = { id: "3071", name: "BATH FAUCET", requiresAttachment: false, classId: "20" };
const details: SpecialOrderDetails = {
  productLineId: "88", productLineName: "DELTA", typeId: "3071", typeName: "BATH FAUCET",
  model: "  TEST-MODEL ", description: " Test collection ", color: " Chrome ", listPrice: 123.45,
};
// PROD values on 2026-11-03: DELTA product line 88 and item SP-DELTA (81317).
const earnRate = { retail: "3.50%", crd: "1.75%", cdRetail: "2.75%", cdCrd: "2.75%" };
const deltaPricing: SpecialOrderPricing = { costMult: 0.534, retailMult: 1.4606, crdMult: 1.2813, dropShip: false, earnRate };
const retail: EstimatePricingContext = { customerCategory: "1", estimateCategory: "1", location: "1" };
const crd: EstimatePricingContext = { customerCategory: "2", estimateCategory: "2", location: "1" };

test("special-order fields map to their NetSuite columns, preserving manually entered list price", () => {
  const line = specialOrderLine("81317", 3, details, productLine, type, deltaPricing, retail);
  assert.deepEqual(line, {
    item: { id: "81317" }, quantity: 3,
    rate: 96.29, amount: 288.87,
    custcol_list_selling_rate: 123.45,
    custcol_list_selling_amt: 370.35,
    custcol_isdropship: false,
    custcol_item_earn_rate: "3.50%",
    custcol_specord_perorderform: { id: "2" },
    custcol_specord_prodline: { id: "88" },
    custcol_specord_type: { id: "3071" },
    custcol_specord_model: "TEST-MODEL",
    custcol_specord_style: "Test collection",
    custcol_specord_color: "Chrome",
  });
  // 2026-11-03: the line now carries NetSuite's selling rate (see the pricing tests below).
  // assert.equal("rate" in line, false, "List price must not replace selling rate");
  assert.equal("price" in line, false, "Leave NetSuite price level sourcing intact");
});

// Real hand-entered PROD estimate lines (rate as NetSuite stored it) run through the app's formula.
test("selling rate matches NetSuite's own special-order lines", () => {
  const cases: Array<[string, number, SpecialOrderPricing, string, number]> = [
    ["ES241762 SP-DELTA retail", 449, deltaPricing, "1", 350.2],
    ["ES241727 SP-DELTA CRD", 215, deltaPricing, "2", 147.11],
    ["ES241762 SP-Kohler retail", 523.99, { ...deltaPricing, costMult: 0.57, retailMult: 1.3735, crdMult: 1.24845 }, "1", 410.23],
    ["ES241737 SP-Kohler retail", 165, { ...deltaPricing, costMult: 0.57, retailMult: 1.3735, crdMult: 1.24845 }, "1", 129.18],
    ["ES241760 SP-FLEURCO CRD", 1919, { ...deltaPricing, costMult: 0.3645, retailMult: 1.75275, crdMult: 1.460625 }, "2", 1021.67],
    ["ES241753 SP-OASIS retail", 570, { ...deltaPricing, costMult: 0.355775, retailMult: 1.75275, crdMult: 1.460625 }, "1", 355.44],
    ["ES241741 SP-TOP KNOBS CRD", 10.9, { ...deltaPricing, costMult: 0.583, retailMult: 1.715, crdMult: 1.4292 }, "2", 9.08],
    ["ES241729 SP-MNG Hardware retail", 11.91, { ...deltaPricing, costMult: 0.5, retailMult: 1.7528, crdMult: 1.4606 }, "1", 10.44],
    ["ES241671 SP-RICHELIEU CRD", 13.79, { ...deltaPricing, costMult: 0.405, retailMult: 1.75275, crdMult: 1.460625 }, "2", 8.16],
    ["ES241669 SP-iLIGHTING retail", 23.18, { ...deltaPricing, costMult: 1, retailMult: 1.9475, crdMult: 1.6195 }, "1", 45.14],
    ["ES241729 SP-SOFIA retail", 1974, { ...deltaPricing, costMult: 0.45, retailMult: 1.75275, crdMult: 1.4607275 }, "1", 1556.97],
  ];
  for (const [label, list, pricing, category, expected] of cases) {
    assert.equal(specialOrderRate(list, pricing, category), expected, label);
  }
});

test("rate rules copied from salesorder.js: blank multipliers are 1, non-retail categories use CRD, no list means 0", () => {
  const blank = { ...deltaPricing, costMult: 1, retailMult: 1, crdMult: 1 };
  assert.equal(specialOrderRate(100, blank, "1"), 100);
  assert.equal(specialOrderRate(215, deltaPricing, "3"), 147.11, "RFQ prices like CRD");
  assert.equal(specialOrderRate(215, deltaPricing, null), 147.11, "unknown category prices like CRD");
  assert.equal(specialOrderRate(0, deltaPricing, "1"), 0);
});

test("earn rate follows GetItemCommissionRates", () => {
  assert.equal(specialOrderEarnRate(deltaPricing, retail), "3.50%");
  assert.equal(specialOrderEarnRate(deltaPricing, crd), "1.75%");
  assert.equal(specialOrderEarnRate(deltaPricing, { ...retail, estimateCategory: "4" }), "3.50%");
  assert.equal(specialOrderEarnRate(deltaPricing, { ...crd, location: "14" }), "2.75%");
  assert.equal(specialOrderEarnRate(deltaPricing, { ...retail, estimateCategory: null }), null);
  const line = specialOrderLine("81317", 1, details, productLine, type, deltaPricing, { ...retail, estimateCategory: null });
  assert.equal("custcol_item_earn_rate" in line, false);
});

test("drop ship and CRD pricing land on the line", () => {
  const knobs = { id: "119", name: "TOP KNOBS HARDWARE", netsuiteItemId: "81427", sku: "SP-TOP KNOBS HARDWARE" };
  const pricing = { ...deltaPricing, costMult: 0.583, retailMult: 1.715, crdMult: 1.4292, dropShip: true };
  const line = specialOrderLine("81427", 37, { ...details, productLineId: "119", listPrice: 10.9 }, knobs, type, pricing, crd);
  assert.equal(line.rate, 9.08);
  assert.equal(line.amount, 335.96);
  assert.equal(line.custcol_list_selling_amt, 403.3);
  assert.equal(line.custcol_isdropship, true);
  assert.equal(line.custcol_item_earn_rate, "1.75%");
});

test("model/color variants sharing one SP item remain distinct lines", () => {
  const a = specialOrderLine("81317", 1, details, productLine, type, deltaPricing, retail);
  const b = specialOrderLine("81317", 2, { ...details, model: "OTHER", color: "Black" }, productLine, type, deltaPricing, retail);
  assert.equal(a.item.id, b.item.id);
  assert.notEqual(a.custcol_specord_model, b.custcol_specord_model);
  assert.notEqual(a.custcol_specord_color, b.custcol_specord_color);
});

test("membership mismatches and blank specifications are rejected", () => {
  for (const input of [
    { ...details, productLineId: "99" }, { ...details, typeId: "99" },
    { ...details, model: "   " }, { ...details, description: "\n" }, { ...details, color: "" },
  ]) {
    assert.throws(() => specialOrderLine("81317", 1, input, productLine, type, deltaPricing, retail), SpecialOrderValidationError);
  }
  assert.throws(() => specialOrderLine("999", 1, details, productLine, type, deltaPricing, retail), SpecialOrderValidationError);
});

test("specifications longer than NetSuite's 300-character text fields are rejected", () => {
  assert.throws(() => specialOrderLine("81317", 1, { ...details, description: "x".repeat(301) }, productLine, type, deltaPricing, retail),
    SpecialOrderValidationError);
  assert.equal(AddEstimateItemsBody.safeParse({
    items: [{ netsuiteId: "81317", quantity: 1, specialOrder: { ...details, description: "x".repeat(301) } }],
  }).success, false);
});

test("no type class is invented when NetSuite has none", () => {
  const line = specialOrderLine("81317", 1, details, productLine, { ...type, classId: null }, deltaPricing, retail);
  assert.equal("custcol_specord_class" in line, false);
});

test("the Class option is left blank even when the Type has a class, as the NetSuite UI does", () => {
  const line = specialOrderLine("81317", 1, details, productLine, type, deltaPricing, retail);
  assert.equal("custcol_specord_class" in line, false);
});

// The `options` string NetSuite generated for a new SP-TOP KNOBS HARDWARE line (sandbox, 2026-11-03).
const O = "\u0003", E = "\u0004";
const template = [
  `CUSTCOL_SPECORD_PRODLINE${O}T${O}PROD LINE${O}119${O}TOP KNOBS HARDWARE`,
  `CUSTCOL_SPECORD_CLASS${O}F${O}CLASS${O}`,
  `CUSTCOL_SPECORD_TYPE${O}T${O}TYPE${O}`,
  `CUSTCOL_SPECORD_PERORDERFORM${O}F${O}As Per Order Form${O}2${O}No`,
  `CUSTCOL_SPECORD_MODEL${O}T${O}MODEL${O}`,
  `CUSTCOL_SPECORD_STYLE${O}T${O}COLL/DESC${O}`,
  `CUSTCOL_SPECORD_COLOR${O}T${O}COLOR${O}`,
  `CUSTCOL_ITEMOPT_SPECIALORDER${O}F${O}Note${O}Special Order - No Returns`,
].join(E);

test("item options are filled into NetSuite's own template", () => {
  const filled = fillSpecialOrderOptions(template,
    { ...details, model: "TK3192BSN", description: "Telfair\nKnob", color: "Brushed Satin Nickel" },
    { id: "3000", name: "KNOBS", requiresAttachment: false });
  assert.equal(filled, [
    `CUSTCOL_SPECORD_PRODLINE${O}T${O}PROD LINE${O}119${O}TOP KNOBS HARDWARE`,
    `CUSTCOL_SPECORD_CLASS${O}F${O}CLASS${O}`,
    `CUSTCOL_SPECORD_TYPE${O}T${O}TYPE${O}3000${O}KNOBS`,
    `CUSTCOL_SPECORD_PERORDERFORM${O}F${O}As Per Order Form${O}2${O}No`,
    `CUSTCOL_SPECORD_MODEL${O}T${O}MODEL${O}TK3192BSN`,
    `CUSTCOL_SPECORD_STYLE${O}T${O}COLL/DESC${O}Telfair Knob`,
    `CUSTCOL_SPECORD_COLOR${O}T${O}COLOR${O}Brushed Satin Nickel`,
    `CUSTCOL_ITEMOPT_SPECIALORDER${O}F${O}Note${O}Special Order - No Returns`,
  ].join(E));
  assert.throws(() => fillSpecialOrderOptions(`CUSTCOL_SPECORD_MODEL${O}T${O}MODEL${O}`, details, type), /CUSTCOL_SPECORD_TYPE/);
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
