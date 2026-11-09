import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function harness(storageBlocked = false, deliveryFails = false) {
  const storage = new Map<string, string>();
  const listeners = new Map<string, Function>();
  const requests: any[] = [];
  const exports: any = {};
  const source = readFileSync(new URL("./analytics.ts", import.meta.url), "utf8")
    .replace("import.meta.env.BASE_URL", '"/"');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, {
    exports,
    sessionStorage: {
      getItem(key: string) { if (storageBlocked) throw new Error("Storage blocked"); return storage.get(key); },
      setItem(key: string, value: string) { storage.set(key, value); },
    },
    localStorage: { getItem: () => "test-signed-token" },
    window: { addEventListener: (name: string, fn: Function) => listeners.set(name, fn),
      location: { pathname: "/list", search: "" } },
    document: { visibilityState: "hidden" },
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    fetch: async (_url: string, options: any) => {
      requests.push(JSON.parse(options.body));
      if (deliveryFails) throw new Error("Browser tracking unavailable");
      return { status: 200 };
    },
  });
  return { api: exports, storage, requests, flush: () => listeners.get("pagehide")!() };
}

test("estimate requests share the page-event session across flushes and reloads", () => {
  const h = harness();
  h.api.trackPageView("/list");
  const id = h.api.getAnalyticsSessionId();
  h.flush();
  assert.equal(h.requests[0].sessionId, id);
  assert.equal(h.storage.get("ps_analytics_session"), id);
  assert.equal(h.api.getAnalyticsSessionId(), id);
});

test("blocked storage and failed browser delivery do not create a new session per push or flush", () => {
  const h = harness(true, true);
  const id = h.api.getAnalyticsSessionId();
  h.api.trackPageView("/list");
  h.flush();
  assert.equal(h.requests[0].sessionId, id);
  assert.equal(h.api.getAnalyticsSessionId(), id);
  h.api.trackAddToList(1, 1);
  h.flush();
  assert.equal(h.requests[1].sessionId, id);
});

test("quote list sends analytics context with the mutation and no longer queues a browser success event", () => {
  const source = readFileSync(new URL("../pages/quote-list.tsx", import.meta.url), "utf8");
  assert.ok(source.includes("analyticsSessionId: getAnalyticsSessionId()"));
  assert.ok(source.includes("analyticsUnitPrice: i.price"));
  assert.ok(source.includes("analyticsVendorPick:"));
  assert.ok(source.includes("pickId: i.vendorPick.id, visitId: i.vendorPick.visitId"));
  assert.ok(!source.includes("trackPushToEstimate"));
});
