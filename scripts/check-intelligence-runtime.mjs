#!/usr/bin/env node
/**
 * check-intelligence-runtime.mjs — wave 6 CI ratchet.
 *
 *   node scripts/check-intelligence-runtime.mjs
 *
 * What this verifies
 * ──────────────────
 *   1. All wave-6 runtime modules exist + export the required surface:
 *        intelligenceRuntime.js
 *        confidenceCalibration.js
 *        recommendationRanking.js
 *        recommendationMemoryRuntime.js
 *        interventionOutcomeRuntime.js
 *        farmMemoryRuntime.js
 *        seasonalContinuityRuntime.js
 *   2. The 5 wave-6 diagnostics are wired:
 *        __intelligenceHealth, __recommendationTrace,
 *        __confidenceCalibration, __learningHealth, __continuitySignals
 *   3. installIntelligenceRuntime is called in src/App.jsx during boot.
 *   4. The intelligence-runtime hook exists at src/hooks/useIntelligenceRuntime.js
 *      and is layer-registered.
 *   5. The intelligence pipeline exports INTELLIGENCE_STAGE constants.
 *
 * Hard gate — no baseline, no grandfathering. A regression fails the
 * build with a clear remediation pointer.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const HEADER    = '[check:intelligence-runtime]';

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
  intel:        'src/runtime/intelligence/intelligenceRuntime.js',
  calibration:  'src/runtime/intelligence/confidenceCalibration.js',
  ranking:      'src/runtime/intelligence/recommendationRanking.js',
  recMemory:    'src/runtime/intelligence/recommendationMemoryRuntime.js',
  outcome:      'src/runtime/intelligence/interventionOutcomeRuntime.js',
  farmMemory:   'src/runtime/intelligence/farmMemoryRuntime.js',
  seasonal:     'src/runtime/intelligence/seasonalContinuityRuntime.js',
  hook:         'src/hooks/useIntelligenceRuntime.js',
  diagnostics:  'src/lib/weatherAndLanguageDiagnostics.js',
  app:          'src/App.jsx',
  layers:       'src/architecture/layers.js',
};

const sources = {};
for (const [key, rel] of Object.entries(FILES)) {
  const src = _read(rel);
  if (!src) fail('missing required file: ' + rel);
  sources[key] = src;
}

// 1) Required exports from intelligenceRuntime.
const REQUIRED_EXPORTS = [
  'produceRecommendations',
  'recordIntervention',
  'recordOutcome',
  'installIntelligenceRuntime',
  'getIntelligenceHealth',
  'getRecommendationTrace',
  'getConfidenceCalibrationSnapshot',
  'getLearningHealth',
  'getContinuitySignals',
  'INTELLIGENCE_STAGE',
];
for (const sym of REQUIRED_EXPORTS) {
  if (!new RegExp('export\\s+(function|const)\\s+' + sym + '\\b').test(sources.intel)) {
    fail('intelligenceRuntime.js missing export: ' + sym);
  }
}

// 2) Required pipeline stages in INTELLIGENCE_STAGE.
const REQUIRED_STAGES = [
  'OBSERVATION', 'CLASSIFICATION', 'CONFIDENCE_CALIBRATION',
  'CONTEXT_ENRICHMENT', 'RECOMMENDATION_RANKING',
  'INTERVENTION_TRACKING', 'OUTCOME_FEEDBACK', 'LONGITUDINAL_LEARNING',
];
const stageBlock = sources.intel.match(
  /INTELLIGENCE_STAGE\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/);
if (!stageBlock) fail('INTELLIGENCE_STAGE block not found');
for (const stage of REQUIRED_STAGES) {
  if (!new RegExp(stage + '\\s*:').test(stageBlock[1])) {
    fail('INTELLIGENCE_STAGE missing: ' + stage);
  }
}

// 3) Five wave-6 diagnostics wired.
const REQUIRED_DIAGNOSTICS = [
  '__intelligenceHealth',
  '__recommendationTrace',
  '__confidenceCalibration',
  '__learningHealth',
  '__continuitySignals',
];
for (const d of REQUIRED_DIAGNOSTICS) {
  if (!new RegExp('window\\.' + d + '\\s*=').test(sources.diagnostics)) {
    fail('diagnostic ' + d + ' not wired in ' + FILES.diagnostics);
  }
}

// 4) App.jsx calls installIntelligenceRuntime() during boot.
if (!/installIntelligenceRuntime\s*\(\s*\)/.test(sources.app)) {
  fail('App.jsx does not call installIntelligenceRuntime() during boot');
}

// 5) Hook is registered in layers.js as RUNTIME.
if (!/useIntelligenceRuntime[^']*['"\]]*\s*,\s*LAYER\.RUNTIME/
    .test(sources.layers)) {
  fail('useIntelligenceRuntime not registered as RUNTIME in layers.js');
}

// 6) Calibration exports CONFIDENCE_BUCKET + calibrateConfidence.
if (!/export\s+const\s+CONFIDENCE_BUCKET\b/.test(sources.calibration)) {
  fail('confidenceCalibration.js missing CONFIDENCE_BUCKET export');
}
if (!/export\s+function\s+calibrateConfidence\b/.test(sources.calibration)) {
  fail('confidenceCalibration.js missing calibrateConfidence export');
}

// 7) Ranking exports SIGNAL_WEIGHTS + scoreRecommendation + rankRecommendations.
const RANKING_EXPORTS = ['SIGNAL_WEIGHTS', 'scoreRecommendation', 'rankRecommendations'];
for (const sym of RANKING_EXPORTS) {
  if (!new RegExp('export\\s+(function|const)\\s+' + sym + '\\b').test(sources.ranking)) {
    fail('recommendationRanking.js missing export: ' + sym);
  }
}

console.log(HEADER, 'PASS — wave 6 intelligence runtime complete.');
console.log('  ' + REQUIRED_EXPORTS.length + ' intel exports, '
  + REQUIRED_STAGES.length + ' pipeline stages, '
  + REQUIRED_DIAGNOSTICS.length + ' diagnostics, hook + install wired.');
process.exit(0);
