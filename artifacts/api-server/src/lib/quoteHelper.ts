import fs from "node:fs";
import path from "node:path";
import { makeZip } from "./zip";

// The Consumers Quote Helper browser extension (browser-extension/consumers-quote-helper in this repo), zipped on
// request so staff can download the version this server was deployed with.
const FOLDER = "consumers-quote-helper";

export function quoteHelperDir(): string | null {
  const candidates = [
    path.resolve("browser-extension", FOLDER), // production runs from the repo root
    path.resolve("..", "..", "browser-extension", FOLDER), // development runs in artifacts/api-server
    ...(typeof __dirname === "string" ? [path.resolve(__dirname, "..", "..", "..", "browser-extension", FOLDER)] : []),
  ];
  return candidates.find(dir => fs.existsSync(path.join(dir, "manifest.json"))) ?? null;
}

function listFiles(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(path.join(dir, prefix), { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(dir, rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

export function quoteHelperVersion(dir = quoteHelperDir()): string | null {
  if (!dir) return null;
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")) as { version?: unknown };
    return typeof manifest.version === "string" && /^[0-9.]+$/.test(manifest.version) ? manifest.version : null;
  } catch {
    return null;
  }
}

// The zip unpacks to a consumers-quote-helper folder, the one Load unpacked asks for.
export function quoteHelperPackage(dir = quoteHelperDir()): { version: string; fileName: string; zip: Buffer } | null {
  const version = quoteHelperVersion(dir);
  if (!dir || !version) return null;
  const entries = listFiles(dir).sort().map(rel => {
    const file = path.join(dir, rel);
    return { name: `${FOLDER}/${rel}`, data: fs.readFileSync(file), mtime: fs.statSync(file).mtime };
  });
  return { version, fileName: `${FOLDER}-${version}.zip`, zip: makeZip(entries) };
}
