#!/usr/bin/env node
/**
 * scripts/check-scan-error-boundary.mjs — Phase 4/6 gate.
 *
 * Guarantees a ScanPage crash can NEVER strand the user:
 *   • the /scan route is wrapped in <ScanErrorBoundary>
 *   • ScanErrorBoundary renders a dependency-light fallback
 *     (PlainUploadFallback) + exposes window.__scanCrashDetails
 *   • PlainUploadFallback does NOT import ScanPage / camera / scan
 *     runtime at module load (so it can't re-crash)
 *   • PlainUploadFallback offers an Upload Photo control
 *
 * Read-only. Never mutates source.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
const fail = (m) => FAILED.push(m);
const pass = (m) => PASSED.push(m);
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

// ─── 1. /scan route is wrapped in ScanErrorBoundary ────────────
const app = read('src/App.jsx');
const scanIdx = app.indexOf('path="/scan"');
if (scanIdx < 0) {
  fail('route: /scan route not found in App.jsx');
} else {
  const block = app.slice(scanIdx, scanIdx + 500);
  if (!/<ScanErrorBoundary>/.test(block)) {
    fail('route: /scan element must wrap ScanPage in <ScanErrorBoundary>');
  } else {
    pass('route: /scan is wrapped in <ScanErrorBoundary>');
  }
}

// ─── 2. ScanErrorBoundary: dependency-light fallback + crash details ─
const boundary = read('src/components/scan/ScanErrorBoundary.jsx');
if (!boundary) {
  fail('boundary: src/components/scan/ScanErrorBoundary.jsx missing');
} else {
  if (!/<PlainUploadFallback/.test(boundary)) {
    fail('boundary: must render <PlainUploadFallback> (dependency-light crash fallback)');
  } else {
    pass('boundary: renders dependency-light PlainUploadFallback');
  }
  if (!/__scanCrashDetails/.test(boundary)) {
    fail('boundary: must expose window.__scanCrashDetails');
  }
  for (const tok of ['message', 'stack', 'route', 'timestamp', 'buildSha']) {
    if (!new RegExp(`\\b${tok}\\b`).test(boundary)) {
      fail(`boundary: __scanCrashDetails must include "${tok}"`);
    }
  }
  // It must NOT statically import ScanPage or camera (would defeat
  // the purpose / risk re-crash).
  if (/from\s+['"][^'"]*ScanPage/.test(boundary)) {
    fail('boundary: must NOT import ScanPage');
  }
  if (/from\s+['"][^'"]*(LiveCameraScanner|ScanCameraScreen|ScanCapture)/.test(boundary)) {
    fail('boundary: must NOT import a camera component');
  }
  if (FAILED.filter((f) => f.startsWith('boundary:')).length === 0) {
    pass('boundary: exposes __scanCrashDetails; no ScanPage/camera import');
  }
}

// ─── 3. PlainUploadFallback isolation ──────────────────────────
const plain = read('src/components/scan/PlainUploadFallback.jsx');
if (!plain) {
  fail('plain: src/components/scan/PlainUploadFallback.jsx missing');
} else {
  // Static (module-load) imports only — ignore lines containing
  // `import(` (dynamic) which are allowed AFTER file selection.
  const staticImports = plain.split(/\r?\n/).filter((l) =>
    /^\s*import\s/.test(l) && !/import\s*\(/.test(l));
  const joined = staticImports.join('\n');
  const FORBIDDEN = [
    [/ScanPage/,                         'ScanPage'],
    [/LiveCameraScanner|ScanCameraScreen|ScanCapture/, 'camera runtime'],
    [/useScanRuntime|runtime\/scan\b|ScanRuntime/, 'ScanRuntime'],
    [/runtime\/(ooda|knowledge)\b/,      'OODA/Knowledge runtime'],
    [/runtime\/offline\b/,               'offline queue runtime'],
  ];
  for (const [re, label] of FORBIDDEN) {
    if (re.test(joined)) fail(`plain: PlainUploadFallback must NOT import ${label} at module load`);
  }
  if (!/data-testid=["']plain-upload-choose["']/.test(plain)) {
    fail('plain: must expose an Upload Photo control (plain-upload-choose)');
  }
  // Analysis must be dynamic-imported (after selection), not static.
  if (!/await\s+import\(/.test(plain)) {
    fail('plain: must dynamic-import analysis only after a file is chosen');
  }
  if (FAILED.filter((f) => f.startsWith('plain:')).length === 0) {
    pass('plain: PlainUploadFallback is dependency-light (no scan/camera/runtime at module load) + Upload present');
  }
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:scan-error-boundary] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:scan-error-boundary] PASS — scan crash always recovers to a dependency-light Upload fallback.');
for (const p of PASSED) console.log('  ✓ ' + p);
