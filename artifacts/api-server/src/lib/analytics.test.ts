import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { PgDialect } from "drizzle-orm/pg-core";
import { analyticsWhere, etMidnight, rangeToWindow } from "./analytics-filters";
import { trackingId, vendorDomain } from "./vendor-conversions";

test("Eastern midnight handles daylight saving, including 23/25-hour days", () => {
  assert.equal(etMidnight("2026-06-10").toISOString(), "2026-06-10T04:00:00.000Z");
  assert.equal(etMidnight("2026-11-06").toISOString(), "2026-11-06T05:00:00.000Z");
  const spring = rangeToWindow("yesterday", new Date("2026-03-09T15:00:00Z"));
  const fall = rangeToWindow("yesterday", new Date("2026-11-02T15:00:00Z"));
  assert.equal((spring.until!.getTime() - spring.since.getTime()) / 3600000, 23);
  assert.equal((fall.until!.getTime() - fall.since.getTime()) / 3600000, 25);
});

test("totals and personal drilldowns share range, admin and home-page filters", () => {
  const dialect = new PgDialect();
  const total = dialect.sqlToQuery(analyticsWhere("7d", ["42"])!);
  const personal = dialect.sqlToQuery(analyticsWhere("7d", ["42"], "100")!);
  assert.ok(total.sql.includes('"employee_id" not in'));
  assert.ok(personal.sql.includes('"employee_id" not in'));
  assert.ok(total.sql.includes("'page_view'") && personal.sql.includes("'page_view'"));
  assert.ok(personal.params.includes("100"));
  const included = dialect.sqlToQuery(analyticsWhere("7d")!);
  assert.ok(!included.sql.includes("not in"));
  assert.ok(included.sql.includes('"created_at" >='));
});

function ingestHarness() {
  const handlers = new Map<string, Function>();
  const inserted: any[] = [];
  const router: any = { use() {} };
  for (const method of ["post", "get"]) router[method] = (path: string, ...fns: Function[]) => { handlers.set(`${method} ${path}`, fns.at(-1)!); };
  const deps: Record<string, any> = {
    express: { Router: () => router }, "drizzle-orm": {},
    "@workspace/db": { db: { insert: () => ({ values: async (rows: any[]) => { inserted.push(...rows); } }) } },
    "../lib/logger": { logger: { error() {}, warn() {} } },
    "../lib/netsuite": {}, "../lib/employees": {},
    "../lib/session": { bearerToken: (req: any) => req.headers.authorization,
      verifySession: (token: string) => token === "valid-test-session" ? "42" : null },
    "../lib/analytics-filters": {}, "./analytics-drilldown": { registerAnalyticsDrilldown() {} },
    "./analytics-conversions": { registerAnalyticsConversions() {} },
    "../lib/vendor-conversions": { trackingId, vendorDomain },
  };
  const source = readFileSync(new URL("../routes/analytics.ts", import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, { exports: {}, Date, URL, require: (id: string) => { assert.ok(id in deps, id); return deps[id]; } });
  async function send(events: any[], headers: Record<string, string> = {}) {
    const res: any = { code: 200, status(code: number) { this.code = code; return this; }, json(body: any) { this.body = body; } };
    await handlers.get("post /analytics/event")!({ ip: "fixture", headers, body: { sessionId: "test", events } }, res);
    return res;
  }
  return { inserted, send };
}

test("signed attribution ignores spoofed employee headers; invalid tokens cannot write", async () => {
  const h = ingestHarness();
  await h.send([{ eventType: "add_to_list", path: "/list" }], { authorization: "valid-test-session", "x-employee-id": "999" });
  assert.equal(h.inserted[0].employeeId, "42");
  assert.equal((await h.send([{ eventType: "add_to_list" }], { authorization: "invalid" })).code, 401);
  assert.equal(h.inserted.length, 1);
});

test("vendor telemetry strips query secrets, bounds fields, and requires signed identity", async () => {
  const h = ingestHarness();
  const event = { eventType: "quickadd_capture", path: "/special-order", metadata: {
    pageUrl: "https://www.vendor.test/product?token=secret#private", source: "quickadd",
    productName: "Example", itemCount: 100, password: "never-store",
  } };
  await h.send([event]);
  assert.equal(h.inserted.length, 0);
  await h.send([event], { authorization: "valid-test-session" });
  assert.equal(h.inserted[0].metadata.pageUrl, "https://www.vendor.test/product");
  assert.equal(h.inserted[0].metadata.itemCount, 20);
  assert.ok(!JSON.stringify(h.inserted).includes("secret"));
  assert.ok(!JSON.stringify(h.inserted).includes("never-store"));
});

test("admin-page events and unknown event types are never ingested", async () => {
  const h = ingestHarness();
  await h.send([{ eventType: "page_view", path: "/admin" }, { eventType: "unapproved" }]);
  assert.equal(h.inserted.length, 0);
});

test("vendor provenance survives ingestion without arbitrary metadata", async () => {
  const h = ingestHarness();
  await h.send([{ eventType: "quickadd_capture", metadata: {
    pageUrl: "https://shop.us.vendor.test/p?private=hidden", visitId: "visit-12345678",
    pickIds: ["pick-12345678", "<bad>"], picks: [{ pickId: "pick-12345678", productLineId: "88", secret: "drop" }],
  } }], { authorization: "valid-test-session" });
  const m = h.inserted[0].metadata;
  assert.equal(m.vendorDomain, "vendor.test");
  assert.equal(m.visitId, "visit-12345678");
  assert.deepEqual(JSON.parse(JSON.stringify(m.pickIds)), ["pick-12345678"]);
  assert.deepEqual(JSON.parse(JSON.stringify(m.picks)), [{ pickId: "pick-12345678", productLineId: "88" }]);
  assert.ok(!JSON.stringify(m).includes("hidden"));
});
