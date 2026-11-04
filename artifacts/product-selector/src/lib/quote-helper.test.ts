// From artifacts/api-server: node --import tsx --test ../product-selector/src/lib/quote-helper.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanVersion, compareVersions, downloadFileName, quoteHelperStatus } from "./quote-helper";

test("versions compare as dotted numbers", () => {
  assert.equal(compareVersions("1.1.0", "1.2.0"), -1);
  assert.equal(compareVersions("1.10.0", "1.9.2"), 1);
  assert.equal(compareVersions("1.2", "1.2.0"), 0);
});

test("status of the extension in this browser", () => {
  assert.equal(quoteHelperStatus(null, "1.2.0"), "not-installed");
  assert.equal(quoteHelperStatus("1.1.0", "1.2.0"), "outdated");
  assert.equal(quoteHelperStatus("1.2.0", "1.2.0"), "current");
  assert.equal(quoteHelperStatus("1.2.0", null), "unknown");
  assert.equal(quoteHelperStatus(null, "1.2.0", true), "unknown");
});

test("only plain versions and zip names are taken from outside", () => {
  assert.equal(cleanVersion("1.2.0"), "1.2.0");
  assert.equal(cleanVersion("1.2.0<script>"), null);
  assert.equal(cleanVersion(12), null);
  assert.equal(downloadFileName('attachment; filename="consumers-quote-helper-1.2.0.zip"', "1.2.0"), "consumers-quote-helper-1.2.0.zip");
  assert.equal(downloadFileName('attachment; filename="../evil.exe"', "1.2.0"), "consumers-quote-helper-1.2.0.zip");
  assert.equal(downloadFileName(null, null), "consumers-quote-helper.zip");
});
