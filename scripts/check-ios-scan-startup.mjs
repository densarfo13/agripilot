#!/usr/bin/env node
/**
 * scripts/check-ios-scan-startup.mjs — wave iOS root-cause gate.
 *
 * Fails the build if any of the iPhone scan-startup regressions
 * resurfaces:
 *
 *   • ScanPage uses setTimeout(... 0) to flip `mounted`
 *     (must be queueMicrotask + Promise.resolve fallback)
 *   • Scan startup hard-stop > 5000ms
 *   • Hard-stop reads the bare `mounted` state instead of a ref
 *     (closure-stale read)
 *   • data-testid="scan-capture" is missing from ScanPage's
 *     mount path
 *   • Upload Photo fallback testid is missing from ScanFallback
 *   • "Preparing scan…" can render without a 5s recovery wired
 *
 * Read-only. Never mutates source.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
function fail(m) { FAILED.push(m); }
function pass(m) { PASSED.push(m); }

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch { return ''; }
}
function requireFile(rel, label) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    fail(`${label}: ${rel} must exist`);
    return '';
  }
  pass(`${label}: ${rel} present`);
  return read(full);
}

// ─── 1. ScanPage mount flip uses queueMicrotask ────────────────
const scanPageSrc = requireFile('src/pages/ScanPage.jsx', 'scan-page');

// Detect the regressed pattern: `setTimeout(... setMounted(true) ..., 0)`
// (allow whitespace and arbitrary fn name "setMounted" only).
const REGRESSED_MACROTASK = /setTimeout\([^)]*setMounted\s*\(\s*true\s*\)[^)]*,\s*0\s*\)/;
if (REGRESSED_MACROTASK.test(scanPageSrc)) {
  fail('scan-page: setTimeout(... setMounted(true) ..., 0) is the regressed macrotask path — must use queueMicrotask + Promise.resolve fallback');
}
if (!/queueMicrotask/.test(scanPageSrc)) {
  fail('scan-page: must use queueMicrotask to flip mounted (root-cause fix)');
}
if (!/Promise\.resolve\(\)\.then/.test(scanPageSrc)) {
  fail('scan-page: must fall back to Promise.resolve().then(...) when queueMicrotask is unavailable');
}

// ─── 2. Hard-stop ≤ 5000ms ─────────────────────────────────────
// The presence of setLoadTimedOut(true) is the hard-stop. The
// timeout window MUST be ≤ 5000ms; we detect by finding the
// `setTimeout(... , <N>);` that's nearest to setLoadTimedOut.
if (!/setLoadTimedOut\s*\(\s*true\s*\)/.test(scanPageSrc)) {
  fail('scan-page: no setLoadTimedOut hard-stop detected — startup recovery missing');
} else {
  // Locate the index of setLoadTimedOut(true) and inspect the next
  // `, <number>)` after it (which closes the enclosing setTimeout).
  const idx = scanPageSrc.indexOf('setLoadTimedOut(true)');
  if (idx >= 0) {
    const tail = scanPageSrc.slice(idx, idx + 600);
    const msMatch = tail.match(/\}\s*,\s*(\d+)\s*\)/);
    if (msMatch) {
      const ms = parseInt(msMatch[1], 10);
      if (!Number.isFinite(ms) || ms > 5000) {
        fail(`scan-page: setLoadTimedOut hard-stop is ${ms}ms — must be ≤ 5000ms`);
      } else {
        pass(`scan-page: hard-stop is ${ms}ms`);
      }
    } else {
      fail('scan-page: could not parse hard-stop timeout duration');
    }
  }
}

// ─── 3. Stale-closure check: hard-stop must read _mountedRef ───
// The hard-stop callback must guard against the stale-closure bug
// by consulting the ref, not the bare state.
const idx2 = scanPageSrc.indexOf('setLoadTimedOut(true)');
if (idx2 >= 0) {
  // Inspect the 400 chars BEFORE the call — the closure body.
  const before = scanPageSrc.slice(Math.max(0, idx2 - 400), idx2);
  if (!/_mountedRef\.current/.test(before)) {
    fail('scan-page: hard-stop callback must read _mountedRef.current before setLoadTimedOut (stale-closure fix)');
  }
  // Forbid a bare `if (!mounted)` guard immediately before
  // setLoadTimedOut (the regressed read).
  if (/if\s*\(\s*!\s*mounted\s*\)\s*\{[^}]{0,80}setLoadTimedOut/.test(scanPageSrc)) {
    fail('scan-page: hard-stop must NOT guard with bare `if (!mounted)` (stale closure)');
  }
} else {
  fail('scan-page: hard-stop block not parseable for stale-closure audit');
}

// ─── 4. scan-capture testid on the mount path ──────────────────
// The mount spinner (rendered while !mounted) must carry the
// scan-capture testid so the diagnostic runtime can flip
// componentMounted=true immediately.
if (!/if\s*\(\s*!\s*mounted\s*\)\s*\{[\s\S]{0,800}?data-testid=["']scan-capture["']/.test(scanPageSrc)) {
  fail('scan-page: mount spinner (the !mounted return) must carry data-testid="scan-capture"');
}

// ─── 5. Upload Photo fallback testid + Go Home button ──────────
const fallbackSrc = requireFile(
  'src/components/scan/ScanFallback.jsx', 'scan-fallback');
if (!/data-testid=["']scan-fallback-upload["']/.test(fallbackSrc)) {
  fail('scan-fallback: must expose data-testid="scan-fallback-upload" for the Upload Photo CTA');
}
if (!/data-testid=["']scan-fallback-home["']/.test(fallbackSrc)) {
  fail('scan-fallback: must expose Go Home button (data-testid="scan-fallback-home") on the page_loading state');
}
// page_loading copy must match the spec.
if (!/Camera unavailable/.test(fallbackSrc)) {
  fail('scan-fallback: page_loading title must read "Camera unavailable"');
}
if (!/Camera is taking longer than expected/.test(fallbackSrc)) {
  fail('scan-fallback: page_loading body must include "Camera is taking longer than expected"');
}

// ─── 6. __scanStartupHealth exposes the new spec fields ────────
const runtimeSrc = requireFile(
  'src/runtime/scanStartup/ScanStartupHealthRuntime.ts', 'scan-runtime');
for (const tok of [
  'mountedRefCurrent', 'hardStopMs', 'infiniteSpinnerBlocked',
  'chunkLoaded', 'componentRendered', 'microtaskMounted',
  'cameraReady', 'fallbackRendered',
]) {
  if (!new RegExp(`\\b${tok}\\b`).test(runtimeSrc)) {
    fail(`scan-runtime: must surface "${tok}"`);
  }
}
// hardStopMs must be 5000 — both as a literal and as the
// guarantee that the recovery window matches the gate.
if (!/hardStopMs:\s*5000/.test(runtimeSrc)) {
  fail('scan-runtime: hardStopMs must equal 5000');
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:ios-scan-startup] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:ios-scan-startup] PASS — iOS scan startup root-cause fix intact.');
for (const p of PASSED) console.log('  ✓ ' + p);
