#!/usr/bin/env node
/**
 * scripts/check-scan-nav-camera-intent.mjs — Lock the Scan UX
 * Final Fix:
 *
 *   A. ScanHub.jsx must NOT render the CAMERA Allowed +
 *      CONNECTION Online status row (data-testid
 *      "scan-hub-status-camera" / "scan-hub-status-connectivity"
 *      removed from JSX).
 *   B. BottomTabNav.jsx scan-tab click navigates to /scan with
 *      ?intent=camera + route state userInitiatedCamera=true,
 *      source='bottom_nav'.
 *   C. ScanPage.jsx reads location.search + location.state to
 *      detect the intent and promote to capture phase.
 *   D. __scanUIHealth() exposes the 4 new flags
 *      (statusCardsRemoved, scanNavOpensCamera,
 *      cameraAutoStartOnPlainRoute=false,
 *      cameraStartsOnlyFromUserIntent).
 *
 * Strict-rule audit
 *   • Read-only. Never mutates source.
 *   • Returns exit 1 on any hard blocker.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [], PASSED = [];
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };

// ─── A. ScanHub strips the status row ────────────────────────
const hub = read(path.join(ROOT, 'src/components/scan/ScanHub.jsx'));
if (!hub) {
  FAILED.push('scan-hub: src/components/scan/ScanHub.jsx missing');
} else {
  // The two status testids must no longer appear inside JSX
  // (any reference inside a comment is fine — we strip those).
  const stripped = hub
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  if (/data-testid\s*=\s*['"]scan-hub-status(-camera|-connectivity|)['"]/.test(stripped)) {
    FAILED.push('scan-hub: CAMERA/CONNECTION status row still present in JSX (data-testid scan-hub-status-*)');
  } else {
    PASSED.push('scan-hub: CAMERA Allowed + CONNECTION Online status row removed from grower UI');
  }
}

// ─── B. Bottom nav passes intent=camera ────────────────────
const nav = read(path.join(ROOT, 'src/components/farmer/BottomTabNav.jsx'));
if (!nav) {
  FAILED.push('bottom-nav: src/components/farmer/BottomTabNav.jsx missing');
} else {
  if (!/tab\.key\s*===\s*['"]scan['"]/.test(nav)
      || !/intent=camera/.test(nav)) {
    FAILED.push('bottom-nav: scan-tab click must navigate with ?intent=camera');
  }
  if (!/userInitiatedCamera:\s*true/.test(nav)
      || !/source:\s*['"]bottom_nav['"]/.test(nav)) {
    FAILED.push('bottom-nav: scan-tab click must set userInitiatedCamera + source=bottom_nav in route state');
  }
  if (FAILED.length === 0) {
    PASSED.push('bottom-nav: scan-tab passes ?intent=camera + userInitiatedCamera state');
  }
}

// ─── C. ScanPage detects intent ──────────────────────────────
const scanPage = read(path.join(ROOT, 'src/pages/ScanPage.jsx'));
if (!scanPage) {
  FAILED.push('scan-page: src/pages/ScanPage.jsx missing');
} else {
  if (!/useLocation/.test(scanPage)) {
    FAILED.push('scan-page: must import useLocation');
  }
  if (!/_launchedFromScanNav/.test(scanPage)) {
    FAILED.push('scan-page: must compute _launchedFromScanNav from URL + state');
  }
  if (!/intent.*camera/.test(scanPage)) {
    FAILED.push('scan-page: must read intent=camera from URL');
  }
  if (!/setPhase\s*\(\s*['"]capture['"]\s*\)/.test(scanPage)) {
    FAILED.push('scan-page: must call setPhase(capture) when launched from scan nav');
  }
  if (FAILED.length === 0
      || !FAILED.some((f) => f.startsWith('scan-page:'))) {
    PASSED.push('scan-page: detects ?intent=camera + state and promotes to capture phase');
  }
}

// ─── D. __scanUIHealth() exposes the 4 new flags ────────────
const health = read(path.join(ROOT, 'src/runtime/scan/scanUIHealth.js'));
const REQUIRED = [
  'statusCardsRemoved',
  'scanNavOpensCamera',
  'cameraAutoStartOnPlainRoute',
  'cameraStartsOnlyFromUserIntent',
];
for (const flag of REQUIRED) {
  if (!new RegExp('\\b' + flag + '\\s*:').test(health)) {
    FAILED.push(`scan-ui-health: __scanUIHealth() must expose "${flag}"`);
  }
}
if (!/scan-nav-camera-final/.test(health)) {
  FAILED.push('scan-ui-health: RUNTIME_VERSION must be "scan-nav-camera-final"');
}
PASSED.push('scan-ui-health: 4 new flags + scan-nav-camera-final version present');

if (FAILED.length > 0) {
  console.error('[check:scan-nav-camera-intent] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('[check:scan-nav-camera-intent] PASS — Scan UX Final Fix locked in.');
console.log('  Status cards removed · Scan nav opens camera via intent · Direct URL stays idle.');
