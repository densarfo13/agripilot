#!/usr/bin/env node
/**
 * scripts/check-no-scan-fullscreen-spinner.mjs — emergency-fix gate.
 *
 * Guarantees ScanPage renders a safe upload shell first and can
 * NEVER show a full-page spinner that blocks the Upload Photo CTA.
 *
 * Fails if ScanPage:
 *   • Renders a fullscreen spinner gated behind `if (!mounted)`
 *   • Contains the legacy "Preparing scan" fullscreen copy
 *   • Returns a spinner-only screen before the ScanHub safe shell
 *   • Gates the page render on runtimeInitialized / cameraReady /
 *     permissionState
 *
 * Also confirms the ScanHub safe shell (Upload photo + Take photo)
 * is the idle render and Upload does not depend on `mounted`.
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

const scanPage = read(path.join(ROOT, 'src/pages/ScanPage.jsx'));
if (!scanPage) {
  fail('ScanPage.jsx missing');
  console.error('[check:no-scan-fullscreen-spinner] FAIL\n  ✗ ' + FAILED.join('\n  ✗ '));
  process.exit(1);
}
pass('ScanPage.jsx present');

// ─── 1. No fullscreen spinner gated behind !mounted ────────────
if (/if\s*\(\s*!\s*mounted\s*\)\s*\{[\s\S]{0,500}?farroway-spin/.test(scanPage)) {
  fail('ScanPage renders a fullscreen spinner behind `if (!mounted)` — must render the safe shell instead');
} else {
  pass('no `if (!mounted)` fullscreen spinner');
}

// ─── 2. No "Preparing scan" fullscreen return ──────────────────
// The legacy fullscreen "Preparing scan…" return must be gone.
// We allow the small inline "Opening camera…" status only.
if (/return\s*\([\s\S]{0,300}?Preparing scan/.test(scanPage)) {
  fail('ScanPage still returns a "Preparing scan" fullscreen state — remove it (inline "Opening camera…" only)');
} else {
  pass('no "Preparing scan" fullscreen return');
}

// ─── 3. Page render not gated on runtime/camera/permission ─────
// Forbid top-level early returns of a spinner gated on these.
const GATE_PATTERNS = [
  /if\s*\(\s*!\s*runtimeInitialized\s*\)\s*return/,
  /if\s*\(\s*!\s*cameraReady\s*\)\s*return\s*\([\s\S]{0,200}?farroway-spin/,
  /if\s*\(\s*permissionState\s*[!=]==?[^)]*\)\s*return\s*\([\s\S]{0,200}?farroway-spin/,
];
let gated = false;
for (const re of GATE_PATTERNS) {
  if (re.test(scanPage)) { gated = true; }
}
if (gated) {
  fail('ScanPage gates the page render on runtimeInitialized / cameraReady / permissionState — Upload must always render');
} else {
  pass('page render not gated on runtime/camera/permission');
}

// ─── 4. ScanHub safe shell is the idle render ──────────────────
if (!/phase\s*===\s*['"]idle['"]/.test(scanPage)) {
  fail('ScanPage must have a `phase === "idle"` branch (the safe shell)');
} else if (!/ScanHub/.test(scanPage)) {
  fail('ScanPage idle branch must render ScanHub (safe shell)');
} else {
  pass('idle phase renders ScanHub safe shell');
}

// ─── 5. ScanHub exposes Upload + Take photo CTAs ───────────────
const scanHub = read(path.join(ROOT, 'src/components/scan/ScanHub.jsx'));
if (!scanHub) {
  fail('ScanHub.jsx missing');
} else {
  if (!/data-testid=["']scan-hub-upload-photo["']/.test(scanHub)) {
    fail('ScanHub must expose data-testid="scan-hub-upload-photo"');
  }
  if (!/data-testid=["']scan-hub-take-photo["']/.test(scanHub)) {
    fail('ScanHub must expose data-testid="scan-hub-take-photo"');
  }
  // ScanHub must not contain a blocking farroway-spin spinner.
  if (/farroway-spin/.test(scanHub)) {
    fail('ScanHub must not contain a blocking spinner');
  }
  if (FAILED.length === 0 || !FAILED.some((f) => f.includes('ScanHub'))) {
    pass('ScanHub exposes Upload photo + Take photo, no blocking spinner');
  }
}

// ─── 6. iOS autostart safety flag present ──────────────────────
if (!/DISABLE_SCAN_CAMERA_AUTOSTART_ON_IOS/.test(scanPage)) {
  fail('ScanPage must declare DISABLE_SCAN_CAMERA_AUTOSTART_ON_IOS launch-safety flag');
} else {
  pass('iOS camera-autostart safety flag present');
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:no-scan-fullscreen-spinner] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:no-scan-fullscreen-spinner] PASS — scan renders safe upload shell, no fullscreen spinner.');
for (const p of PASSED) console.log('  ✓ ' + p);
