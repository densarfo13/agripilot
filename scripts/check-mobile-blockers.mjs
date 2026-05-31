#!/usr/bin/env node
/**
 * scripts/check-mobile-blockers.mjs — the two permanent mobile
 * blockers (camera-on-load warning + location onboarding loop).
 *
 * Fails if:
 *   • getUserMedia can run on Scan mount / iOS autostart is removed
 *   • the camera "taking longer / runtimeInitialized" warning can
 *     appear BEFORE the user taps Take Photo (banner not gated on
 *     cameraRequested)
 *   • Upload Photo is hidden or camera-gated
 *   • an existing user can be routed to location onboarding
 *     (RouteGuard branches on location/onboarding completeness)
 *   • the location screen Continue does not route home
 *   • __mobileBlockerHealth diagnostic missing / not wired
 *
 * Read-only. Never mutates source.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

// ─── 1. iOS camera autostart disabled (gesture-gated) ──────────
const scanPage = read('src/pages/ScanPage.jsx');
if (!/DISABLE_SCAN_CAMERA_AUTOSTART_ON_IOS/.test(scanPage))
  F.push('ScanPage must keep DISABLE_SCAN_CAMERA_AUTOSTART_ON_IOS (no iOS camera autostart)');
else P.push('iOS camera autostart disabled (gesture-gated)');
// mode=camera must NOT auto-launch the camera (it only renders the
// idle camera-like shell). _launchedFromScanNav keys on intent=camera,
// never on mode=camera.
if (/mode'?\)?\s*===\s*'camera'[\s\S]{0,120}setPhase\(\s*'capture'/.test(scanPage))
  F.push('?mode=camera must NOT auto-promote to the capture phase on iOS');
else P.push('?mode=camera renders idle shell (no auto-capture)');

// ─── 2. Banner warning gated on cameraRequested ────────────────
const banner = read('src/components/scan/ScanStartupBanner.jsx');
if (!/cameraRequested/.test(banner)
    || !/if\s*\(\s*!\s*snap\.cameraRequested\s*\)\s*return null/.test(banner)) {
  F.push('ScanStartupBanner must return null until snap.cameraRequested '
    + '(no "taking longer / runtimeInitialized" warning before Take Photo)');
} else {
  P.push('camera warning gated on cameraRequested (none on page load)');
}

// ─── 3. Upload always available (shells) ───────────────────────
const shell = read('src/components/scan/ScanCameraLikeShell.jsx');
const hub   = read('src/components/scan/ScanHub.jsx');
if (!/data-testid=["']scan-camera-like-upload["']/.test(shell))
  F.push('ScanCameraLikeShell must expose an Upload/Gallery control');
if (!/data-testid=["']scan-hub-upload-photo["']/.test(hub))
  F.push('ScanHub must expose Upload Photo');
if (!F.some((m) => m.includes('Upload')))
  P.push('Upload always available on both idle shells');

// ─── 4. RouteGuard gates on role only (no location loop) ───────
const guard = read('src/components/auth/RouteGuard.jsx')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');
if (/\bonboardingComplete\b|\bneedsOnboarding\b|!\s*hasLocation\b|!\s*country\b/.test(guard))
  F.push('RouteGuard must NOT branch on onboarding/location/farm completeness');
else P.push('RouteGuard gates on role only (existing user → Home, no location loop)');

// ─── 5. OnboardingEntry skips returning users to /home ─────────
const entry = read('src/pages/OnboardingEntry.jsx');
if (!/navigate\(['"]\/home['"]/.test(entry) || !/onboarded|farm/.test(entry))
  F.push('OnboardingEntry must route returning/onboarded users to /home');
else P.push('OnboardingEntry routes returning users to /home');

// ─── 6. Location screen Continue routes home + general_guidance ─
const fast = read('src/pages/onboarding/FastOnboarding.jsx');
if (!/navigate\(['"]\/home['"]/.test(fast)
    || !/locationMode['"]?\s*,\s*['"]general_guidance['"]/.test(fast))
  F.push('FastOnboarding Continue must persist general_guidance + navigate /home');
else P.push('location screen Continue → general_guidance + /home');

// ─── 7. Diagnostic present + wired ─────────────────────────────
const gap = read('src/runtime/pilotGap/PilotGapHealthRuntime.ts');
for (const tok of ['__mobileBlockerHealth', 'iosCameraAutostartDisabled',
  'cameraStartsOnlyAfterUserTap', 'noRuntimeInitializedWarningOnLoad',
  'uploadAlwaysAvailable', 'existingUserRoutesHome', 'locationOptional',
  'gpsFailureDoesNotBlock', 'noLocationLoop']) {
  if (!new RegExp(`\\b${tok}\\b`).test(gap))
    F.push(`__mobileBlockerHealth must surface "${tok}"`);
}
const app = read('src/App.jsx');
if (!/installPilotGapHealthGlobals/.test(app))
  F.push('App.jsx must wire installPilotGapHealthGlobals (installs __mobileBlockerHealth)');
if (!F.some((m) => m.includes('__mobileBlockerHealth') || m.includes('installPilotGapHealthGlobals')))
  P.push('__mobileBlockerHealth present + wired');

const uniqF = [...new Set(F)];
if (uniqF.length) {
  console.error('[check:mobile-blockers] FAIL');
  for (const m of uniqF) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:mobile-blockers] PASS — no camera warning on load, no location loop, upload always available.');
for (const m of P) console.log('  ✓ ' + m);
