#!/usr/bin/env node
/**
 * scripts/check-ios-camera-init.mjs — iOS camera-init gate.
 *
 * Fails if the iOS Safari camera-startup contract regresses:
 *   • getUserMedia could run before a user action on iOS
 *     (ScanPage must keep DISABLE_SCAN_CAMERA_AUTOSTART_ON_IOS)
 *   • the video.srcObject assignment is missing
 *   • the inline-playback attrs (playsinline + webkit-playsinline) are
 *     missing, OR are set AFTER srcObject (iOS needs them BEFORE)
 *   • MediaStream cleanup (getTracks().stop()) is missing
 *   • the camera diagnostic only reports the vague "runtimeInitialized"
 *     instead of the real failed stage (__cameraHealth.failedStage)
 *   • camera failure hides Upload Photo
 *   • capture can run before the video is ready
 *
 * Read-only. Never mutates source.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

// ─── 1. No autostart on iOS ────────────────────────────────────
const scanPage = read('src/pages/ScanPage.jsx');
if (!/DISABLE_SCAN_CAMERA_AUTOSTART_ON_IOS/.test(scanPage))
  F.push('ScanPage must keep DISABLE_SCAN_CAMERA_AUTOSTART_ON_IOS (no getUserMedia before user action)');
else P.push('no camera autostart on iOS (gesture-gated)');

// ─── 2. cameraRuntimeManager: attrs BEFORE srcObject ───────────
const mgr = read('src/core/camera/cameraRuntimeManager.js');
if (!mgr) {
  F.push('cameraRuntimeManager.js missing');
} else {
  const iPlaysinline = mgr.indexOf("setAttribute('playsinline'");
  const iWebkit      = mgr.indexOf("setAttribute('webkit-playsinline'");
  const iSrcObject   = mgr.indexOf('v.srcObject = stream');
  if (iPlaysinline < 0) F.push("manager must setAttribute('playsinline','true')");
  if (iWebkit < 0)      F.push("manager must setAttribute('webkit-playsinline','true') (legacy iOS)");
  if (iSrcObject < 0)   F.push('manager must assign video.srcObject = stream');
  if (iPlaysinline >= 0 && iSrcObject >= 0 && iPlaysinline > iSrcObject)
    F.push('manager must set playsinline BEFORE srcObject (iOS needs attrs first)');
  if (iWebkit >= 0 && iSrcObject >= 0 && iWebkit > iSrcObject)
    F.push('manager must set webkit-playsinline BEFORE srcObject');
  if (!/getTracks\(\)/.test(mgr) || !/\.stop\(\)/.test(mgr))
    F.push('manager must stop MediaStream tracks (getTracks().forEach(t=>t.stop()))');
  if (![...new Set(F)].some((m) => m.startsWith('manager')))
    P.push('manager sets playsinline+webkit-playsinline BEFORE srcObject, stops tracks');
}

// ─── 3. __cameraHealth reports the REAL stage ──────────────────
if (!/installCameraHealthGlobal/.test(mgr) || !/__cameraHealth/.test(mgr))
  F.push('cameraRuntimeManager must install window.__cameraHealth()');
for (const tok of ['failedStage', 'videoReady', 'startupMs', 'permissionState']) {
  if (!new RegExp(`\\b${tok}\\b`).test(mgr))
    F.push(`__cameraHealth must surface "${tok}" (not just "runtimeInitialized")`);
}
const app = read('src/App.jsx');
if (!/installCameraHealthGlobal/.test(app)) F.push('App.jsx must wire installCameraHealthGlobal');
if (![...new Set(F)].some((m) => m.includes('__cameraHealth') || m.includes('installCameraHealthGlobal')))
  P.push('__cameraHealth() exposes real failedStage/videoReady/startupMs + wired');

// ─── 4. LiveCameraScanner: webkit-playsinline + ready-gated ────
const live = read('src/components/scan/LiveCameraScanner.jsx');
if (!/webkit-playsinline/.test(live))
  F.push('LiveCameraScanner <video> must carry webkit-playsinline');
else P.push('LiveCameraScanner video has webkit-playsinline');
// Camera ready is gated on a real frame (videoWidth) — not a bare timer.
if (!/videoWidth/.test(live))
  F.push('LiveCameraScanner must gate readiness on videoWidth (> 0)');
else P.push('camera readiness gated on videoWidth');
// Bounded retry — a sequence guard prevents infinite restart loops.
if (!/startSeqRef/.test(live))
  F.push('LiveCameraScanner must use a start-sequence guard (no infinite retry loop)');
else P.push('start-sequence guard prevents infinite retry');

// ─── 5. Camera failure keeps Upload Photo ──────────────────────
const fallback = read('src/components/scan/ScanFallback.jsx');
if (!/data-testid=["']scan-fallback-upload["']/.test(fallback))
  F.push('camera-failure fallback must keep Upload Photo');
else P.push('camera-failure fallback keeps Upload Photo');

// ─── 6. Diagnostics flags ──────────────────────────────────────
const perm = read('src/runtime/scanStartup/ScanPermanentHealthRuntime.ts');
for (const tok of ['cameraStateMachineReady', 'iosVideoAttachReady', 'cameraCleanupReady']) {
  if (!new RegExp(`\\b${tok}\\b`).test(perm))
    F.push(`__scanPermanentHealth must surface "${tok}"`);
}
if (![...new Set(F)].some((m) => m.includes('__scanPermanentHealth')))
  P.push('__scanPermanentHealth surfaces camera-init flags');

const uniqF = [...new Set(F)];
if (uniqF.length) {
  console.error('[check:ios-camera-init] FAIL');
  for (const m of uniqF) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:ios-camera-init] PASS — iOS attrs-before-srcObject, real failed stage, cleanup, ready-gated capture.');
for (const m of P) console.log('  ✓ ' + m);
