// Isolated UI fixture: real modal + generated client; mocked network, no sign-in
// or writes to app data, NetSuite or analytics.
const { createRequire } = require("node:module");
const { existsSync } = require("node:fs");
const assert = require("node:assert/strict");
const esbuild = createRequire(`${process.cwd()}/artifacts/api-server/package.json`)("esbuild");
const { chromium } = require("playwright");

async function main() {
  const { outputFiles } = await esbuild.build({
    stdin: {
      contents: `
        import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
        import {ActionDrilldownModal} from './src/components/analytics/action-drilldown-modal';
        const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
        window.showModal=(type,range='7d',admins=true)=>createRoot(document.getElementById('root')).render(
          <QueryClientProvider client={client}><ActionDrilldownModal eventType={type} range={range}
            rangeLabel='Last 7 days' includeAdmins={admins} onClose={()=>{}}/></QueryClientProvider>);
      `,
      resolveDir: `${process.cwd()}/artifacts/product-selector`, loader: "tsx",
    },
    bundle: true, format: "iife", write: false, platform: "browser",
    jsx: "automatic", define: { "process.env.NODE_ENV": '"test"' },
  });
  const executablePath = process.env.CHROMIUM_PATH || (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined);
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
  try {
    const requests = [];
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    await page.route("http://analytics-fixture.test/**", async route => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' });
      requests.push(url.searchParams);
      const person = url.searchParams.get("employeeId");
      const actor = person === "anonymous" ? { employeeId: null, employeeName: "Anonymous / unattributed", count: 1 }
        : { employeeId: "42", employeeName: "Fixture User", count: 51 };
      const payload = {
        total: person === "anonymous" ? 1 : 52, page: Number(url.searchParams.get("page") || 1), pageSize: 50,
        actors: [
          { employeeId: "42", employeeName: "Fixture User", count: 51, lastSeen: "2026-11-06T15:00:00Z" },
          { employeeId: null, employeeName: "Anonymous / unattributed", count: 1, lastSeen: "2026-11-06T15:00:00Z" },
        ],
        sites: [{ domain: "vendor.test", count: 52 }],
        events: [{ id: 1, createdAt: "2026-11-06T15:00:00Z", ...actor, productName: "Fixture product",
          metadata: { vendorDomain: "vendor.test", source: "quickadd", pageUrl: "https://vendor.test/product" } }],
      };
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(payload) });
    });
    await page.goto("http://analytics-fixture.test/");
    await page.addScriptTag({ content: outputFiles[0].text });
    await page.evaluate(() => window.showModal("quickadd_capture"));
    await page.locator('[data-testid="row-actor-42"]').waitFor();
    assert.equal(requests.at(-1).get("includeAdmins"), "1");
    await page.locator('[data-testid="row-actor-42"]').click();
    await page.waitForFunction(() => document.body.textContent.includes("Action history · Fixture User"));
    assert.equal(requests.at(-1).get("employeeId"), "42");
    await page.locator('[data-testid="button-next-page"]').click();
    await page.waitForFunction(() => document.querySelector('[data-testid="text-page"]')?.textContent.includes("2 /"));
    assert.equal(requests.at(-1).get("page"), "2");
    await page.locator('[data-testid="row-actor-anonymous"]').click();
    await page.waitForFunction(() => document.body.textContent.includes("Action history · Anonymous / unattributed"));
    assert.equal(requests.at(-1).get("employeeId"), "anonymous");
    assert.equal(requests.at(-1).get("page"), "1");
    await page.getByRole("button", { name: /vendor\.test/ }).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="text-page"]')?.textContent.includes("1 /"));
    assert.equal(requests.at(-1).get("vendorDomain"), "vendor.test");
    assert.equal(requests.at(-1).get("range"), "7d");
    console.log("PASS: real analytics modal drills into users, anonymous activity, sites and paginated history with matching filters.");

    const tracker = await esbuild.build({
      entryPoints: ["artifacts/product-selector/src/lib/analytics.ts"],
      bundle: true, format: "iife", globalName: "analyticsTracker", write: false, platform: "browser",
      define: { "import.meta.env.BASE_URL": '"/"' },
    });
    const trackingPage = await browser.newPage();
    let recorded;
    await trackingPage.route("http://analytics-fixture.test/**", async route => {
      if (route.request().method() === "POST") {
        recorded = { headers: route.request().headers(), body: route.request().postDataJSON() };
        return route.fulfill({ contentType: "application/json", body: '{"ok":true,"inserted":1}' });
      }
      return route.fulfill({ contentType: "text/html", body: "<body>Analytics fixture</body>" });
    });
    await trackingPage.goto("http://analytics-fixture.test/");
    await trackingPage.addScriptTag({ content: tracker.outputFiles[0].text });
    const requestDone = trackingPage.waitForResponse("**/api/analytics/event");
    await trackingPage.evaluate(() => {
      localStorage.setItem("ps_session", "fixture-only-session");
      analyticsTracker.setAnalyticsIdentity("42");
      analyticsTracker.trackVendorSiteVisit({ id: "10", name: "Fixture vendor", websiteUrl: "https://vendor.test/" });
      window.dispatchEvent(new Event("pagehide"));
    });
    await requestDone;
    assert.equal(recorded.headers.authorization, "Bearer fixture-only-session");
    assert.equal(recorded.body.events[0].eventType, "vendor_site_visit");
    console.log("PASS: tab-hide flush retains signed attribution for vendor-site tracking.");
  } finally {
    await browser.close();
  }
}
main().catch(err => { console.error(err); process.exitCode = 1; });
