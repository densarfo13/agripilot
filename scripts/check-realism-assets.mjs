#!/usr/bin/env node
/**
 * check-realism-assets.mjs — standalone build-time guard.
 *
 * Scans every '/assets/realism/...' string literal in
 * src/lib/realVisuals.jsx and asserts each resolves to a real file
 * under public/. Exit code 0 on success, 1 on any miss.
 *
 * Same invariant as server/src/__tests__/realVisualsManifest.test.js
 * but runs without the vitest stack so the build pipeline can call
 * it directly (npm run check:assets) — significantly faster than
 * spinning up vitest just for this one assertion.
 *
 * Also enforces "no .webp.jpeg double extensions" as a hard rule —
 * any literal containing `.webp.jpeg` or `.webp.png` is rejected
 * even if a matching file happens to exist on disk. This is the
 * "permanent" half of the May 2026 realism asset 404 fix.
 *
 *   npm run check:assets
 *
 * Recommended hook:
 *
 *   "build:safe": "npm run check:assets && npm run build"
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

const REGISTRY = resolve(ROOT, 'src/lib/realVisuals.jsx');

function fail(msg) {
  console.error('[check:assets] FAIL —', msg);
  process.exit(1);
}

function ok(msg) {
  console.log('[check:assets]', msg);
}

if (!existsSync(REGISTRY)) {
  fail(`registry not found at ${REGISTRY}`);
}

const src = readFileSync(REGISTRY, 'utf8');

// Match any single-quoted '/assets/realism/...' literal. We scan the
// whole file so the check catches paths added in regions, packs, or
// future blocks the manifest test might not have descended into.
const re = /'(\/assets\/realism\/[^']+)'/g;
const seen = new Set();
let m;
while ((m = re.exec(src)) !== null) {
  seen.add(m[1]);
}

if (seen.size === 0) {
  fail('registry contained zero /assets/realism/ literals — the regex broke');
}

// 1. Double-extension guard — hard rule, regardless of disk state.
const doubleExt = [];
for (const p of seen) {
  if (/\.webp\.(jpe?g|png)$/i.test(p)) doubleExt.push(p);
}
if (doubleExt.length > 0) {
  console.error('[check:assets] FAIL — double-extension paths still in registry:');
  for (const p of doubleExt) console.error(`  • ${p}`);
  console.error('\nRename the file (drop the .webp prefix) and update the literal in src/lib/realVisuals.jsx.');
  process.exit(1);
}

// 2. Existence guard — every literal must resolve to a file under public/.
const missing = [];
for (const p of seen) {
  const onDisk = resolve(ROOT, 'public' + p);
  if (!existsSync(onDisk)) missing.push({ path: p, onDisk });
}
if (missing.length > 0) {
  console.error(`[check:assets] FAIL — ${missing.length} path${missing.length === 1 ? '' : 's'} in realVisuals.jsx do not exist under public/:`);
  for (const row of missing) {
    console.error(`  • ${row.path}\n      expected on disk: ${row.onDisk}`);
  }
  console.error('\nFix by either:\n  (a) committing the missing file under public/, or\n  (b) removing the stale entry from src/lib/realVisuals.jsx.');
  process.exit(1);
}

ok(`registry clean — ${seen.size} unique realism paths, all on disk, no double extensions.`);
process.exit(0);
