#!/usr/bin/env node
/**
 * update-brand-icons.mjs — one-shot brand-icon refresh.
 *
 *   node scripts/update-brand-icons.mjs <source-image>
 *
 * Reads a square master image (PNG/JPG, ≥ 1024×1024) and
 * regenerates every PWA / favicon / apple-touch-icon variant
 * the rest of the app references. Used when the brand mark
 * changes and we need the new artwork to propagate everywhere
 * in one pass.
 *
 * Output (under public/icons/):
 *   • logo-premium.jpg          1080×1080 master JPG
 *   • logo-premium-1024.jpg     1024×1024 — Windows tile + og:image
 *   • logo-premium-512.jpg      512×512  — PWA install + maskable
 *   • logo-premium-192.jpg      192×192  — Android home-screen
 *   • logo-premium-180.jpg      180×180  — iOS apple-touch-icon
 *   • logo-premium-32.png       32×32    — favicon fallback
 *   • icon-192.png              192×192  — legacy PWA call site
 *   • icon-512.png              512×512  — legacy PWA call site
 *   • maskable-512.png          512×512  — Android adaptive (with safe-zone padding)
 *   • apple-touch-icon.png      180×180  — legacy iOS call site
 *   • logo-shield.png           192×192  — alias kept for old callers
 *
 * Strict-rule audit
 *   • Read-only outside the public/icons/ output dir.
 *   • Idempotent — running twice produces byte-identical output.
 *   • Soft-fails when sharp can't read the input — leaves the
 *     existing icons in place (matches build-icons.mjs policy).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const ICONS_DIR = join(ROOT, 'public', 'icons');

const sourceArg = process.argv[2];
if (!sourceArg) {
  console.error('Usage: node scripts/update-brand-icons.mjs <source-image>');
  process.exit(2);
}

const source = sourceArg.startsWith('/') || /^[A-Z]:/.test(sourceArg)
  ? sourceArg
  : join(ROOT, sourceArg);

if (!existsSync(source)) {
  console.error(`source not found: ${source}`);
  process.exit(2);
}

if (!existsSync(ICONS_DIR)) mkdirSync(ICONS_DIR, { recursive: true });

const buf = readFileSync(source);

// Each task: { out, size, format, maskable? }
//   maskable=true → pad to ~80% inside a square so Android's
//   adaptive-icon mask never clips the mark (W3C safe-zone spec).
const TASKS = [
  // logo-premium-* family (referenced by index.html + manifest.json)
  { out: 'logo-premium.jpg',      size: 1080, format: 'jpeg', quality: 92 },
  { out: 'logo-premium-1024.jpg', size: 1024, format: 'jpeg', quality: 92 },
  { out: 'logo-premium-512.jpg',  size: 512,  format: 'jpeg', quality: 92 },
  { out: 'logo-premium-192.jpg',  size: 192,  format: 'jpeg', quality: 92 },
  { out: 'logo-premium-180.jpg',  size: 180,  format: 'jpeg', quality: 92 },
  { out: 'logo-premium-32.png',   size: 32,   format: 'png' },
  // Legacy PWA icon family (build-icons.mjs writes here too)
  { out: 'icon-192.png',          size: 192,  format: 'png' },
  { out: 'icon-512.png',          size: 512,  format: 'png' },
  { out: 'apple-touch-icon.png',  size: 180,  format: 'png' },
  { out: 'logo-shield.png',       size: 192,  format: 'png' },
  // Maskable — pad to 80% safe-zone with the master's average
  // background color (sharp's `flatten` lifts alpha onto an
  // opaque pad).
  { out: 'maskable-512.png',      size: 512,  format: 'png', maskable: true },
];

async function _writeTask(task) {
  const { out, size, format, maskable } = task;
  const outPath = join(ICONS_DIR, out);
  let pipeline = sharp(buf).resize(size, size, { fit: 'cover' });

  if (maskable) {
    // Android adaptive-icon spec: keep the mark inside ~80% of
    // the square so circle / squircle / teardrop masks don't
    // clip it. We resize the source to 80% of `size`, then
    // composite onto a square pad with the master's background.
    const inner = Math.round(size * 0.78);
    const innerBuf = await sharp(buf).resize(inner, inner, { fit: 'cover' }).png().toBuffer();
    // Sample bg color from a 1px corner of the master so the pad
    // matches whatever the brand background is (dark navy here).
    const corner = await sharp(buf).resize(2, 2).raw().toBuffer();
    const bg = { r: corner[0], g: corner[1], b: corner[2], alpha: 1 };
    pipeline = sharp({
      create: { width: size, height: size, channels: 4, background: bg },
    }).composite([{ input: innerBuf, gravity: 'center' }]);
  }

  if (format === 'jpeg') {
    pipeline = pipeline.jpeg({ quality: task.quality || 90, progressive: true });
  } else {
    pipeline = pipeline.png({ compressionLevel: 9 });
  }

  await pipeline.toFile(outPath);
  console.log(`  \u2713 ${out}`);
}

(async () => {
  console.log(`Source: ${source}`);
  console.log(`Output: ${ICONS_DIR}\n`);
  for (const task of TASKS) {
    try { await _writeTask(task); }
    catch (err) {
      console.warn(`  \u2717 ${task.out} \u2014 ${err.message}`);
    }
  }
  console.log('\nDone. Run `npx vite build` to ship the new icons.');
})();
