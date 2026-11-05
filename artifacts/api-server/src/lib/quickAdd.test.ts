// node --import tsx --test src/lib/quickAdd.test.ts (from artifacts/api-server)
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { quoteHelperDir } from "./quoteHelper";
import { QUICKADD_UPDATE_URL, quickAddPolicyValue, quickAddRelease, quickAddUpdateXml } from "./quickAdd";

const require = createRequire(import.meta.url);
const { readCrx } = require(path.resolve("..", "..", "browser-extension", "pack-crx.cjs")) as {
  readCrx: (crx: Buffer) => { id: string; zip: Buffer };
};

function unzip(zip: Buffer): Map<string, Buffer> {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const files = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(at + 10);
    const size = zip.readUInt32LE(at + 20);
    const nameLen = zip.readUInt16LE(at + 28), extraLen = zip.readUInt16LE(at + 30), commentLen = zip.readUInt16LE(at + 32);
    const local = zip.readUInt32LE(at + 42);
    const name = zip.subarray(at + 46, at + 46 + nameLen).toString("utf8");
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const raw = zip.subarray(start, start + size);
    if (!name.endsWith("/")) files.set(name, method === 8 ? zlib.inflateRawSync(raw) : Buffer.from(raw));
    at += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function listFiles(dir: string, prefix = ""): string[] {
  return fs.readdirSync(path.join(dir, prefix), { withFileTypes: true }).flatMap(e => {
    if (e.name.startsWith(".")) return [];
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    return e.isDirectory() ? listFiles(dir, rel) : [rel];
  });
}

test("the signed QuickAdd package is the current extension (run pack-crx.cjs after every version bump)", () => {
  const release = quickAddRelease();
  assert.ok(release, "browser-extension/release/release.json and consumers-quickadd.crx");
  const dir = quoteHelperDir()!;
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  assert.equal(release!.version, manifest.version, "release.json version = manifest.json version");
  assert.equal(manifest.update_url, QUICKADD_UPDATE_URL, "the extension looks for updates where this server answers");

  const { id, zip } = readCrx(release!.crx); // throws when the signature does not verify
  assert.equal(id, release!.id);
  assert.equal(crypto.createHash("sha256").update(release!.crx).digest("hex"), release!.sha256);

  // Text compares without CR: the package holds LF files, a Windows checkout has CRLF ones.
  const lf = (rel: string, b: Buffer) => (/\.(js|json|html|css|txt|md)$/i.test(rel) ? Buffer.from(b.toString("utf8").replace(/\r\n/g, "\n")) : b);
  const packed = unzip(zip);
  for (const rel of listFiles(dir)) {
    assert.ok(packed.has(rel), `${rel} in the package`);
    assert.ok(lf(rel, packed.get(rel)!).equals(lf(rel, fs.readFileSync(path.join(dir, rel)))), `${rel} unchanged since packing`);
  }
  assert.equal(packed.size, listFiles(dir).length, "no extra files in the package");
});

test("the update file names the id, version, package address and hash", () => {
  const xml = quickAddUpdateXml({ id: "abcdefghijklmnopabcdefghijklmnop", version: "1.5.1", sha256: "f".repeat(64) });
  assert.match(xml, /<app appid='abcdefghijklmnopabcdefghijklmnop'>/);
  assert.match(xml, /codebase='https:\/\/consumers-product-selector\.replit\.app\/api\/quickadd\/consumers-quickadd-1\.5\.1\.crx'/);
  assert.match(xml, /version='1\.5\.1'/);
  assert.match(xml, /hash_sha256='f{64}'/);
  assert.equal(quickAddPolicyValue("abcdefghijklmnopabcdefghijklmnop"),
    "abcdefghijklmnopabcdefghijklmnop;https://consumers-product-selector.replit.app/api/quickadd/update.xml");
});
