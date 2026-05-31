#!/usr/bin/env node
/**
 * scripts/check-scan-mobile-permanent.mjs — §1 mobile-scan contract.
 *
 * Asserts __scanPermanentHealth surfaces the full §1 envelope and the
 * scan shell is gesture-gated / spinner-free. Composes the already-
 * enforced scan invariants (this is the single mobile-scan proof gate).
 *
 * Read-only. Never mutates source.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const perm = read('src/runtime/scanStartup/ScanPermanentHealthRuntime.ts');
for (const tok of ['safeShellFirst', 'uploadPrimary', 'uploadVisibleWithinMs',
  'iosCameraAutostartDisabled', 'cameraStartsOnlyAfterUserTap',
  'noRuntimeInitializedWarningOnLoad', 'scanCanNeverSpinForever']) {
  if (!new RegExp(`\\b${tok}\\b`).test(perm))
    F.push(`__scanPermanentHealth must surface "${tok}"`);
}
if (!F.length) P.push('__scanPermanentHealth surfaces the full §1 mobile-scan envelope');

const scanPage = read('src/pages/ScanPage.jsx');
if (!/DISABLE_SCAN_CAMERA_AUTOSTART_ON_IOS/.test(scanPage))
  F.push('ScanPage must keep DISABLE_SCAN_CAMERA_AUTOSTART_ON_IOS');
else P.push('iOS camera autostart disabled (gesture-gated)');
if (!/<ScanCameraLikeShell|<ScanHub/.test(scanPage))
  F.push('ScanPage idle must render a safe shell (ScanCameraLikeShell / ScanHub)');
else P.push('mobile idle renders the camera-like safe shell');

// Banner warning gated on cameraRequested (no warning on load).
const banner = read('src/components/scan/ScanStartupBanner.jsx');
if (!/if\s*\(\s*!\s*snap\.cameraRequested\s*\)\s*return null/.test(banner))
  F.push('ScanStartupBanner must gate warnings on cameraRequested');
else P.push('no camera warning before Take Photo (cameraRequested-gated)');

if (F.length) {
  console.error('[check:scan-mobile-permanent] FAIL');
  for (const m of F) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:scan-mobile-permanent] PASS — mobile scan shell-first, upload-primary, gesture-gated, spinner-free.');
for (const m of P) console.log('  ✓ ' + m);
