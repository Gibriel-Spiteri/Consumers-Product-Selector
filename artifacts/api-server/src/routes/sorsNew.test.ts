import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import * as specialOrders from "../lib/specialOrders";
import * as sorPush from "../lib/sorPush";
import * as newSor from "../lib/newSor";

// routes/sors.ts with isolated I/O: no NetSuite, database or sign-in check runs here.
function load(path: string, deps: Record<string, any>) {
  const exports: any = {};
  const source = readFileSync(fileURLToPath(new URL(path, import.meta.url).href), "utf8");
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, Date, Map, Set, Promise, Error, JSON, require: (id: string) => {
    assert.ok(id in deps, `Unexpected dependency: ${id}`);
    return deps[id];
  } });
  return exports;
}

const clone = (v: any) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const logger = { info() {}, warn() {}, error() {} };
const ATTEMPT = "0f8fad5b-d9cb-469f-a165-70867728950e";

const facts = (id: string, itemid = "KSU23189T") => ({
  id, itemid, itemtype: "InvtPart", stockCode: "1", taxable: true, description: "Sink",
  groupRetail: null, groupCrd: null, prices: new Map([["1", 199.99], ["5", 166.66]]),
});

function harness(o: { order?: any; lock?: boolean; done?: any; failWriteAt?: number; sor?: any } = {}) {
  const handlers = new Map<string, Function>();
  const router: any = { use() {} };
  for (const m of ["get", "post"]) router[m] = (p: string, fn: Function) => { handlers.set(`${m} ${p}`, fn); };
  const log = { creates: [] as any[], patches: [] as any[], deletes: [] as string[], made: [] as string[], saved: [] as any[], unlocked: [] as string[] };
  let written = 0;
  const order = o.order === null ? null : {
    id: "6755862", tranId: "SO712473", status: "B", statusText: "Pending Fulfillment", customerName: "57395 Griswold",
    customerCategoryId: "1", customerCategory: "RETAIL", openSor: null, blocked: null, offer: null,
    customerId: "57395", priceLevel: "5", customerRecordCategory: "1", ...(o.order ?? {}),
  };
  load("./sors.ts", {
    express: { Router: () => router },
    "../lib/logger": { logger },
    "../lib/session": { requireEmployee() {} },
    "../lib/specialOrders": specialOrders,
    "../lib/netsuite": {
      isNetSuiteConfigured: () => true,
      executeSuiteQL: async (q: string) => (q.includes("FROM item WHERE id IN")
        ? { items: [{ id: "78085" }, { id: "78086" }].filter(r => q.includes(r.id)) } : { items: [] }),
      netsuiteCreate: async (path: string, body: any) => {
        written++;
        if (o.failWriteAt && written >= o.failWriteAt) throw new Error("NetSuite 500");
        log.creates.push({ path, body: clone(body) });
        return `row${written}`;
      },
      netsuiteRequest: async (path: string, method: string, body: any) => {
        if (method === "PATCH") log.patches.push({ path, body: clone(body) });
        if (method === "DELETE") log.deletes.push(path);
        return null;
      },
    },
    "../lib/sorPush": {
      ...sorPush,
      getCatalogItemFacts: async (ids: string[]) => new Map(ids.map(id => [String(id), facts(String(id))])),
      loadSorForPush: async () => o.sor ?? null,
    },
    "../lib/newSor": {
      ...newSor,
      loadOrderForNewSor: async () => order,
      lockOrder: async () => (o.lock === false ? null : "lockvalue"),
      unlockOrder: async (soId: string) => { log.unlocked.push(soId); },
      loadAttempt: async () => o.done ?? null,
      saveAttempt: async (id: string, result: any) => { log.saved.push({ id, result: clone(result) }); },
      purgeOldAttempts: async () => {},
      createSorOnOrder: async (soId: string) => { log.made.push(soId); return "520"; },
      workbenchUrl: (id: string) => `https://ns.example/workbench?srr=${id}`,
    },
  });
  async function call(key: string, req: any, locals: any = { employeeId: "4151" }) {
    let status = 200, body: any;
    const res: any = { locals, status(c: number) { status = c; return res; }, json(d: any) { body = clone(d); return res; } };
    await handlers.get(key)!({ params: {}, query: {}, body: {}, ...req }, res);
    return { status, body };
  }
  return { call, log };
}

const newSorBody = (items: any[] = [{ netsuiteId: "78085", quantity: 2 }]) => ({ body: { soId: "6755862", attemptId: ATTEMPT, items } });

