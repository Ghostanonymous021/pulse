/**
 * Generates Pulse PWA icons from the official brand mark (EKG heartbeat).
 * Source of truth: public/brand/icon-source.svg (same path as PulseMark / PulseLoader).
 *
 * Run: node scripts/generate-pwa-icons.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "public/icons");
const SOURCE = join(ROOT, "public/brand/icon-source.svg");

const SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512];

/** Full-bleed blue plate + white EKG (matches icon-source.svg). */
function svgForSize(size, { maskable = false } = {}) {
  // Maskable: keep ~20% safe padding so the mark survives Android circle crop.
  const pad = maskable ? 0.18 : 0.12;
  const inner = 1 - pad * 2;
  // Original path viewBox roughly 3687 5399 888 896
  const vbX = 3687;
  const vbY = 5399;
  const vbW = 888;
  const vbH = 896;
  const scale = (size * inner) / Math.max(vbW, vbH);
  const drawW = vbW * scale;
  const drawH = vbH * scale;
  const tx = (size - drawW) / 2 - vbX * scale;
  const ty = (size - drawH) / 2 - vbY * scale;

  const path =
    "M3927.15 5942.17c12.36,0 14.61,-20.26 18.32,-31.24l60.96 -172.37c4.17,-12.09 7.67,-21.95 12.29,-34.33 4.02,-10.78 6,-25.61 15.1,-32.6 6.03,9.41 5.68,22.88 6.79,34.44l25.59 251.42c5.2,52.39 22.45,248.81 29,284.09 6.76,36.42 61.13,44.2 72.83,15.26 24.21,-59.86 128.29,-354.78 142.46,-364.85 17.32,18.24 10.93,50.19 30,50.19l166.67 0c24.35,0 40.45,-7.08 45.32,-27.34 23.59,-98.17 -129.27,-41.54 -156.98,-60.52 -10.82,-11.75 -39.67,-101.74 -49.24,-124.05 -9.75,-22.72 -43.52,-25.28 -59.39,-14.61 -18.42,12.38 -66.09,154.95 -76.07,180.68 -5.13,13.24 -36.81,114.22 -50.3,118.57 -4.5,-8.77 -47.8,-445.7 -55.56,-527.09 -2.61,-27.36 0.85,-45.78 -20.23,-59.4 -20.48,-13.23 -48.49,-13.55 -60.82,4.31 -10.59,15.33 -137.74,397.63 -152.49,423.54 -30.33,1.93 -125.55,-4.22 -145.16,5.37 -21.64,10.59 -38.05,80.54 27.59,80.54l173.33 0z";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#2563EB"/>
  <g transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${scale.toFixed(6)})">
    <path fill="#F8FAFC" d="${path}"/>
  </g>
</svg>`;
}

function renderPng(size, opts) {
  const svg = svgForSize(size, opts);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
  });
  return resvg.render().asPng();
}

mkdirSync(OUT, { recursive: true });

for (const size of SIZES) {
  const buf = renderPng(size, { maskable: false });
  const name =
    size === 180
      ? "apple-touch-icon.png"
      : `icon-${size}.png`;
  writeFileSync(join(OUT, name), buf);
  if (size === 180) writeFileSync(join(OUT, "icon-180.png"), buf);
  console.log("wrote", name, buf.length);
}

writeFileSync(join(OUT, "icon-maskable-192.png"), renderPng(192, { maskable: true }));
writeFileSync(join(OUT, "icon-maskable-512.png"), renderPng(512, { maskable: true }));
console.log("wrote maskable icons");

// Keep a favicon-sized copy at public root if referenced
try {
  writeFileSync(join(ROOT, "public/favicon.ico"), renderPng(48, { maskable: false }));
} catch {
  /* optional */
}

console.log("OK", OUT);
console.log("Brand mark: EKG heartbeat on Pulse Blue (#2563EB) — same as PulseLoader.");
