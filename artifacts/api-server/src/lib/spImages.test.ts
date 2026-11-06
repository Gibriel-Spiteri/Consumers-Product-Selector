// node --import tsx --test artifacts/api-server/src/lib/spImages.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  fetchVendorImage, isPrivateAddress, makeThumbnail, MAX_THUMB_BYTES, saveThumbnails, SpImageError, THUMB_PX, thumbnailName,
} from "./spImages";

const picture = (width: number, height: number, format: "png" | "webp" | "jpeg", alpha = false) => sharp({
  create: { width, height, channels: alpha ? 4 : 3, background: alpha ? { r: 0, g: 0, b: 0, alpha: 0 } : "#ffffff" },
}).composite([{
  // a tan block in the middle, like a butcher block on a white page
  input: { create: { width: Math.round(width / 3), height: Math.round(height / 2), channels: 3, background: "#c8a06e" } },
  gravity: "center",
}])[format]().toBuffer();

test("thumbnail: 300 x 300 JPEG on white, small, from PNG / WebP / JPEG", async () => {
  for (const format of ["png", "webp", "jpeg"] as const) {
    const jpeg = await makeThumbnail(await picture(2000, 1600, format));
    const meta = await sharp(jpeg).metadata();
    assert.equal(meta.format, "jpeg", format);
    assert.equal(meta.width, THUMB_PX, format);
    assert.equal(meta.height, THUMB_PX, format);
    assert.ok(jpeg.length < 30_000, `${format}: ${jpeg.length} bytes`);
    assert.equal(jpeg.subarray(0, 3).toString("hex"), "ffd8ff");
  }
});

test("thumbnail: the white border is trimmed so the product fills the square", async () => {
  const jpeg = await makeThumbnail(await picture(2000, 1600, "png"));
  const { data, info } = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true });
  // the product (tan) reaches near the top and bottom edges of the 280 px inner area, not a third of it
  const column = THUMB_PX / 2;
  const tan = (y: number) => { const i = (y * info.width + column) * info.channels; return data[i] < 230 && data[i + 2] < 160; };
  assert.ok(tan(20), "tan near the top margin");
  assert.ok(tan(THUMB_PX - 21), "tan near the bottom margin");
  assert.ok(!tan(3), "white margin kept");
});

test("thumbnail: transparency becomes white, not black", async () => {
  const jpeg = await makeThumbnail(await picture(800, 800, "png", true));
  const { data } = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true });
  assert.ok(data[0] > 240 && data[1] > 240 && data[2] > 240, `corner ${data[0]},${data[1]},${data[2]}`);
});

test("thumbnail: a plain one-colour picture still works (trim falls back)", async () => {
  const flat = await sharp({ create: { width: 400, height: 400, channels: 3, background: "#336699" } }).png().toBuffer();
  const jpeg = await makeThumbnail(flat);
  assert.equal((await sharp(jpeg).metadata()).width, THUMB_PX);
  assert.ok(jpeg.length <= MAX_THUMB_BYTES);
});

test("thumbnail: not a picture is refused", async () => {
  await assert.rejects(makeThumbnail(Buffer.from("<html>not a picture</html>")));
});

test("file name: hash of the JPEG, the shape the RESTlet accepts", async () => {
  const a = await makeThumbnail(await picture(600, 600, "png"));
  assert.match(thumbnailName(a), /^sp-[0-9a-f]{16}\.jpg$/);
  assert.equal(thumbnailName(a), thumbnailName(Buffer.from(a)));
  assert.notEqual(thumbnailName(a), thumbnailName(Buffer.concat([a, Buffer.from([0])])));
});

test("private addresses", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ["23.45.67.89", "172.32.0.1", "8.8.8.8", "2606:4700::6810:1"]) assert.equal(isPrivateAddress(ip), false, ip);
});

test("fetch: refuses local addresses before any request", async () => {
  let called = 0;
  const fake = (async () => { called++; return new Response("x"); }) as unknown as typeof fetch;
  for (const url of ["http://127.0.0.1/a.jpg", "http://localhost/a.jpg", "http://169.254.169.254/latest/meta-data", "file:///etc/passwd", "http://[::1]/a.png"]) {
    await assert.rejects(fetchVendorImage(url, fake), SpImageError, url);
  }
  assert.equal(called, 0);
});

test("fetch: follows a redirect, re-checking the next host", async () => {
  const seen: string[] = [];
  const png = await picture(100, 100, "png");
  const fake = (async (u: URL | string) => {
    const s = String(u); seen.push(s);
    if (s.includes("first")) return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/steal" } });
    return new Response(png, { headers: { "content-type": "image/png" } });
  }) as unknown as typeof fetch;
  await assert.rejects(fetchVendorImage("https://8.8.8.8/first.png", fake), SpImageError);
  assert.deepEqual(seen, ["https://8.8.8.8/first.png"]);
  const ok = (async (u: URL | string) => String(u).includes("first")
    ? new Response(null, { status: 301, headers: { location: "/second.png" } })
    : new Response(png, { headers: { "content-type": "image/png" } })) as unknown as typeof fetch;
  assert.equal((await fetchVendorImage("https://8.8.8.8/first.png", ok)).length, png.length);
});

test("fetch: refuses a page that is not a picture, and a huge one", async () => {
  const html = (async () => new Response("<html></html>", { headers: { "content-type": "text/html" } })) as unknown as typeof fetch;
  await assert.rejects(fetchVendorImage("https://8.8.8.8/p", html), /not a picture/);
  const big = (async () => new Response("x", { headers: { "content-type": "image/jpeg", "content-length": String(50 * 1024 * 1024) } })) as unknown as typeof fetch;
  await assert.rejects(fetchVendorImage("https://8.8.8.8/p.jpg", big), /too large/);
  const missing = (async () => new Response("no", { status: 404 })) as unknown as typeof fetch;
  await assert.rejects(fetchVendorImage("https://8.8.8.8/p.jpg", missing), /HTTP 404/);
});

test("saveThumbnails: one upload per picture, failures counted, never throws", async () => {
  const a = await makeThumbnail(await picture(500, 500, "png"));
  const b = await makeThumbnail(await picture(500, 300, "webp"));
  const uploads: string[] = [];
  const upload = async (jpeg: Buffer) => {
    uploads.push(thumbnailName(jpeg));
    if (jpeg === b) throw new Error("RESTlet down");
    return "501";
  };
  const { fileIds, failed } = await saveThumbnails(
    [Promise.resolve(a), null, Promise.resolve(a), Promise.resolve(null), Promise.resolve(b)], upload);
  assert.deepEqual(fileIds, ["501", null, "501", null, null]);
  assert.equal(failed, 2); // the picture that could not be prepared, and the failed upload
  assert.deepEqual(uploads, [thumbnailName(a), thumbnailName(b)]);
});
