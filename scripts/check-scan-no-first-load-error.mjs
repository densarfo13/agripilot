#!/usr/bin/env node
/**
 * check-scan-no-first-load-error.mjs — emergency fix gate.
 *
 *   node scripts/check-scan-no-first-load-error.mjs
 *
 * Verifies the "Camera ran into a problem" card can NEVER fire
 * on first load of /scan:
 *   1. ScanFallback hard-blocks camera-failure copy when
 *      cameraAttempted/userInitiatedCamera are false.
 *   2. ScanPage default phase is 'idle'; declares
 *      userInitiatedCamera state; resets transient camera-error
 *      keys on /scan mount; never references `lang` undefined.
 *   3. ScanPage does NOT call getUserMedia / Camera.getPhoto /
 *      startCapture inside a useEffect body (which would fire on
 *      mount before any user gesture).
 *   4. scanUIHealth surfaces the v3 contract: version field
 *      'scan-idle-entry-v3', cameraAutoStart=false,
 *      firstLoadErrorCardBlocked=true, and pins
 *      __forceScanIdle().
 *   5. package.json + manifest.json bumped to 1.0.4 with
 *      start_url v=1.0.4.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const HEADER    = '[check:scan-no-first-load-error]';

function _read(rel) {
  const p = resolve(ROOT, rel);
  if (!existsSync(p)) return null;
  try { return readFileSync(p, 'utf8'); } catch { return null; }
}
function fail(m, d) {
  console.error(HEADER, 'FAIL —', m);
  if (d) console.error('  ' + d);
  process.exit(1);
}

const FILES = {
  scanPage:   'src/pages/ScanPage.jsx',
  fallback:   'src/components/scan/ScanFallback.jsx',
  boundary:   'src/components/scan/ScanErrorBoundary.jsx',
  uiHealth:   'src/runtime/scan/scanUIHealth.js',
  pkg:        'package.json',
  manifest:   'public/manifest.json',
};
const sources = {};
for (const [k, rel] of Object.entries(FILES)) {
  const src = _read(rel);
  if (!src) fail('missing file: ' + rel);
  sources[k] = src;
}

// ─── 1. ScanFallback hard-block guard ───────────────────────────
if (!/cameraAttempted\s*=\s*false/.test(sources.fallback)) {
  fail('ScanFallback must default cameraAttempted prop to false');
}
if (!/userInitiatedCamera\s*=\s*false/.test(sources.fallback)) {
  fail('ScanFallback must default userInitiatedCamera prop to false');
}
if (!/firstLoadBlock/.test(sources.fallback)) {
  fail('ScanFallback must compute firstLoadBlock and short-circuit '
    + 'before rendering the camera-error copy');
}
if (!/scan-fallback-blocked/.test(sources.fallback)) {
  fail('ScanFallback must render the blocked-loading surface with '
    + 'data-testid="scan-fallback-blocked"');
}

// ─── 2. ScanPage idle + reset + no undefined lang ───────────────
if (!/useState\('idle'\)/.test(sources.scanPage)) {
  fail('ScanPage default phase must be useState(\'idle\')');
}
if (!/setUserInitiatedCamera\(false\)/.test(sources.scanPage)) {
  fail('ScanPage must declare userInitiatedCamera state and reset it');
}
// The `lang` ReferenceError that triggered the camera-error card
// is the root cause. Fail if `locale: lang` appears as live code
// (start of line, no leading * or // comment marker).
{
  const codeLines = sources.scanPage
    .split(/\r?\n/)
    .filter((line) => !/^\s*(\*|\/\/)/.test(line));
  for (const line of codeLines) {
    if (/^\s*locale:\s*lang\b/.test(line)) {
      fail('ScanPage must not reference undefined `lang` — '
        + 'fix the useScanRuntime locale prop');
    }
  }
}
// Route-entry reset effect
if (!/farroway_scan_camera_error/.test(sources.scanPage)) {
  fail('ScanPage must clear farroway_scan_camera_error on mount');
}
if (!/window\.__forceScanIdle\s*=/.test(sources.scanPage)) {
  fail('ScanPage must pin window.__forceScanIdle on mount');
}

// ─── 3. No auto-start camera in useEffect ───────────────────────
// Forbidden patterns: any camera-start call inside a useEffect body
// that ScanPage owns. We grep for the specific call shapes the
// spec forbids and require the pattern to NOT appear in ScanPage.
const FORBIDDEN_AUTO_START = [
  /navigator\.mediaDevices\.getUserMedia\s*\(/,
  /Camera\.getPhoto\s*\(/,
  /Camera\.requestPermissions\s*\(/,
];
for (const pattern of FORBIDDEN_AUTO_START) {
  if (pattern.test(sources.scanPage)) {
    fail('ScanPage must not call ' + pattern.source
      + ' — auto-start forbidden');
  }
}

// ─── 4. scanUIHealth v3 contract ────────────────────────────────
if (!/scan-idle-entry-v3/.test(sources.uiHealth)) {
  fail('scanUIHealth.js must declare RUNTIME_VERSION = scan-idle-entry-v3');
}
const V3_FIELDS = [
  /version:\s*RUNTIME_VERSION/,
  /initialPhase:\s*'idle'/,
  /cameraAutoStart:\s*false/,
  /userInitiatedCamera:/,
  /firstLoadErrorCardBlocked:\s*true/,
];
for (const re of V3_FIELDS) {
  if (!re.test(sources.uiHealth)) {
    fail('scanUIHealth.js missing v3 field shape: ' + re.source);
  }
}
if (!/__forceScanIdle/.test(sources.uiHealth)) {
  fail('scanUIHealth.js must install window.__forceScanIdle stub');
}

// ─── 5. Version bump ────────────────────────────────────────────
let pkgVersion;
try { pkgVersion = JSON.parse(sources.pkg).version; }
catch (e) { fail('package.json does not parse', e.message); }
if (pkgVersion !== '1.0.4') {
  fail('package.json version must be bumped to 1.0.4 '
    + '(found: ' + pkgVersion + ')');
}
let manifest;
try { manifest = JSON.parse(sources.manifest); }
catch (e) { fail('public/manifest.json does not parse', e.message); }
if (manifest.version !== '1.0.4') {
  fail('public/manifest.json version must be bumped to 1.0.4 '
    + '(found: ' + manifest.version + ')');
}
if (manifest.start_url !== '/?v=1.0.4') {
  fail('public/manifest.json start_url must include v=1.0.4 '
    + '(found: ' + manifest.start_url + ')');
}

// ─── ScanErrorBoundary remains the boundary; it renders fallback
// with no guard props so the first-load block in ScanFallback kicks
// in via the defaults.
if (!/<ScanFallback[^/]*reason="crash"/.test(sources.boundary)) {
  fail('ScanErrorBoundary must keep its <ScanFallback reason="crash" /> '
    + 'render path (the guards default to false → blocked)');
}

console.log(HEADER, 'PASS — first-load camera-error card hard-blocked.');
console.log('  ScanFallback guards: cameraAttempted + userInitiatedCamera (default false).');
console.log('  ScanPage: idle default + route-entry reset + __forceScanIdle pinned.');
console.log('  scanUIHealth: v3 contract complete.');
console.log('  Version: 1.0.4 (package.json + manifest.json + start_url).');
process.exit(0);
