// Isolated browser fixture using the real conversion UI, generated client and tracker.
// No application auth bypass, database changes or NetSuite requests.
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
        import {VendorConversions} from './src/components/analytics/vendor-conversions';
        const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
        const root=createRoot(document.getElementById('root'));
        window.showConversions=(range='7d',admins=false)=>root.render(
          <QueryClientProvider client={client}><VendorConversions range={range} includeAdmins={admins}/></QueryClientProvider>);
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
    let fail = false;
    const errors = [];
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on("pageerror", error => errors.push(error.message));
    const base = {
      vendorDomain: "vendor.test", employeeId: "42", employeeName: "Fixture User",
      opens: 4, captures: 5, adds: 6, pushes: 7, visits: 4,
      capturedVisits: 3, addedVisits: 2, pushedVisits: 1, unlinkedActions: 3,
    };
    await page.route("http://conversions-fixture.test/**", async route => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' });
      requests.push(url.searchParams);
      return route.fulfill({
        status: fail ? 500 : 200, contentType: "application/json",
        body: JSON.stringify(fail ? { error: "Fixture failure" } : { rows: url.searchParams.get("range") === "today" ? [] : [
          base, { ...base, vendorDomain: "other.test", employeeId: "99", employeeName: "Second User" },
          { ...base, employeeId: "99", employeeName: "Second User" },
        ] }),
      });
    });
    await page.goto("http://conversions-fixture.test/");
    await page.addScriptTag({ content: outputFiles[0].text });
    await page.evaluate(() => window.showConversions());
    await page.getByRole("table").waitFor();
    assert.equal(requests.at(-1).get("range"), "7d");
    assert.equal(requests.at(-1).get("includeAdmins"), "0");
    assert.equal(await page.locator("tbody tr").count(), 3);
    assert.ok((await page.locator("tfoot").innerText()).includes("25.0%"));
    await page.getByLabel("Conversion vendor", { exact: true }).selectOption("vendor.test");
    assert.equal(await page.locator("tbody tr").count(), 2);
    await page.getByLabel("Conversion user", { exact: true }).selectOption("42");
    assert.equal(await page.locator("tbody tr").count(), 1);
    assert.equal((await page.locator("tbody td").allTextContents()).at(-1), "25.0%");
    assert.ok((await page.locator("section").innerText()).includes("Historical events"));
    assert.ok((await page.locator("section").innerText()).includes("All stages must be recorded inside this range"));
    const rangeDone = page.waitForResponse("**/conversions?range=yesterday&includeAdmins=1");
    await page.evaluate(() => window.showConversions("yesterday", true));
    await rangeDone;
    assert.equal(requests.at(-1).get("includeAdmins"), "1");
    assert.equal(requests.at(-1).get("range"), "yesterday");
    await page.evaluate(() => window.showConversions("today", true));
    await page.getByText("No vendor activity matches these filters.").waitFor();
    fail = true;
    await page.getByRole("button", { name: "Refresh conversions" }).click();
    await page.getByRole("alert").waitFor();
    assert.equal(errors.length, 0);
    console.log("PASS: vendor and user filters, totals, distinct conversion rate, range/admin requests, empty/error states.");

    const tracker = await esbuild.build({
      entryPoints: ["artifacts/product-selector/src/lib/analytics.ts"],
      bundle: true, format: "iife", globalName: "tracker", write: false, platform: "browser",
      define: { "import.meta.env.BASE_URL": '"/"' },
    });
    let recorded;
    await page.route("**/api/analytics/event", route => {
      recorded = route.request().postDataJSON();
      return route.fulfill({ contentType: "application/json", body: '{"ok":true}' });
    });
    await page.addScriptTag({ content: tracker.outputFiles[0].text });
    const done = page.waitForResponse("**/api/analytics/event");
    await page.evaluate(() => {
      tracker.setAnalyticsIdentity("42");
      const visitId = tracker.trackVendorSiteVisit({ id: "88", name: "Fixture", websiteUrl: "https://vendor.test/" });
      tracker.trackSpecialOrderAdd({ quantity: 2, details: { productLineId: "88", productLineName: "Fixture" },
        vendorPick: { id: "pick-12345678", visitId, vendorDomain: "vendor.test", pageUrl: "https://vendor.test/product" } });
      tracker.trackPushToEstimate({ estimateId: "123", tranId: "EST123", itemCount: 2, lineCount: 1, totalValue: 0,
        specialOrderLines: [{ productLineId: "88", productLineName: "Fixture", quantity: 2,
          vendorDomain: "vendor.test", pickId: "pick-12345678", visitId }] });
      window.dispatchEvent(new Event("pagehide"));
    });
    await done;
    const [opening, add, push] = recorded.events;
    assert.ok(opening.metadata.visitId);
    assert.equal(add.metadata.visitId, opening.metadata.visitId);
    assert.equal(push.metadata.specialOrderLines[0].visitId, opening.metadata.visitId);
    assert.equal(push.metadata.specialOrderLines[0].pickId, add.metadata.pickId);
    assert.equal(push.metadata.specialOrderLines[0].productLineName, "Fixture");
    console.log("PASS: actual browser tracking preserves visit, vendor, pick and product-line metadata through add and send.");
  } finally {
    await browser.close();
  }
}
main().catch(err => { console.error(err); process.exitCode = 1; });
