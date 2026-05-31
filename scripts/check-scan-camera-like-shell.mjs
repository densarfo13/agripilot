#!/usr/bin/env node
/**
 * scripts/check-scan-camera-like-shell.mjs — Option 3 gate.
 *
 * Locks the "camera LOOK, safe-shell protections preserved" contract.
 *
 * Fails if:
 *   • iOS camera autostart protection is removed (ScanPage must keep
 *     DISABLE_SCAN_CAMERA_AUTOSTART_ON_IOS)
 *   • the camera-like shell calls getUserMedia / mediaDevices
 *     (Take Photo must be gesture-gated; the camera opens only after
 *     the parent flips to the capture phase)
 *   • the camera-like shell statically imports a scan runtime / camera
 *     component at module load
 *   • Upload / Gallery is missing or disabled on the camera-like shell
 *   • a full-screen farroway-spin spinner appears in the shell
 *   • the banned "Camera ran into a problem" wording appears
 *   • ScanPage doesn't render ScanCameraLikeShell on mobile
 *   • __scanCameraLikeShellHealth diagnostic missing / unwired
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

// ─── 1. Camera-like shell component ────────────────────────────
const shell = read('src/components/scan/ScanCameraLikeShell.jsx');
if (!shell) {
  fail('shell: src/components/scan/ScanCameraLikeShell.jsx must exist');
} else {
  const s = strip(shell);
  // No camera startup inside the shell — it is presentational only.
  if (/getUserMedia|mediaDevices/.test(s)) {
    fail('shell: ScanCameraLikeShell must NOT call getUserMedia/mediaDevices (camera is gesture-gated by the parent)');
  } else {
    pass('shell: no getUserMedia/mediaDevices in the camera-like shell');
  }
  // No scan-runtime / camera-component import at module load.
  const staticImports = shell.split(/\r?\n/).filter((l) =>
    /^\s*import\s/.test(l) && !/import\s*\(/.test(l)).join('\n');
  if (/useScanRuntime|ScanRuntime|LiveCameraScanner|ScanCameraScreen|ScanCapture/.test(staticImports)) {
    fail('shell: must NOT statically import a scan runtime / camera component');
  } else {
    pass('shell: no scan-runtime/camera import at module load');
  }
  // Upload + Take Photo + Close controls present.
  for (const tid of [
    'scan-camera-like-upload', 'scan-camera-like-take-photo', 'scan-camera-like-close',
  ]) {
    if (!new RegExp(`data-testid=["']${tid}["']`).test(shell)) {
      fail(`shell: missing control data-testid="${tid}"`);
    }
  }
  // Upload must not be gated by camera readiness.
  if (/data-testid=["']scan-camera-like-upload["'][^>]*disabled=\{[^}]*camera/i.test(shell)) {
    fail('shell: Upload must NOT be gated by camera readiness');
  }
  // No blocking spinner.
  if (/farroway-spin/.test(shell)) {
    fail('shell: must not contain a blocking farroway-spin spinner');
  }
  // Banned grower wording.
  if (/Camera ran into a problem/i.test(s)) {
    fail('shell: banned wording "Camera ran into a problem" present');
  }
  if (!FAILED.some((f) => f.startsWith('shell:'))) {
    pass('shell: Upload/Take Photo/Close present, no spinner, no banned wording');
  }
}

// ─── 2. ScanPage renders it on mobile + keeps autostart protection ─
const scanPage = read('src/pages/ScanPage.jsx');
if (!scanPage) {
  fail('scan-page: src/pages/ScanPage.jsx missing');
} else {
  if (!/DISABLE_SCAN_CAMERA_AUTOSTART_ON_IOS/.test(scanPage)) {
    fail('scan-page: must KEEP DISABLE_SCAN_CAMERA_AUTOSTART_ON_IOS (no autostart reversal)');
  } else {
    pass('scan-page: iOS camera-autostart protection preserved');
  }
  if (!/<ScanCameraLikeShell/.test(scanPage)) {
    fail('scan-page: idle branch must render <ScanCameraLikeShell> on mobile');
  } else {
    pass('scan-page: renders ScanCameraLikeShell on mobile');
  }
  // Mobile detector present.
  if (!/_isMobileScanSurface/.test(scanPage)) {
    fail('scan-page: must detect mobile (_isMobileScanSurface) to choose the camera-like shell');
  }
  // ScanHub still present for desktop (and for the existing gates).
  if (!/<ScanHub/.test(scanPage)) {
    fail('scan-page: desktop must keep <ScanHub> (safe shell)');
  }
}

// ─── 3. Diagnostic present + wired ─────────────────────────────
const rt = read('src/runtime/scanStartup/ScanCameraLikeShellHealthRuntime.ts');
for (const tok of [
  '__scanCameraLikeShellHealth', 'safeShellPreserved', 'cameraAutostartDisabled',
  'uploadAlwaysAvailable', 'mobileCameraLikeUI', 'takePhotoUserGestureOnly',
  'uploadAutoAnalyzeReady', 'captureAutoAnalyzeReady', 'cameraFailureFallbackReady',
  'noStartupPermissionRace',
]) {
  if (!new RegExp(`\\b${tok}\\b`).test(rt)) {
    fail(`diag: ScanCameraLikeShellHealthRuntime must surface "${tok}"`);
  }
}
const app = read('src/App.jsx');
if (!/installScanCameraLikeShellHealthGlobal/.test(app)) {
  fail('wiring: App.jsx must wire installScanCameraLikeShellHealthGlobal');
}
if (!FAILED.some((f) => f.startsWith('diag:') || f.startsWith('wiring:'))) {
  pass('diag: __scanCameraLikeShellHealth present + wired');
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:scan-camera-like-shell] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:scan-camera-like-shell] PASS — camera-look mobile shell, safe-shell protections intact.');
for (const p of PASSED) console.log('  ✓ ' + p);
