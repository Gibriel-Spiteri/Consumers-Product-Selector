import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import * as crypto from "node:crypto";
import * as orm from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { analyticsEventsTable } from "@workspace/db";
import * as specialOrders from "./specialOrders";
import * as vendorConversions from "./vendor-conversions";

// Load the real modules with isolated I/O. No app startup, database connection,
// employee lookup or NetSuite request runs in these tests.
function load(path: string, deps: Record<string, any>) {
  const exports: any = {};
  const source = readFileSync(fileURLToPath(new URL(path, import.meta.url).href), "utf8");
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, Date, Map, Set, require: (id: string) => {
    assert.ok(id in deps, `Unexpected dependency: ${id}`);
    return deps[id];
  } });
  return exports;
}

const logger = { info() {}, warn() {}, error() {} };

function persistenceHarness(fail: "before" | "after" | "always" | "none" = "none") {
  const rows: any[] = [];
  let attempts = 0;
  const queries: string[] = [];
  const dialect = new PgDialect();
  const db = {
    transaction: async (callback: Function) => {
      attempts++;
      if (fail === "always" || (fail === "before" && attempts === 1)) throw new Error("Database unavailable");
      const result = await callback({
        execute: async (query: any) => { queries.push(dialect.sqlToQuery(query).sql); },
        select: () => ({ from: () => ({ where: (query: any) => ({
          limit: async () => {
            const params = dialect.sqlToQuery(query).params;
            return rows.filter(row => params.includes(row.metadata.actionId));
          },
        }) }) }),
        insert: () => ({ values: async (row: any) => { rows.push(row); } }),
      });
      if (fail === "after" && attempts === 1) throw new Error("Commit response lost");
      return result;
    },
  };
  const mod = load("./estimate-analytics.ts", {
    "node:crypto": crypto, "node:timers/promises": { setTimeout: async () => {} },
    "drizzle-orm": orm, "@workspace/db": { db, analyticsEventsTable },
    "./logger": { logger },
  });
  return { ...mod, rows, queries, attempts: () => attempts };
}

const event = { employeeId: "42", sessionId: "tab-session", path: "/list",
  metadata: { estimateId: 123, tranId: "ES123", itemCount: 3, lineCount: 2, totalValue: 18 } };

test("server analytics retries database failures without changing action or session identity", async () => {
  const h = persistenceHarness("before");
  assert.equal(await h.recordEstimatePush("stable-action", event), true);
  assert.equal(h.attempts(), 2);
  assert.equal(h.rows.length, 1);
  assert.equal(h.rows[0].metadata.actionId, "stable-action");
  assert.equal(h.rows[0].metadata.source, "server");
  assert.equal(h.rows[0].employeeId, "42");
  assert.equal(h.rows[0].sessionId, "tab-session");
  assert.ok(h.queries.every((q: string) => q.includes("pg_advisory_xact_lock")));
});

test("lost commit responses and repeated persistence calls cannot double count a push", async () => {
  const h = persistenceHarness("after");
  assert.equal(await h.recordEstimatePush("stable-action", event), true);
  assert.equal(h.attempts(), 2);
  await h.recordEstimatePush("stable-action", event);
  assert.equal(h.rows.length, 1);
  await h.recordEstimatePush("another-action", event);
  assert.equal(h.rows.length, 2, "a distinct successful push to the same estimate must count separately");
});

test("exhausted analytics retries return an explicit failure, not a failed NetSuite push", async () => {
  const h = persistenceHarness("always");
  assert.equal(await h.recordEstimatePush("stable-action", event), false);
  assert.equal(h.attempts(), 3);
  assert.equal(h.rows.length, 0);
});

test("legacy callers reuse one opaque session per signed login; current tab ids pass through", () => {
  const h = persistenceHarness();
  assert.equal(h.estimateSessionId("tab-session", "signed-token"), "tab-session");
  const fallback = h.estimateSessionId(undefined, "signed-token");
  assert.equal(h.estimateSessionId(undefined, "signed-token"), fallback);
  assert.notEqual(h.estimateSessionId(undefined, "other-token"), fallback);
  assert.ok(fallback.length <= 64);
  assert.ok(!fallback.includes("signed-token"));
});

