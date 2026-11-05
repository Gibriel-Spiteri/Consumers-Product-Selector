#!/usr/bin/env node
// Packs Consumers QuickAdd (browser-extension/consumers-quote-helper) into a signed .crx for the Group Policy install
// (Edge's "Control which extensions are installed silently"), with Microsoft Edge's own packer, and writes:
//   browser-extension/release/consumers-quickadd.crx
//   browser-extension/release/release.json   { id, version, sha256, packedAt }
// The Product Selector serves both at /api/quickadd/update.xml and /api/quickadd/consumers-quickadd-<version>.crx.
//
// Run it after every change to the extension (after bumping "version" in manifest.json), then commit release/:
//   node browser-extension/pack-crx.cjs
// The private key signs every version and fixes the extension id that the Group Policy names. It NEVER goes in the
// repo. Default: Documents\ConsumersQuickAdd-signing\consumers-quickadd.pem (or --key <file>, or QUICKADD_KEY).
// Keep a backup: a lost key means a new id, and every PC's policy line has to change.
// --new-key makes the key the first time only; it refuses to run without a key otherwise.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const HERE = __dirname;
const SRC = path.join(HERE, "consumers-quote-helper");
const OUT = path.join(HERE, "release");
const args = process.argv.slice(2);
const argValue = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const KEY = path.resolve(argValue("--key") || process.env.QUICKADD_KEY
  || path.join(os.homedir(), "Documents", "ConsumersQuickAdd-signing", "consumers-quickadd.pem"));
const NEW_KEY = args.includes("--new-key");
const EDGE = process.env.MSEDGE || [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find(p => fs.existsSync(p));

function fail(message) {
  console.error(`pack-crx: ${message}`);
  process.exit(1);
}

// CRX3: "Cr24", version 3, header size, a CrxFileHeader protobuf, then the zip. Reads the RSA proof and the signed
// header data, and checks the signature the way the browser does.
function readVarint(buf, at) {
  let value = 0, shift = 0, byte;
  do {
    byte = buf[at++];
    value += (byte & 0x7f) * 2 ** shift;
    shift += 7;
  } while (byte & 0x80);
  return [value, at];
}
function protoFields(buf) {
  const fields = [];
  for (let at = 0; at < buf.length;) {
    let key;
    [key, at] = readVarint(buf, at);
    const field = Math.floor(key / 8), wire = key & 7;
    if (wire === 2) {
      let len;
      [len, at] = readVarint(buf, at);
      fields.push({ field, data: buf.subarray(at, at + len) });
      at += len;
    } else if (wire === 0) {
      [, at] = readVarint(buf, at);
    } else {
      throw new Error(`unexpected protobuf wire type ${wire}`);
    }
  }
  return fields;
}
function readCrx(crx) {
  if (crx.toString("latin1", 0, 4) !== "Cr24") throw new Error("not a CRX file");
  if (crx.readUInt32LE(4) !== 3) throw new Error(`CRX version ${crx.readUInt32LE(4)}, want 3`);
  const headerSize = crx.readUInt32LE(8);
  const header = crx.subarray(12, 12 + headerSize);
  const zip = crx.subarray(12 + headerSize);
  const fields = protoFields(header);
  const proof = fields.find(f => f.field === 2); // sha256_with_rsa
  const signedHeader = fields.find(f => f.field === 10000);
  if (!proof || !signedHeader) throw new Error("CRX header has no RSA proof or signed data");
  const proofFields = protoFields(proof.data);
  const publicKey = proofFields.find(f => f.field === 1).data;
  const signature = proofFields.find(f => f.field === 2).data;
  const crxId = protoFields(signedHeader.data).find(f => f.field === 1).data;
  const digest = crypto.createHash("sha256").update(publicKey).digest();
  if (!digest.subarray(0, 16).equals(crxId)) throw new Error("CRX id does not match its public key");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(signedHeader.data.length);
  const signed = Buffer.concat([Buffer.from("CRX3 SignedData\x00", "latin1"), len, signedHeader.data, zip]);
  const key = crypto.createPublicKey({ key: publicKey, format: "der", type: "spki" });
  if (!crypto.verify("sha256", signed, key, signature)) throw new Error("CRX signature does not verify");
  // The extension id: the first 16 bytes of the key's SHA-256, each hex digit 0-f written as a-p.
  const id = [...crxId.toString("hex")].map(c => String.fromCharCode(97 + parseInt(c, 16))).join("");
  return { id, zip };
}

// Text files go in with plain LF line endings, as the repo stores them: a Windows checkout has CRLF, and the package
// should not depend on which PC packed it.
const TEXT = /\.(js|json|html|css|txt|md)$/i;
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const a = path.join(from, entry.name), b = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(a, b);
    else if (entry.isFile() && TEXT.test(entry.name)) fs.writeFileSync(b, fs.readFileSync(a, "utf8").replace(/\r\n/g, "\n"));
    else if (entry.isFile()) fs.copyFileSync(a, b);
  }
}

if (require.main === module) {
  if (!EDGE) fail("Microsoft Edge (msedge.exe) not found; set MSEDGE to its path.");
  const haveKey = fs.existsSync(KEY);
  if (!haveKey && !NEW_KEY) fail(`no signing key at ${KEY}. Use --key <file>, or --new-key the very first time only.`);
  if (haveKey && NEW_KEY) fail(`a key already exists at ${KEY}; drop --new-key (a new key would change the extension id).`);
  const version = JSON.parse(fs.readFileSync(path.join(SRC, "manifest.json"), "utf8")).version;

  // Pack a copy in a temp folder, so Edge writes nothing next to the repo's folder (the new key above all).
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "quickadd-pack-"));
  const ext = path.join(stage, "consumers-quickadd");
  copyDir(SRC, ext);
  const edgeArgs = [`--pack-extension=${ext}`, ...(haveKey ? [`--pack-extension-key=${KEY}`] : []),
    `--user-data-dir=${path.join(stage, "profile")}`, "--no-message-box", "--no-first-run", "--no-default-browser-check"];
  const run = spawnSync(EDGE, edgeArgs, { encoding: "utf8", timeout: 120000 });
  const crxFile = `${ext}.crx`;
  for (let i = 0; i < 40 && !fs.existsSync(crxFile); i++) spawnSync(process.execPath, ["-e", "setTimeout(()=>{},250)"]);
  if (!fs.existsSync(crxFile)) fail(`Edge did not write the .crx (exit ${run.status}). ${run.stderr || run.stdout || ""}`.trim());
  if (!haveKey) {
    fs.mkdirSync(path.dirname(KEY), { recursive: true });
    fs.copyFileSync(`${ext}.pem`, KEY);
    console.log(`New signing key saved to ${KEY}. Back it up somewhere safe.`);
  }

  const crx = fs.readFileSync(crxFile);
  const { id } = readCrx(crx);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "consumers-quickadd.crx"), crx);
  const release = {
    id,
    version,
    sha256: crypto.createHash("sha256").update(crx).digest("hex"),
    packedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUT, "release.json"), JSON.stringify(release, null, 2) + "\n");
  fs.rmSync(stage, { recursive: true, force: true });
  console.log(`Packed Consumers QuickAdd ${version}: id ${id}, ${crx.length} bytes, signature verified.`);
}

module.exports = { readCrx };
