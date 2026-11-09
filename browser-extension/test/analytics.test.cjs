// Real background message handlers, isolated Chrome/storage/network fixtures.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

function fixture() {
  let listener;
  const requests = [];
  const local = { vendorDomains: ["vendor.test"], picks: [], siteLines: { "vendor.test": [{ id: "88", name: "Fixture" }] } };
  const session = {};
  const storage = state => ({ get: async defaults => typeof defaults === "string" ? { [defaults]: state[defaults] }
    : Array.isArray(defaults) ? Object.fromEntries(defaults.map(key => [key, state[key]])) : { ...defaults, ...state },
    set: async values => { Object.assign(state, values); } });
  const chrome = {
    runtime: { id: "fixture", getManifest: () => ({ version: "1.5.9" }),
      onMessage: { addListener: fn => { listener = fn; } },
      onInstalled: { addListener() {} }, onStartup: { addListener() {} } },
    storage: { local: storage(local), session: storage(session) },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
    tabs: { query: async () => [], update: async id => ({ id }), onRemoved: { addListener() {} } },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../consumers-quote-helper/background.js"), "utf8"), {
    chrome, URL, crypto: webcrypto, Date, AbortSignal, importScripts() {},
    ConsumersExtract: { registrableDomain: host => host.replace(/^www\./, ""), text: v => String(v || ""), number: v => Number(v) || null },
    fetch: async (url, options) => { requests.push({ url, ...options, body: JSON.parse(options.body) }); return { status: 200 }; },
  });
  const app = { id: "fixture", url: "https://consumersstore.com/special-order", tab: { id: 1 } };
  const vendor = { id: "fixture", url: "https://www.vendor.test/product?secret=hidden", tab: { id: 2 } };
  const relay = { ...app, url: "https://consumersstore.com/vendor-open", tab: { id: 2 } };
  const send = (message, sender) => new Promise(resolve => listener(message, sender, resolve));
  const settle = () => new Promise(resolve => setImmediate(resolve));
  return { requests, send, settle, app, relay, vendor, local, session };
}

test("a successful vendor capture reports signed user context, site and version exactly once", async () => {
  const h = fixture();
  await h.send({ type: "app-session", token: "fixture-only-token", name: "Fixture" }, h.app);
  assert.equal((await h.send({ type: "add-pick", pick: { name: "Fixture product", model: "123" } }, h.vendor)).ok, true);
  await h.settle();
  assert.equal(h.requests.length, 1);
  const request = h.requests[0];
  assert.equal(request.url, "https://consumersstore.com/api/analytics/event");
  assert.equal(request.headers.Authorization, "Bearer fixture-only-token");
  assert.equal(request.body.events[0].eventType, "quickadd_capture");
  assert.equal(request.body.events[0].metadata.pageUrl, "https://www.vendor.test/product");
  assert.equal(request.body.events[0].metadata.extensionVersion, "1.5.9");
  assert.ok(!JSON.stringify(request.body).includes("hidden"));
});

test("capturing a multi-part kit is one action with its item count", async () => {
  const h = fixture();
  await h.send({ type: "app-session", token: "fixture-only-token" }, h.app);
  await h.send({ type: "add-picks", picks: [{ name: "Door" }, { name: "Base" }] }, h.vendor);
  await h.settle();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].body.events[0].metadata.itemCount, 2);
});

test("signed-out and unknown-site captures never send browsing analytics", async () => {
  const h = fixture();
  await h.send({ type: "add-pick", pick: { name: "Fixture" } }, h.vendor);
  await h.settle();
  assert.equal(h.requests.length, 0);
  await h.send({ type: "app-session", token: "fixture-only-token" }, h.app);
  assert.equal((await h.send({ type: "add-pick", pick: { name: "Fixture" } },
    { ...h.vendor, url: "https://unrelated.test/page" })).ok, false);
  await h.settle();
  assert.equal(h.requests.length, 0);
});

test("only a tab explicitly opened by CPS carries its visit to picks and capture telemetry", async () => {
  const h = fixture();
  await h.send({ type: "app-session", token: "fixture-only-token" }, h.app);
  assert.equal((await h.send({ type: "open-vendor", visitId: "visit-12345678", websiteUrl: "https://vendor.test/",
    productLineId: "88", token: "fixture-only-token" }, h.relay)).ok, true);
  await h.send({ type: "add-picks", picks: [{ name: "Door", productLineId: "88" }, { name: "Base", productLineId: "88" }] }, h.vendor);
  await h.settle();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].body.events[0].metadata.visitId, "visit-12345678");
  assert.deepEqual(h.requests[0].body.events[0].metadata.pickIds, Array.from(h.local.picks, pick => pick.id));
  assert.ok(h.local.picks.every(pick => pick.visitId === "visit-12345678"));
  // Same vendor in a different tab is NOT a linked visit.
  await h.send({ type: "add-pick", pick: { name: "Elsewhere" } }, { ...h.vendor, tab: { id: 3 } });
  await h.settle();
  assert.equal(h.local.picks.at(-1).visitId, undefined);
  assert.equal(h.requests.at(-1).body.events[0].metadata.visitId, undefined);
});

test("changed sessions, wrong origins and invalid opening commands cannot link visits", async () => {
  const h = fixture();
  await h.send({ type: "app-session", token: "fixture-only-token" }, h.app);
  const open = { type: "open-vendor", visitId: "visit-12345678", websiteUrl: "https://vendor.test/",
    productLineId: "88", token: "fixture-only-token" };
  assert.equal((await h.send(open, h.vendor)).ok, false);
  assert.equal((await h.send(open, h.app)).ok, false);
  assert.equal((await h.send({ ...open, websiteUrl: "https://unknown.test/" }, h.relay)).ok, false);
  assert.equal((await h.send({ ...open, productLineId: "99" }, h.relay)).ok, false);
  assert.equal((await h.send(open, h.relay)).ok, true);
  await h.send({ type: "app-session", token: "different-fixture-token" }, h.app);
  await h.send({ type: "add-pick", pick: { name: "Changed employee" } }, h.vendor);
  await h.settle();
  assert.equal(h.local.picks[0].visitId, undefined);
  assert.equal(h.requests[0].body.events[0].metadata.visitId, undefined);
});
