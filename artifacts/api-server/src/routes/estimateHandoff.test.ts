import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import * as handoffLib from "../lib/estimateHandoff";
import * as specialOrders from "../lib/specialOrders";
import * as vendorConversions from "../lib/vendor-conversions";

// The real route module with isolated I/O: no database, NetSuite or sign-in check runs here.
function load(path: string, deps: Record<string, any>) {
  const exports: any = {};
  const source = readFileSync(fileURLToPath(new URL(path, import.meta.url).href), "utf8");
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, Date, Map, Set, Promise, require: (id: string) => {
    assert.ok(id in deps, `Unexpected dependency: ${id}`);
    return deps[id];
  } });
  return exports;
}

const TOKEN = "T".repeat(43);
// Values made inside the vm context have its own prototypes; compare plain copies.
const clone = (v: any) => JSON.parse(JSON.stringify(v));
const logger = { info() {}, warn() {}, error() {} };

function harness(options: { stored?: any; estimate?: any; priceError?: Error } = {}) {
  const handlers = new Map<string, Function>();
  const router: any = { use() {} };
  for (const method of ["get", "post"]) router[method] = (path: string, fn: Function) => { handlers.set(`${method} ${path}`, fn); };
  const saved = new Map<string, any>();
  if (options.stored) saved.set(TOKEN, options.stored);
  const priced: any[] = [];
  const records: any[] = [];
  load("./estimateHandoff.ts", {
    express: { Router: () => router },
    "../lib/netsuite": { isNetSuiteConfigured: () => true },
    "../lib/logger": { logger },
    "../lib/specialOrders": specialOrders,
    "../lib/session": { requireEmployee() {}, bearerToken: () => "signed" },
    "../lib/estimate-analytics": {
      estimateSessionId: (s: string) => s || "legacy",
      recordEstimatePush: async (actionId: string, row: any) => { records.push(clone({ actionId, ...row })); return true; },
    },
    "../lib/vendor-conversions": vendorConversions,
    "../lib/estimateRefresh": { appBaseUrl: () => "https://1212804.app.netsuite.com" },
    "../lib/estimateHandoff": {
      ...handoffLib,
      activeItems: async (ids: string[]) => new Map(ids.filter(id => id !== "99").map(id => [String(id), { id: String(id), itemid: `ITEM${id}`, displayname: "Sink" }])),
      priceHandoffLines: async (items: any[], ctx: any) => {
        if (options.priceError) throw options.priceError;
        priced.push(clone(ctx));
        return items.map(i => ({ item: { id: i.netsuiteId }, quantity: i.quantity }));
      },
      purgeExpiredHandoffs: async () => 0,
      newHandoffToken: () => TOKEN,
      saveHandoff: async (token: string, h: any) => { saved.set(token, clone(h)); },
      loadHandoff: async (token: string, now = Date.now()) => {
        const h = saved.get(token);
        return h && h.expiresAt > now ? h : null;
      },
      deleteHandoff: async (token: string) => { saved.delete(token); },
      findHandoffEstimate: async () => options.estimate ?? null,
    },
  });
  async function call(key: string, req: any, locals: any = {}) {
    let status = 200;
    let body: any;
    const res: any = {
      locals,
      status(code: number) { status = code; return res; },
      json(data: any) { body = clone(data); return res; },
    };
    await handlers.get(key)!({ params: {}, query: {}, body: {}, get: () => "test-agent", ...req }, res);
    return { status, body };
  }
  return { call, saved, priced, records };
}

const stored = (over: any = {}) => ({
  employeeId: "4151",
  items: [{ netsuiteId: "10", quantity: 2, analyticsUnitPrice: 50 }],
  labels: [{ label: "ITEM10 - Sink", quantity: 2 }],
  analyticsSessionId: "tab",
  createdAt: Date.now(),
  expiresAt: Date.now() + 60_000,
  ...over,
});

test("starting a hand-off stores the rep's items and returns NetSuite's Customer Search with the token, never the items", async () => {
  const h = harness();
  const r = await h.call("post /estimates/handoff",
    { body: { items: [{ netsuiteId: "10", quantity: 2 }, { netsuiteId: "99", quantity: 1 }] } }, { employeeId: "4151" });
  assert.equal(r.status, 200);
  assert.equal(r.body.token, TOKEN);
  assert.equal(r.body.url, "https://1212804.app.netsuite.com/app/site/hosting/scriptlet.nl?script=customscript_employeeappointments_suitel" +
    `&deploy=customdeploy1&openCustomerSearch=true&cps=${TOKEN}`);
  assert.equal(r.body.netsuiteOrigin, "https://1212804.app.netsuite.com");
  assert.deepEqual(r.body.skippedNetsuiteIds, ["99"]);
  const s = h.saved.get(TOKEN);
  assert.equal(s.employeeId, "4151");
  assert.deepEqual(s.items.map((i: any) => i.netsuiteId), ["10"]);
  assert.deepEqual(s.labels, [{ label: "ITEM10 - Sink", quantity: 2 }]);
  assert.ok(s.expiresAt - s.createdAt === handoffLib.HANDOFF_TTL_MS);
});

test("a special order that can't be priced stops the hand-off before the pop-up goes to NetSuite", async () => {
  const h = harness({ priceError: new specialOrders.SpecialOrderValidationError("This special-order item has no product line pricing in NetSuite") });
  const r = await h.call("post /estimates/handoff", { body: { items: [{ netsuiteId: "10", quantity: 1 }] } }, { employeeId: "4151" });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /no product line pricing/);
  assert.equal(h.saved.size, 0);
});

