// Generates simple Lumi icons (glowing capsule on dark) as PNGs without native deps.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function lumiPixel(size) {
  const c = size / 2;
  const bodyR = size * 0.34;
  const coreR = size * 0.13;
  return (x, y) => {
    const px = x + 0.5 - c;
    const py = y + 0.5 - c;
    const d = Math.hypot(px, py);
    const rounded = Math.hypot(px, py) <= size * 0.48;
    if (!rounded) return [0, 0, 0, 0];
    // background
    let r = 10, g = 10, b = 15, a = 255;
    // outer glow
    const glow = Math.max(0, 1 - d / (size * 0.48));
    r += 20 * glow; g += 60 * glow; b += 70 * glow;
    // body (capsule-ish: ellipse taller than wide)
    const ex = px / bodyR, ey = py / (bodyR * 1.15);
    if (ex * ex + ey * ey <= 1) {
      r = 224; g = 242; b = 254;
      // eyes
      const eyeY = -size * 0.06;
      for (const ox of [-size * 0.11, size * 0.11]) {
        if (Math.hypot(px - ox, py - eyeY) <= size * 0.045) { r = 11; g = 16; b = 32; }
      }
      // core
      const cd = Math.hypot(px, py - size * 0.12);
      if (cd <= coreR) {
        const t = 1 - cd / coreR;
        r = 34 + (200 - 34) * t; g = 211 + (255 - 211) * t; b = 238;
      }
    }
    return [Math.min(255, r | 0), Math.min(255, g | 0), Math.min(255, b | 0), a];
  };
}

mkdirSync('public/icons', { recursive: true });
for (const size of [16, 48, 128]) {
  writeFileSync(`public/icons/icon${size}.png`, png(size, lumiPixel(size)));
}
console.log('icons written');
