import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "./logger";

// Product cut out of a room or lifestyle picture (2026-11-06, Jim Baloga Jr. on the first printout samples: "give it
// instructions to remove background and room settings from the pic and to crop it as well").
//
// Runs on the server with no outside service: the small U^2-Net "u2netp" saliency model (models/u2netp.onnx, 4.6 MB,
// Apache-2.0) through onnxruntime-node, about half a second a picture.
//   - A picture already on a plain white background is left to the plain crop (makeThumbnail): nothing to remove.
//   - Otherwise the model marks the product, the main object is kept (the biggest one plus parts right next to it, so
//     a toilet beside a vanity goes but a faucet's handles stay), it is laid on white and cropped tight.
//   - A mask that looks wrong (almost nothing, almost everything, or mostly blurry edges) is refused, and the caller
//     uses the plain crop instead. So is any error, including the model or library not loading.

export const WORK_PX = 1024; // the picture is worked on at this size at most
const MODEL_PX = 320;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
const MODEL_SHA256 = "309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8";

// Mask checks (measured on vendor pictures 11/6: good cutouts had 15-35% foreground and 1-12% soft edge; white-on-white
// close-ups the model could not separate had 70-98% soft edge).
export const LIMITS = { minForeground: 0.015, maxForeground: 0.9, maxSoftEdge: 0.35, minKept: 0.01, nearGap: Number(process.env.SP_CUTOUT_GAP) || 0.15 };

type SharpFn = typeof import("sharp").default;
type Ort = typeof import("onnxruntime-node");
export interface Rgb { data: Buffer; width: number; height: number }
export type Predict = (rgb: Rgb) => Promise<Uint8Array>; // alpha 0..255, width x height

export type CutoutResult =
  | { status: "cutout"; image: Rgb; stats: MaskStats }
  | { status: "plain" }
  | { status: "rejected"; reason: string; stats?: MaskStats };
export interface MaskStats { foreground: number; softEdge: number; kept: number }

// ---------------------------------------------------------------------------------------------------------------
// The model

function modelPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.SP_CUTOUT_MODEL ?? "",
    path.resolve(here, "../models/u2netp.onnx"), // dist/index.mjs -> artifacts/api-server/models
    path.resolve(here, "../../models/u2netp.onnx"), // src/lib/spCutout.ts
    path.resolve("artifacts/api-server/models/u2netp.onnx"),
    path.resolve("models/u2netp.onnx"),
  ].filter(Boolean);
  const found = candidates.find(p => fs.existsSync(p));
  if (!found) throw new Error("cutout model u2netp.onnx not found");
  return found;
}

type Session = Awaited<ReturnType<Ort["InferenceSession"]["create"]>>;
let session: Promise<{ ort: Ort; run: Session }> | null = null;
let sessionFailedAt = 0;
function loadModel() {
  if (!session && Date.now() - sessionFailedAt > 10 * 60_000) {
    session = (async () => {
      const ort = (await import("onnxruntime-node")) as unknown as Ort;
      const file = modelPath();
      const bytes = fs.readFileSync(file);
      if (createHash("sha256").update(bytes).digest("hex") !== MODEL_SHA256) throw new Error(`cutout model ${file} is not the expected file`);
      const run = await ort.InferenceSession.create(bytes, { graphOptimizationLevel: "all", intraOpNumThreads: 2 });
      return { ort, run };
    })().catch(err => {
      session = null;
      sessionFailedAt = Date.now();
      throw err;
    });
  }
  if (!session) return Promise.reject(new Error("cutout model unavailable (retrying in a few minutes)"));
  return session;
}

// The model's saliency map for the picture, at the picture's size.
export function modelPredict(sharp: SharpFn): Predict {
  return async (rgb) => {
    const { ort, run } = await loadModel();
    const small = await sharp(rgb.data, { raw: { width: rgb.width, height: rgb.height, channels: 3 } })
      .resize(MODEL_PX, MODEL_PX, { fit: "fill", kernel: "lanczos3" }).raw().toBuffer();
    let max = 1;
    for (const v of small) if (v > max) max = v;
    const n = MODEL_PX * MODEL_PX;
    const input = new Float32Array(3 * n);
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 3; c++) input[c * n + i] = (small[i * 3 + c] / max - MEAN[c]) / STD[c];
    }
    const out = await run.run({ [run.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, MODEL_PX, MODEL_PX]) });
    const pred = out[run.outputNames[0]].data as Float32Array;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) { if (pred[i] < lo) lo = pred[i]; if (pred[i] > hi) hi = pred[i]; }
    const span = Math.max(hi - lo, 1e-6);
    const m8 = Buffer.alloc(n);
    for (let i = 0; i < n; i++) m8[i] = Math.round(((pred[i] - lo) / span) * 255);
    // resize keeps 1 channel only with extractChannel (a raw 1-channel resize comes back as 3 channels)
    const full = await sharp(m8, { raw: { width: MODEL_PX, height: MODEL_PX, channels: 1 } })
      .resize(rgb.width, rgb.height, { fit: "fill" }).extractChannel(0).raw().toBuffer();
    return new Uint8Array(full);
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Pure steps (tested without the model)

// True when the outer ring of the picture is plain white (a product shot on white): nothing to remove.
export function plainWhiteBorder(rgb: Rgb): boolean {
  const { data, width: w, height: h } = rgb;
  const ring = Math.max(2, Math.round(Math.min(w, h) * 0.02));
  let total = 0, white = 0;
  const check = (x: number, y: number) => {
    const i = (y * w + x) * 3;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    total++;
    if (Math.min(r, g, b) >= 232 && Math.max(r, g, b) - Math.min(r, g, b) <= 18) white++;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x >= ring && x < w - ring && y >= ring && y < h - ring) { x = w - ring - 1; continue; }
      check(x, y);
    }
  }
  return total > 0 && white / total >= 0.96;
}