test("New SOR starts the revision through the workbench, makes the rep its requester and adds the rows to it", async () => {
  const h = harness();
  const r = await h.call("post /sors/new", newSorBody());
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.sorNumber, "SOR520");
  assert.equal(r.body.soTranId, "SO712473");
  assert.equal(r.body.itemsAdded, 1);
  assert.equal(r.body.workbenchUrl, "https://ns.example/workbench?srr=520");
  assert.equal(r.body.employeeId, undefined, "the stored owner is not sent back");
  assert.deepEqual(h.log.made, ["6755862"]);
  assert.deepEqual(h.log.patches, [{ path: "/customrecord_sor/520", body: { custrecord_sor_requested_by: { id: "4151" } } }]);
  assert.equal(h.log.creates.length, 1);
  const row = h.log.creates[0].body;
  assert.deepEqual(row.custrecord_soritem_sor, { id: "520" });
  assert.equal(row.custrecord_soritem_rate, 166.66, "the customer's price level, as the push prices it");
  assert.equal(row.custrecord_soritem_qty, 2);
  assert.equal(h.log.saved[0].id, ATTEMPT);
  assert.equal(h.log.saved[0].result.employeeId, "4151");
  assert.deepEqual(h.log.unlocked, ["6755862"]);
});

test("an order that can't take a revision is refused with the reason, and an open Draft is offered; nothing is made", async () => {
  const offer = { id: "516", number: "SOR516", status: "1", blocked: null };
  const h = harness({ order: { blocked: "SOR516 is already open on SO712473 ...", offer } });
  const r = await h.call("post /sors/new", newSorBody());
  assert.equal(r.status, 409);
  assert.match(r.body.error, /SOR516 is already open/);
  assert.equal(r.body.offer.number, "SOR516");
  assert.deepEqual(h.log.made, []);
  assert.deepEqual(h.log.creates, []);
  assert.deepEqual(h.log.unlocked, ["6755862"]);
});

test("one New SOR per order at a time, and a retry of the same press returns the same revision", async () => {
  const locked = harness({ lock: false });
  const r1 = await locked.call("post /sors/new", newSorBody());
  assert.equal(r1.status, 409);
  assert.deepEqual(locked.log.made, []);

  const done = { success: true, employeeId: "4151", sorId: "520", sorNumber: "SOR520", soTranId: "SO712473", itemsAdded: 1 };
  const again = harness({ done });
  const r2 = await again.call("post /sors/new", newSorBody());
  assert.equal(r2.status, 200);
  assert.equal(r2.body.sorNumber, "SOR520");
  assert.equal(r2.body.already, true);
  assert.deepEqual(again.log.made, [], "no second revision");
  const other = harness({ done });
  const r3 = await other.call("post /sors/new", newSorBody(), { employeeId: "999" });
  assert.equal(r3.status, 200);
  assert.deepEqual(other.log.made, ["6755862"], "another rep's attempt id is not theirs to read back");
});

test("if the rows don't all go on, the new empty revision is taken back off and nothing is left", async () => {
  const h = harness({ failWriteAt: 2 });
  const r = await h.call("post /sors/new", newSorBody([{ netsuiteId: "78085", quantity: 1 }, { netsuiteId: "78086", quantity: 1 }]));
  assert.equal(r.status, 500);
  assert.match(r.body.error, /No revision was started on SO712473/);
  assert.deepEqual(h.log.deletes, ["/customrecord_soritem/row1", "/customrecord_sor/520"]);
  assert.deepEqual(h.log.saved, []);
  assert.deepEqual(h.log.unlocked, ["6755862"]);
});

test("items no longer in NetSuite stop it before any revision is started", async () => {
  const h = harness();
  const r = await h.call("post /sors/new", newSorBody([{ netsuiteId: "99999", quantity: 1 }]));
  assert.equal(r.status, 400);
  assert.deepEqual(r.body.invalidNetsuiteIds, ["99999"]);
  assert.deepEqual(h.log.made, []);
});

test("bad input is refused", async () => {
  const h = harness();
  assert.equal((await h.call("post /sors/new", { body: { soId: "abc", attemptId: ATTEMPT, items: [] } })).status, 400);
  assert.equal((await h.call("post /sors/new", { body: { soId: "6755862", attemptId: "x", items: [{ netsuiteId: "78085", quantity: 1 }] } })).status, 400);
  assert.deepEqual(h.log.made, []);
});

test("the existing SOR push still builds and writes the same rows (moved into buildSorRows / writeSorRows)", async () => {
  const sor = {
    id: "313", number: "SOR313", status: "1", statusText: "Draft", soId: "1", soTranId: "SO712477", customerName: "x",
    customerCategoryId: "1", customerCategory: "RETAIL", created: null, lastPrinted: null, signing: null, newTotal: 0,
    customerId: "1", priceLevel: "5", customerRecordCategory: "1", existingRows: 4,
  };
  const h = harness({ sor });
  const r = await h.call("post /sors/:sorId/add-items", { params: { sorId: "313" }, body: { items: [{ netsuiteId: "78085", quantity: 3 }] } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.sorNumber, "SOR313");
  assert.equal(r.body.itemsAdded, 1);
  assert.deepEqual(h.log.creates[0].body.custrecord_soritem_sor, { id: "313" });
  assert.equal(h.log.creates[0].body.custrecord_soritem_rate, 166.66);
  assert.equal(h.log.creates[0].body.custrecord_soritem_amt, 499.98);
  assert.deepEqual(h.log.made, []);
});
