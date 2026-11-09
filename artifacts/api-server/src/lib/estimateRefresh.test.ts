import { test } from "node:test";
import assert from "node:assert/strict";

process.env.NETSUITE_ACCOUNT_ID = "1212804-sb1";
process.env.DATABASE_URL ??= "postgres://unused:unused@127.0.0.1:1/unused"; // the db pool is never queried here
const { readRecalcRedirect, recalcStartUrl, refreshEstimateDiscounts, appBaseUrl } = await import("./estimateRefresh");

const FROM = "https://1212804-sb1.app.netsuite.com/app/site/hosting/scriptlet.nl?script=5120&deploy=1";

test("the engine is opened on the app domain with resave=T", () => {
  assert.equal(appBaseUrl(), "https://1212804-sb1.app.netsuite.com");
  const url = new URL(recalcStartUrl(6756278));
  assert.equal(url.searchParams.get("script"), "customscript_recalcpras");
  assert.equal(url.searchParams.get("recid"), "6756278");
  assert.equal(url.searchParams.get("rectype"), "estimate");
  assert.equal(url.searchParams.get("resave"), "T");
});

test("redirects: next pass, back on the estimate, or NetSuite's sign-in page", () => {
  // Pass redirects use NetSuite's numeric script id, not customscript_recalcpras.
  assert.deepEqual(readRecalcRedirect("/app/site/hosting/scriptlet.nl?script=5120&deploy=1&recid=1&rectype=estimate&pass=2&resave=T", FROM),
    { kind: "pass", url: "https://1212804-sb1.app.netsuite.com/app/site/hosting/scriptlet.nl?script=5120&deploy=1&recid=1&rectype=estimate&pass=2&resave=T" });
  // The real sandbox redirects of 11/9.
  assert.deepEqual(readRecalcRedirect("/app/accounting/transactions/estimate.nl?id=6756177&compid=1212804_SB1&rcresult=saved&whence=", FROM),
    { kind: "done", status: "saved", warning: null });
  assert.deepEqual(readRecalcRedirect("/app/accounting/transactions/estimate.nl?id=6756278&compid=1212804_SB1&rcresult=repriced&whence=", FROM),
    { kind: "done", status: "repriced", warning: null });
  assert.deepEqual(readRecalcRedirect(
    "/app/accounting/transactions/estimate.nl?id=1&rcresult=repriced&topalert=DISCOUNTS%3A%20Discount%20BN26%20was%20not%20applied%3A%20No%20eligible%20items", FROM),
    { kind: "done", status: "repriced", warning: "Discount BN26 was not applied: No eligible items" });
  // An engine without resave support still lands on the estimate.
  assert.deepEqual(readRecalcRedirect("/app/accounting/transactions/estimate.nl?id=1&whence=", FROM), { kind: "done", status: "unknown", warning: null });
  assert.equal(readRecalcRedirect("/app/login/secure/loginrouter.nl?c=1212804", FROM).kind, "signin");
});

function redirect(location: string): Response {
  return new Response("", { status: 302, headers: { location } });
}

test("follows the engine's passes with the bearer token and reports the last redirect", async () => {
  const seen: Array<{ url: string; auth: string | null; redirect?: RequestInit["redirect"] }> = [];
  const answers = [
    redirect("/app/site/hosting/scriptlet.nl?script=5120&deploy=1&recid=7&rectype=estimate&pass=2&resave=T"),
    redirect("/app/accounting/transactions/estimate.nl?id=7&rcresult=repriced&whence="),
  ];
  const result = await refreshEstimateDiscounts(7, {
    fetch: async (url, init) => {
      seen.push({ url, auth: new Headers(init.headers).get("authorization"), redirect: init.redirect });
      return answers.shift()!;
    },
    token: async () => "tok",
  });
  assert.equal(result.status, "repriced");
  assert.equal(result.passes, 2);
  assert.equal(seen.length, 2);
  assert.match(seen[0].url, /scriptlet\.nl\?script=customscript_recalcpras&deploy=customdeploy1&recid=7&rectype=estimate&resave=T$/);
  assert.match(seen[1].url, /pass=2&resave=T$/);
  assert.ok(seen.every(s => s.auth === "Bearer tok" && s.redirect === "manual"));
});

test("a sign-in redirect or a page instead of a redirect is an error, not a success", async () => {
  await assert.rejects(refreshEstimateDiscounts(7, {
    fetch: async () => redirect("/app/login/secure/loginrouter.nl?c=1212804"), token: async () => "tok",
  }), /did not accept/);
  await assert.rejects(refreshEstimateDiscounts(7, {
    fetch: async () => new Response("<html>error</html>", { status: 200 }), token: async () => "tok",
  }), /HTTP 200/);
});

test("stops following after too many passes", async () => {
  let calls = 0;
  await assert.rejects(refreshEstimateDiscounts(7, {
    fetch: async () => { calls++; return redirect("/app/site/hosting/scriptlet.nl?script=5120&deploy=1&pass=2"); },
    token: async () => "tok",
  }), /did not finish/);
  assert.equal(calls, 14);
});
