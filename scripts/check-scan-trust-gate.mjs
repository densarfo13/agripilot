/**
 * check-scan-trust-gate.mjs — sprint #214 §12.
 * Fails build if the trust gate is missing or the scan UI doesn't
 * gate Add-to-My-Plants / Create-Task on it.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const errors = [];
const _exists = (r) => { try { return fs.existsSync(path.join(ROOT, r)); } catch { return false; } };
const _read = (r) => { try { return fs.readFileSync(path.join(ROOT, r), 'utf8'); } catch { return ''; } };
const _has = (s, n, m) => { if (!s.includes(n)) errors.push(m); };

const GATE = 'src/runtime/scanTrust/ScanTrustGate.ts';
if (!_exists(GATE)) errors.push('missing: ' + GATE);
else {
  const s = _read(GATE);
  _has(s, 'export function evaluateScanTrust', 'ScanTrustGate must export evaluateScanTrust');
  for (const f of ['allowPlantCreation', 'allowTaskCreation', 'allowFarmBrainIngestion',
    'allowTimelineWrite', 'allowRecentScanDisplay', 'allowReviewSave', 'gateStatus', 'gateReasons']) {
    _has(s, f, 'trust decision must include: ' + f);
  }
  _has(s, '__scanTrustGateHealth', 'ScanTrustGate must pin __scanTrustGateHealth');
}

// Scan UI must gate the plant + task CTAs on the trust gate.
const UI = 'src/components/scan/IntelligentScanResult.jsx';
if (!_exists(UI)) errors.push('missing: ' + UI);
else {
  const s = _read(UI);
  _has(s, 'evaluateScanTrust', 'IntelligentScanResult must consult evaluateScanTrust');
  _has(s, '_trust.allowPlantCreation', 'Save-plant CTA must require _trust.allowPlantCreation');
  _has(s, '_trust.allowTaskCreation', 'Create-task CTA must require _trust.allowTaskCreation');
  // UX sprint 2026-07-05: the coach card's job (coaching + save-for-review when blocked,
  // never Add-to-My-Plants) moved to the single ScanGuidanceCard beneath the header.
  _has(s, 'ScanGuidanceCard', 'must render ScanGuidanceCard (the single blocked/low-confidence surface)');
  const G = 'src/components/scan/ScanGuidanceCard.jsx';
  if (!_exists(G)) errors.push('missing: ' + G);
  else {
    const g = _read(G);
    _has(g, 'scan-guidance-retake', 'guidance card must offer Retake');
    _has(g, 'scan-guidance-save-review', 'guidance card must offer Save for Review');
  }
  _has(_read('src/App.jsx'), 'installScanTrustGateHealthGlobal',
    'App.jsx must boot-install installScanTrustGateHealthGlobal');
}

if (errors.length) {
  console.error('[check:scan-trust-gate] FAIL — ' + errors.length + ' issue(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:scan-trust-gate] PASS — trust gate present; Add-to-My-Plants + Create-Task gated; coach card wired.');
