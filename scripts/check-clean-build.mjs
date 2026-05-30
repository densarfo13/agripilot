#!/usr/bin/env node
/**
 * scripts/check-clean-build.mjs — Wave-23.
 *
 * Two-mode check:
 *
 * MODE A (default, runs BEFORE build): verifies stale artifacts
 * have been cleaned. Reports OK if dist/ and .vite caches are
 * absent. The pre-build invocation in build:safe sits AFTER
 * clean:build runs, so this should always pass at that point.
 *
 * MODE B (--post-build): verifies the fresh build produced a
 * non-empty dist/ with at least one bundle file dated within
 * the last 5 minutes. Confirms vite actually emitted output and
 * we're not staring at a stale cache.
 *
 * Read-only. Never mutates state.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MODE_POST = process.argv.includes('--post-build');

const FAILED = [];
const PASSED = [];
function fail(m) { FAILED.push(m); }
function pass(m) { PASSED.push(m); }

const distDir   = path.join(ROOT, 'dist');
const viteDir   = path.join(ROOT, '.vite');
const depViteDir = path.join(ROOT, 'node_modules', '.vite');

if (!MODE_POST) {
  // ─── Mode A — pre-build: no stale artifacts allowed ──────────
  if (existsSync(distDir)) {
    fail(`pre-build: stale dist/ present — run "npm run clean:build" first`);
  } else {
    pass(`pre-build: no stale dist/`);
  }
  if (existsSync(viteDir)) {
    fail(`pre-build: stale .vite/ present — run "npm run clean:build" first`);
  } else {
    pass(`pre-build: no stale .vite/ cache`);
  }
  if (existsSync(depViteDir)) {
    fail(`pre-build: stale node_modules/.vite present — run "npm run clean:build" first`);
  } else {
    pass(`pre-build: no stale node_modules/.vite cache`);
  }
} else {
  // ─── Mode B — post-build: fresh artifacts must exist ─────────
  if (!existsSync(distDir)) {
    fail(`post-build: dist/ missing — vite produced no output`);
  } else {
    // Walk one level for bundle files.
    let foundFreshBundle = false;
    let freshestMs = 0;
    let freshestName = '';
    const FIVE_MIN_MS = 5 * 60 * 1000;
    const now = Date.now();
    const walk = (dir, depth) => {
      if (depth > 3) return; // never recurse too deep
      let entries = [];
      try { entries = readdirSync(dir, { withFileTypes: true }); }
      catch { return; }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { walk(full, depth + 1); continue; }
        // Only consider bundles + entry HTML.
        if (!/\.(js|html|css)$/.test(e.name)) continue;
        let st;
        try { st = statSync(full); } catch { continue; }
        if (!st || !st.mtime) continue;
        const ms = st.mtime.getTime();
        if (ms > freshestMs) { freshestMs = ms; freshestName = e.name; }
        if ((now - ms) < FIVE_MIN_MS) foundFreshBundle = true;
      }
    };
    walk(distDir, 0);
    if (!freshestMs) {
      fail(`post-build: dist/ empty — no bundle files`);
    } else if (!foundFreshBundle) {
      const ageMin = Math.round((now - freshestMs) / 60000);
      fail(`post-build: freshest bundle "${freshestName}" is ${ageMin}m old — looks stale`);
    } else {
      pass(`post-build: dist/ contains fresh bundles (newest: ${freshestName})`);
    }
  }
}

if (FAILED.length > 0) {
  console.error(`[check:clean-build] FAIL (${MODE_POST ? 'post-build' : 'pre-build'})`);
  for (const f of FAILED) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log(`[check:clean-build] PASS (${MODE_POST ? 'post-build' : 'pre-build'})`);
for (const p of PASSED) console.log('  ✓ ' + p);
