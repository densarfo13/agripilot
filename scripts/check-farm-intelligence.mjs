#!/usr/bin/env node
/**
 * check-farm-intelligence.mjs — Phase 10 farm intelligence gate.
 *
 *   node scripts/check-farm-intelligence.mjs
 *
 * Verifies the wave-10 farm-intelligence runtime is complete:
 *   1. All 5 sub-engine files exist.
 *   2. Each exports the spec'd entry function + constants.
 *   3. The composite `src/runtime/farmIntelligence/index.js`
 *      exports computeFarmIntelligence +
 *      installFarmIntelligenceGlobal + re-exports each sub-engine.
 *   4. `src/hooks/useFarmIntelligence.js` exports useFarmIntelligence.
 *   5. `src/components/farm/FarmIntelligenceCard.jsx` exists.
 *   6. App.jsx calls installFarmIntelligenceGlobal() during boot.
 *
 * Hard gate — no baseline, no grandfathering.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const HEADER    = '[check:farm-intelligence]';

function _read(rel) {
  const p = resolve(ROOT, rel);
  if (!existsSync(p)) return null;
  try { return readFileSync(p, 'utf8'); } catch { return null; }
}
function fail(msg, detail) {
  console.error(HEADER, 'FAIL —', msg);
  if (detail) console.error('  ' + detail);
  process.exit(1);
}

const FILES = {
  health:    'src/runtime/farmIntelligence/farmHealthScore.js',
  risk:      'src/runtime/farmIntelligence/fieldRiskEngine.js',
  weather:   'src/runtime/farmIntelligence/smartWeatherAction.js',
  crop:      'src/runtime/farmIntelligence/cropStageEngine.js',
  trust:     'src/runtime/farmIntelligence/trustScore.js',
  composite: 'src/runtime/farmIntelligence/index.js',
  hook:      'src/hooks/useFarmIntelligence.js',
  card:      'src/components/farm/FarmIntelligenceCard.jsx',
  app:       'src/App.jsx',
};

const sources = {};
for (const [k, rel] of Object.entries(FILES)) {
  const src = _read(rel);
  if (!src) fail('missing required file: ' + rel);
  sources[k] = src;
}

const REQUIRED = [
  { src: 'health',    sym: 'computeFarmHealthScore' },
  { src: 'health',    sym: 'HEALTH_WEIGHTS' },
  { src: 'health',    sym: 'HEALTH_BAND_THRESHOLDS' },
  { src: 'risk',      sym: 'computeFieldRisk' },
  { src: 'risk',      sym: 'RISK_KIND' },
  { src: 'weather',   sym: 'deriveSmartWeatherActions' },
  { src: 'weather',   sym: 'WEATHER_ACTION_KIND' },
  { src: 'crop',      sym: 'deriveCropStage' },
  { src: 'crop',      sym: 'CROP_STAGE' },
  { src: 'trust',     sym: 'computeTrustScore' },
  { src: 'trust',     sym: 'TRUST_BANDS' },
  { src: 'trust',     sym: 'TRUST_WEIGHTS' },
  { src: 'composite', sym: 'computeFarmIntelligence' },
  { src: 'composite', sym: 'installFarmIntelligenceGlobal' },
  { src: 'composite', sym: 'FARM_INTELLIGENCE_VERSION' },
  { src: 'hook',      sym: 'useFarmIntelligence' },
];

for (const { src, sym } of REQUIRED) {
  if (!new RegExp('export\\s+(function|const|async function)\\s+' + sym + '\\b').test(sources[src])
      && !new RegExp('export\\s*\\{[\\s\\S]*\\b' + sym + '\\b').test(sources[src])) {
    fail(FILES[src] + ' missing export: ' + sym);
  }
}

// RISK_KIND values
const REQUIRED_RISKS = [
  'DISEASE', 'DROUGHT', 'FLOODING', 'HEAT_STRESS',
  'NUTRIENT_DEFICIENCY', 'PEST_OUTBREAK',
];
for (const r of REQUIRED_RISKS) {
  if (!new RegExp(r + '\\s*:').test(sources.risk)) {
    fail('RISK_KIND missing: ' + r);
  }
}

// CROP_STAGE values
const REQUIRED_STAGES = [
  'SEED', 'GERMINATION', 'VEGETATIVE', 'FLOWERING',
  'FRUIT_DEVELOPMENT', 'HARVEST',
];
for (const s of REQUIRED_STAGES) {
  if (!new RegExp(s + '\\s*:').test(sources.crop)) {
    fail('CROP_STAGE missing: ' + s);
  }
}

// FarmIntelligenceCard renders blocks for each engine
const CARD_TESTIDS = [
  'farm-intelligence-card',
  'farm-intel-health',
  'farm-intel-risk',
  'farm-intel-weather',
  'farm-intel-stage',
  'farm-intel-trust',
];
for (const id of CARD_TESTIDS) {
  if (!sources.card.includes(id)) {
    fail('FarmIntelligenceCard missing data-testid="' + id + '"');
  }
}

// App.jsx installs the global
if (!/installFarmIntelligenceGlobal\s*\(\s*\)/.test(sources.app)) {
  fail('App.jsx does not call installFarmIntelligenceGlobal() during boot');
}

console.log(HEADER, 'PASS — Phase 10 farm intelligence runtime complete.');
console.log('  5 engines + composite + hook + card + global install wired.');
process.exit(0);
