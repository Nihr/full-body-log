// Generates icons/icon.svg, icons/icon-192.png and icons/icon-512.png.
// Run with: node tools/make-icons.js   (no dependencies)
// The design is a white barbell on the accent blue, kept inside the maskable
// safe zone so Android can crop it to any launcher shape.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG = [0x1f, 0x5e, 0xe8];
const FG = [0xff, 0xff, 0xff];
// Rounded rectangles in a 512 x 512 design space: [x, y, w, h, radius]
const SHAPES = [
  [72, 242, 368, 28, 8],     // bar
  [104, 196, 32, 120, 8],    // left outer plate
  [140, 150, 40, 212, 10],   // left inner plate
  [332, 150, 40, 212, 10],   // right inner plate
  [376, 196, 32, 120, 8],    // right outer plate
  [180, 228, 14, 56, 4],     // left collar
  [318, 228, 14, 56, 4]      // right collar
];

function inRoundRect(px, py, [x, y, w, h, r]) {
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

function render(size) {
  const ss = 4, scale = 512 / size;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const px = (x + (sx + 0.5) / ss) * scale, py = (y + (sy + 0.5) / ss) * scale;
        if (SHAPES.some(s => inRoundRect(px, py, s))) hits++;
      }
      const a = hits / (ss * ss);
      for (let c = 0; c < 3; c++) row[1 + x * 3 + c] = Math.round(BG[c] * (1 - a) + FG[c] * a);
    }
    rows.push(row);
  }
  return png(size, size, Buffer.concat(rows));
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(buf) { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))
  ]);
}

function svg() {
  const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  const rects = SHAPES.map(([x, y, w, h, r]) => `  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n  <rect width="512" height="512" rx="96" fill="${hex(BG)}"/>\n  <g fill="${hex(FG)}">\n${rects.replace(/^/gm, '  ')}\n  </g>\n</svg>\n`;
}

const out = path.join(__dirname, '..', 'icons');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon.svg'), svg());
fs.writeFileSync(path.join(out, 'icon-192.png'), render(192));
fs.writeFileSync(path.join(out, 'icon-512.png'), render(512));
console.log('Wrote icons to ' + out);