function routeHarness(options: { failPatch?: boolean; failOptions?: boolean; recorded?: boolean; invalid?: readonly string[] } = {}) {
  const handlers = new Map<string, Function>();
  const records: any[] = [];
  const patches: any[] = [];
  const router: any = { use() {} };
  for (const method of ["get", "post"]) router[method] = (path: string, fn: Function) => { handlers.set(`${method} ${path}`, fn); };
  load("../routes/estimates.ts", {
    express: { Router: () => router },
    "../lib/logger": { logger },
    "../lib/session": { requireEmployee() {}, bearerToken: () => "signed-test-token" },
    "../lib/vendor-conversions": vendorConversions,
    // The after-push discount refresh is its own route (refresh-discounts); add-items never calls it.
    "../lib/estimateRefresh": {
      refreshEstimateDiscounts: async () => { throw new Error("add-items must not refresh discounts itself"); },
    },
    "../lib/estimate-analytics": {
      estimateActionId: () => "server-action",
      estimateSessionId: (session: string) => session || "legacy-session",
      recordEstimatePush: async (actionId: string, row: any) => {
        records.push({ actionId, ...row }); return options.recorded ?? true;
      },
    },
    "../lib/netsuite": {
      isNetSuiteConfigured: () => true,
      executeSuiteQL: async (query: string) => query.includes("FROM transactionline")
        ? { items: [{ id: "1", type: "2", model: "MODEL" }] } : ({ items: [
        { id: "10", itemid: "CATALOG" }, { id: "20", itemid: "CATALOG2" },
      ].filter(item => !options.invalid?.includes(item.id)) }),
      netsuiteRequest: async (path: string, method: string, data: any) => {
        if (method === "PATCH") {
          patches.push(data);
          if (options.failPatch) throw new Error("NetSuite 429 busy");
          return null;
        }
        if (path.includes("/item?")) {
          if (options.failOptions) throw new Error("Options read failed");
          return { items: [{ line: 1, item: { id: "10" }, options: "template" }] };
        }
        return { tranId: "ES123", item: { items: [] } };
      },
    },
    "../lib/specialOrders": {
      ...specialOrders,
      getSpecialOrderProductLines: async () => [{ id: "1", netsuiteItemId: "10" }],
      getSpecialOrderTypes: async () => [{ id: "2" }],
      getSpecialOrderPricing: async () => new Map([["10", {}]]),
      specialOrderLine: () => ({ rate: 12, amount: 12 }),
      fillSpecialOrderOptions: () => "filled-options",
    },
  });
  async function send(body: any) {
    const res: any = { code: 200, locals: { employeeId: "42" },
      status(code: number) { this.code = code; return this; },
      json(body: any) { this.body = body; return this; } };
    await handlers.get("post /estimates/:estimateId/add-items")!({
      params: { estimateId: "123" }, body, get: () => "test-browser",
    }, res);
    return res;
  }
  return { send, records, patches };
}

const request = {
  analyticsSessionId: "existing-tab",
  employeeId: "spoofed",
  actionId: "spoofed",
  items: [
    { netsuiteId: "10", quantity: 2, analyticsUnitPrice: 8 },
    { netsuiteId: "20", quantity: 1, analyticsUnitPrice: 2 },
  ],
};

test("successful route writes one server event without browser delivery and excludes skipped lines", async () => {
  const h = routeHarness({ invalid: ["20"] });
  const res = await h.send(request);
  assert.equal(res.code, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.actionId, "server-action");
  assert.equal(res.body.analyticsRecorded, true);
  assert.equal(h.patches.length, 1);
  assert.equal(h.records.length, 1);
  assert.equal(h.records[0].employeeId, "42");
  assert.equal(h.records[0].sessionId, "existing-tab");
  assert.equal(h.records[0].metadata.estimateId, 123);
  assert.equal(h.records[0].metadata.tranId, "ES123");
  assert.equal(h.records[0].metadata.itemCount, 2);
  assert.equal(h.records[0].metadata.lineCount, 1);
  assert.equal(h.records[0].metadata.totalValue, 16);
  assert.equal(h.patches[0].item.items[0].analyticsUnitPrice, undefined);
  assert.equal(h.records[0].metadata.specialOrderLines.length, 0);
});

test("validation failures, no valid items, and NetSuite failures never count as successful pushes", async () => {
  for (const [options, body] of [
    [{}, { items: [] }],
    [{ invalid: ["10", "20"] }, request],
    [{ failPatch: true }, request],
  ] as const) {
    const h = routeHarness(options);
    const res = await h.send(body);
    assert.ok(res.code >= 400);
    assert.equal(h.records.length, 0);
  }
});

