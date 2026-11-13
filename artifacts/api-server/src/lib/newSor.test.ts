import { test } from "node:test";
import assert from "node:assert/strict";
import { createSorOnOrder, isAttemptId, newSorVerdict, OPEN_ORDER_STATUSES, readCreatedSorId, workbenchUrl } from "./newSor";

const draft = (over: any = {}) => ({
  id: "516", number: "SOR516", status: "1", statusText: "Draft", soId: "6755848", soTranId: "SO712469", customerName: "x",
  customerCategoryId: "2", customerCategory: "CRD", created: null, lastPrinted: null, signing: null, newTotal: 100,
  blocked: null, warning: null, ...over,
});
const order = (over: any = {}) => ({ tranId: "SO712469", status: "B", statusText: "Sales Order : Pending Fulfillment", openSor: null, pendingCor: false, pendingPras: 0, ...over });

test("an open order with no open revision can take a new one", () => {
  for (const status of OPEN_ORDER_STATUSES) assert.deepEqual(newSorVerdict(order({ status })), { blocked: null, offer: null });
});

test("closed and cancelled orders are refused, named as NetSuite names them", () => {
  assert.equal(newSorVerdict(order({ status: "H", statusText: "Sales Order : Closed" })).blocked, "SO712469 is Closed, so it can't take a revision.");
  assert.equal(newSorVerdict(order({ status: "C", statusText: "Sales Order : Cancelled" })).blocked, "SO712469 is Cancelled, so it can't take a revision.");
});

test("an open Draft revision is offered instead; one that can't take items, or isn't a Draft, is not", () => {
  const v = newSorVerdict(order({ openSor: draft() }));
  assert.match(v.blocked!, /SOR516 is already open on SO712469.*Push your items to SOR516 instead/);
  assert.equal(v.offer?.number, "SOR516");
  const signed = newSorVerdict(order({ openSor: draft({ blocked: "SOR516 is signed in Consumers Confirm, so it can't take new items." }) }));
  assert.equal(signed.offer, null);
  assert.match(signed.blocked!, /SOR516 is already open on SO712469 \(one open revision per order\)\. SOR516 is signed/);
  const submitted = newSorVerdict(order({ openSor: draft({ status: "2", statusText: "Submitted", blocked: "x" }) }));
  assert.equal(submitted.offer, null);
  assert.match(submitted.blocked!, /SOR516 is open on SO712469 \(Submitted\)\. A new revision can start once it is processed\./);
});

test("a pending change order or unapplied discount codes stop it, as the workbench does", () => {
  assert.match(newSorVerdict(order({ pendingCor: true })).blocked!, /change order \(COR\) waiting for verification/);
  assert.match(newSorVerdict(order({ pendingPras: 2 })).blocked!, /discount codes that have not been Applied yet/);
});

test("the new revision's id comes from the workbench's redirect", () => {
  assert.equal(readCreatedSorId("/app/site/hosting/scriptlet.nl?script=4652&deploy=1&compid=1212804_SB1&srr=516&whence="), "516");
  assert.equal(readCreatedSorId("/app/site/hosting/scriptlet.nl?script=4652&deploy=1&srr=516"), "516");
  assert.equal(readCreatedSorId("/pages/customerlogin.jsp"), null);
  assert.equal(readCreatedSorId(null), null);
});

test("createSorOnOrder: the workbench's ?soid= GET with the bearer, reading the redirect", async () => {
  const calls: any[] = [];
  const fakeFetch = async (url: string, init: any) => {
    calls.push({ url, init });
    return new Response("", { status: 302, headers: { location: "/app/site/hosting/scriptlet.nl?script=4652&deploy=1&srr=777&whence=" } });
  };
  assert.equal(await createSorOnOrder("6755848", { fetch: fakeFetch as any, token: async () => "tok" }), "777");
  assert.match(calls[0].url, /script=customscript_sor_workbench&deploy=customdeploy_sor_workbench&soid=6755848$/);
  assert.equal(calls[0].init.headers.Authorization, "Bearer tok");
  assert.equal(calls[0].init.redirect, "manual");

  const refusing = async () => new Response("<html><body>A change order is pending verification. Complete or void the COR before creating a revision request.</body></html>", { status: 500 });
  await assert.rejects(createSorOnOrder("6755848", { fetch: refusing as any, token: async () => "t" }), /A change order is pending verification/);
  const signIn = async () => new Response("", { status: 302, headers: { location: "/pages/customerlogin.jsp" } });
  await assert.rejects(createSorOnOrder("6755848", { fetch: signIn as any, token: async () => "t" }), /did not start a revision \(HTTP 302, redirected to sign-in\)/);
});

test("attempt ids and the workbench link", () => {
  assert.equal(isAttemptId("0f8fad5b-d9cb-469f-a165-70867728950e"), true);
  assert.equal(isAttemptId("short"), false);
  assert.equal(isAttemptId("x'; DROP"), false);
  assert.equal(workbenchUrl("520", "https://1212804.app.netsuite.com"),
    "https://1212804.app.netsuite.com/app/site/hosting/scriptlet.nl?script=customscript_sor_workbench&deploy=customdeploy_sor_workbench&srr=520&uimode=assistant");
});
