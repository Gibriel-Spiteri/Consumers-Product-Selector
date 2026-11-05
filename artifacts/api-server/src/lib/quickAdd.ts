import fs from "node:fs";
import path from "node:path";

// Consumers QuickAdd for the Group Policy install (Edge's "Control which extensions are installed silently"): the
// signed .crx made by browser-extension/pack-crx.cjs, and the update file Edge reads to install it and, every few
// hours, to look for a newer version. Both are public: Edge fetches them without anyone signed in.
export const QUICKADD_ORIGIN = "https://consumers-product-selector.replit.app";
export const QUICKADD_UPDATE_PATH = "/api/quickadd/update.xml";
export const QUICKADD_UPDATE_URL = `${QUICKADD_ORIGIN}${QUICKADD_UPDATE_PATH}`;

export interface QuickAddRelease {
  id: string;
  version: string;
  sha256: string;
  crx: Buffer;
}

export function quickAddReleaseDir(): string | null {
  const candidates = [
    path.resolve("browser-extension", "release"), // production runs from the repo root
    path.resolve("..", "..", "browser-extension", "release"), // development runs in artifacts/api-server
    ...(typeof __dirname === "string" ? [path.resolve(__dirname, "..", "..", "..", "browser-extension", "release")] : []),
  ];
  return candidates.find(dir => fs.existsSync(path.join(dir, "release.json"))) ?? null;
}

export function quickAddRelease(dir = quickAddReleaseDir()): QuickAddRelease | null {
  if (!dir) return null;
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(dir, "release.json"), "utf8")) as Record<string, unknown>;
    const { id, version, sha256 } = meta;
    if (typeof id !== "string" || !/^[a-p]{32}$/.test(id)) return null;
    if (typeof version !== "string" || !/^\d+(\.\d+){0,3}$/.test(version)) return null;
    if (typeof sha256 !== "string" || !/^[0-9a-f]{64}$/.test(sha256)) return null;
    const crx = fs.readFileSync(path.join(dir, "consumers-quickadd.crx"));
    return { id, version, sha256, crx };
  } catch {
    return null;
  }
}

export const quickAddCrxPath = (version: string) => `/api/quickadd/consumers-quickadd-${version}.crx`;

// The line for the Group Policy: "<extension id>;<update URL>".
export const quickAddPolicyValue = (id: string) => `${id};${QUICKADD_UPDATE_URL}`;

// Google's update protocol answer (gupdate), the format Edge and Chrome read for self-hosted extensions.
export function quickAddUpdateXml(release: Pick<QuickAddRelease, "id" | "version" | "sha256">): string {
  const codebase = `${QUICKADD_ORIGIN}${quickAddCrxPath(release.version)}`;
  return [
    "<?xml version='1.0' encoding='UTF-8'?>",
    "<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>",
    `  <app appid='${release.id}'>`,
    `    <updatecheck codebase='${codebase}' version='${release.version}' hash_sha256='${release.sha256}' />`,
    "  </app>",
    "</gupdate>",
    "",
  ].join("\n");
}
