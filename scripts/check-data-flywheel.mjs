#!/usr/bin/env node
/**
 * check-data-flywheel.mjs — Phase 14 data-flywheel gate.
 *
 *   node scripts/check-data-flywheel.mjs
 *
 * Verifies the Phase 14 data-flywheel runtime is complete:
 *   1. 10 sub-engine files + composite + hook exist.
 *   2. Required exports declared on each.
 *   3. EVENT_KIND covers the 11 spec'd kinds + the 4
 *      recommendation-lifecycle kinds + the 4 memory-graph kinds.
 *   4. OUTCOME_VERDICT covers improved/neutral/worsened/unknown.
 *   5. Server route module exists and exports a router.
 *   6. server/src/app.js mounts /api/flywheel.
 *   7. src/App.jsx installs the global during boot.
 *   8. PII drop-list intersects the Phase 12 anonymizer.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const HEADER    = '[check:data-flywheel]';

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
  events:       'src/runtime/flywheel/eventEngine.js',
  store:        'src/runtime/flywheel/eventStore.js',
  farmMem:      'src/runtime/flywheel/farmMemoryGraph.js',
  cropMem:      'src/runtime/flywheel/cropMemoryGraph.js',
  recFeedback:  'src/runtime/flywheel/recommendationFeedback.js',
  outcomes:     'src/runtime/flywheel/outcomeEngine.js',
  regional:     'src/runtime/flywheel/regionalLearning.js',
  farmerTrust:  'src/runtime/flywheel/farmerTrustEngine.js',
  buyerTrust:   'src/runtime/flywheel/buyerTrustEngine.js',
  programTrust: 'src/runtime/flywheel/programTrustEngine.js',
  composite:    'src/runtime/flywheel/index.js',
  hook:         'src/hooks/useDataFlywheel.js',
  serverRoute:  'server/src/modules/flywheel/routes.js',
  serverApp:    'server/src/app.js',
  app:          'src/App.jsx',
};
const sources = {};
for (const [k, rel] of Object.entries(FILES)) {
  const src = _read(rel);
  if (!src) fail('missing file: ' + rel);
  sources[k] = src;
}

const REQUIRED = [
  { src: 'events',       sym: 'EVENT_KIND' },
  { src: 'events',       sym: 'EVENT_SCHEMA_VERSION' },
  { src: 'events',       sym: 'normalizeEvent' },
  { src: 'events',       sym: 'validateEvent' },
  { src: 'events',       sym: 'eventEquals' },
  { src: 'store',        sym: 'appendEvent' },
  { src: 'store',        sym: 'mergeEventLogs' },
  { src: 'store',        sym: 'replayEvents' },
  { src: 'store',        sym: 'dedupeEvents' },
  { src: 'farmMem',      sym: 'buildFarmMemory' },
  { src: 'cropMem',      sym: 'buildCropMemory' },
  { src: 'recFeedback',  sym: 'computeRecommendationFunnel' },
  { src: 'recFeedback',  sym: 'RECOMMENDATION_LIFECYCLE' },
  { src: 'outcomes',     sym: 'computeOutcomes' },
  { src: 'outcomes',     sym: 'OUTCOME_KIND' },
  { src: 'outcomes',     sym: 'OUTCOME_VERDICT' },
  { src: 'regional',     sym: 'anonymizeRegionalInsight' },
  { src: 'regional',     sym: 'REGIONAL_LEARNING_VERSION' },
  { src: 'farmerTrust',  sym: 'composeFarmerTrust' },
  { src: 'farmerTrust',  sym: 'FARMER_TRUST_INPUTS' },
  { src: 'farmerTrust',  sym: 'FARMER_TRUST_WEIGHTS' },
  { src: 'buyerTrust',   sym: 'computeBuyerTrust' },
  { src: 'buyerTrust',   sym: 'BUYER_TRUST_INPUTS' },
  { src: 'programTrust', sym: 'computeProgramTrust' },
  { src: 'programTrust', sym: 'PROGRAM_TRUST_INPUTS' },
  { src: 'composite',    sym: 'dataFlywheel' },
  { src: 'composite',    sym: 'installDataFlywheelGlobal' },
  { src: 'composite',    sym: 'DATA_FLYWHEEL_VERSION' },
  { src: 'hook',         sym: 'useDataFlywheel' },
];
for (const { src, sym } of REQUIRED) {
  if (!new RegExp('export\\s+(function|const|async function)\\s+' + sym + '\\b').test(sources[src])
      && !new RegExp('export\\s*\\{[\\s\\S]*\\b' + sym + '\\b').test(sources[src])) {
    fail(FILES[src] + ' missing export: ' + sym);
  }
}

// EVENT_KIND — must include the 11 spec'd farmer-interaction kinds
const SPEC_KINDS = [
  'FARM_CREATED', 'CROP_ADDED', 'TASK_COMPLETED',
  'SCAN_COMPLETED', 'SCAN_NEEDS_REVIEW', 'JOURNAL_CREATED',
  'WEATHER_ALERT_VIEWED', 'HEALTH_SCORE_CHANGED',
  'YIELD_FORECAST_GENERATED', 'READY_TO_SELL_MARKED', 'GRANT_VIEWED',
];
for (const k of SPEC_KINDS) {
  if (!new RegExp(k + '\\s*:').test(sources.events)) {
    fail('EVENT_KIND missing: ' + k);
  }
}

// Recommendation lifecycle event kinds
const REC_KINDS = [
  'RECOMMENDATION_SHOWN', 'RECOMMENDATION_ACCEPTED',
  'RECOMMENDATION_IGNORED', 'RECOMMENDATION_COMPLETED',
];
for (const k of REC_KINDS) {
  if (!new RegExp(k + '\\s*:').test(sources.events)) {
    fail('EVENT_KIND missing: ' + k);
  }
}

// Memory-graph supplemental kinds
const MEMORY_KINDS = [
  'TREATMENT_APPLIED', 'PLANTING_LOGGED', 'HARVEST_LOGGED',
  'WEATHER_EVENT_RECORDED',
];
for (const k of MEMORY_KINDS) {
  if (!new RegExp(k + '\\s*:').test(sources.events)) {
    fail('EVENT_KIND missing: ' + k);
  }
}

// OUTCOME_VERDICT
const VERDICTS = ['IMPROVED', 'NEUTRAL', 'WORSENED', 'UNKNOWN'];
for (const v of VERDICTS) {
  if (!new RegExp(v + '\\s*:').test(sources.outcomes)) {
    fail('OUTCOME_VERDICT missing: ' + v);
  }
}

// RECOMMENDATION_LIFECYCLE values
const LIFECYCLE = ['SHOWN', 'ACCEPTED', 'IGNORED', 'COMPLETED', 'OUTCOME'];
for (const v of LIFECYCLE) {
  if (!new RegExp(v + '\\s*:').test(sources.recFeedback)) {
    fail('RECOMMENDATION_LIFECYCLE missing: ' + v);
  }
}

// FARMER_TRUST_INPUTS — 5 spec'd inputs
const FARMER_INPUTS = [
  'TASK_COMPLETION', 'PHOTO_VERIFICATION', 'FARM_CONSISTENCY',
  'SCAN_QUALITY', 'ACTIVITY_FREQUENCY',
];
for (const i of FARMER_INPUTS) {
  if (!new RegExp(i + '\\s*:').test(sources.farmerTrust)) {
    fail('FARMER_TRUST_INPUTS missing: ' + i);
  }
}

// BUYER_TRUST_INPUTS — 4 spec'd inputs
const BUYER_INPUTS = [
  'PURCHASE_HISTORY', 'RESPONSE_TIME',
  'PAYMENT_CONSISTENCY', 'FARMER_RATINGS',
];
for (const i of BUYER_INPUTS) {
  if (!new RegExp(i + '\\s*:').test(sources.buyerTrust)) {
    fail('BUYER_TRUST_INPUTS missing: ' + i);
  }
}

// PROGRAM_TRUST_INPUTS — 4 spec'd inputs
const PROGRAM_INPUTS = [
  'FARMER_ENGAGEMENT', 'PROGRAM_PARTICIPATION',
  'OUTCOME_DELIVERY', 'EVIDENCE_COMPLETENESS',
];
for (const i of PROGRAM_INPUTS) {
  if (!new RegExp(i + '\\s*:').test(sources.programTrust)) {
    fail('PROGRAM_TRUST_INPUTS missing: ' + i);
  }
}

// Marketplace + NGO gates must default to closed
if (!/marketplace_gated/.test(sources.buyerTrust)) {
  fail('buyerTrustEngine.js must default to marketplace_gated null envelope');
}
if (!/ngo_dashboard_gated/.test(sources.programTrust)) {
  fail('programTrustEngine.js must default to ngo_dashboard_gated null envelope');
}

// PII drop-list intersection with Phase 12 anonymizer
const PII_REQUIRED = [
  'farmerName', 'email', 'phone', 'lat', 'lng',
  'imageBase64', 'ipAddress',
];
for (const f of PII_REQUIRED) {
  if (!new RegExp("'" + f + "'").test(sources.events)) {
    fail('eventEngine.js PII drop-list missing field: ' + f);
  }
}

// Server route paths
const ROUTE_PATHS = [
  '/farm', '/crop', '/recommendations', '/trust', '/outcomes',
];
for (const p of ROUTE_PATHS) {
  if (!new RegExp("router\\.get\\('" + p + "'").test(sources.serverRoute)) {
    fail('server flywheel route missing GET ' + p);
  }
}

// server/src/app.js mounts /api/flywheel
if (!/app\.use\('\/api\/flywheel'/.test(sources.serverApp)) {
  fail('server/src/app.js does not mount /api/flywheel');
}

// App.jsx installs the global
if (!/installDataFlywheelGlobal\s*\(\s*\)/.test(sources.app)) {
  fail('App.jsx does not call installDataFlywheelGlobal() during boot');
}

console.log(HEADER, 'PASS — Phase 14 data flywheel runtime complete.');
console.log('  10 engines + composite + hook + server routes wired.');
console.log('  Event kinds: ' + SPEC_KINDS.length + ' spec + '
  + REC_KINDS.length + ' lifecycle + ' + MEMORY_KINDS.length
  + ' memory · Trust engines: 3 (farmer composed, buyer + program gated).');
console.log('  Intelligence API at /api/flywheel/* (5 endpoints + composite).');
process.exit(0);
