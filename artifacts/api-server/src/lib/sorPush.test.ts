import { test } from "node:test";
import assert from "node:assert/strict";

process.env.NETSUITE_ACCOUNT_ID = "1212804-sb1";
process.env.DATABASE_URL ??= "postgres://unused:unused@127.0.0.1:1/unused"; // the db pool is never queried here
const {
  sorPushVerdict, sorQueryDigits, catalogRate, sorTaxable, sorSpecialOrderDesc, sorItemRow, refreshSor, BLOCK_WHILE_OUT_FOR_SIGNATURE,
} = await import("./sorPush");

const draft = { number: "SOR230", status: "1", lastPrinted: null, signing: null };

test("only a Draft revision takes items, and each refusal names why", () => {
  assert.deepEqual(sorPushVerdict(draft), { blocked: null, warning: null });
  assert.equal(sorPushVerdict({ ...draft, status: "" }).blocked, null, "a blank status is Draft, as in the workbench");
  for (const [status, words] of [["2", "submitted"], ["3", "applied"], ["5", "cancelled"], ["6", "PO check"], ["7", "approved"], ["9", "no longer a Draft"]]) {
    const v = sorPushVerdict({ ...draft, status });
    assert.ok(v.blocked && v.blocked.startsWith("SOR230 ") && v.blocked.includes(words), `${status}: ${v.blocked}`);
  }
});

test("signed or out for signature is refused; printed is allowed with a reprint warning", () => {
  assert.match(sorPushVerdict({ ...draft, signing: "signed" }).blocked ?? "", /is signed in Consumers Confirm/);
  assert.equal(BLOCK_WHILE_OUT_FOR_SIGNATURE, true);
  for (const s of ["sent", "opened"]) assert.match(sorPushVerdict({ ...draft, signing: s }).blocked ?? "", /out for signature/);
  const printed = sorPushVerdict({ ...draft, lastPrinted: "11/9/2026" });
  assert.equal(printed.blocked, null);
  assert.equal(printed.warning, "SOR230 was printed on 11/9/2026. Reprint it and have it signed again before Update Sales Order.");
  assert.match(sorPushVerdict({ ...draft, signing: "signing on paper" }).warning ?? "", /Reprint/);
  for (const text of [printed.warning, sorPushVerdict({ ...draft, status: "3" }).blocked]) {
    assert.ok(!String(text).includes(String.fromCharCode(0x2014)), "no em dashes");
  }
});

test("search input: SOR or SO number, with or without the letters", () => {
  assert.equal(sorQueryDigits("SOR230"), "230");
  assert.equal(sorQueryDigits(" sor 230 "), "230");
  assert.equal(sorQueryDigits("SO714882"), "714882");
  assert.equal(sorQueryDigits("714882"), "714882");
  assert.equal(sorQueryDigits("#231"), "231");
  assert.equal(sorQueryDigits("ES241850"), null);
  assert.equal(sorQueryDigits("230'; drop"), null);
});

const item = (over: Partial<Parameters<typeof catalogRate>[0]> = {}) => ({
  id: "78085", itemid: "KSU23189T", itemtype: "InvtPart", stockCode: "1", taxable: true, description: "23x18 Sink",
  groupRetail: null, groupCrd: null,
  // PROD pricing of KSU23189T, 11/9: Retail (base) 199.99, CRD 166.65833.
  prices: new Map([["1", 199.99], ["3", 166.65833], ["4", 150.14264]]),
  ...over,
});

test("catalog price: the customer's price level, rounded to the cent; base price otherwise", () => {
  assert.deepEqual(catalogRate(item(), "3", "2"), { listRate: 199.99, rate: 166.66 });
  assert.deepEqual(catalogRate(item(), "1", "1"), { listRate: 199.99, rate: 199.99 });
  assert.deepEqual(catalogRate(item(), "", null), { listRate: 199.99, rate: 199.99 }, "blank level = 1");
  assert.deepEqual(catalogRate(item(), "7", "2"), { listRate: 199.99, rate: 199.99 }, "no row for the level = base");
});

