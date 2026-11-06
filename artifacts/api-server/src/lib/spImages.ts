import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import net from "node:net";
import { logger } from "./logger";
import { netsuiteRestlet } from "./netsuite";

// Special-order pictures on the NetSuite printouts (Gib 2026-11-06: "We'd like to get the thumbnail from the special
// items we grab from the product selector to make it to the estimate & sales order printouts").
//
// A pick from a vendor website carries the product picture's address (vendorPick.imageUrl). Vendor addresses change
// and some sites refuse other sites' requests, so the printout never points at them. When the line is pushed:
//   1. fetch the picture here (server side, so no browser CORS limits),
//   2. shrink it to a 300 x 300 white-backed JPEG (a few KB; the printout draws it about an inch square),
//   3. save it in the NetSuite File Cabinet through the SP Image Upload RESTlet (customscript_sp_image_upload, folder
//      "* Documents : Special Order Images"; the name is a hash of the JPEG, so one picture is one file),
//   4. write the file id to the line's custcol_sp_thumbnail (estimates.ts). It carries to the sales order.
// Any failure only means that line prints without a picture; the push itself never fails because of a picture.

export const THUMB_PX = 300;
const THUMB_MARGIN_PX = 10; // white space around the product inside the square
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 4;
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
export const MAX_THUMB_BYTES = 300 * 1024; // the RESTlet's own limit
export const SP_IMAGE_RESTLET = { script: "customscript_sp_image_upload", deploy: "customdeploy_sp_image_upload" } as const;

export class SpImageError extends Error {}

// Addresses a server must never be sent to on a vendor page's say-so (loopback, private networks, link-local, cloud
// metadata). The picture address comes from a vendor page through the browser extension.
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === "::" || v === "::1") return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || /^ff/.test(v);
  }
  return true;
}

async function assertPublicHost(url: URL): Promise<void> {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new SpImageError(`unsupported protocol ${url.protocol}`);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new SpImageError(`refusing host ${host}`);
  }
  const addresses = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some(a => isPrivateAddress(a.address))) {
    throw new SpImageError(`refusing private address for ${host}`);
  }
}

// Fetch the picture the extension read, following up to MAX_REDIRECTS redirects (each one re-checked).
export async function fetchVendorImage(rawUrl: string, fetchImpl: typeof fetch = fetch): Promise<Buffer> {
  let url = new URL(rawUrl);
  for (let hop = 0; ; hop++) {
    await assertPublicHost(url);
    const response = await fetchImpl(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        // The same picture the rep's browser just showed; some image CDNs refuse requests that do not look like one.
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5",
        Referer: `${url.origin}/`,
      },
    });
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      await response.body?.cancel().catch(() => {});
      if (hop >= MAX_REDIRECTS) throw new SpImageError("too many redirects");
      url = new URL(response.headers.get("location")!, url);
      continue;
    }
    if (!response.ok || !response.body) throw new SpImageError(`picture request failed: HTTP ${response.status}`);
    const type = (response.headers.get("content-type") ?? "").toLowerCase();
    if (type && !type.startsWith("image/") && !type.startsWith("application/octet-stream") && !type.startsWith("binary/")) {
      await response.body.cancel().catch(() => {});
      throw new SpImageError(`not a picture (${type})`);
    }
    const declared = Number(response.headers.get("content-length"));
    if (declared > MAX_SOURCE_BYTES) {
      await response.body.cancel().catch(() => {});
      throw new SpImageError(`picture too large (${declared} bytes)`);
    }
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      total += chunk.length;
      if (total > MAX_SOURCE_BYTES) throw new SpImageError("picture too large");
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}

type SharpFn = typeof import("sharp").default;
let sharpModule: Promise<SharpFn> | null = null;
// Loaded on first use, so a server where sharp failed to install still starts and pushes (without pictures).
function loadSharp(): Promise<SharpFn> {
  sharpModule ??= import("sharp").then(m => (m.default ?? m) as unknown as SharpFn).catch(err => {
    sharpModule = null;
    throw new SpImageError(`image library unavailable: ${err?.message ?? err}`);
  });
  return sharpModule;
}

