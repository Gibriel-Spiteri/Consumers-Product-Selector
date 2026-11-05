// The Consumers Quote Helper extension download (staff only): the server's version and the one in this browser.

export interface QuoteHelperInfo {
  available: boolean;
  version: string | null;
  // 1.5.1: the Group Policy install (signed package on this server); null when there is none.
  policy?: { extensionId: string; version: string; updateUrl: string; value: string } | null;
}

export const QUOTE_HELPER_INFO_URL = "/api/quote-helper";
export const QUOTE_HELPER_DOWNLOAD_URL = "/api/quote-helper/download";

// A version the extension reports ("1.2.0"); anything else is ignored.
export function cleanVersion(value: unknown): string | null {
  return typeof value === "string" && /^\d+(\.\d+){0,3}$/.test(value) ? value : null;
}

// -1, 0 or 1, comparing dotted numbers ("1.10.0" is newer than "1.9.2").
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

export type QuoteHelperStatus = "not-installed" | "outdated" | "current" | "unknown";

// installed: the version this browser's extension reported. ready: the extension answered at all (1.0.0 and 1.1.0
// say their version only once, at page load, which can come before the app is listening).
export function quoteHelperStatus(installed: string | null, latest: string | null, ready = false): QuoteHelperStatus {
  if (!installed) return ready ? "unknown" : "not-installed";
  if (!latest) return "unknown";
  return compareVersions(installed, latest) < 0 ? "outdated" : "current";
}

// The file name the server sends ("consumers-quote-helper-1.2.0.zip"), or a safe default.
export function downloadFileName(contentDisposition: string | null, version: string | null): string {
  const m = /filename="?([\w.-]+\.zip)"?/i.exec(contentDisposition ?? "");
  return m ? m[1] : `consumers-quote-helper${version ? `-${version}` : ""}.zip`;
}
