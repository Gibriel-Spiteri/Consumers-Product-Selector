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
  const local = { vendorDomains: ["vendor.test"], picks: [], siteLines: { "vendor.test": [] } };
  const session = {};
  const storage = state => ({ get: async defaults => typeof defaults === "string" ? { [defaults]: state[defaults] } : { ...defaults, ...state },
    set: async values => { Object.assign(state, values); } });
  const chrome = {
    runtime: { id: "fixture", getManifest: () => ({ version: "1.5.9" }),
      onMessage: { addListener: fn => { listener = fn; } },
      onInstalled: { addListener() {} }, onStartup: { addListener() {} } },
    storage: { local: storage(local), session: storage(session) },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
    tabs: { query: async () => [] },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../consumers-quote-helper/background.js"), "utf8"), {
    chrome, URL, crypto: webcrypto, Date, AbortSignal, importScripts() {},
    ConsumersExtract: { registrableDomain: host => host.replace(/^www\./, ""), text: v => String(v || ""), number: v => Number(v) || null },
    fetch: async (url, options) => { requests.push({ url, ...options, body: JSON.parse(options.body) }); return { status: 200 }; },
  });
  const app = { id: "fixture", url: "https://consumersstore.com/special-order", tab: { id: 1 } };
  const vendor = { id: "fixture", url: "https://www.vendor.test/product?secret=hidden", tab: { id: 2 } };
  const send = (message, sender) => new Promise(resolve => listener(message, sender, resolve));
  const settle = () => new Promise(resolve => setImmediate(resolve));
  return { requests, send, settle, app, vendor };
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