test("group items use their Retail or CRD group selling price by customer category", () => {
  const g = item({ itemtype: "Group", groupRetail: 500, groupCrd: 420.555, prices: new Map([["1", 600]]) });
  assert.equal(catalogRate(g, "3", "1").rate, 500);
  assert.equal(catalogRate(g, "3", "2").rate, 420.56);
  assert.equal(catalogRate(g, "3", "4").rate, 600, "other categories keep the base price");
  assert.equal(catalogRate(item({ itemtype: "Group", groupRetail: null, prices: new Map([["1", 600]]) }), "1", "1").rate, 600);
});

test("counters are never taxable on a revision", () => {
  assert.equal(sorTaxable("4", true), false);
  assert.equal(sorTaxable("1", true), true);
  assert.equal(sorTaxable(null, false), false);
});

test("SOR rows match what the Add step and the special-order popup write", () => {
  const catalog = sorItemRow({
    sorId: "230", itemId: "78085", itemtype: "InvtPart", stockCode: "1", taxable: true, description: "23x18 Sink",
    quantity: 2, listRate: 199.99, rate: 166.66,
  });
  assert.deepEqual(catalog, {
    custrecord_soritem_sor: { id: "230" }, custrecord_soritem_action: { id: "1" }, custrecord_soritem_status: { id: "1" },
    custrecord_soritem_item: { id: "78085" }, custrecord_soritem_itemtype: "InvtPart", custrecord_soritem_desc: "23x18 Sink",
    custrecord_soritem_qty: 2, custrecord_soritem_listrate: 199.99, custrecord_soritem_rate: 166.66, custrecord_soritem_amt: 333.32,
    custrecord_soritem_istaxable: true, custrecord_soritem_takeitem: false, custrecord_soritem_getoptions: false,
    custrecord_soritem_isc: 1,
  });
  // PROD SOR224 row 1549 (SP-DELTA, 11/6), rebuilt.
  const sp = sorItemRow({
    sorId: "224", itemId: "81317", itemtype: "InvtPart", stockCode: "2", taxable: true,
    description: sorSpecialOrderDesc("SP-DELTA", "BATH FAUCET", "Cassidy Faucet", 1, "3595LF-MPU-LHP", "Chrome"),
    quantity: 1, listRate: 774.3, rate: 603.92,
    specialOrder: { typeId: "3071", model: "3595LF-MPU-LHP", style: "Cassidy Faucet", color: "Chrome", perOrderForm: false, lineSeqNum: 1005 },
  });
  assert.equal(sp.custrecord_soritem_desc, "SP-DELTA\nType: BATH FAUCET\nStyle: Cassidy Faucet\nQty: 1\nModel: 3595LF-MPU-LHP\nColor: Chrome\n");
  assert.deepEqual(sp.custrecord_soritem_option_type, { id: "3071" });
  assert.deepEqual(sp.custrecord_soritem_option_asperorderform, { id: "2" });
  assert.equal(sp.custrecord_soritem_lineseqnum, 1005);
  assert.equal(sp.custrecord_soritem_amt, 603.92);
  assert.equal(sp.custrecord_soritem_isc, 2);
});

test("refreshSor opens the workbench with cpsrecalc=T and reads its answer", async () => {
  let seenUrl = "";
  const result = await refreshSor("230", {
    fetch: async (url, init) => {
      seenUrl = url;
      assert.equal(new Headers(init.headers).get("authorization"), "Bearer tok");
      return new Response(JSON.stringify({ srr: "230", ok: true, status: "1", newTotal: 23565.9, deltaTotal: 2250.71 }), { status: 200 });
    },
    token: async () => "tok",
  });
  assert.match(seenUrl, /^https:\/\/1212804-sb1\.app\.netsuite\.com\/app\/site\/hosting\/scriptlet\.nl\?script=customscript_sor_workbench&deploy=customdeploy_sor_workbench&srr=230&cpsrecalc=T$/);
  assert.deepEqual(result, { ok: true, status: "1", newTotal: 23565.9, deltaTotal: 2250.71, error: null });
  const notDraft = await refreshSor("230", { fetch: async () => new Response(JSON.stringify({ ok: false, status: "3", error: "not draft" })), token: async () => "t" });
  assert.equal(notDraft.ok, false);
  assert.equal(notDraft.error, "not draft");
  await assert.rejects(refreshSor("230", { fetch: async () => new Response("<html>", { status: 200 }), token: async () => "t" }), /did not answer/);
  await assert.rejects(refreshSor("230", { fetch: async () => new Response("", { status: 302, headers: { location: "/app/login" } }), token: async () => "t" }), /sign-in/);
});
