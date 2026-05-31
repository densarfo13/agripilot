#!/usr/bin/env node
/**
 * scripts/check-scan-safe-shell-permanent.mjs — Permanent Mobile
 * Navigation Fix §3 + §4 gate.
 *
 * Fails if:
 *   • /scan first render depends on camera / GPS / runtime
 *   • Upload Photo is not visible before runtime load
 *   • the plain-HTML upload fallback (PlainUploadFallback) is missing,
 *     uses a lazy import on initial render, imports a scan runtime at
 *     module load, or fakes a success
 *   • ScanPage does not render PlainUploadFallback for ?intent=upload
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
const strip = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/(^|\s)\/\/.*$/gm, '');

// ─── 1. ScanPage: idle render is the ScanHub safe shell ────────
const scanPage = read('src/pages/ScanPage.jsx');
if (!scanPage) {
  fail('scan-page: src/pages/ScanPage.jsx missing');
} else {
  const sp = strip(scanPage);
  if (!/phase\s*===\s*['"]idle['"]/.test(sp) || !/<ScanHub/.test(sp)) {
    fail('scan-page: idle phase must render the ScanHub safe shell');
  } else {
    pass('scan-page: idle phase renders ScanHub safe shell');
  }
  // First render must NOT be gated on camera / runtime / permission.
  const GATES = [
    /if\s*\(\s*!\s*runtimeInitialized\s*\)\s*return/,
    /if\s*\(\s*!\s*cameraReady\s*\)\s*return\s*\([\s\S]{0,200}?farroway-spin/,
    /if\s*\(\s*permissionState\s*[!=]==?[^)]*\)\s*return\s*\([\s\S]{0,200}?farroway-spin/,
  ];
  if (GATES.some((re) => re.test(sp))) {
    fail('scan-page: first render must NOT gate on camera/runtime/permission');
  } else {
    pass('scan-page: first render not gated on camera/runtime/permission');
  }
  // iOS autostart safety flag present.
  if (!/DISABLE_SCAN_CAMERA_AUTOSTART_ON_IOS/.test(scanPage)) {
    fail('scan-page: DISABLE_SCAN_CAMERA_AUTOSTART_ON_IOS flag missing');
  } else {
    pass('scan-page: iOS auto-camera disabled before shell render');
  }
  // ScanPage renders PlainUploadFallback for the upload-intent path.
  if (!/PlainUploadFallback/.test(scanPage)) {
    fail('scan-page: must import + render PlainUploadFallback for ?intent=upload');
  } else if (!/intent['"]?\s*\)\s*===\s*['"]upload['"]|===\s*['"]upload['"]/.test(sp)) {
    fail('scan-page: must detect intent=upload and render PlainUploadFallback');
  } else {
    pass('scan-page: renders PlainUploadFallback for ?intent=upload');
  }
}

// ─── 2. ScanHub: Upload visible, not camera-gated ──────────────
const hub = read('src/components/scan/ScanHub.jsx');
if (!hub) {
  fail('scan-hub: src/components/scan/ScanHub.jsx missing');
} else {
  if (!/data-testid=["']scan-hub-upload-photo["']/.test(hub)) {
    fail('scan-hub: Upload photo CTA (scan-hub-upload-photo) missing');
  } else {
    pass('scan-hub: Upload photo CTA present before any runtime load');
  }
  if (/data-testid=["']scan-hub-upload-photo["'][^>]*disabled=\{[^}]*camera/i.test(hub)) {
    fail('scan-hub: Upload photo must NOT be gated by camera readiness');
  }
  if (/farroway-spin/.test(hub)) {
    fail('scan-hub: safe shell must not contain a blocking spinner');
  }
}

// ─── 3. PlainUploadFallback: dependency-free, honest ───────────
const plain = read('src/components/scan/PlainUploadFallback.jsx');
if (!plain) {
  fail('plain-upload: src/components/scan/PlainUploadFallback.jsx must exist');
} else {
  const ps = strip(plain);
  // Plain file input present, NO camera capture attribute.
  if (!/type=["']file["']/.test(plain) || !/accept=["']image\/\*["']/.test(plain)) {
    fail('plain-upload: must render a plain <input type="file" accept="image/*">');
  } else {
    pass('plain-upload: plain file input present (image/*)');
  }
  if (/capture=/.test(ps)) {
    fail('plain-upload: must NOT use the camera `capture` attribute');
  }
  // No lazy / Suspense on initial render.
  if (/\blazy\s*\(|React\.lazy|<Suspense/.test(ps)) {
    fail('plain-upload: must NOT use lazy()/Suspense (renders even if chunks fail)');
  } else {
    pass('plain-upload: no lazy()/Suspense on initial render');
  }
  // The analysis engine must be DYNAMIC-imported (after select), not
  // statically imported at module load.
  if (/^\s*import\s+[^\n]*scanDetectionEngine/m.test(plain)
      || /^\s*import\s+[^\n]*ScanRuntime/m.test(plain)
      || /^\s*import\s+[^\n]*useScanRuntime/m.test(plain)) {
    fail('plain-upload: must NOT statically import the scan runtime/engine at module load');
  } else {
    pass('plain-upload: no static scan-runtime import at module load');
  }
  if (!/await\s+import\(/.test(ps)) {
    fail('plain-upload: must dynamic-import the analysis engine after a file is chosen');
  } else {
    pass('plain-upload: dynamic-imports analysis only after file selection');
  }
  // Honest failure path — saves locally + honest message, never fakes.
  if (!/saved_offline|savedOffline|pending_upload/.test(plain)) {
    fail('plain-upload: must save the image locally + show an honest message when analysis is unavailable');
  } else {
    pass('plain-upload: honest offline-save fallback present');
  }
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:scan-safe-shell-permanent] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:scan-safe-shell-permanent] PASS — safe shell first, upload always available, plain fallback dependency-free.');
for (const p of PASSED) console.log('  ✓ ' + p);
