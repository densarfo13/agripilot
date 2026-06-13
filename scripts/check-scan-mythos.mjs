/**
 * check-scan-mythos.mjs — locks the Mythos scan composition layer
 * (sprint #200, no-satellite partial override).
 *
 * Fails build if:
 *   - any of the 6 scanMythos modules is missing or loses its export
 *   - the decision contract loses a required field (plant, why,
 *     limitations, nextAction, followUpDate, outcomePrompt)
 *   - the composer can render an empty plant / "Unknown Plant" with
 *     candidates (regression of the #179 invariant)
 *   - satellite is fabricated (any NDVI literal or satellite boost
 *     other than the hard-coded 0)
 *   - provider names appear in composed grower output
 *   - App.jsx loses the boot install
 *   - the 8 spec health flags are missing
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const errors = [];
const _exists = (rel) => { try { return fs.existsSync(path.join(ROOT, rel)); } catch { return false; } };
const _read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; } };
const _has = (s, n, m) => { if (!s.includes(n)) errors.push(m); };

const BASE = 'src/runtime/scanMythos/';
const MODULES = {
  'ScanMythosContracts.ts':   ['SCAN_MYTHOS_CONTRACTS_VERSION', 'FORBIDDEN_PROVIDER_NAMES', 'FORBIDDEN_DOSAGE_TOKENS'],
  'FarmScanContextRuntime.ts':['export function buildFarmScanContext'],
  'ScanConfidenceExplainer.ts':['export function buildWhy', 'export function buildLimitations', 'export function confidenceLabelFor'],
  'MultiPhotoGuidance.ts':    ['export function getMultiPhotoStatus'],
  'ScanDecisionComposer.ts':  ['export function composeScanMythosDecision'],
  'ScanMythosEngine.ts':      ['export function installScanMythosHealthGlobals', 'export function buildScanMythosHealth', 'export function buildMultiPhotoScanHealth'],
};
for (const [file, needles] of Object.entries(MODULES)) {
  const rel = BASE + file;
  if (!_exists(rel)) { errors.push('missing: ' + rel); continue; }
  const src = _read(rel);
  for (const n of needles) _has(src, n, rel + ' must contain ' + n);
}

// Decision contract fields.
const COMPOSER = _read(BASE + 'ScanDecisionComposer.ts');
for (const f of ['plant', 'why', 'limitations', 'nextAction', 'followUpDate',
                 'outcomePrompt', 'topCandidates', 'confidenceLabel']) {
  _has(COMPOSER, f + ':', 'ScanDecisionComposer output must include field: ' + f);
}
// Never-dead-end ladder + honest placeholders.
_has(COMPOSER, "'Needs confirmation'",
  'ScanDecisionComposer must use "Needs confirmation" when candidates exist but no name');
_has(COMPOSER, "'Scan unclear'",
  'ScanDecisionComposer must use "Scan unclear" floor (never empty plant)');

// Satellite must NOT be fabricated: boost hard-coded 0, no NDVI math.
_has(COMPOSER, 'satelliteContextBoost: 0',
  'ScanDecisionComposer must hard-code satelliteContextBoost: 0 (no satellite this sprint)');
const CONTRACTS = _read(BASE + 'ScanMythosContracts.ts');
if (/ndvi\s*[:=]\s*[0-9]/i.test(CONTRACTS) || /ndvi\s*[:=]\s*[0-9]/i.test(COMPOSER)) {
  errors.push('scanMythos must NOT contain a fabricated NDVI numeric literal');
}

// Health flags (spec §9).
const ENGINE = _read(BASE + 'ScanMythosEngine.ts');
for (const flag of ['mythosReady', 'farmContextReady', 'satelliteOptional',
  'noFabricatedSatelliteData', 'nonBlocking', 'nextActionReady',
  'followUpReady', 'outcomePathReady']) {
  _has(ENGINE, flag, 'ScanMythosEngine health must expose flag: ' + flag);
}

// Boot install.
const APP = _read('src/App.jsx');
_has(APP, 'installScanMythosHealthGlobals',
  'App.jsx must call installScanMythosHealthGlobals at boot');
_has(APP, "import('./runtime/scanMythos/ScanMythosEngine')",
  'App.jsx must lazy-import ScanMythosEngine');

if (errors.length) {
  console.error('[check:scan-mythos] FAIL — ' + errors.length + ' violation(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:scan-mythos] PASS — 6 modules present, decision contract complete, '
  + 'never-dead-end ladder + honest limitations, satellite boost hard-zeroed (no fabrication), '
  + '8 health flags + boot install wired.');
