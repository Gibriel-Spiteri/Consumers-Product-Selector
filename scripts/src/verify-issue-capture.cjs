// Isolated browser fixture: no sign-in, app data, storage or NetSuite writes.
const { createRequire } = require("node:module");
const { existsSync } = require("node:fs");
const assert = require("node:assert/strict");
const esbuild = createRequire(`${process.cwd()}/artifacts/api-server/package.json`)("esbuild");
const { chromium } = require("playwright");

async function main() {
  const { outputFiles } = await esbuild.build({
    entryPoints: ["artifacts/product-selector/src/lib/issue-diagnostics.ts"],
    bundle: true, format: "iife", globalName: "issueDiagnostics", write: false, platform: "browser",
  });
  // Replit's Chromium wrapper includes the Nix libraries missing from downloaded browsers.
  const executablePath = process.env.CHROMIUM_PATH || (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined);
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.setContent('<html><body style="margin:0;background:white"><input style="position:absolute;left:20px;top:20px;width:400px;height:60px;color:rgb(255,0,0);font-size:36px;border:0" value="PRIVATE-FORM-VALUE"><div style="position:absolute;left:20px;top:150px;width:100px;height:100px;background:rgb(0,0,255)"></div><div data-report-overlay style="position:fixed;inset:0;background:rgb(0,255,0)">REPORT MODAL</div></body></html>');
    await page.addScriptTag({ content: outputFiles[0].text });
    const result = await page.evaluate(async () => {
      issueDiagnostics.installIssueDiagnostics();
      console.warn("Failure password=private api_key=another person@example.com");
      const logs = issueDiagnostics.browserIssueLogs();
      const blob = await issueDiagnostics.captureIssueScreenshot();
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      context.drawImage(bitmap, 0, 0);
      const marker = Array.from(context.getImageData(60, 190, 1, 1).data);
      const form = context.getImageData(20, 20, 400, 60).data;
      let redPixels = 0;
      for (let i = 0; i < form.length; i += 4) if (form[i] > 180 && form[i + 1] < 100 && form[i + 2] < 100) redPixels++;
      issueDiagnostics.clearIssueDiagnostics();
      return { type: blob.type, bytes: blob.size, width: bitmap.width, height: bitmap.height, marker, redPixels, logs, cleared: issueDiagnostics.browserIssueLogs().length };
    });
    assert.equal(result.type, "image/jpeg");
    assert.ok(result.bytes > 1000);
    assert.equal(result.width, 800); assert.equal(result.height, 600);
    assert.ok(result.marker[2] > 180 && result.marker[1] < 100, "Report overlay must be omitted");
    assert.equal(result.redPixels, 0, "Entered form text must be blanked");
    assert.ok(!JSON.stringify(result.logs).includes("person@example.com"));
    assert.ok(!JSON.stringify(result.logs).includes("password=private"));
    assert.equal(result.cleared, 0);
    console.log("PASS: JPEG screenshot, underlying page, masked form values, redacted logs and session cleanup.");
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
