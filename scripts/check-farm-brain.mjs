/**
 * check-farm-brain.mjs — sprint #207 gate.
 *
 * Guards the "Mythos Farm Brain V1" honest deltas. Fails build if:
 *   1. FarmBrain.ts missing or doesn't export the read-only composite
 *      + nextRecommendedAction + health installer.
 *   2. Honesty weakened: satelliteHistory must stay [] and the health
 *      envelope must assert satelliteUsed:false + readOnly. No
 *      satellite/Sentinel/NDVI import.
 *   3. ScanConfidenceExplainer doesn't export buildConfidenceBreakdown,
 *      OR the breakdown grows a fabricated satellite slice.
 *   4. App.jsx doesn't boot-install __farmBrainHealth.
 *   5. CommandCenterDeck empty state doesn't consult FarmBrain
 *      (still shows a bare "Not enough data yet" with no next step).
 *   6. Scan UI doesn't render the confidence breakdown.
 *   7. Required i18n keys missing.
 *
 * Read-only.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const errors = [];
const _exists = (rel) => { try { return fs.existsSync(path.join(ROOT, rel)); } catch { return false; } };
const _read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; } };
const _has = (s, n, m) => { if (!s.includes(n)) errors.push(m); };

// 1-2. FarmBrain composite + honesty.
const FB = 'src/runtime/farmBrain/FarmBrain.ts';
if (!_exists(FB)) {
  errors.push('missing: ' + FB);
} else {
  const src = _read(FB);
  _has(src, 'export function buildFarmBrain',
    'FarmBrain must export buildFarmBrain');
  _has(src, 'export function nextRecommendedAction',
    'FarmBrain must export nextRecommendedAction (empty-state next step)');
  _has(src, 'export function installFarmBrainHealthGlobal',
    'FarmBrain must export installFarmBrainHealthGlobal');
  _has(src, 'satelliteHistory', 'FarmBrain must declare satelliteHistory');
  _has(src, 'satelliteUsed: false',
    'FarmBrain health must assert satelliteUsed:false (satellite frozen)');
  _has(src, 'readOnly: true', 'FarmBrain must be read-only');
  if (/import .*(SatelliteCorrelation|Sentinel|NDVI|NDMI)/i.test(src)) {
    errors.push('FarmBrain must NOT import satellite/Sentinel/NDVI (frozen)');
  }
}

// 3. Honest confidence breakdown.
const CE = 'src/runtime/scanMythos/ScanConfidenceExplainer.ts';
if (!_exists(CE)) {
  errors.push('missing: ' + CE);
} else {
  const src = _read(CE);
  _has(src, 'export function buildConfidenceBreakdown',
    'ScanConfidenceExplainer must export buildConfidenceBreakdown');
  // The breakdown must NOT manufacture a satellite slice.
  if (/source:\s*['"]satellite['"]/i.test(src)) {
    errors.push('buildConfidenceBreakdown must NOT emit a satellite slice (would fabricate evidence)');
  }
}

// 4. Boot install.
_has(_read('src/App.jsx'), 'installFarmBrainHealthGlobal',
  'App.jsx must boot-install installFarmBrainHealthGlobal');

// 5. Empty-state wiring.
const DECK = 'src/components/commandCenter/CommandCenterDeck.jsx';
if (!_exists(DECK)) {
  errors.push('missing: ' + DECK);
} else {
  const src = _read(DECK);
  _has(src, 'nextRecommendedAction',
    'CommandCenterDeck must consult FarmBrain.nextRecommendedAction for the empty state');
  _has(src, 'cc-action-onboarding-guide',
    'CommandCenterDeck must render the onboarding guide in the empty Today\'s Action state');
}

// 6. Scan UI breakdown.
const UI = 'src/components/scan/IntelligentScanResult.jsx';
if (!_exists(UI)) {
  errors.push('missing: ' + UI);
} else {
  _has(_read(UI), 'scan-intel-confidence-breakdown',
    'IntelligentScanResult must render the confidence breakdown list');
}

// 7. i18n keys.
const TEN = _read('src/i18n/columns/T-en.js');
for (const k of [
  'scan.evidence.breakdown', 'scan.evidence.image', 'scan.evidence.farmHistory',
  'farmBrain.next.addCrop.title', 'farmBrain.next.firstScan.title',
  'farmBrain.next.startAction.title',
]) {
  if (!TEN.includes('"' + k + '"')) errors.push('T-en.js missing key: ' + k);
}

if (errors.length) {
  console.error('[check:farm-brain] FAIL — ' + errors.length + ' violation(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:farm-brain] PASS — read-only FarmBrain composite + onboarding next-step wired; '
  + 'honest confidence breakdown (no fabricated satellite slice); satellite frozen.');
