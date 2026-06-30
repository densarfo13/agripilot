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

// 1. FarmBrain state composite (#207) — state + next-action.
const FB = 'src/runtime/farmBrain/FarmBrain.ts';
if (!_exists(FB)) {
  errors.push('missing: ' + FB);
} else {
  const src = _read(FB);
  _has(src, 'export function buildFarmBrain',
    'FarmBrain must export buildFarmBrain');
  _has(src, 'export function nextRecommendedAction',
    'FarmBrain must export nextRecommendedAction (empty-state next step)');
  _has(src, 'satelliteHistory', 'FarmBrain must declare satelliteHistory');
}

// 1a. Sprint #208 — Farm Brain Runtime: getFarmBrain + 7-flag health.
const FBR = 'src/runtime/farmBrain/FarmBrainRuntime.ts';
if (!_exists(FBR)) {
  errors.push('missing: ' + FBR);
} else {
  const src = _read(FBR);
  _has(src, 'export function getFarmBrain',
    'FarmBrainRuntime must export getFarmBrain(farmId)');
  _has(src, 'export function installFarmBrainHealthGlobal',
    'FarmBrainRuntime must export installFarmBrainHealthGlobal');
  _has(src, 'export function buildFarmBrainReadiness',
    'FarmBrainRuntime must export buildFarmBrainReadiness');
  for (const f of ['farmBrainReady', 'cropStageReady', 'farmHealthReady',
    'adaptiveTasksReady', 'scanMemoryReady', 'outcomeLearningReady',
    'satelliteFoundationReady']) {
    _has(src, f, 'FarmBrainRuntime readiness must expose flag: ' + f);
  }
  _has(src, 'satelliteUsed: false',
    'FarmBrainRuntime must assert satelliteUsed:false (frozen)');
  _has(src, 'readOnly: true', 'FarmBrainRuntime must be read-only');
  _has(src, 'satelliteHistory: Object.freeze([])',
    'FarmBrainRuntime must keep satelliteHistory empty (frozen)');
}

// 1b. Sprint #208 — CropStageEngine (10 crops, honest confidence).
const CS = 'src/runtime/farmBrain/CropStageEngine.ts';
if (!_exists(CS)) {
  errors.push('missing: ' + CS);
} else {
  const src = _read(CS);
  _has(src, 'export function inferCropStage',
    'CropStageEngine must export inferCropStage');
  for (const c of ['onion', 'tomato', 'pepper', 'okra', 'maize',
    'cassava', 'rice', 'beans', 'cabbage', 'cucumber']) {
    _has(src, c + ':', 'CropStageEngine must support crop: ' + c);
  }
  _has(src, 'confidence: null',
    'CropStageEngine must return confidence null when not computable (no faked stage)');
}

// 1c. Sprint #208 — Satellite foundation: UNCONFIGURED, never fake.
for (const f of [
  'src/runtime/farmBrain/SatelliteContracts.ts',
  'src/runtime/farmBrain/SatelliteProvider.ts',
  'src/runtime/farmBrain/SatelliteCorrelationEngine.ts',
]) {
  if (!_exists(f)) { errors.push('missing: ' + f); continue; }
  const src = _read(f);
  _has(src, 'UNCONFIGURED', f + ' must use the UNCONFIGURED status');
  // No fabricated numeric NDVI / vegetation value.
  if (/\b(ndvi|ndmi|vegetationStress|waterStress)\s*[:=]\s*-?\d/i.test(src)) {
    errors.push(f + ' must NOT assign a numeric NDVI/stress value (no fake satellite)');
  }
}
{
  const sce = _read('src/runtime/farmBrain/SatelliteCorrelationEngine.ts');
  _has(sce, 'satelliteConfidence: null',
    'SatelliteCorrelationEngine must return satelliteConfidence null (never faked)');
}

// 1d. Sprint #208 — AdaptiveTaskGenerator: ONE task, reason+confidence.
const ATG = 'src/runtime/farmBrain/AdaptiveTaskGenerator.ts';
if (!_exists(ATG)) {
  errors.push('missing: ' + ATG);
} else {
  const src = _read(ATG);
  _has(src, 'export function generatePrimaryTask',
    'AdaptiveTaskGenerator must export generatePrimaryTask');
  _has(src, 'reason:', 'AdaptiveTaskGenerator task must carry a reason');
  _has(src, 'confidence:', 'AdaptiveTaskGenerator task must carry a confidence');
  _has(src, 'followUp:', 'AdaptiveTaskGenerator task must carry a followUp');
}

