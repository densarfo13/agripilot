/**
 * build-icons.mjs — generate the rasterised PWA / iOS icons
 * from the canonical Farroway leaf SVG.
 *
 * Reads:    public/icons/farroway-mark.svg     (vector source)
 * Writes:   public/icons/icon-192.png          (192×192)
 *           public/icons/icon-512.png          (512×512)
 *           public/icons/maskable-512.png      (512×512, with safe-zone padding)
 *           public/icons/apple-touch-icon.png  (180×180)
 *           public/icons/logo-shield.png       (192×192, alias kept for old callers)
 *
 * Why: Vite copies `public/` straight into `dist/` so any
 * raster generated here ships unchanged. iOS Safari's
 * `apple-touch-icon` link tag still prefers PNG, so we keep
 * a rasterised copy alongside the vector.
 *
 * The `maskable-512` variant pads the leaf inside the safe
 * zone (40% of edge) so Android's adaptive-icon mask never
 * clips the mark. See https://w3c.github.io/manifest/#purpose-member.
 *
 * Run manually:    node scripts/build-icons.mjs
 * Run on build:    wired into `prebuild` in package.json so
 *                  every `npm run build` regenerates the icons
 *                  in lockstep with the SVG source.
 *
 * Strict-rule audit
 *   * Idempotent: writing the same SVG twice produces
 *     byte-identical PNGs.
 *   * Soft-fail: if the SVG source is missing OR sharp
 *     rejects the input, we log a warning and exit 0 — the
 *     existing PNGs in tree are kept and the build keeps
 *     moving. (Asset generation must never break the build.)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const SRC_SVG   = join(ROOT, 'public', 'icons', 'farroway-mark.svg');
const OUT_DIR   = join(ROOT, 'public', 'icons');

// Outputs: [filename, width, options]
const TARGETS = [
  ['icon-192.png',         192,  { padding: 0      }],
  ['icon-512.png',         512,  { padding: 0      }],
  ['apple-touch-icon.png', 180,  { padding: 0      }],
  // Maskable: pad the mark inside the 40 % safe zone so
  // adaptive icon shapes (circle / squircle / rounded
  // square) never clip the leaf.
  ['maskable-512.png',     512,  { padding: 0.20, bg: '#0B1220' }],
  // Legacy alias used by older import sites — keep so the
  // PWA install doesn't 404 if a stale SW returns it.
  ['logo-shield.png',      192,  { padding: 0      }],
];

async function main() {
  if (!existsSync(SRC_SVG)) {
    console.warn(`[build-icons] source SVG missing at ${SRC_SVG} — skipping`);
    return;
  }
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const svg = readFileSync(SRC_SVG);

  for (const [name, size, opts] of TARGETS) {
    const out = join(OUT_DIR, name);
    try {
      const padding = opts.padding || 0;
      const inner   = Math.round(size * (1 - padding * 2));
      const offset  = Math.round((size - inner) / 2);

      // Render the SVG into the inner box, then composite
      // onto a square canvas (transparent or branded bg).
      const inner_png = await sharp(svg, { density: 384 })
        .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

      const bg = opts.bg
        ? { r: parseInt(opts.bg.slice(1, 3), 16),
            g: parseInt(opts.bg.slice(3, 5), 16),
            b: parseInt(opts.bg.slice(5, 7), 16),
            alpha: 1 }
        : { r: 0, g: 0, b: 0, alpha: 0 };

      await sharp({
        create: {
          width:    size,
          height:   size,
          channels: 4,
          background: bg,
        },
      })
        .composite([{ input: inner_png, top: offset, left: offset }])
        .png()
        .toFile(out);

      console.log(`[build-icons] wrote ${name} (${size}×${size})`);
    } catch (err) {
      console.warn(`[build-icons] failed to render ${name}:`, err.message);
    }
  }
}

main().catch((err) => {
  console.warn('[build-icons] fatal —', err.message);
  // Exit 0 so the build never blocks on icon generation.
  process.exit(0);
});