export function maskStats(alpha: Uint8Array): { foreground: number; softEdge: number } {
  let fg = 0, some = 0, soft = 0;
  for (const a of alpha) {
    if (a > 127) fg++;
    if (a > 38) { some++; if (a < 217) soft++; }
  }
  return { foreground: fg / alpha.length, softEdge: some ? soft / some : 1 };
}

// Keep the main object: the biggest solid region of the mask, plus regions of at least 2% of its size that sit within
// 15% of its width / height of it (a faucet's separate handles, a mirror right above a vanity). Everything else (the
// toilet across the room, a basket on the floor, specks) is cleared. Returns a new alpha.
export function keepMainObject(alpha: Uint8Array, w: number, h: number): Uint8Array {
  const n = w * h;
  const label = new Int32Array(n).fill(-1);
  const comps: Array<{ area: number; x0: number; y0: number; x1: number; y1: number }> = [];
  const stack = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    if (alpha[s] <= 127 || label[s] !== -1) continue;
    const id = comps.length;
    const c = { area: 0, x0: w, y0: h, x1: -1, y1: -1 };
    let top = 0;
    stack[top++] = s; label[s] = id;
    while (top > 0) {
      const p = stack[--top];
      const x = p % w, y = (p - x) / w;
      c.area++;
      if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if ((dx === 0 && dy === 0) || nx < 0 || nx >= w) continue;
          const q = ny * w + nx;
          if (alpha[q] > 127 && label[q] === -1) { label[q] = id; stack[top++] = q; }
        }
      }
    }
    comps.push(c);
  }
  const out = new Uint8Array(n);
  if (comps.length === 0) return out;
  const main = comps.reduce((a, b) => (b.area > a.area ? b : a));
  const gx = (main.x1 - main.x0 + 1) * LIMITS.nearGap, gy = (main.y1 - main.y0 + 1) * LIMITS.nearGap;
  const keep = comps.map(c => c === main || (c.area >= main.area * 0.02
    && c.x0 <= main.x1 + gx && c.x1 >= main.x0 - gx && c.y0 <= main.y1 + gy && c.y1 >= main.y0 - gy));
  // Kept regions, grown by a few pixels so their soft edges (alpha <= 127) stay.
  const grow = Math.max(2, Math.round(Math.max(w, h) / 256));
  const keepMask = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (label[i] >= 0 && keep[label[i]]) keepMask[i] = 1;
  const rows = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = Math.max(0, x - grow); k <= Math.min(w - 1, x + grow) && !v; k++) v = keepMask[y * w + k];
      rows[y * w + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = Math.max(0, y - grow); k <= Math.min(h - 1, y + grow) && !v; k++) v = rows[k * w + x];
      if (v) out[y * w + x] = alpha[y * w + x];
    }
  }
  return out;
}

// The picture laid on white through the alpha, cropped to the kept object with a small border.
export function compositeAndCrop(rgb: Rgb, alpha: Uint8Array): Rgb | null {
  const { data, width: w, height: h } = rgb;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] > 127) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  if (x1 < 0) return null;
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.03);
  const left = Math.max(0, x0 - pad), top = Math.max(0, y0 - pad);
  const right = Math.min(w - 1, x1 + pad), bottom = Math.min(h - 1, y1 + pad);
  const cw = right - left + 1, ch = bottom - top + 1;
  const out = Buffer.alloc(cw * ch * 3);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = (y + top) * w + (x + left), a = alpha[si] / 255, di = (y * cw + x) * 3;
      for (let c = 0; c < 3; c++) out[di + c] = Math.round(data[si * 3 + c] * a + 255 * (1 - a));
    }
  }
  return { data: out, width: cw, height: ch };
}

// ---------------------------------------------------------------------------------------------------------------

// The product cut out and cropped, or why not ("plain" = already on white; "rejected" = use the plain crop).
export async function cutoutProduct(sharp: SharpFn, source: Buffer, predict: Predict = modelPredict(sharp)): Promise<CutoutResult> {
  const { data, info } = await sharp(source, { failOn: "none", limitInputPixels: 50_000_000, animated: false })
    .rotate().flatten({ background: "#ffffff" }).removeAlpha()
    .resize(WORK_PX, WORK_PX, { fit: "inside", withoutEnlargement: true }).raw().toBuffer({ resolveWithObject: true });
  const rgb: Rgb = { data, width: info.width, height: info.height };
  if (plainWhiteBorder(rgb)) return { status: "plain" };
  const alpha = await predict(rgb);
  const { foreground, softEdge } = maskStats(alpha);
  if (foreground < LIMITS.minForeground || foreground > LIMITS.maxForeground) {
    return { status: "rejected", reason: `foreground ${(foreground * 100).toFixed(1)}%`, stats: { foreground, softEdge, kept: 0 } };
  }
  if (softEdge > LIMITS.maxSoftEdge) {
    return { status: "rejected", reason: `soft edge ${(softEdge * 100).toFixed(1)}%`, stats: { foreground, softEdge, kept: 0 } };
  }
  const kept = keepMainObject(alpha, rgb.width, rgb.height);
  const keptFrac = maskStats(kept).foreground;
  const stats = { foreground, softEdge, kept: keptFrac };
  if (keptFrac < LIMITS.minKept) return { status: "rejected", reason: `kept ${(keptFrac * 100).toFixed(1)}%`, stats };
  const image = compositeAndCrop(rgb, kept);
  if (!image) return { status: "rejected", reason: "empty", stats };
  logger.debug?.({ stats }, "Special-order picture cut out");
  return { status: "cutout", image, stats };
}