test("a definite failed push followed by a successful retry records only the success", async () => {
  const options = { failPatch: true };
  const h = routeHarness(options);
  assert.equal((await h.send(request)).code, 503);
  options.failPatch = false;
  assert.equal((await h.send(request)).body.success, true);
  assert.equal(h.records.length, 1);
});

test("analytics storage failure does not turn an already-written estimate into a retryable error", async () => {
  const h = routeHarness({ recorded: false });
  const res = await h.send(request);
  assert.equal(res.code, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.analyticsRecorded, false);
  assert.equal(h.patches.length, 1);
});

test("legacy requests work without browser analytics context or displayed prices", async () => {
  const h = routeHarness();
  const res = await h.send({ items: [{ netsuiteId: "10", quantity: 1 }] });
  assert.equal(res.code, 200);
  assert.equal(h.records[0].sessionId, "legacy-session");
  assert.equal(h.records[0].metadata.totalValue, null);
});

test("partial special-order option failures are not counted as completed pushes", async () => {
  const h = routeHarness({ failOptions: true });
  const details = {
    productLineId: "1", productLineName: "Example", typeId: "2", typeName: "Example",
    model: "MODEL", description: "Example", color: "White", listPrice: 12,
  };
  const res = await h.send({ items: [{ netsuiteId: "10", quantity: 1, specialOrder: details }] });
  assert.equal(res.code, 502);
  assert.equal(h.patches.length, 1, "lines were already appended");
  assert.equal(h.records.length, 0);
});

test("server success retains explicit vendor links and still completes the vendor conversion funnel", async () => {
  const h = routeHarness();
  const specialOrder = {
    productLineId: "1", productLineName: "Example", typeId: "2", typeName: "Example",
    model: "MODEL", description: "Example", color: "White", listPrice: 12,
  };
  const source = { productLineId: "1", vendorDomain: "vendor.test",
    pickId: "pick-12345678", visitId: "visit-12345678" };
  const res = await h.send({
    analyticsSessionId: "existing-tab",
    items: [{ netsuiteId: "10", quantity: 2, specialOrder,
      analyticsVendorPick: { ...source, vendorDomain: "shop.vendor.test" } }],
  });
  assert.equal(res.code, 200);
  assert.equal(h.records.length, 1);
  const line = h.records[0].metadata.specialOrderLines[0];
  assert.equal(line.pickId, source.pickId);
  assert.equal(line.visitId, source.visitId);
  assert.equal(line.vendorDomain, source.vendorDomain);
  assert.equal(line.productLineId, "1");
  assert.equal(line.quantity, 2);
  assert.equal(h.patches[0].item.items[0].analyticsVendorPick, undefined);
  const event = (id: number, eventType: string, metadata: unknown) => ({ id, eventType, employeeId: "42", metadata });
  const [conversion] = vendorConversions.buildVendorConversions([
    event(1, "vendor_site_visit", source),
    event(2, "quickadd_capture", { ...source, picks: [{ pickId: source.pickId, productLineId: "1" }] }),
    event(3, "add_to_list", source),
    event(4, "push_to_estimate", h.records[0].metadata),
  ]);
  assert.equal(conversion.pushes, 1);
  assert.equal(conversion.pushedVisits, 1);
});

test("skipped special orders cannot create a vendor conversion, and missing links stay unlinked", async () => {
  const specialOrder = {
    productLineId: "1", productLineName: "Example", typeId: "2", typeName: "Example",
    model: "MODEL", description: "Example", color: "White", listPrice: 12,
  };
  const h = routeHarness({ invalid: ["10"] });
  const res = await h.send({ items: [
    { netsuiteId: "10", quantity: 1, specialOrder, analyticsVendorPick: {
      vendorDomain: "vendor.test", pickId: "pick-12345678", visitId: "visit-12345678",
    } },
    { netsuiteId: "20", quantity: 1 },
  ] });
  assert.equal(res.code, 200);
  assert.equal(h.records[0].metadata.specialOrderLines.length, 0);
  const unlinked = routeHarness();
  assert.equal((await unlinked.send({ items: [{ netsuiteId: "10", quantity: 1, specialOrder }] })).code, 200);
  const line = unlinked.records[0].metadata.specialOrderLines[0];
  assert.equal(line.pickId, null);
  assert.equal(line.visitId, null);
  assert.equal(line.vendorDomain, "");
});