test("NetSuite reads the item names, then the lines priced for the chosen customer", async () => {
  const h = harness({ stored: stored() });
  const names = await h.call("get /handoff/estimate/:token", { params: { token: TOKEN }, query: { employeeId: "4151" } });
  assert.equal(names.status, 200);
  assert.deepEqual(names.body, { items: [{ label: "ITEM10 - Sink", quantity: 2 }] });
  const lines = await h.call("get /handoff/estimate/:token",
    { params: { token: TOKEN }, query: { employeeId: "4151", customerId: "123", customerCategory: "2", location: "14" } });
  assert.equal(lines.status, 200);
  assert.deepEqual(lines.body.lines, [{ item: { id: "10" }, quantity: 2 }]);
  assert.equal(lines.body.externalId, `cps-${TOKEN}`);
  // A new estimate's Customer Category is the customer's, so CRD pricing and earn rates follow the customer.
  assert.deepEqual(h.priced, [{ customerCategory: "2", estimateCategory: "2", location: "14" }]);
});

test("only the rep who started the hand-off can read it, and not after it expires", async () => {
  const other = await harness({ stored: stored() }).call("get /handoff/estimate/:token", { params: { token: TOKEN }, query: { employeeId: "999" } });
  assert.equal(other.status, 403);
  const none = await harness({ stored: stored() }).call("get /handoff/estimate/:token", { params: { token: TOKEN }, query: {} });
  assert.equal(none.status, 403);
  const expired = await harness({ stored: stored({ expiresAt: Date.now() - 1 }) })
    .call("get /handoff/estimate/:token", { params: { token: TOKEN }, query: { employeeId: "4151" } });
  assert.equal(expired.status, 404);
  const bad = await harness({ stored: stored() }).call("get /handoff/estimate/:token", { params: { token: "short" }, query: { employeeId: "4151" } });
  assert.equal(bad.status, 400);
});

test("confirm: nothing leaves the list until NetSuite has the estimate; then it is counted once and the hand-off is gone", async () => {
  const notYet = harness({ stored: stored() });
  const r1 = await notYet.call("post /estimates/handoff/:token/confirm", { params: { token: TOKEN } }, { employeeId: "4151" });
  assert.equal(r1.status, 404);
  assert.equal(r1.body.code, "NOT_CREATED");
  assert.ok(notYet.saved.has(TOKEN));

  const h = harness({ stored: stored(), estimate: { id: 5001, tranId: "ES241900", customerName: "Test Customer" } });
  const r2 = await h.call("post /estimates/handoff/:token/confirm", { params: { token: TOKEN } }, { employeeId: "4151" });
  assert.equal(r2.status, 200);
  assert.deepEqual(r2.body, { success: true, estimateId: 5001, tranId: "ES241900", customerName: "Test Customer" });
  assert.equal(h.saved.has(TOKEN), false);
  assert.equal(h.records.length, 1);
  assert.equal(h.records[0].actionId, `handoff-${TOKEN}`);
  assert.equal(h.records[0].metadata.newEstimate, true);
  assert.equal(h.records[0].metadata.totalValue, 100);
  // A second confirm (the window closing after the message) still answers, without counting it again.
  const r3 = await h.call("post /estimates/handoff/:token/confirm", { params: { token: TOKEN } }, { employeeId: "4151" });
  assert.equal(r3.status, 200);
  assert.equal(h.records.length, 1);
});

test("confirm refuses another rep's hand-off", async () => {
  const h = harness({ stored: stored(), estimate: { id: 5001, tranId: "ES241900", customerName: "x" } });
  const r = await h.call("post /estimates/handoff/:token/confirm", { params: { token: TOKEN } }, { employeeId: "777" });
  assert.equal(r.status, 403);
  assert.ok(h.saved.has(TOKEN));
});

test("labels, tokens and stored hand-offs", () => {
  assert.equal(handoffLib.isHandoffToken(handoffLib.newHandoffToken()), true);
  assert.equal(handoffLib.isHandoffToken("x".repeat(42)), false);
  assert.equal(handoffLib.isHandoffToken(`${"x".repeat(42)}'`), false);
  const labels = handoffLib.handoffLabels([
    { netsuiteId: "10", quantity: 1 },
    { netsuiteId: "20", quantity: 3, specialOrder: { productLineId: "5", productLineName: "Kohler", typeId: "1", typeName: "Faucet", model: "K-123", description: "d", color: "c", listPrice: 100 } },
    { netsuiteId: "30", quantity: 1 },
  ] as any, new Map([["10", { itemid: "SINK1", displayname: "Undermount sink" }]]));
  assert.deepEqual(labels, [
    { label: "SINK1 - Undermount sink", quantity: 1 },
    { label: "Kohler special order (K-123)", quantity: 3 },
    { label: "NetSuite item 30", quantity: 1 },
  ]);
  const now = 1_000_000;
  const value = JSON.stringify({ employeeId: "1", items: [], labels: [], analyticsSessionId: null, createdAt: now, expiresAt: now + 10 });
  assert.ok(handoffLib.parseHandoff(value, now));
  assert.equal(handoffLib.parseHandoff(value, now + 10), null);
  assert.equal(handoffLib.parseHandoff("nope", now), null);
});
