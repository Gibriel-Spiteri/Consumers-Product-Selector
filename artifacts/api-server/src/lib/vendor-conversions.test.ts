import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVendorConversions, type ConversionEvent } from "./vendor-conversions";

const visitId = "visit-12345678";
const pickId = "pick-12345678";
const source = { visitId, pickId, vendorDomain: "vendor.test", productLineId: "88", productLineName: "Fixture", quantity: 1 };
function event(id: number, eventType: string, metadata: unknown, employeeId: string | null = "42"): ConversionEvent {
  return { id, eventType, metadata, employeeId };
}
const open = () => event(1, "vendor_site_visit", source);
const capture = () => event(2, "quickadd_capture", { ...source, picks: [{ pickId, productLineId: "88" }] });
const add = () => event(3, "add_to_list", source);
const push = () => event(4, "push_to_estimate", { specialOrderLines: [source] });
const funnel = () => [open(), capture(), add(), push()];

test("complete explicit chain converts once, while repeated estimate sends count as actions", () => {
  const [row] = buildVendorConversions([...funnel(), { ...push(), id: 5 }]);
  assert.deepEqual([row.opens, row.captures, row.adds, row.pushes], [1, 1, 1, 2]);
  assert.deepEqual([row.visits, row.capturedVisits, row.addedVisits, row.pushedVisits], [1, 1, 1, 1]);
  assert.equal(row.unlinkedActions, 0);
});

test("kit capture is one action with multiple picks, adds and lines but one converting visit", () => {
  const second = { ...source, pickId: "pick-87654321" };
  const [row] = buildVendorConversions([open(),
    event(2, "quickadd_capture", { ...source, picks: [{ pickId, productLineId: "88" }, { pickId: second.pickId, productLineId: "88" }] }),
    add(), event(4, "add_to_list", second), event(5, "push_to_estimate", { specialOrderLines: [source, second] })]);
  assert.deepEqual([row.captures, row.adds, row.pushes, row.pushedVisits], [1, 2, 1, 1]);
});

test("missing stages never infer later conversions from user, vendor or visit alone", () => {
  for (const omit of [1, 2, 3]) {
    const rows = buildVendorConversions(funnel().filter(e => e.id !== omit));
    assert.equal(rows.reduce((sum, row) => sum + row.pushedVisits, 0), 0);
  }
});

test("historical actions remain visible and never fabricate visits", () => {
  const [row] = buildVendorConversions([
    event(1, "vendor_site_visit", { vendorDomain: "vendor.test" }),
    event(2, "quickadd_capture", { vendorDomain: "vendor.test" }),
    event(3, "add_to_list", { vendorDomain: "vendor.test", productLineId: "88" }),
    event(4, "push_to_estimate", { specialOrderLines: [{ vendorDomain: "vendor.test", productLineId: "88" }] }),
  ]);
  assert.deepEqual([row.opens, row.captures, row.adds, row.pushes, row.unlinkedActions], [1, 1, 1, 1, 4]);
  assert.deepEqual([row.visits, row.capturedVisits, row.addedVisits, row.pushedVisits], [0, 0, 0, 0]);
});

test("mismatched actor, vendor, pick, visit and product line cannot convert", () => {
  const changed = [
    event(4, "push_to_estimate", { specialOrderLines: [source] }, "99"),
    event(4, "push_to_estimate", { specialOrderLines: [{ ...source, vendorDomain: "other.test" }] }),
    event(4, "push_to_estimate", { specialOrderLines: [{ ...source, pickId: "other-12345678" }] }),
    event(4, "push_to_estimate", { specialOrderLines: [{ ...source, visitId: "other-12345678" }] }),
    event(4, "push_to_estimate", { specialOrderLines: [{ ...source, productLineId: "99" }] }),
  ];
  for (const p of changed) {
    const rows = buildVendorConversions([open(), capture(), add(), p]);
    assert.equal(rows.reduce((sum, row) => sum + row.pushedVisits, 0), 0);
  }
});

test("anonymous chains and reused opening or pick identifiers are not reliable conversions", () => {
  for (const events of [
    funnel().map(e => ({ ...e, employeeId: null })),
    [...funnel(), { ...open(), id: 5 }],
    [...funnel(), { ...capture(), id: 5 }],
    [...funnel(), { ...add(), id: 5 }],
  ]) {
    assert.equal(buildVendorConversions(events).reduce((sum, row) => sum + row.pushedVisits, 0), 0);
  }
});

test("multi-vendor sends count once per vendor and never include a skipped line not in metadata", () => {
  const second = { ...source, visitId: "visit-87654321", pickId: "pick-87654321", vendorDomain: "other.test" };
  const rows = buildVendorConversions([
    open(), capture(), add(),
    event(5, "vendor_site_visit", second),
    event(6, "quickadd_capture", { ...second, picks: [{ pickId: second.pickId, productLineId: "88" }] }),
    event(7, "add_to_list", second),
    event(8, "push_to_estimate", { specialOrderLines: [source, source, second] }),
  ]);
  assert.equal(rows.length, 2);
  assert.ok(rows.every(row => row.pushes === 1 && row.pushedVisits === 1));
  const skipped = buildVendorConversions([
    open(), capture(), add(), event(8, "push_to_estimate", { specialOrderLines: [] }),
  ]);
  assert.equal(skipped.find(row => row.vendorDomain === "vendor.test")?.pushedVisits, 0);
});

test("subdomains normalize consistently and catalog adds are not special-order adds", () => {
  const rows = buildVendorConversions([
    ...funnel().map(e => {
      const m = e.metadata as Record<string, unknown>;
      return { ...e, metadata: e.eventType === "push_to_estimate"
        ? { specialOrderLines: [{ ...source, vendorDomain: "shop.us.vendor.test" }] }
        : { ...m, vendorDomain: "www.vendor.test" } };
    }),
    event(5, "add_to_list", { productName: "Catalog item" }),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].pushedVisits, 1);
  assert.equal(rows[0].adds, 1);
});
