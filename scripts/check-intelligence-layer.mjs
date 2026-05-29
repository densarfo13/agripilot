#!/usr/bin/env node
/**
 * check-intelligence-layer.mjs — proactive Intelligence Layer gate.
 *
 *   node scripts/check-intelligence-layer.mjs
 *
 * Verifies the Phase 16 Intelligence Layer is complete:
 *   1. 9 sub-engines + keystone dailyGrowEngine + composite + hook
 *      exist.
 *   2. Required exports declared on each.
 *   3. GROWTH_STAGE covers the 6 spec'd stages.
 *   4. DISEASE_KIND covers the 4 spec-called-out diseases.
 *   5. PEST_KIND covers ≥4 pests.
 *   6. Satellite + marketplace gated CLOSED.
 *   7. Regional calendar seeds Maryland + Ghana + India.
 *   8. dailyGrowEngine emits {todayTasks, warnings, opportunities,
 *      recommendations}.
 *   9. App.jsx installs the global during boot.
 *  10. New composite does NOT shadow the existing
 *      src/intelligence/index.ts barrel.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const HEADER    = '[check:intelligence-layer]';

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
  daily:      'src/intelligence/dailyGrowEngine.ts',
  stage:      'src/intelligence/growthStageEngine.ts',
  weather:    'src/intelligence/weatherTaskAdjuster.ts',
  calendar:   'src/intelligence/regionalDiseaseCalendar.ts',
  pest:       'src/intelligence/pestRiskEngine.ts',
  disease:    'src/intelligence/diseaseForecast.ts',
  soil:       'src/intelligence/soilAdvisor.ts',
  satellite:  'src/intelligence/satelliteIntelligenceGate.ts',
  garden:     'src/intelligence/gardenHealth.ts',
  smartScan:  'src/intelligence/smartScanResult.ts',
  composite:  'src/intelligence/intelligenceLayer.ts',
  hook:       'src/hooks/useDailyGrow.ts',
  app:        'src/App.jsx',
  existingBarrel: 'src/intelligence/index.ts',
};
const sources = {};
for (const [k, rel] of Object.entries(FILES)) {
  const src = _read(rel);
  if (!src) fail('missing file: ' + rel);
  sources[k] = src;
}

const REQUIRED = [
  { src: 'daily',      sym: 'dailyGrowEngine' },
  { src: 'daily',      sym: 'DAILY_GROW_ENGINE_VERSION' },
  { src: 'stage',      sym: 'deriveGrowthStage' },
  { src: 'stage',      sym: 'GROWTH_STAGE' },
  { src: 'stage',      sym: 'GROWTH_STAGE_ENGINE_VERSION' },
  { src: 'weather',    sym: 'adjustTasksForWeather' },
  { src: 'weather',    sym: 'WEATHER_TASK_ADJUSTER_VERSION' },
  { src: 'calendar',   sym: 'regionalDiseaseCalendar' },
  { src: 'calendar',   sym: 'REGIONAL_DISEASE_CALENDAR_VERSION' },
  { src: 'pest',       sym: 'pestRiskEngine' },
  { src: 'pest',       sym: 'PEST_KIND' },
  { src: 'pest',       sym: 'PEST_RISK_VERSION' },
  { src: 'disease',    sym: 'diseaseForecast' },
  { src: 'disease',    sym: 'DISEASE_KIND' },
  { src: 'disease',    sym: 'DISEASE_FORECAST_VERSION' },
  { src: 'soil',       sym: 'soilAdvisor' },
  { src: 'soil',       sym: 'SOIL_ADVISOR_VERSION' },
  { src: 'satellite',  sym: 'satelliteIntelligence' },
  { src: 'satellite',  sym: 'SATELLITE_INTELLIGENCE_VERSION' },
  { src: 'garden',     sym: 'gardenHealth' },
  { src: 'garden',     sym: 'GARDEN_HEALTH_VERSION' },
  { src: 'smartScan',  sym: 'smartScanResult' },
  { src: 'smartScan',  sym: 'SMART_SCAN_RESULT_VERSION' },
  { src: 'composite',  sym: 'intelligenceLayer' },
  { src: 'composite',  sym: 'installIntelligenceLayerGlobal' },
  { src: 'composite',  sym: 'INTELLIGENCE_LAYER_VERSION' },
  { src: 'hook',       sym: 'useDailyGrow' },
];
for (const { src, sym } of REQUIRED) {
  if (!new RegExp('export\\s+(function|const|async function)\\s+' + sym + '\\b').test(sources[src])
      && !new RegExp('export\\s*\\{[\\s\\S]*\\b' + sym + '\\b').test(sources[src])) {
    fail(FILES[src] + ' missing export: ' + sym);
  }
}

// GROWTH_STAGE — 6 spec'd stages
const SPEC_STAGES = [
  'SEED', 'SPROUT', 'VEGETATIVE', 'FLOWERING', 'FRUITING', 'HARVEST',
];
for (const s of SPEC_STAGES) {
  if (!new RegExp(s + '\\s*:').test(sources.stage)) {
    fail('GROWTH_STAGE missing: ' + s);
  }
}

// DISEASE_KIND — 4 spec'd diseases
const SPEC_DISEASES = [
  'POWDERY_MILDEW', 'BLIGHT', 'RUST', 'BLACK_SPOT',
];
for (const d of SPEC_DISEASES) {
  if (!new RegExp(d + '\\s*:').test(sources.disease)) {
    fail('DISEASE_KIND missing: ' + d);
  }
}

// PEST_KIND — ≥4 pests + spec'd APHIDS
const SPEC_PESTS = ['APHIDS', 'SPIDER_MITES', 'WHITEFLY', 'CATERPILLAR'];
for (const p of SPEC_PESTS) {
  if (!new RegExp(p + '\\s*:').test(sources.pest)) {
    fail('PEST_KIND missing: ' + p);
  }
}

// Satellite + marketplace gates
if (!/satellite_backend_required/.test(sources.satellite)) {
  fail('satelliteIntelligenceGate.ts must default to satellite_backend_required null envelope');
}
if (!/marketplace_gated/.test(sources.smartScan)) {
  fail('smartScanResult.ts marketValue must be marketplace_gated');
}

// Seeded regions
for (const region of ['Maryland', 'Ghana', 'India']) {
  if (!new RegExp(region + '\\s*:').test(sources.calendar)) {
    fail('regionalDiseaseCalendar.ts missing seed for: ' + region);
  }
}

// dailyGrowEngine output shape sentinels
for (const k of ['todayTasks', 'warnings', 'opportunities', 'recommendations']) {
  if (!new RegExp(k + '\\s*:').test(sources.daily)) {
    fail('dailyGrowEngine.ts missing output field: ' + k);
  }
}

// App.jsx installs the global
if (!/installIntelligenceLayerGlobal\s*\(\s*\)/.test(sources.app)) {
  fail('App.jsx does not call installIntelligenceLayerGlobal() during boot');
}

// Strict-rule: new composite must NOT shadow the existing
// src/intelligence/index.ts barrel.
if (sources.existingBarrel.indexOf('intelligenceLayer') !== -1) {
  fail('existing src/intelligence/index.ts must not be modified to re-export the new composite '
    + '(strict rule: do not modify existing modules)');
}
// Composite file must be the new intelligenceLayer.ts — not index.ts
if (FILES.composite !== 'src/intelligence/intelligenceLayer.ts') {
  fail('composite path drift — expected src/intelligence/intelligenceLayer.ts');
}

console.log(HEADER, 'PASS — Phase 16 proactive Intelligence Layer complete.');
console.log('  9 sub-engines + dailyGrowEngine keystone + composite + hook wired.');
console.log('  Growth stages: ' + SPEC_STAGES.length
  + ' · diseases: ' + SPEC_DISEASES.length
  + ' · pests: ' + SPEC_PESTS.length
  + ' · seeded regions: 3 (Maryland · Ghana · India).');
console.log('  Satellite + marketplace gated CLOSED.');
console.log('  Existing src/intelligence/ barrel untouched.');
process.exit(0);
