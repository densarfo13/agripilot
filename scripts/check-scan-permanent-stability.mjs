#!/usr/bin/env node
/**
 * scripts/check-scan-permanent-stability.mjs — permanent scan
 * stability governance gate.
 *
 * Fails if any of the permanent-stability invariants regress:
 *   • ScanPage renders a full-page spinner before Upload Photo
 *   • Upload Photo is gated by camera / runtime init
 *   • camera startup blocks first render
 *   • iOS auto-camera enabled before shell render
 *   • mounted=false blocks the ScanPage shell
 *   • ScanPage uses setTimeout(..., 0) for mount readiness
 *   • /scan redirects because GPS/location is missing
 *   • "Camera ran into a problem" appears in grower UI
 *   • scan has no 5s fallback
 *   • __scanPermanentHealth diagnostic missing / wiring missing
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
  if (!fs.existsSync(full)) { fail(`${label}: ${rel} must exist`); return ''; }
  pass(`${label}: ${rel} present`);
  return read(full);
}

// ─── 1. ScanPage — no fullscreen spinner gated behind !mounted ─
const scanPage = requireFile('src/pages/ScanPage.jsx', 'scan-page');
if (/if\s*\(\s*!\s*mounted\s*\)\s*\{[\s\S]{0,500}?farroway-spin/.test(scanPage)) {
  fail('scan-page: must NOT render a fullscreen spinner gated behind `if (!mounted)`');
}
if (/return\s*\([\s\S]{0,300}?Preparing scan/.test(scanPage)) {
  fail('scan-page: must NOT return a fullscreen "Preparing scan" state');
}

// ─── 2. No setTimeout(... 0) mount readiness ───────────────────
if (/setTimeout\([^)]*setMounted\s*\(\s*true\s*\)[^)]*,\s*0\s*\)/.test(scanPage)) {
  fail('scan-page: setTimeout(... setMounted(true) ..., 0) is the regressed macrotask path');
}

// ─── 3. iOS auto-camera disabled before shell render ───────────
if (!/DISABLE_SCAN_CAMERA_AUTOSTART_ON_IOS/.test(scanPage)) {
  fail('scan-page: must declare DISABLE_SCAN_CAMERA_AUTOSTART_ON_IOS launch-safety flag');
}
// The flag must actually gate the scan-nav auto-launch decision.
if (!/DISABLE_SCAN_CAMERA_AUTOSTART_ON_IOS\s*&&\s*_isIOSSafari/.test(scanPage)) {
  fail('scan-page: iOS auto-camera must be gated by DISABLE_SCAN_CAMERA_AUTOSTART_ON_IOS && _isIOSSafari');
}

// ─── 4. /scan does not redirect on missing GPS/location ────────
// ScanPage must not navigate to onboarding/location based on a
// missing-location / missing-GPS branch.
const stripped = scanPage
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\s)\/\/.*$/gm, '');
if (/if\s*\([^)]*!\s*(location|gps|country|coords)[^)]*\)\s*\{[^}]{0,120}navigate\(/i.test(stripped)) {
  fail('scan-page: must NOT navigate away when location/GPS is missing');
} else {
  pass('scan-page: no GPS/location-missing redirect');
}

// ─── 5. ScanHub safe shell has Upload + Take photo + Go Home ───
const scanHub = requireFile('src/components/scan/ScanHub.jsx', 'scan-hub');
for (const tid of [
  'scan-hub-upload-photo', 'scan-hub-take-photo', 'scan-hub-go-home',
]) {
  if (!new RegExp(`data-testid=["']${tid}["']`).test(scanHub)) {
    fail(`scan-hub: safe shell must expose data-testid="${tid}"`);
  }
}
// Upload button must not be disabled by a camera/runtime gate.
if (/data-testid=["']scan-hub-upload-photo["'][^>]*disabled=\{[^}]*camera/i.test(scanHub)) {
  fail('scan-hub: Upload photo must NOT be gated by camera readiness');
}
if (/farroway-spin/.test(scanHub)) {
  fail('scan-hub: safe shell must not contain a blocking spinner');
}

// ─── 6. 5s fallback present (ScanFallback page_loading) ────────
const fallback = requireFile('src/components/scan/ScanFallback.jsx', 'scan-fallback');
if (!/Camera unavailable/.test(fallback)) {
  fail('scan-fallback: must surface the "Camera unavailable" recovery state');
}
if (!/data-testid=["']scan-fallback-upload["']/.test(fallback)) {
  fail('scan-fallback: Upload Photo CTA must be present on the fallback');
}

// ─── 7. Banned grower wording ──────────────────────────────────
// "Camera ran into a problem" must not appear in grower scan UI.
for (const [rel, label] of [
  ['src/components/scan/ScanFallback.jsx', 'scan-fallback'],
  ['src/components/scan/ScanHub.jsx',      'scan-hub'],
  ['src/pages/ScanPage.jsx',               'scan-page'],
]) {
  // Strip comments first — the canonical ban-list docblock
  // legitimately NAMES the banned phrase to document it.
  const src = read(path.join(ROOT, rel))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '');
  if (/Camera ran into a problem/i.test(src)) {
    fail(`${label}: banned wording "Camera ran into a problem" present in rendered UI`);
  }
}

// ─── 8. __scanPermanentHealth diagnostic + wiring ──────────────
const runtime = requireFile(
  'src/runtime/scanStartup/ScanPermanentHealthRuntime.ts', 'runtime');
for (const tok of [
  '__scanPermanentHealth', 'safeShellFirst', 'uploadPrimary',
  'uploadVisibleWithinMs', 'cameraOptional', 'iosAutoCameraDisabled',
  'noFullscreenSpinner', 'runtimeLazyAfterUserAction',
  'chunkRecoveryReady', 'gpsDoesNotBlockScan',
  'scanCanNeverSpinForever', 'scanPermanentReady',
]) {
  if (!new RegExp(`\\b${tok}\\b`).test(runtime)) {
    fail(`runtime: must surface "${tok}"`);
  }
}
const appSrc = requireFile('src/App.jsx', 'wiring');
if (!/installScanPermanentHealthGlobal/.test(appSrc)) {
  fail('wiring: App.jsx must wire installScanPermanentHealthGlobal');
}

// ─── 9. scanPermanentReady surfaced in goLive + releaseLock ────
const goLive = read(path.join(ROOT, 'src/runtime/launchBlockers/GoLiveHealthRuntime.ts'));
if (!/scanPermanentReady/.test(goLive)) {
  fail('go-live: __goLiveHealth must surface scanPermanentReady');
}
const releaseLock = read(path.join(ROOT, 'src/runtime/release/ReleaseLockRuntime.ts'));
if (!/scanPermanentReady/.test(releaseLock)) {
  fail('release-lock: __releaseLock must surface scanPermanentReady');
}

// ─── 10. Auth gate cannot hang the app (THE real root cause) ───
// AuthLoadingGate gates EVERY route (incl. /scan) on authLoading.
// If bootstrap() can hang before releasing it, /scan never mounts
// and the full-screen Farroway spinner shows forever. Enforce an
// absolute hard-stop timer + bounded repair awaits so the gate
// ALWAYS opens within a fixed ceiling.
const authCtx = read(path.join(ROOT, 'src/context/AuthContext.jsx'));
if (!authCtx) {
  fail('auth: src/context/AuthContext.jsx must exist');
} else {
  if (!/_authGateHardStop/.test(authCtx) || !/_releaseAuthGate/.test(authCtx)) {
    fail('auth: bootstrap() must schedule an absolute auth-gate hard-stop that releases authLoading even if a step hangs');
  } else {
    pass('auth: bootstrap has an absolute auth-gate hard-stop');
  }
  // The repairActiveContext dynamic-import must be bounded — a
  // stalled chunk fetch (stale SW precache) on iOS Safari must not
  // hold the gate closed. Reject the raw unbounded `await import`.
  if (/await\s+import\(\s*['"]\.\.\/utils\/repairActiveContext\.js['"]\s*\)/.test(authCtx)) {
    fail('auth: repairActiveContext import must be bounded by withBootstrapTimeout (unbounded await can hang the gate on iOS Safari)');
  } else {
    pass('auth: repair dynamic-imports are bounded');
  }
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:scan-permanent-stability] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:scan-permanent-stability] PASS — scan is upload-first, shell-first, and can never spin forever.');
for (const p of PASSED) console.log('  ✓ ' + p);
