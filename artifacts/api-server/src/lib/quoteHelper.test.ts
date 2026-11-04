// node --import tsx --test src/lib/quoteHelper.test.ts (from artifacts/api-server)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { makeZip } from "./zip";
import { quoteHelperDir, quoteHelperPackage } from "./quoteHelper";

// Reads a zip back through its central directory, as unzip tools do.
function readZip(zip: Buffer): Map<string, Buffer> {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(end >= 0, "end of central directory");
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const files = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    assert.equal(zip.readUInt32LE(at), 0x02014b50);
    const method = zip.readUInt16LE(at + 10);
    const crc = zip.readUInt32LE(at + 16);
    const size = zip.readUInt32LE(at + 20);
    const nameLen = zip.readUInt16LE(at + 28);
    const local = zip.readUInt32LE(at + 42);
    const name = zip.subarray(at + 46, at + 46 + nameLen).toString("utf8");
    assert.equal(zip.readUInt32LE(local), 0x04034b50);
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const raw = zip.subarray(start, start + size);
    const data = method === 8 ? zlib.inflateRawSync(raw) : Buffer.from(raw);
    assert.equal(zlib.crc32(data) >>> 0, crc, `crc of ${name}`);
    files.set(name, data);
    at += 46 + nameLen;
  }
  return files;
}

test("makeZip round-trips stored and deflated files", () => {
  const big = Buffer.from("abc".repeat(1000));
  const tiny = Buffer.from([1, 2, 3]);
  const files = readZip(makeZip([{ name: "a/big.txt", data: big }, { name: "a\\tiny.bin", data: tiny }]));
  assert.deepEqual([...files.keys()], ["a/big.txt", "a/tiny.bin"]);
  assert.ok(files.get("a/big.txt")!.equals(big));
  assert.ok(files.get("a/tiny.bin")!.equals(tiny));
});

test("the Quote Helper zip holds every extension file under consumers-quote-helper/", () => {
  const dir = quoteHelperDir();
  assert.ok(dir, "extension folder found");
  const pkg = quoteHelperPackage(dir)!;
  const manifest = JSON.parse(fs.readFileSync(path.join(dir!, "manifest.json"), "utf8"));
  assert.equal(pkg.version, manifest.version);
  assert.equal(pkg.fileName, `consumers-quote-helper-${manifest.version}.zip`);
  const files = readZip(pkg.zip);
  for (const rel of ["manifest.json", "background.js", "extract.js", "vendor.js", "app.js", "popup.html", "popup.js", "icons/icon128.png"]) {
    const inZip = files.get(`consumers-quote-helper/${rel}`);
    assert.ok(inZip, `${rel} in the zip`);
    assert.ok(inZip!.equals(fs.readFileSync(path.join(dir!, rel))), `${rel} unchanged`);
  }
  assert.ok([...files.keys()].every(n => n.startsWith("consumers-quote-helper/") && !n.includes("/.")));
});

test("no extension folder gives no package", () => {
  assert.equal(quoteHelperPackage(null), null);
});
