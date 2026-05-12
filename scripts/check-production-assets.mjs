#!/usr/bin/env node
/**
 * check-production-assets.mjs — verifies the six production-critical
 * realism assets exist in BOTH .jpeg and .webp variants, plus the
 * three brand icons referenced by index.html + manifest.json.
 *
 * Why two extensions per realism asset?
 *   The canonical content is JPEG (verified with `file`). The .webp
 *   variants are conversions produced by scripts/convert-realism-to-webp.mjs
 *   for two purposes:
 *     1. Old cached bundles request .jpeg paths — those resolve.
 *     2. Future bundles can opt into .webp paths — those also resolve.
 *   The server's jpeg→webp fallback middleware redirects from
 *   .jpeg → .webp ONLY when the .jpeg is missing, so the two-file
 *   layout is a permanent stale-asset compatibility shim.
 *
 * Exit 0 on success, exit 1 on any miss. Output is greppable so a
 * CI dashboard can spot the specific missing file.
 *
 * Usage:
 *   node scripts/check-production-assets.mjs
 *   npm run check:assets   (runs the realism manifest guard alongside)
 */

import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

const REQUIRED = [
  // Realism canonical set — both extensions must exist for full
  // back-compat with cached bundles. The trio was the original
  // set; greenhouse-work + healthy-leaf were added after the
  // May 2026 console screenshot showed 404s on those paths.
  'public/assets/realism/heroes/africa-farm-atmosphere.jpeg',
  'public/assets/realism/heroes/africa-farm-atmosphere.webp',
  'public/assets/realism/journal/farm-inspection.jpeg',
  'public/assets/realism/journal/farm-inspection.webp',
  'public/assets/realism/farm/pepper-closeup.jpeg',
  'public/assets/realism/farm/pepper-closeup.webp',
  'public/assets/realism/journal/greenhouse-work.jpeg',
  'public/assets/realism/journal/greenhouse-work.webp',
  'public/assets/realism/scan/healthy-leaf.jpeg',
  'public/assets/realism/scan/healthy-leaf.webp',
  // Brand icons referenced by index.html + public/manifest.json.
  'public/icons/logo-premium.jpg',
  'public/icons/logo-premium-192.jpg',
  'public/icons/logo-premium-180.jpg',
  'public/icons/logo-premium-512.jpg',
  'public/icons/logo-premium-1024.jpg',
];

const missing = [];
const tooSmall = [];

for (const rel of REQUIRED) {
  const abs = resolve(ROOT, rel);
  if (!existsSync(abs)) {
    missing.push(rel);
    continue;
  }
  // Sanity: a real image should be at least 1 KB. A zero-byte file
  // ships as 0 bytes from the static handler and renders as broken
  // in the browser. Flag suspicious sizes so a botched convert
  // surfaces here rather than in production.
  try {
    const size = statSync(abs).size;
    if (size < 1024) tooSmall.push({ rel, size });
  } catch { /* if stat fails, treat as missing */ }
}

if (missing.length > 0 || tooSmall.length > 0) {
  if (missing.length > 0) {
    console.error(`[check:production-assets] FAIL — ${missing.length} required file${missing.length === 1 ? '' : 's'} missing:`);
    for (const rel of missing) console.error(`  • ${rel}`);
  }
  if (tooSmall.length > 0) {
    console.error(`[check:production-assets] WARN — ${tooSmall.length} file${tooSmall.length === 1 ? '' : 's'} suspiciously small (<1 KB):`);
    for (const row of tooSmall) console.error(`  • ${row.rel}  (${row.size} bytes)`);
  }
  console.error('\nFix:');
  console.error('  • Realism files: run `node scripts/convert-realism-to-webp.mjs` to regenerate the .webp variants.');
  console.error('  • Brand icons: run `node scripts/update-brand-icons.mjs` to regenerate the icon family.');
  process.exit(1);
}

console.log(`[check:production-assets] OK — ${REQUIRED.length} required files present, all ≥1 KB.`);
process.exit(0);
