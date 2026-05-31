#!/usr/bin/env node
/**
 * scripts/check-bundle-budget.mjs — REAL post-build byte budget.
 *
 * Runs AFTER `npm run build` (appended to build:safe after the build
 * step) so dist/ exists. Reads dist/index.html, extracts the initial
 * critical path the browser fetches eagerly — the entry <script> plus
 * every <link rel="modulepreload"> — and sums the actual bytes of
 * those .js files. Fails if the eager initial path exceeds the budget.
 *
 * This is the deterministic byte budget the runtime __bundleHealth()
 * probe could only estimate. Skips (passes) when dist/ is absent so
 * running the gate standalone (without a build) doesn't false-fail.
 *
 * Budget is a RATCHET ceiling set just above the measured size; lower
 * it as the bundle shrinks. Read-only.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const INDEX = path.join(DIST, 'index.html');

// Ratchet ceilings (KB). Measured initial-path raw ≈ 2715 KB; budget
// set ~10% above so it passes now and catches regressions/growth.
const RAW_BUDGET_KB  = 3000;
const GZIP_BUDGET_KB = 1100;

if (!fs.existsSync(INDEX)) {
  console.log('[check:bundle-budget] SKIP — dist/index.html not present (run after `npm run build`).');
  process.exit(0);
}

const html = fs.readFileSync(INDEX, 'utf8');
// Eager initial path: entry <script src> + <link rel=modulepreload href>.
const refs = new Set();
const re = /(?:src|href)="(\/assets\/[^"]+\.js)"/g;
let m;
while ((m = re.exec(html))) refs.add(m[1]);

let rawBytes = 0, gzBytes = 0;
const missing = [];
for (const ref of refs) {
  const p = path.join(DIST, ref.replace(/^\//, ''));
  try {
    const buf = fs.readFileSync(p);
    rawBytes += buf.length;
    gzBytes  += zlib.gzipSync(buf).length;
  } catch { missing.push(ref); }
}

const rawKb  = Math.round(rawBytes / 1024);
const gzKb   = Math.round(gzBytes / 1024);
const FAIL = [];
if (rawKb > RAW_BUDGET_KB)  FAIL.push(`initial-path RAW ${rawKb}KB > budget ${RAW_BUDGET_KB}KB`);
if (gzKb  > GZIP_BUDGET_KB) FAIL.push(`initial-path GZIP ${gzKb}KB > budget ${GZIP_BUDGET_KB}KB`);

if (FAIL.length) {
  console.error('[check:bundle-budget] FAIL');
  for (const f of FAIL) console.error('  ✗ ' + f);
  console.error('    The eager initial critical path grew past budget. Move new heavy');
  console.error('    code into a lazy chunk, or justify + raise the ceiling deliberately.');
  process.exit(1);
}
console.log(`[check:bundle-budget] PASS — initial path ${rawKb}KB raw / ${gzKb}KB gzip `
  + `(budget ${RAW_BUDGET_KB}/${GZIP_BUDGET_KB}KB), ${refs.size} eager chunks.`);
if (missing.length) console.log('  (note: ' + missing.length + ' referenced chunk(s) not found on disk)');
