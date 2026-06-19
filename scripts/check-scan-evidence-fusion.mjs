/**
 * check-scan-evidence-fusion.mjs — sprint #206 gate.
 *
 * Guards the one genuine "Scan Intelligence V2" delta: two-sided
 * evidence fusion (Layer 1). Fails the build if:
 *   1. ScanEvidenceFusionEngine is missing or doesn't export the
 *      fuse fn + health installer.
 *   2. The honesty invariants are weakened — the engine MUST keep
 *      contradicting observations, MUST NOT use satellite, MUST NOT
 *      inflate confidence (fusedConfidence echoes decision.confidence).
 *   3. scanDetectionEngine doesn't wire evidenceFusion onto the result.
 *   4. App.jsx doesn't boot-install the health global.
 *   5. The UI doesn't surface contradicting observations.
 *   6. The 'scan.evidence.against' key is missing from T-en.
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

// 1-2. Engine + honesty invariants.
const ENG = 'src/runtime/scanMythos/ScanEvidenceFusionEngine.ts';
if (!_exists(ENG)) {
  errors.push('missing: ' + ENG);
} else {
  const src = _read(ENG);
  _has(src, 'export function fuseScanEvidence',
    'ScanEvidenceFusionEngine must export fuseScanEvidence');
  _has(src, 'export function installScanEvidenceFusionHealthGlobal',
    'ScanEvidenceFusionEngine must export installScanEvidenceFusionHealthGlobal');
  _has(src, 'contradictingObservations',
    'ScanEvidenceFusionEngine must produce contradictingObservations (the honest delta)');
  _has(src, 'supportingObservations',
    'ScanEvidenceFusionEngine must produce supportingObservations');
  // Honesty: confidence echoed, never inflated.
  _has(src, 'fusedConfidence: confidence',
    'ScanEvidenceFusionEngine must echo decision.confidence (never inflate)');
  // Honesty: satellite never used (Layer 2 frozen).
  _has(src, 'satelliteUsed: false',
    'ScanEvidenceFusionEngine must keep satelliteUsed:false (Layer 2 frozen)');
  if (/import .*(SatelliteCorrelation|Sentinel|NDVI)/i.test(src)) {
    errors.push('ScanEvidenceFusionEngine must NOT import satellite/Sentinel/NDVI (frozen)');
  }
}

// 3. Wired into scanDetectionEngine.
const SDE = 'src/core/scanDetectionEngine.js';
if (!_exists(SDE)) {
  errors.push('missing: ' + SDE);
} else {
  const src = _read(SDE);
  _has(src, '_fuseScanEvidenceSafe',
    'scanDetectionEngine must define _fuseScanEvidenceSafe');
  _has(src, 'evidenceFusion:',
    'scanDetectionEngine must attach evidenceFusion onto the result');
}

// 4. Boot install.
_has(_read('src/App.jsx'), 'installScanEvidenceFusionHealthGlobal',
  'App.jsx must boot-install installScanEvidenceFusionHealthGlobal');

// 5. UI surfaces contradicting observations.
const UI = 'src/components/scan/IntelligentScanResult.jsx';
if (!_exists(UI)) {
  errors.push('missing: ' + UI);
} else {
  const src = _read(UI);
  _has(src, 'contradictingObservations',
    'IntelligentScanResult must read contradictingObservations');
  _has(src, 'scan-intel-evidence-against-list',
    'IntelligentScanResult must render the contradicting-observations list');
}

// 6. i18n key.
_has(_read('src/i18n/columns/T-en.js'), '"scan.evidence.against"',
  'T-en.js must declare scan.evidence.against');

if (errors.length) {
  console.error('[check:scan-evidence-fusion] FAIL — ' + errors.length + ' violation(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:scan-evidence-fusion] PASS — two-sided evidence fusion wired; '
  + 'contradicting observations surfaced; confidence never inflated; satellite never used (Layer 2 frozen).');
