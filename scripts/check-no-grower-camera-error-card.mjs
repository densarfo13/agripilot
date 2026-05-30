#!/usr/bin/env node
/**
 * scripts/check-no-grower-camera-error-card.mjs — Emergency
 * fix gate. Grower-facing files must never contain the banned
 * camera-error-card wording.
 *
 * Hard blockers (after JS/JSX comment stripping):
 *
 *   "Camera ran into a problem"
 *   "Tap retry to try again"
 *   "Retry camera"
 *
 * Allowed only in:
 *   - scripts/ (this file + sibling gates that name the banned
 *     wording in order to forbid it)
 *   - src/runtime/release/* (Release Lock + Godmode diagnostic
 *     copy that explains the rule)
 *   - src/i18n/*           (locale catalogs may keep the keys;
 *                            values must use the spec wording)
 *
 * This script is intentionally STRICT — false positives are
 * easy to surface and fix; false negatives ship a regression
 * to growers.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
function fail(m) { FAILED.push(m); }
function pass(m) { PASSED.push(m); }

function readOrEmpty(f) {
  try { return fs.readFileSync(f, 'utf8'); } catch { return ''; }
}

function stripComments(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist'
          || e.name === '__tests__') continue;
      walk(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

const BANNED_PATTERNS = [
  /Camera\s+ran\s+into\s+a\s+problem/i,
  /Tap\s+retry\s+to\s+try\s+again/i,
  /\bRetry\s+camera\b/i,
  // Camera + Upload Final Fix — "Use a saved photo" replaced
  // with "Upload photo" everywhere grower-facing.
  /\bUse\s+a\s+saved\s+photo\b/i,
];

// Files where these strings can legitimately appear because
// they're EXPLAINING the rule rather than rendering it.
const ALLOWLIST_DIRS = [
  path.join(ROOT, 'scripts'),
  path.join(ROOT, 'src/runtime/release'),
];

function _isAllowlisted(absPath) {
  for (const dir of ALLOWLIST_DIRS) {
    if (absPath.startsWith(dir + path.sep)
        || absPath === dir) return true;
  }
  return false;
}

const SRC_DIR = path.join(ROOT, 'src');
const violators = [];

for (const f of walk(SRC_DIR)) {
  if (_isAllowlisted(f)) continue;
  // i18n catalogs — values must avoid the banned WORDING but
  // the keys may legitimately exist. Strip values and check.
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  const rawSrc = readOrEmpty(f);
  const src = stripComments(rawSrc);
  for (const re of BANNED_PATTERNS) {
    const m = src.match(re);
    if (m) {
      violators.push({
        rel,
        match: m[0],
        re: re.toString(),
      });
      break;  // one finding per file is enough
    }
  }
}

if (violators.length > 0) {
  for (const v of violators) {
    fail(`grower-camera-error: ${v.rel} contains banned wording "${v.match}" (${v.re}). Replace with the upload-first spec copy.`);
  }
} else {
  pass(`grower-camera-error: 0 banned-phrase occurrences in grower-facing files`);
}

// ─── Diagnostic contract — __scanUIHealth() must expose the
//      5 new flags so QA can confirm in one console call.    ──
const healthSrc = readOrEmpty(path.join(ROOT, 'src/runtime/scan/scanUIHealth.js'));
const REQUIRED_FLAGS = [
  'cameraErrorPageRemoved',
  'growerNeverSeesCameraErrorPage',
  'cameraFailureShowsUploadFallback',
  'scanNavAttemptsCamera',
  'directScanUrlStaysIdle',
  // Camera + Upload Final Fix — Upload is always reachable.
  'uploadOptionAlwaysAvailable',
  // Native Camera UX Match — 4 control flags that audit the
  // ScanCameraScreen surface (delegating to LiveCameraScanner).
  'nativeCameraScreenReady',
  'galleryOptionAvailable',
  'flipCameraAvailable',
  'shutterAvailable',
];
for (const flag of REQUIRED_FLAGS) {
  if (!new RegExp('\\b' + flag + '\\s*:').test(healthSrc)) {
    fail(`scan-ui-health: __scanUIHealth() must expose "${flag}"`);
  }
}
pass(`scan-ui-health: 10 emergency-fix + camera-upload + native-camera flags exposed`);

// ─── ScanCameraScreen spec-named module exists ───────────────
const cameraScreen = readOrEmpty(path.join(ROOT,
  'src/components/scan/ScanCameraScreen.jsx'));
if (!cameraScreen) {
  fail(`scan-camera-screen: src/components/scan/ScanCameraScreen.jsx missing`);
} else if (!/LiveCameraScanner/.test(cameraScreen)) {
  fail(`scan-camera-screen: ScanCameraScreen.jsx must delegate to LiveCameraScanner (single source of truth)`);
} else {
  pass(`scan-camera-screen: ScanCameraScreen.jsx re-exports LiveCameraScanner`);
}

// ─── LiveCameraScanner contains all 4 required controls ──────
const cameraImpl = readOrEmpty(path.join(ROOT,
  'src/components/scan/LiveCameraScanner.jsx'));
const CAMERA_CONTROL_MARKERS = [
  { name: 'Close (X) button',      re: /aria-label[^,)]*tSafe\(['"]common\.close/ },
  { name: 'Center-crop helper',    re: /Center\s+crop\s+or\s+leaf/ },
  { name: 'Shutter button',        re: /S\.shutter\b/ },
  { name: 'Flip button',           re: /scan\.camera\.flip/ },
  { name: 'Gallery upload button', re: /scan\.camera\.gallery|scan\.camera\.upload/ },
];
for (const { name, re } of CAMERA_CONTROL_MARKERS) {
  if (!re.test(cameraImpl)) {
    fail(`scan-camera-controls: LiveCameraScanner missing "${name}"`);
  }
}
pass(`scan-camera-controls: Close · Center-crop · Shutter · Flip · Gallery all wired`);

// ─── ScanFallback uses the spec-approved CTA labels ───────────
const fallback = readOrEmpty(path.join(ROOT,
  'src/components/scan/ScanFallback.jsx'));
if (!/Upload\s+photo/.test(fallback)) {
  fail(`scan-fallback: must surface "Upload photo" as primary CTA`);
}
if (!/Try\s+camera\s+again/.test(fallback)) {
  fail(`scan-fallback: must surface "Try camera again" as secondary CTA`);
}
if (!/scan-fallback-helper/.test(fallback)) {
  fail(`scan-fallback: must render the helper line ("Camera may be blocked...")`);
}
pass(`scan-fallback: "Upload photo" + "Try camera again" + helper line wired`);

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:no-grower-camera-error-card] FAIL — banned wording leaked.');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} checks passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:no-grower-camera-error-card] PASS — grower never sees the camera error card.');
console.log(`  Banned phrases cleared from src/ outside the release-lock + scripts allowlist.`);
console.log(`  ScanFallback uses "Upload photo" primary + "Try camera again" secondary + helper line.`);
console.log(`  __scanUIHealth() exposes the 10 diagnostic flags (incl. nativeCameraScreenReady + galleryOptionAvailable + flipCameraAvailable + shutterAvailable).`);
console.log(`  ScanCameraScreen.jsx re-exports LiveCameraScanner; all 5 native-camera controls (Close · Center-crop · Shutter · Flip · Gallery) verified.`);
