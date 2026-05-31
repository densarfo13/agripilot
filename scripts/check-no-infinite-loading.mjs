#!/usr/bin/env node
/**
 * scripts/check-no-infinite-loading.mjs — broken-link audit gate.
 *
 * Enforces that:
 *   • The outer Suspense fallback is the wave-audit
 *     PageLoaderWithTimeout (5s timeout flips to recovery UI).
 *   • LazyLoadErrorBoundary wraps the Suspense so chunk errors
 *     never leave the user on a spinner.
 *   • PageLoaderWithTimeout sets __scanSpinnerTimeoutFired and
 *     ships the canonical recovery copy.
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

const loaderSrc = requireFile(
  'src/components/system/PageLoaderWithTimeout.jsx', 'loader');
for (const tok of [
  'DEFAULT_TIMEOUT_MS', '5000',
  '__scanSpinnerTimeoutFired',
  'Try again', 'Upload photo', 'Go Home',
  'Scan is taking too long to load',
  'page-loader-timeout',
]) {
  if (!new RegExp(tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(loaderSrc)) {
    fail(`loader: must contain "${tok}"`);
  }
}

const boundarySrc = requireFile(
  'src/components/system/LazyLoadErrorBoundary.jsx', 'boundary');
for (const tok of [
  'ChunkLoadError',
  'loading chunk',
  'failed to fetch dynamically imported module',
  "Something didn't load correctly",
  '__lastLazyLoadErrorAt',
]) {
  // Case-insensitive — boundary normalises to lowercase before
  // matching browser error messages.
  if (!new RegExp(tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(boundarySrc)) {
    fail(`boundary: must contain "${tok}"`);
  }
}

const appSrc = requireFile('src/App.jsx', 'app');
if (!/PageLoaderWithTimeout/.test(appSrc)) {
  fail('app: PageLoaderWithTimeout must be imported in App.jsx');
}
if (!/LazyLoadErrorBoundary/.test(appSrc)) {
  fail('app: LazyLoadErrorBoundary must be imported in App.jsx');
}
if (!/<LazyLoadErrorBoundary>[\s\S]*?<Suspense\s+fallback=\{<PageLoader/.test(appSrc)) {
  fail('app: <LazyLoadErrorBoundary><Suspense fallback={<PageLoader …/> must compose');
}

// Ban infinite-loop loaders: any `<Suspense fallback={<X />}>` in
// App.jsx where X is a static spinner without a timeout. The
// canonical `PageLoader` constant must point at the timeout-wrapped
// variant. Detect the legacy inline-spinner regression.
if (/const\s+PageLoader\s*=\s*\(\)\s*=>\s*\(\s*<div\s+style=\{\{\s*minHeight:\s*['"]100vh['"]/.test(appSrc)
    && !/PageLoaderWithTimeout/.test(appSrc)) {
  fail('app: legacy static PageLoader detected — must be replaced by PageLoaderWithTimeout');
}

if (FAILED.length > 0) {
  console.error('[check:no-infinite-loading] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:no-infinite-loading] PASS — Suspense fallback has 5s timeout + chunk-error boundary.');
for (const p of PASSED) console.log('  ✓ ' + p);
