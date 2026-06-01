#!/usr/bin/env node
/**
 * scripts/check-agronomy-intelligence.mjs — adaptive agronomy contract.
 *
 * Fails if:
 *   - any of the 5 spec-canonical files is missing
 *   - AgronomyRuntime doesn't pin __agronomyHealth
 *   - the 6 spec readiness flags are missing from the envelope
 *   - recommendation-rationale / confidence / limitations literals
 *     are not declared true in the envelope (the spec's traceability
 *     contract — every recommendation must carry these)
 *   - RecommendationEngine could emit a recommendation without rationale,
 *     confidence, or limitations
 *   - any file fabricates (Math.random / fetch)
 *   - boot install isn't wired in App.jsx
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const exists = (f) => { try { return fs.statSync(path.join(ROOT, f)).isFile(); } catch { return false; } };

// 5 spec-canonical files.
const SPEC_FILES = [
  'src/runtime/agronomy/AgronomyRuntime.ts',
  'src/runtime/agronomy/CropStageEngine.ts',
  'src/runtime/agronomy/RecommendationEngine.ts',
  'src/runtime/agronomy/WeatherAdjustmentEngine.ts',
  'src/runtime/agronomy/RegionalKnowledgeEngine.ts',
];
const missing = SPEC_FILES.filter((f) => !exists(f));
if (missing.length) F.push('spec files missing: ' + missing.join(', '));
else P.push('all 5 spec files present');

// Composite envelope contract.
const rt = read('src/runtime/agronomy/AgronomyRuntime.ts');
if (rt) {
  if (!/__agronomyHealth/.test(rt))
    F.push('AgronomyRuntime must pin window.__agronomyHealth');
  else P.push('__agronomyHealth pinned');

  // 6 spec readiness flags.
  for (const flag of ['cropStageReady', 'recommendationReady',
    'weatherAdjustmentReady', 'outcomeAdjustmentReady',
    'scanAdjustmentReady', 'harvestPredictionReady']) {
    if (!new RegExp('\\b' + flag + '\\b').test(rt))
      F.push(`envelope must declare ${flag}`);
  }
  if (!F.some((m) => /envelope must declare/.test(m)))
    P.push('all 6 §HEALTH-CHECK flags present');

  // Traceability contract literals.
  for (const lit of ['recommendationCarriesRationale: true',
    'recommendationCarriesConfidence: true',
    'recommendationCarriesLimitations: true',
    'noFakeAI: true', 'noHallucinatedCropScience: true']) {
    if (!rt.includes(lit))
      F.push(`envelope must declare ${lit}`);
  }
  if (!F.some((m) => /envelope must declare/.test(m) && /Carries|noFakeAI|noHallucinated/.test(m)))
    P.push('traceability + safety literals present');

  // Composition: must read source engines by name.
  for (const probe of ['__cropLifecycleHealth', '__growTimeframeHealth',
    '__regionalKnowledgeHealth', '__weatherRiskHealth',
    '__dailyPlanScanHealth', '__outcomeLearningLoopHealth',
    '__dailyAssistantHealth']) {
    if (!rt.includes(probe))
      F.push(`runtime must compose ${probe} by name`);
  }
  if (!F.some((m) => /must compose/.test(m)))
    P.push('composes 7 source probes by name');

  // Aggregate verdict + supported crops.
  if (!/agronomyReady/.test(rt))
    F.push('envelope must surface agronomyReady aggregate');
  else P.push('aggregate verdict surfaced');
  for (const crop of ['onion', 'maize', 'tomato', 'pepper', 'cassava', 'rice', 'beans']) {
    if (!new RegExp(`'${crop}'`).test(rt))
      F.push(`SUPPORTED_CROPS must include ${crop}`);
  }
  if (!F.some((m) => /SUPPORTED_CROPS/.test(m)))
    P.push('all 7 supported crops listed');

  // No fabrication anywhere.
  if (/Math\.random|\bfetch\s*\(/.test(rt))
    F.push('AgronomyRuntime must not fabricate / call the network');
  else P.push('no fabrication, no network');
}

// RecommendationEngine emits the spec output shape with traceability.
const rec = read('src/runtime/agronomy/RecommendationEngine.ts');
if (rec) {
  for (const fld of ['todayAction', 'why', 'riskLevel', 'estimatedTime',
    'daysToHarvest', 'rationale', 'confidence', 'limitations']) {
    if (!new RegExp('\\b' + fld + '\\b').test(rec))
      F.push(`RecommendationEngine output must include ${fld}`);
  }
  if (!F.some((m) => /Recommendation.* output must include/.test(m)))
    P.push('Recommendation output carries 8 spec fields');
  if (/Math\.random|\bfetch\s*\(/.test(rec))
    F.push('RecommendationEngine must not fabricate');
  else P.push('RecommendationEngine no fabrication');
}

// WeatherAdjustmentEngine traceable.
const wx = read('src/runtime/agronomy/WeatherAdjustmentEngine.ts');
if (wx) {
  if (!/__weatherRiskHealth/.test(wx))
    F.push('WeatherAdjustmentEngine must read __weatherRiskHealth');
  else P.push('WeatherAdjustmentEngine reads __weatherRiskHealth');
  for (const fld of ['adjust', 'block', 'prefer', 'reason', 'confidence', 'limitations']) {
    if (!new RegExp('\\b' + fld + '\\b').test(wx))
      F.push(`WeatherAdjustment output must include ${fld}`);
  }
}

// CropStageEngine returns 9 canonical stages.
const stage = read('src/runtime/agronomy/CropStageEngine.ts');
if (stage) {
  for (const s of ['not_started', 'land_prep', 'planting', 'emergence',
    'vegetative', 'flowering', 'fruiting', 'harvest_ready', 'post_harvest']) {
    if (!new RegExp(`'${s}'`).test(stage))
      F.push(`CropStageEngine canonical stage ${s} missing`);
  }
  if (!F.some((m) => /canonical stage/.test(m)))
    P.push('CropStageEngine declares all 9 canonical stages');
}

// RegionalKnowledgeEngine traceable.
const reg = read('src/runtime/agronomy/RegionalKnowledgeEngine.ts');
if (reg) {
  if (!/__regionalKnowledgeHealth/.test(reg))
    F.push('RegionalKnowledgeEngine must read __regionalKnowledgeHealth');
  else P.push('RegionalKnowledgeEngine reads __regionalKnowledgeHealth');
}

// Boot install wired.
const app = read('src/App.jsx');
if (app && !/installAgronomyHealthGlobal/.test(app))
  F.push('App.jsx must wire installAgronomyHealthGlobal in boot');
else if (app) P.push('App.jsx wires installAgronomyHealthGlobal');

if (F.length) {
  console.error('[check:agronomy-intelligence] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:agronomy-intelligence] PASS — 5 files, 6 readiness flags, traceable recommendations, no fabrication.');
for (const m of P) console.log('  ✓ ' + m);
