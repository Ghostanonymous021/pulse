/**
 * Generates Pulse PWA icons (PNG) without external deps.
 * Brand: near-black plate + soft white "P" mark (maskable-safe center).
 *
 * Run: node scripts/generate-pwa-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../public/icons");

const SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512];

function crcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
}
const CRC = crcTable();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  const crcData = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(crcData));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // filter none
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = deflateSync(raw, { level: 9 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function drawIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const bg = maskable ? [9, 9, 11, 255] : [9, 9, 11, 255]; // zinc-950
  const fg = [245, 245, 247, 255]; // near white

  // Fill background
  for (let i = 0; i < size * size; i++) {
    rgba[i * 4] = bg[0];
    rgba[i * 4 + 1] = bg[1];
    rgba[i * 4 + 2] = bg[2];
    rgba[i * 4 + 3] = bg[3];
  }

  const cx = size / 2;
  const cy = size / 2;
  // Safe zone for maskable ~80%; regular uses more of the canvas
  const outerR = size * (maskable ? 0.36 : 0.42);
  const ringW = size * 0.055;

  function setPx(x, y, color) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    rgba[i] = color[0];
    rgba[i + 1] = color[1];
    rgba[i + 2] = color[2];
    rgba[i + 3] = color[3];
  }

  // Soft rounded square plate (not pure circle — app-like)
  const plateR = size * (maskable ? 0.34 : 0.4);
  const corner = plateR * 0.28;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.abs(x + 0.5 - cx);
      const dy = Math.abs(y + 0.5 - cy);
      // rounded rect SDF-ish
      const hx = Math.max(dx - (plateR - corner), 0);
      const hy = Math.max(dy - (plateR - corner), 0);
      const d = Math.hypot(hx, hy) - corner;
      if (d <= 0) {
        // subtle gradient
        const t = (y / size) * 0.12;
        setPx(x, y, [
          Math.min(255, bg[0] + 18 + t * 40),
          Math.min(255, bg[1] + 18 + t * 40),
          Math.min(255, bg[2] + 22 + t * 50),
          255,
        ]);
      }
    }
  }

  // Pulse ring (outer arc)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (Math.abs(d - outerR) < ringW * 0.55) {
        setPx(x, y, fg);
      }
    }
  }

  // Inner filled circle (pulse core)
  const coreR = size * (maskable ? 0.14 : 0.16);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= coreR) setPx(x, y, fg);
    }
  }

  return encodePng(size, size, rgba);
}

mkdirSync(OUT, { recursive: true });

for (const size of SIZES) {
  const buf = drawIcon(size, { maskable: false });
  const name =
    size === 180
      ? "apple-touch-icon.png"
      : size === 192
        ? "icon-192.png"
        : size === 512
          ? "icon-512.png"
          : `icon-${size}.png`;
  writeFileSync(join(OUT, name), buf);
  if (size === 180) {
    // also keep generic name
    writeFileSync(join(OUT, "icon-180.png"), buf);
  }
  console.log("wrote", name, buf.length);
}

// Dedicated maskable 512 (more padding)
writeFileSync(join(OUT, "icon-maskable-512.png"), drawIcon(512, { maskable: true }));
writeFileSync(join(OUT, "icon-maskable-192.png"), drawIcon(192, { maskable: true }));
console.log("wrote maskable icons");
console.log("OK", OUT);
