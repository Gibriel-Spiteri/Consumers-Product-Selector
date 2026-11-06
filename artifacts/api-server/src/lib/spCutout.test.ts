// node --import tsx --test artifacts/api-server/src/lib/spCutout.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { compositeAndCrop, cutoutProduct, keepMainObject, LIMITS, maskStats, modelPredict, plainWhiteBorder, type Predict, type Rgb } from "./spCutout";
import { makeThumbnailDetailed, THUMB_PX } from "./spImages";

const W = 200, H = 160;
// A raw RGB picture: background colour, plus rectangles [x0, y0, x1, y1, colour].
const rgbOf = (bg: [number, number, number], rects: Array<[number, number, number, number, [number, number, number]]> = []): Rgb => {
  const data = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) data.set(bg, i * 3);
  for (const [x0, y0, x1, y1, c] of rects) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) data.set(c, (y * W + x) * 3);
  return { data, width: W, height: H };
};
const maskOf = (rects: Array<[number, number, number, number]>, value = 255): Uint8Array => {
  const m = new Uint8Array(W * H);
  for (const [x0, y0, x1, y1] of rects) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y * W + x] = value;
  return m;
};
const png = (rgb: Rgb) => sharp(rgb.data, { raw: { width: rgb.width, height: rgb.height, channels: 3 } }).png().toBuffer();
const BOARD: [number, number, number] = [200, 140, 80];
const BEIGE: [number, number, number] = [226, 220, 205];

test("plain white border: product on white is left alone, a tinted or busy backdrop is not", () => {
  assert.equal(plainWhiteBorder(rgbOf([255, 255, 255], [[60, 40, 140, 120, BOARD]])), true);
  assert.equal(plainWhiteBorder(rgbOf([248, 248, 246], [[60, 40, 140, 120, BOARD]])), true);
  assert.equal(plainWhiteBorder(rgbOf(BEIGE, [[60, 40, 140, 120, BOARD]])), false);
  assert.equal(plainWhiteBorder(rgbOf([255, 255, 255], [[0, 100, W - 1, H - 1, [120, 100, 90]]])), false, "floor across the bottom");
});

test("mask stats: foreground share and soft edge share", () => {
  const s = maskStats(maskOf([[0, 0, 99, H - 1]]));
  assert.equal(s.foreground, 0.5);
  assert.equal(s.softEdge, 0);
  assert.equal(maskStats(maskOf([[0, 0, W - 1, H - 1]], 128)).softEdge, 1);
});

test("keep the main object: big region, parts right next to it; drop far objects and specks", () => {
  const alpha = maskOf([
    [50, 40, 110, 140],   // vanity (main)
    [112, 60, 125, 80],   // handle just outside it (over 2% of the main area) -> kept
    [170, 90, 195, 140],  // toilet across the room -> dropped
    [5, 5, 6, 6],         // speck -> dropped
  ]);
  const kept = keepMainObject(alpha, W, H);
  assert.equal(kept[100 * W + 80], 255);
  assert.equal(kept[65 * W + 115], 255);
  assert.equal(kept[120 * W + 180], 0);
  assert.equal(kept[5 * W + 5], 0);
});

test("composite: background goes white, crop hugs the object with a small border", () => {
  const rgb = rgbOf(BEIGE, [[60, 40, 139, 119, BOARD]]);
  const out = compositeAndCrop(rgb, maskOf([[60, 40, 139, 119]]))!;
  assert.ok(out.width >= 80 && out.width <= 86 && out.height >= 80 && out.height <= 86, `${out.width}x${out.height}`);
  assert.deepEqual([...out.data.subarray(0, 3)], [255, 255, 255]);
  const mid = ((out.height >> 1) * out.width + (out.width >> 1)) * 3;
  assert.deepEqual([...out.data.subarray(mid, mid + 3)], BOARD);
});

