// Superseded 2026-11-04 (1.2.1): the icons now come from the Product Selector's favicon, by make-icons.py.
// Running this would bring back the old navy tile with a white plus.
// Draws the Consumers Quote Helper icons (navy rounded tile, white plus) as PNGs with Node's zlib only.
// Run: node browser-extension/make-icons.cjs
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = buf => {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size) {
  const navy = [0x0f, 0x1b, 0x33], blue = [0x1f, 0x4f, 0xd1];
  const r = size * 0.2; // corner radius
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = [0];
    for (let x = 0; x < size; x++) {
      // rounded-square mask
      const cx = Math.min(Math.max(x + 0.5, r), size - r), cy = Math.min(Math.max(y + 0.5, r), size - r);
      const inside = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r;
      // plus sign
      const t = size * 0.12, arm = size * 0.30, mid = size / 2;
      const plus = (Math.abs(x + 0.5 - mid) <= t / 2 && Math.abs(y + 0.5 - mid) <= arm) ||
        (Math.abs(y + 0.5 - mid) <= t / 2 && Math.abs(x + 0.5 - mid) <= arm);
      // blue bar along the bottom edge
      const bar = y >= size * 0.86;
      const [cr, cg, cb] = plus ? [255, 255, 255] : bar ? blue : navy;
      row.push(cr, cg, cb, inside ? 255 : 0);
    }
    rows.push(Buffer.from(row));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const dir = path.join(__dirname, "consumers-quote-helper", "icons");
fs.mkdirSync(dir, { recursive: true });
for (const size of [16, 32, 48, 128]) fs.writeFileSync(path.join(dir, `icon${size}.png`), png(size));
console.log("icons written to", dir);