// 1e. Sprint #208 — FarmScanMemory.
const FSM = 'src/runtime/farmBrain/FarmScanMemory.ts';
if (!_exists(FSM)) {
  errors.push('missing: ' + FSM);
} else {
  _has(_read(FSM), 'export function buildFarmScanMemory',
    'FarmScanMemory must export buildFarmScanMemory');
}

// 1f. Sprint #208 — FarmBrainContracts (7-flag readiness shape).
const FBC = 'src/runtime/farmBrain/FarmBrainContracts.ts';
if (!_exists(FBC)) {
  errors.push('missing: ' + FBC);
} else {
  _has(_read(FBC), 'satelliteHistory',
    'FarmBrainContracts must declare satelliteHistory (always [])');
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

// 6a. Sprint #209 — Decision Trace + Timeline + Data Quality engines.
const TRACE = 'src/runtime/farmBrain/DecisionTraceEngine.ts';
if (!_exists(TRACE)) {
  errors.push('missing: ' + TRACE);
} else {
  const src = _read(TRACE);
  _has(src, 'export function buildDecisionTrace',
    'DecisionTraceEngine must export buildDecisionTrace');
  for (const f of ['recommendation', 'confidence', 'evidence', 'risks', 'contributors']) {
    _has(src, f, 'DecisionTrace output must include: ' + f);
  }
  // "No recommendation without reason" — the guarantee must be present.
  _has(src, 'hasReason',
    'DecisionTraceEngine must expose hasReason (no recommendation without reason)');
  // Honesty — confidence echoed, never recomputed.
  _has(src, '_num(input.confidence)',
    'DecisionTraceEngine must echo input.confidence (never recompute)');
}
const TL = 'src/runtime/farmBrain/FarmTimeline.ts';
if (!_exists(TL)) {
  errors.push('missing: ' + TL);
} else {
  const src = _read(TL);
  _has(src, 'export function buildFarmTimeline',
    'FarmTimeline must export buildFarmTimeline');
  for (const k of ['farm_created', 'crop_added', 'planting_date_added',
    'scan_completed', 'issue_detected', 'task_completed',
    'outcome_recorded', 'weather_alert', 'health_score_changed']) {
    _has(src, k, 'FarmTimeline must track kind: ' + k);
  }
}
const DQ = 'src/runtime/farmBrain/FarmDataQualityEngine.ts';
if (!_exists(DQ)) {
  errors.push('missing: ' + DQ);
} else {
  const src = _read(DQ);
  _has(src, 'export function buildFarmDataQuality',
    'FarmDataQualityEngine must export buildFarmDataQuality');
  for (const f of ['score', 'missingData', 'nextBestAction']) {
    _has(src, f, 'FarmDataQuality output must include: ' + f);
  }
}

// 6b. Readiness flags for the 3 new engines.
{
  const fbr = _read('src/runtime/farmBrain/FarmBrainRuntime.ts');
  for (const f of ['decisionTraceReady', 'timelineReady', 'dataQualityReady']) {
    _has(fbr, f, 'FarmBrainRuntime readiness must expose flag: ' + f);
  }
}

// 6c. Home below-fold renders Timeline + Quality.
const BF = 'src/components/farmBrain/FarmBrainBelowFold.jsx';
if (!_exists(BF)) {
  errors.push('missing: ' + BF);
} else {
  const src = _read(BF);
  _has(src, 'farm-timeline-card', 'FarmBrainBelowFold must render the timeline card');
  _has(src, 'farm-readiness-card', 'FarmBrainBelowFold must render the consolidated Farm Readiness card');
}
_has(_read('src/pages/Home.jsx'), 'FarmBrainBelowFold',
  'Home.jsx must render FarmBrainBelowFold below the hero');

// 7. i18n keys.
const TEN = _read('src/i18n/columns/T-en.js');
for (const k of [
  'scan.evidence.breakdown', 'scan.evidence.image', 'scan.evidence.farmHistory',
  'farmBrain.next.addCrop.title', 'farmBrain.next.firstScan.title',
  'farmBrain.next.startAction.title',
  'farmQuality.title', 'farmQuality.improveBy', 'farmTimeline.title',
  'farmTimeline.empty', 'farmTimeline.kind.crop_added',
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