test("cutoutProduct: plain white skips the model; a good mask is cut out; bad masks are refused", async () => {
  let calls = 0;
  const never: Predict = async () => { calls++; return new Uint8Array(W * H); };
  assert.equal((await cutoutProduct(sharp, await png(rgbOf([255, 255, 255], [[60, 40, 140, 120, BOARD]])), never)).status, "plain");
  assert.equal(calls, 0);

  const scene = await png(rgbOf(BEIGE, [[60, 40, 139, 119, BOARD]]));
  const good: Predict = async () => maskOf([[60, 40, 139, 119]]);
  const r = await cutoutProduct(sharp, scene, good);
  assert.equal(r.status, "cutout");

  const tiny: Predict = async () => maskOf([[60, 40, 62, 42]]);
  const all: Predict = async () => maskOf([[0, 0, W - 1, H - 1]]);
  const blurry: Predict = async () => maskOf([[0, 0, W - 1, 99]], 140);
  assert.match((await cutoutProduct(sharp, scene, tiny) as any).reason, /foreground/);
  assert.match((await cutoutProduct(sharp, scene, all) as any).reason, /foreground/);
  assert.match((await cutoutProduct(sharp, scene, blurry) as any).reason, /soft edge/);
  assert.ok(LIMITS.maxSoftEdge < 1);
});

test("makeThumbnail: cut out when it looks right, plain crop when refused or broken, never throws for it", async () => {
  const scene = await png(rgbOf(BEIGE, [[60, 40, 139, 119, BOARD]]));
  const cut = await makeThumbnailDetailed(scene, { predict: async () => maskOf([[60, 40, 139, 119]]) });
  assert.equal(cut.method, "cutout");
  const meta = await sharp(cut.jpeg).metadata();
  assert.equal(meta.width, THUMB_PX);
  assert.equal(meta.height, THUMB_PX);
  // the beige backdrop is gone: the corners and edges are white
  const { data } = await sharp(cut.jpeg).raw().toBuffer({ resolveWithObject: true });
  assert.ok(data[0] > 245 && data[1] > 245 && data[2] > 245, `corner ${data[0]},${data[1]},${data[2]}`);

  const broken = await makeThumbnailDetailed(scene, { predict: async () => { throw new Error("model missing"); } });
  assert.equal(broken.method, "plain-fallback");
  assert.equal(broken.reason, "model missing");
  assert.equal((await sharp(broken.jpeg).metadata()).width, THUMB_PX);

  const refused = await makeThumbnailDetailed(scene, { predict: async () => maskOf([[0, 0, W - 1, H - 1]]) });
  assert.equal(refused.method, "plain-fallback");

  const off = await makeThumbnailDetailed(scene, { cutout: false, predict: async () => { throw new Error("must not run"); } });
  assert.equal(off.method, "plain");
});

test("the real model loads (checksum) and runs on a backdrop picture in reasonable time", async () => {
  // a board on a soft beige-to-grey backdrop with a shadow, like the John Boos studio shots
  const w = 600, h = 600, data = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const g = 228 - Math.round((y / h) * 30), i = (y * w + x) * 3;
    data[i] = g; data[i + 1] = g - 4; data[i + 2] = g - 14;
    if (x > 190 && x < 420 && y > 130 && y < 480) { data[i] = 196; data[i + 1] = 134; data[i + 2] = 76; }
    else if (x > 200 && x < 430 && y > 140 && y < 492) { data[i] -= 40; data[i + 1] -= 40; data[i + 2] -= 40; }
  }
  const picture = await sharp(data, { raw: { width: w, height: h, channels: 3 } }).jpeg().toBuffer();
  const t = Date.now();
  const alpha = await modelPredict(sharp)({ data: (await sharp(picture).raw().toBuffer()), width: w, height: h });
  assert.equal(alpha.length, w * h);
  const s = maskStats(alpha);
  assert.ok(s.foreground > 0.1 && s.foreground < 0.5, `foreground ${s.foreground}`);
  const r = await makeThumbnailDetailed(picture);
  assert.equal(r.method, "cutout", r.reason);
  assert.ok(Date.now() - t < 15_000);
});
