import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const data = JSON.parse(
  await (await import("node:fs/promises")).readFile(
    resolve("../../.local/video_data/sample.json"),
    "utf8",
  ),
);

const outDir = resolve("public/products");
mkdirSync(outDir, { recursive: true });

const all = [
  ...(data.expressBath ?? []),
  ...(data.ppr ?? []),
  ...(data.products ?? []),
];

const seen = new Set();
let count = 0;
for (const item of all) {
  if (!item.image_url) continue;
  const safe = item.sku.replace(/[^A-Za-z0-9._-]/g, "_") + ".jpg";
  if (seen.has(safe)) continue;
  seen.add(safe);
  const out = resolve(outDir, safe);
  if (existsSync(out)) { count++; continue; }
  try {
    const r = await fetch(item.image_url);
    if (!r.ok) { console.log("skip", item.sku, r.status); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    writeFileSync(out, buf);
    count++;
    console.log("ok", safe, buf.length);
  } catch (e) {
    console.log("err", item.sku, e.message);
  }
}
console.log("Saved", count, "images");
