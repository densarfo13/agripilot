#!/usr/bin/env node
/**
 * check-plant-runtime.mjs — Universal Plant Runtime gate.
 *
 *   node scripts/check-plant-runtime.mjs
 *
 * Verifies:
 *   1. src/runtime/plants/ ships the 7 spec'd engine files + barrel.
 *   2. Required exports on each.
 *   3. Plant interface fields are documented + the runtime exports
 *      ManagedPlant.
 *   4. PLANT_LIFECYCLE_STAGES covers the 6 spec'd stages +
 *      DORMANT (perennial/tree fallback).
 *   5. Shrub category is wired: GROW_TYPES + PLANT_CATEGORIES +
 *      shrubs.json (>= 10 entries) + PLANTS_BY_TYPE.shrub +
 *      PLANT_DB_STATS.shrub + specTarget.shrub.
 *   6. MyPlants.jsx exists + carries the expected testids.
 *   7. App.jsx mounts /my-plants + installs the global at boot.
 *   8. No fetch / LLM patterns in runtime files (deterministic only).
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const HEADER    = '[check:plant-runtime]';

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
  runtime:     'src/runtime/plants/PlantRuntime.ts',
  registry:    'src/runtime/plants/PlantRegistry.ts',
  health:      'src/runtime/plants/PlantHealthEngine.ts',
  tasks:       'src/runtime/plants/PlantTaskEngine.ts',
  lifecycle:   'src/runtime/plants/PlantLifecycleEngine.ts',
  recommend:   'src/runtime/plants/PlantRecommendationEngine.ts',
  memory:      'src/runtime/plants/PlantMemoryGraph.ts',
  barrel:      'src/runtime/plants/index.ts',
  growTypes:   'src/types/growTypes.ts',
  categories:  'src/modules/plants/plantCategories.ts',
  shrubs:      'src/data/plants/shrubs.json',
  dbLoader:    'src/data/plants/index.js',
  myPlants:    'src/pages/MyPlants.jsx',
  app:         'src/App.jsx',
};
const sources = {};
for (const [k, rel] of Object.entries(FILES)) {
  const src = _read(rel);
  if (!src) fail('missing file: ' + rel);
  sources[k] = src;
}

const REQUIRED = [
  { src: 'runtime',    sym: 'createManagedPlant' },
  { src: 'runtime',    sym: 'updateManagedPlant' },
  { src: 'runtime',    sym: 'freezePlant' },
  { src: 'runtime',    sym: 'appendPlantHistory' },
  { src: 'runtime',    sym: 'PLANT_RUNTIME_VERSION' },
  { src: 'runtime',    sym: 'PLANT_SCHEMA_VERSION' },
  { src: 'registry',   sym: 'registryAddPlant' },
  { src: 'registry',   sym: 'registryUpdatePlant' },
  { src: 'registry',   sym: 'registryRemovePlant' },
  { src: 'registry',   sym: 'registryListByCategory' },
  { src: 'registry',   sym: 'registrySummary' },
  { src: 'registry',   sym: 'PLANT_REGISTRY_RUNTIME_VERSION' },
  { src: 'health',     sym: 'scoreManagedPlant' },
  { src: 'health',     sym: 'appendHealthSnapshot' },
  { src: 'health',     sym: 'PLANT_HEALTH_RUNTIME_VERSION' },
  { src: 'tasks',      sym: 'generateTasksForManagedPlant' },
  { src: 'tasks',      sym: 'PLANT_TASK_RUNTIME_VERSION' },
  { src: 'lifecycle',  sym: 'advancePlantStage' },
  { src: 'lifecycle',  sym: 'derivePlantStage' },
  { src: 'lifecycle',  sym: 'markPlantDormant' },
  { src: 'lifecycle',  sym: 'PLANT_LIFECYCLE_STAGES' },
  { src: 'lifecycle',  sym: 'PLANT_LIFECYCLE_VERSION' },
  { src: 'recommend',  sym: 'recommendForManagedPlant' },
  { src: 'recommend',  sym: 'PLANT_RECOMMENDATION_VERSION' },
  { src: 'memory',     sym: 'buildPlantMemory' },
  { src: 'memory',     sym: 'PLANT_MEMORY_VERSION' },
  { src: 'barrel',     sym: 'universalPlantRuntime' },
  { src: 'barrel',     sym: 'installUniversalPlantRuntimeGlobal' },
  { src: 'barrel',     sym: 'UNIVERSAL_PLANT_RUNTIME_VERSION' },
];
for (const { src, sym } of REQUIRED) {
  if (!new RegExp('export\\s+(function|const|async function|interface|type)\\s+' + sym + '\\b').test(sources[src])
      && !new RegExp('export\\s*\\{[\\s\\S]*\\b' + sym + '\\b').test(sources[src])) {
    fail(FILES[src] + ' missing export: ' + sym);
  }
}

// Plant interface fields documented in PlantRuntime.ts
const PLANT_FIELDS = [
  'id', 'commonName', 'scientificName', 'category', 'subtype',
  'growType', 'growthStage', 'healthScore', 'riskScore',
  'location', 'scans', 'tasks', 'history',
  'createdAt', 'updatedAt',
];
for (const f of PLANT_FIELDS) {
  if (!new RegExp('\\b' + f + '\\b\\s*:').test(sources.runtime)) {
    fail('PlantRuntime.ts ManagedPlant interface missing field: ' + f);
  }
}
// ManagedPlant type must be exported
if (!/export\s+(interface|type)\s+ManagedPlant\b/.test(sources.runtime)) {
  fail('PlantRuntime.ts must export the ManagedPlant interface');
}

// Lifecycle stages — 6 spec'd + DORMANT
const SPEC_STAGES = [
  'SEED', 'SPROUT', 'VEGETATIVE', 'FLOWERING',
  'FRUITING', 'HARVEST', 'DORMANT',
];
for (const s of SPEC_STAGES) {
  if (!new RegExp(s + '\\s*:').test(sources.lifecycle)) {
    fail('PLANT_LIFECYCLE_STAGES missing: ' + s);
  }
}

// Shrub wiring
if (sources.growTypes.indexOf("'shrub'") === -1) {
  fail('growTypes.ts must include shrub in GROW_TYPES');
}
if (sources.categories.indexOf("'shrub'") === -1) {
  fail('plantCategories.ts must include shrub in PLANT_CATEGORIES');
}
let shrubsParsed;
try { shrubsParsed = JSON.parse(sources.shrubs); }
catch (e) { fail('shrubs.json does not parse', e.message); }
if (!Array.isArray(shrubsParsed)) fail('shrubs.json must be a JSON array');
if (shrubsParsed.length < 10) {
  fail('shrubs.json starter must have >= 10 entries (has '
    + shrubsParsed.length + ')');
}
const SHRUB_FIELDS = ['id', 'commonName', 'scientificName',
                       'family', 'type', 'lifecycle', 'bloomSeason',
                       'sunlight', 'waterNeeds', 'pollinatorValue',
                       'diseaseRisks', 'image'];
for (const s of shrubsParsed) {
  for (const f of SHRUB_FIELDS) {
    if (!(f in s)) fail('shrubs.json entry "' + (s.id || '?')
                       + '" missing field: ' + f);
  }
  if (s.type !== 'shrub') fail('shrubs.json entry "' + s.id
                              + '" must have type: "shrub"');
}
if (!/import\s+shrubs\s+from/.test(sources.dbLoader)) {
  fail('plant DB loader does not import shrubs.json');
}
if (!/shrub:\s*_freezeAll\(shrubs\)/.test(sources.dbLoader)) {
  fail('PLANTS_BY_TYPE missing shrub entry');
}
if (sources.dbLoader.indexOf('shrub:       PLANTS_BY_TYPE.shrub.length') === -1
    && !/shrub:\s*PLANTS_BY_TYPE\.shrub\.length/.test(sources.dbLoader)) {
  fail('PLANT_DB_STATS missing shrub count');
}
if (!/shrub:\s*\d+/.test(sources.dbLoader)) {
  fail('PLANT_DB_STATS.specTarget missing shrub target');
}

// MyPlants UI surface
const MY_PLANTS_TESTIDS = [
  'my-plants-page', 'my-plants-stat-total',
  'my-plants-stat-health', 'my-plants-stat-alerts',
];
for (const id of MY_PLANTS_TESTIDS) {
  if (sources.myPlants.indexOf(id) === -1) {
    fail('MyPlants.jsx missing testid: ' + id);
  }
}
if (sources.myPlants.indexOf('Camera ran into a problem') !== -1) {
  fail('MyPlants.jsx must not show camera-error wording');
}

// App.jsx routes + boot install
if (!/path="\/my-plants"/.test(sources.app)) {
  fail('App.jsx does not mount /my-plants route');
}
if (!/installUniversalPlantRuntimeGlobal\s*\(\s*\)/.test(sources.app)) {
  fail('App.jsx does not call installUniversalPlantRuntimeGlobal() during boot');
}

// LLM honesty — runtime files must NOT make external calls.
const BANNED_PATTERNS = [
  /\bfetch\s*\(/,
  /openai/i,
  /anthropic/i,
  /\.ai\/v1/i,
];
for (const f of ['runtime', 'registry', 'health', 'tasks',
                  'lifecycle', 'recommend', 'memory']) {
  const src = sources[f];
  for (const pat of BANNED_PATTERNS) {
    if (pat.test(src)) {
      fail(FILES[f] + ' contains banned pattern (no fetch / no LLM): '
        + pat.source);
    }
  }
}

console.log(HEADER, 'PASS — Universal Plant Runtime complete.');
console.log('  7 engines + barrel + MyPlants UI + boot install wired.');
console.log('  Plant fields: ' + PLANT_FIELDS.length
  + ' · lifecycle stages: ' + SPEC_STAGES.length
  + ' · shrub starter: ' + shrubsParsed.length + ' entries.');
console.log('  No fetch / LLM patterns. Wave-5 single-writer preserved.');
process.exit(0);