// A 300 x 300 JPEG on white: transparency flattened to white, the plain border around the product trimmed, the
// product fitted inside a small margin. Works for anything sharp reads (JPEG, PNG, WebP, AVIF, GIF, SVG, TIFF).
export async function makeThumbnail(source: Buffer): Promise<Buffer> {
  const sharp = await loadSharp();
  const inner = THUMB_PX - 2 * THUMB_MARGIN_PX;
  const base = () => sharp(source, { failOn: "none", limitInputPixels: 50_000_000, animated: false })
    .rotate()
    .flatten({ background: "#ffffff" });
  let fitted: Buffer;
  try {
    // trim: product photos usually sit in a wide white border, which would leave a tiny product in a small square.
    const trimmed = await base().trim({ threshold: 12 }).toBuffer();
    fitted = await sharp(trimmed).resize(inner, inner, { fit: "contain", background: "#ffffff" }).toBuffer();
  } catch {
    // trim refuses a picture that is all one colour; use it untrimmed.
    fitted = await base().resize(inner, inner, { fit: "contain", background: "#ffffff" }).toBuffer();
  }
  for (const quality of [82, 70, 55]) {
    const jpeg = await sharp(fitted)
      .extend({ top: THUMB_MARGIN_PX, bottom: THUMB_MARGIN_PX, left: THUMB_MARGIN_PX, right: THUMB_MARGIN_PX, background: "#ffffff" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    if (jpeg.length <= MAX_THUMB_BYTES) return jpeg;
  }
  throw new SpImageError("thumbnail too large");
}

// File name = a hash of the JPEG, so the same picture pushed onto many estimates is one File Cabinet file.
export function thumbnailName(jpeg: Buffer): string {
  return `sp-${createHash("sha256").update(jpeg).digest("hex").slice(0, 16)}.jpg`;
}

export async function prepareThumbnail(imageUrl: string): Promise<Buffer> {
  return makeThumbnail(await fetchVendorImage(imageUrl));
}

// Save the JPEG in NetSuite; returns the File Cabinet id.
export async function uploadThumbnail(jpeg: Buffer): Promise<string> {
  const result = await netsuiteRestlet<{ ok?: boolean; fileId?: string | number; error?: string }>(
    SP_IMAGE_RESTLET.script, SP_IMAGE_RESTLET.deploy, { name: thumbnailName(jpeg), contents: jpeg.toString("base64") },
  );
  if (!result?.ok || !/^[1-9]\d*$/.test(String(result.fileId ?? ""))) {
    throw new SpImageError(`NetSuite did not save the picture: ${result?.error ?? "no file id"}`);
  }
  return String(result.fileId);
}

// Pictures for the special-order lines just added: the picture work (fetch + shrink) has been running since the push
// started; this saves each one and returns the file id per line (null where there is none). Same picture twice = one
// upload. Never throws.
export async function saveThumbnails(
  jobs: Array<Promise<Buffer | null> | null>,
  upload: (jpeg: Buffer) => Promise<string> = uploadThumbnail,
): Promise<{ fileIds: Array<string | null>; failed: number }> {
  const byName = new Map<string, Promise<string>>();
  let failed = 0;
  const fileIds: Array<string | null> = [];
  for (const job of jobs) {
    if (!job) { fileIds.push(null); continue; }
    try {
      const jpeg = await job;
      if (!jpeg) { failed++; fileIds.push(null); continue; }
      const name = thumbnailName(jpeg);
      if (!byName.has(name)) byName.set(name, upload(jpeg));
      fileIds.push(await byName.get(name)!);
    } catch (err: any) {
      failed++;
      fileIds.push(null);
      logger.warn({ err: err?.message ?? String(err) }, "Special-order picture not saved; the line prints without one");
    }
  }
  return { fileIds, failed };
}

// Start the fetch + shrink for one line now (it runs while NetSuite adds the lines). null = no picture for this line.
export function startThumbnail(imageUrl: string | null | undefined): Promise<Buffer | null> | null {
  if (!imageUrl) return null;
  const job = prepareThumbnail(imageUrl).catch(err => {
    logger.warn({ imageUrl, err: err?.message ?? String(err) }, "Special-order picture could not be prepared");
    return null;
  });
  return job;
}
