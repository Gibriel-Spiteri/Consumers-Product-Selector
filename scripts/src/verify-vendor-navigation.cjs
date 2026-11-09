// Real native-anchor + relay + extension content bridge browser tests.
// No app sign-in bypass and no live vendor, database or NetSuite requests.
const { createRequire } = require("node:module");
const { existsSync, readFileSync } = require("node:fs");
const assert = require("node:assert/strict");
const esbuild = createRequire(`${process.cwd()}/artifacts/api-server/package.json`)("esbuild");
const { chromium } = require("playwright");

async function main() {
  const { outputFiles } = await esbuild.build({
    stdin: {
      contents: `
        import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {useVendorVisitLink} from './src/hooks/use-vendor-visit-link';
        import VendorOpenPage from './src/pages/vendor-open';
        function Link() {
          const open=useVendorVisitLink({id:'88',name:'Fixture',websiteUrl:'https://vendor.test/product'});
          return <a href="https://vendor.test/product" target="_blank" rel="noopener noreferrer"
            onClick={open} onAuxClick={open}>Shop vendor site</a>;
        }
        createRoot(document.getElementById('root')).render(<React.StrictMode>{
          location.pathname==='/vendor-open' ? <VendorOpenPage/> : <Link/>
        }</React.StrictMode>);
      `,
      resolveDir: `${process.cwd()}/artifacts/product-selector`, loader: "tsx",
    },
    bundle: true, format: "iife", write: false, platform: "browser", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"test"', "import.meta.env.BASE_URL": '"/"' },
    plugins: [{
      name: "fixture-extension-status",
      setup(build) {
        build.onResolve({ filter: /^@\/context\/vendor-picks-context$/ }, args => ({ path: args.path, namespace: "fixture" }));
        build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: "export const useVendorPicks=()=>({extensionVersion:'1.6.0'});", loader: "js",
        }));
      },
    }],
  });
  const executablePath = process.env.CHROMIUM_PATH || (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined);
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
  const bridge = readFileSync("browser-extension/consumers-quote-helper/app.js", "utf8");
  try {
    for (const mode of ["absent", "unavailable", "rejecting", "working"]) {
      const context = await browser.newContext();
      const errors = [];
      const commands = [];
      await context.exposeBinding("recordOpenCommand", (_source, command) => commands.push(command));
      await context.addInitScript(({ mode, bridge }) => {
        // Any programmatic popup would fail this test. Native anchor tabs work.
        window.open = () => { throw new Error("Asynchronous popup fallback is forbidden"); };
        if (mode === "absent" || location.hostname !== "vendor-navigation.test") return;
        window.chrome = { runtime: {
          getManifest: () => ({ version: "1.6.0" }),
          onMessage: { addListener() {} },
          async sendMessage(message) {
            if (message.type !== "open-vendor") return { picks: [] };
            window.recordOpenCommand(message);
            if (mode === "unavailable") throw new Error("Extension context invalidated");
            if (mode === "rejecting") return { ok: false };
            // The browser extension navigates the sender's exact existing tab.
            location.replace(message.websiteUrl);
            return { ok: true };
          },
        } };
        (0, eval)(bridge);
      }, { mode, bridge });
      await context.route("**/*", route => {
        const url = new URL(route.request().url());
        if (url.hostname === "vendor.test") return route.fulfill({ contentType: "text/html", body: "<h1>Fixture vendor product</h1>" });
        if (url.pathname === "/fixture.js") return route.fulfill({ contentType: "application/javascript", body: outputFiles[0].text });
        if (url.pathname.startsWith("/api/")) return route.fulfill({ contentType: "application/json", body: '{"ok":true}' });
        return route.fulfill({ contentType: "text/html", body: '<div id="root"></div><script src="/fixture.js"></script>' });
      });
      context.on("page", page => page.on("pageerror", err => errors.push(err.message)));
      const page = await context.newPage();
      await page.goto("http://vendor-navigation.test/");
      const popupReady = page.waitForEvent("popup");
      await page.getByRole("link", { name: "Shop vendor site" }).click();
      const popup = await popupReady;
      await popup.waitForURL("https://vendor.test/product", { timeout: 7000 });
      await popup.getByRole("heading", { name: "Fixture vendor product" }).waitFor();
      assert.equal(context.pages().length, 2, `${mode}: exactly one vendor tab`);
      assert.equal(errors.length, 0, `${mode}: ${errors.join(", ")}`);
      assert.equal(commands.length, mode === "absent" ? 0 : 1);
      if (commands.length) {
        assert.ok(/^[A-Za-z0-9-]{8,64}$/.test(commands[0].visitId));
        assert.equal(commands[0].productLineId, "88");
      }
      console.log(`PASS: ${mode} extension opens vendor via one native link tab without a programmatic popup.`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
main().catch(err => { console.error(err); process.exitCode = 1; });
