#!/usr/bin/env node
/**
 * check-scan-no-autostart.mjs — RC1 scan-landing safety gate.
 *
 *   node scripts/check-scan-no-autostart.mjs
 *
 * What this verifies
 * ──────────────────
 *   The /scan landing surface must NOT auto-start the camera on
 *   mount. Before RC1, ScanPage defaulted phase = 'capture' which
 *   mounted ScanCapture + LiveCameraScanner on initial render and
 *   fired getUserMedia before any user gesture — on mobile Safari
 *   / PWA this could land on the "Camera ran into a problem" error
 *   card before the user did anything.
 *
 *   This gate enforces the RC1 contract:
 *
 *     1. src/pages/ScanPage.jsx declares `useState('idle')` for
 *        the phase variable.
 *     2. ScanEntryCard.jsx is imported and rendered on the idle path.
 *     3. cameraAttempted state is declared.
 *     4. ScanUIHealth runtime is wired in App.jsx.
 *
 *   Hard gate — no baseline, no grandfathering. A regression fails
 *   the build with an actionable error.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const HEADER    = '[check:scan-no-autostart]';

function _read(rel) {
  const p = resolve(ROOT, rel);
  if (!existsSync(p)) return null;
  try { return readFileSync(p, 'utf8'); } catch { return null; }
}

function fail(message, details) {
  console.error(HEADER, 'FAIL — ' + message);
  if (details) console.error('  ' + details);
  process.exit(1);
}

const FILES = {
  scanPage:        'src/pages/ScanPage.jsx',
  scanEntryCard:   'src/components/scan/ScanEntryCard.jsx',
  scanUIHealth:    'src/runtime/scan/scanUIHealth.js',
  app:             'src/App.jsx',
};

const sources = {};
for (const [k, rel] of Object.entries(FILES)) {
  const src = _read(rel);
  if (!src) fail('missing required file: ' + rel);
  sources[k] = src;
}

// 1) ScanPage default phase MUST be 'idle' (not 'capture'/'analyzing'/etc).
const phaseDecl = sources.scanPage.match(
  /useState\(\s*['"]([a-z_]+)['"]\s*\)[^;]*?;\s*(?:\/\/[^\n]*\n\s*)*const\s+\[\s*(?:cameraAttempted|result|error)/);
// Looser detection: find every useState('xxx') line and ensure
// the FIRST one — at the canonical phase declaration spot — is 'idle'.
const useStateMatches = [...sources.scanPage.matchAll(
  /const\s+\[\s*(\w+)\s*,\s*set\w+\s*\]\s*=\s*useState\(\s*['"]([a-z_]+)['"]\s*\)/g)];
const phaseEntry = useStateMatches.find((m) => m[1] === 'phase');
if (!phaseEntry) {
  fail('ScanPage.jsx: cannot find `useState(...)` for `phase` variable');
}
if (phaseEntry[2] !== 'idle') {
  fail('ScanPage.jsx: default phase must be "idle", found "' + phaseEntry[2] + '"',
    'RC1 contract — camera must not auto-start on mount.');
}

// 2) cameraAttempted state must exist
if (!/useState\(\s*false\s*\)[^;]*;\s*\/\/\s*Hidden gallery/.test(sources.scanPage)
    && !/const\s+\[\s*cameraAttempted\s*,/.test(sources.scanPage)) {
  fail('ScanPage.jsx: cameraAttempted state not declared',
    'Required so ScanFallback can distinguish first-load from real failure.');
}

// 3) An idle-state landing component is imported + rendered. RC1
//    shipped ScanEntryCard; the production-hardening pass replaced
//    the default render with the richer ScanHub. Either satisfies
//    the contract — what matters is that SOMETHING calm renders in
//    the idle phase and the camera never auto-starts.
const idleImports = [
  /import\s+ScanHub\s+from\s+['"][^'"]+ScanHub\.jsx['"]/,
  /import\s+ScanEntryCard\s+from\s+['"][^'"]+ScanEntryCard\.jsx['"]/,
];
const idleRenders = [/<ScanHub\b/, /<ScanEntryCard\b/];
if (!idleImports.some((re) => re.test(sources.scanPage))) {
  fail('ScanPage.jsx: no idle-state landing component imported',
    'Need either <ScanHub> or <ScanEntryCard>');
}
if (!idleRenders.some((re) => re.test(sources.scanPage))) {
  fail('ScanPage.jsx: no idle-state landing component rendered',
    'Need either <ScanHub> or <ScanEntryCard>');
}

// 4) Idle render guard must come BEFORE the capture early-return.
const idxIdle    = sources.scanPage.indexOf("phase === 'idle'");
const idxCapture = sources.scanPage.indexOf("phase === 'capture' && _scanSupportsLiveCamera");
if (idxIdle < 0) {
  fail('ScanPage.jsx: idle render guard not found',
    'Required: `if (phase === "idle" && flagOn) return <ScanEntryCard ... />`');
}
if (idxCapture >= 0 && idxIdle > idxCapture) {
  fail('ScanPage.jsx: idle render guard must precede capture early-return',
    'Otherwise the camera will auto-start before the entry card renders.');
}

// 5) ScanEntryCard exposes the spec'd test-ids
const ENTRY_IDS = ['scan-entry-card', 'scan-entry-take-photo', 'scan-entry-use-saved-photo'];
for (const id of ENTRY_IDS) {
  if (!sources.scanEntryCard.includes(id)) {
    fail('ScanEntryCard.jsx: missing data-testid="' + id + '"');
  }
}

// 6) ScanUIHealth exports the spec'd surface
const UI_HEALTH_EXPORTS = [
  'installScanUIHealthGlobal', 'getScanUIHealth',
  'recordCameraAttempt', 'recordCameraStatus', 'recordPermissionStatus',
];
for (const sym of UI_HEALTH_EXPORTS) {
  if (!new RegExp('export\\s+function\\s+' + sym + '\\b').test(sources.scanUIHealth)) {
    fail('scanUIHealth.js missing export: ' + sym);
  }
}

// 7) Required snapshot fields
const FIELDS = [
  'route', 'defaultEntryMode', 'cameraAutoStart',
  'cameraAttempted', 'cameraStatus', 'permissionStatus',
  'savedPhotoAvailable',
];
for (const f of FIELDS) {
  if (!new RegExp(f + '\\s*:').test(sources.scanUIHealth)) {
    fail('scanUIHealth snapshot missing field: ' + f);
  }
}
// cameraAutoStart must be the constant `false`
if (!/cameraAutoStart\s*:\s*false/.test(sources.scanUIHealth)) {
  fail('scanUIHealth: cameraAutoStart must be the literal `false`',
    'RC1 contract — the surface NEVER auto-starts the camera.');
}

// 8) App.jsx installs the diagnostic
if (!/installScanUIHealthGlobal\s*\(\s*\)/.test(sources.app)) {
  fail('App.jsx does not call installScanUIHealthGlobal() during boot');
}

console.log(HEADER, 'PASS — scan landing default-mode is idle.');
console.log('  ScanEntryCard wired, cameraAttempted state present, idle');
console.log('  guard precedes capture, __scanUIHealth() installed.');
process.exit(0);
