#!/usr/bin/env node
/**
 * scripts/check-scan-permanent-lock.mjs — permanent-scan §2 contract lock.
 *
 * Fails if:
 *   • __scanPermanentHealth does not surface all 11 §2 contract keys
 *   • the safe shell (ScanCameraLikeShell) calls getUserMedia (it must be
 *     presentational — camera starts only from a user tap in
 *     LiveCameraScanner)
 *   • the safe shell has no upload affordance (upload must be primary)
 *   • the iOS-autostart-disabled / camera-on-tap invariants are absent
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|\s)\/\/.*$/gm, '');

// 1. The 11 §2 contract keys.
const probe = read('src/runtime/scanStartup/ScanPermanentHealthRuntime.ts');
const KEYS = [
  'safeShellFirst', 'uploadPrimary', 'uploadVisibleWithinMs',
  'iosCameraAutostartDisabled', 'cameraStartsOnlyAfterUserTap',
  'scanRuntimeLazyAfterImage', 'gpsDoesNotBlockScan', 'noInfiniteSpinner',
  'uploadAnalysisReady', 'captureAnalysisReady', 'failureFallbackReady',
];
if (!probe) F.push('ScanPermanentHealthRuntime.ts: missing');
else {
  const missing = KEYS.filter((k) => !probe.includes(k));
  if (missing.length) F.push(`__scanPermanentHealth missing §2 keys: ${missing.join(', ')}`);
  else P.push('__scanPermanentHealth surfaces all 11 §2 contract keys');
}

// 2. Safe shell is presentational — no getUserMedia call.
const shell = strip(read('src/components/scan/ScanCameraLikeShell.jsx'));
if (!shell) F.push('ScanCameraLikeShell.jsx: missing (safe shell required)');
else {
  if (/\.getUserMedia\s*\(/.test(shell))
    F.push('ScanCameraLikeShell must NOT call getUserMedia (safe shell is presentational; camera starts on tap)');
  else P.push('safe shell never calls getUserMedia (camera starts only after user tap)');
  // 3. Upload affordance present.
  if (!/type=["']file["']|onUpload|Upload|Gallery|fileInput/i.test(shell))
    F.push('ScanCameraLikeShell must expose an upload affordance (upload is primary)');
  else P.push('safe shell exposes an upload affordance');
}

// 4. getUserMedia is owned by the gesture-driven LiveCameraScanner only.
const live = read('src/components/scan/LiveCameraScanner.jsx');
if (live && !/getUserMedia/.test(live))
  F.push('LiveCameraScanner should own the gesture-driven getUserMedia path');
else P.push('getUserMedia is owned by the gesture-driven LiveCameraScanner');

if (F.length) {
  console.error('[check:scan-permanent-lock] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:scan-permanent-lock] PASS — §2 contract locked; upload primary; no safe-shell autostart.');
for (const m of P) console.log('  ✓ ' + m);
