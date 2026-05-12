#!/usr/bin/env node
/**
 * convert-realism-to-webp.mjs — one-shot JPEG→WebP converter for the
 * three canonical realism fallback images. Writes new .webp files
 * alongside their .jpeg counterparts so both extensions resolve
 * directly from disk + the server-side redirect (jpeg → webp) lands
 * on a real file.
 *
 * Idempotent — running twice produces the same bytes. Won't touch
 * the source .jpeg files.
 *
 * Usage:
 *   node scripts/convert-realism-to-webp.mjs
 */

import sharp from 'sharp';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

const PAIRS = [
  {
    src: 'public/assets/realism/heroes/africa-farm-atmosphere.jpeg',
    out: 'public/assets/realism/heroes/africa-farm-atmosphere.webp',
  },
  {
    src: 'public/assets/realism/journal/farm-inspection.jpeg',
    out: 'public/assets/realism/journal/farm-inspection.webp',
  },
  {
    src: 'public/assets/realism/farm/pepper-closeup.jpeg',
    out: 'public/assets/realism/farm/pepper-closeup.webp',
  },
  // Added after the May 2026 production console showed 404s for
  // these two specific paths. Same compatibility pattern: ship
  // .webp alongside .jpeg so cached old bundles requesting either
  // extension resolve directly from disk.
  {
    src: 'public/assets/realism/journal/greenhouse-work.jpeg',
    out: 'public/assets/realism/journal/greenhouse-work.webp',
  },
  {
    src: 'public/assets/realism/scan/healthy-leaf.jpeg',
    out: 'public/assets/realism/scan/healthy-leaf.webp',
  },
];

async function main() {
  for (const { src, out } of PAIRS) {
    const srcAbs = resolve(ROOT, src);
    const outAbs = resolve(ROOT, out);
    if (!existsSync(srcAbs)) {
      console.error(`[convert] FAIL — source missing: ${src}`);
      process.exit(1);
    }
    // quality 85 — webp default, balances fidelity + size. The
    // realism heroes carry visible texture; lower quality loses
    // crop detail on close inspection.
    await sharp(srcAbs).webp({ quality: 85 }).toFile(outAbs);
    const srcBytes = statSync(srcAbs).size;
    const outBytes = statSync(outAbs).size;
    const ratio = ((outBytes / srcBytes) * 100).toFixed(1);
    console.log(`[convert] ${src.replace('public/', '')}  →  ${out.replace('public/', '')}  (${(srcBytes / 1024).toFixed(0)} KB → ${(outBytes / 1024).toFixed(0)} KB, ${ratio}%)`);
  }
  console.log(`[convert] done — ${PAIRS.length} files converted.`);
}

main().catch((err) => {
  console.error('[convert] error:', err && err.message);
  process.exit(1);
});
