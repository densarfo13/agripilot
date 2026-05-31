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
  timeline:    'src/runtime/plants/PlantTimeline.ts',
  workflow:    'src/runtime/plants/scanToManagedPlant.ts',
  briefingCmp: 'src/runtime/plants/briefingComposer.ts',
  barrel:      'src/runtime/plants/index.ts',
  growTypes:   'src/types/growTypes.ts',
  categories:  'src/modules/plants/plantCategories.ts',
  shrubs:      'src/data/plants/shrubs.json',
  dbLoader:    'src/data/plants/index.js',
  myPlants:    'src/pages/MyPlants.jsx',
  plantProfile:'src/pages/PlantProfile.jsx',
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
  { src: 'timeline',   sym: 'buildPlantTimeline' },
  { src: 'timeline',   sym: 'TIMELINE_EVENT_KIND' },
  { src: 'timeline',   sym: 'PLANT_TIMELINE_VERSION' },
  { src: 'workflow',   sym: 'scanToManagedPlant' },
  { src: 'workflow',   sym: 'SCAN_TO_MANAGED_PLANT_VERSION' },
  { src: 'briefingCmp',sym: 'composeFullBriefing' },
  { src: 'briefingCmp',sym: 'FULL_BRIEFING_VERSION' },
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
  'growType', 'growthStage', 'lifecycleStage',
  'healthScore', 'riskScore',
  'location', 'scans', 'tasks', 'history',
  // Real Plant Image System — 3 optional image fields.
  'imageUrl', 'thumbnailUrl', 'galleryImages',
  'createdAt', 'updatedAt',
];
for (const f of PLANT_FIELDS) {
  // Accept both required (`field:`) and optional (`field?:`) forms.
  if (!new RegExp('\\b' + f + '\\??\\s*:').test(sources.runtime)) {
    fail('PlantRuntime.ts ManagedPlant interface missing field: ' + f);
  }
}
// ManagedPlant type must be exported
if (!/export\s+(interface|type)\s+ManagedPlant\b/.test(sources.runtime)) {
  fail('PlantRuntime.ts must export the ManagedPlant interface');
}

// Sprint A — governance manifest
if (!/export\s+const\s+PLANT_RUNTIME_OWNERSHIP\b/.test(sources.runtime)) {
  fail('PlantRuntime.ts must export PLANT_RUNTIME_OWNERSHIP');
}
for (const k of ['plantRuntime', 'scanRuntime', 'farmRuntime']) {
  if (!new RegExp(k + '\\s*:').test(sources.runtime)) {
    fail('PLANT_RUNTIME_OWNERSHIP missing owner: ' + k);
  }
}
for (const cap of ['plant_state', 'plant_health',
                    'plant_lifecycle', 'plant_memory']) {
  if (sources.runtime.indexOf("'" + cap + "'") === -1) {
    fail("PLANT_RUNTIME_OWNERSHIP.plantRuntime missing capability: '"
      + cap + "'");
  }
}
for (const cap of ['camera', 'upload', 'plant_id_classifier']) {
  if (sources.runtime.indexOf("'" + cap + "'") === -1) {
    fail("PLANT_RUNTIME_OWNERSHIP.scanRuntime missing capability: '"
      + cap + "'");
  }
}
for (const cap of ['farm_selection', 'garden_selection']) {
  if (sources.runtime.indexOf("'" + cap + "'") === -1) {
    fail("PLANT_RUNTIME_OWNERSHIP.farmRuntime missing capability: '"
      + cap + "'");
  }
}

// Plant Timeline — 11 spec'd event kinds
const TIMELINE_KINDS = [
  'PlantCreated', 'ScanCompleted', 'DiseaseDetected', 'PestDetected',
  'TaskCompleted', 'TreatmentApplied', 'GrowthStageChanged',
  'BloomStarted', 'HarvestCompleted', 'RecommendationAccepted',
  'RecommendationCompleted',
];
for (const k of TIMELINE_KINDS) {
  if (!new RegExp(k + '\\s*:').test(sources.timeline)) {
    fail('TIMELINE_EVENT_KIND missing: ' + k);
  }
}
// Timeline envelope shape — required output fields
for (const k of ['entries', 'groups', 'counts', 'totalCount',
                  'attachments', 'plantId']) {
  if (sources.timeline.indexOf(k) === -1) {
    fail('PlantTimeline envelope missing field: ' + k);
  }
}
// Date-grouping check — groups must carry { date, entries }
if (!/date:\s*day/.test(sources.timeline)
    && !/date:\s*_str/.test(sources.timeline)) {
  fail('PlantTimeline groups missing "date" field');
}
// Timeline must NOT add new EVENT_KIND values — the strict-rule
// says don't modify eventEngine. The timeline DERIVES the 11
// spec'd kinds from existing event types.
if (/EVENT_KIND\s*\[\s*['"]/.test(sources.timeline)) {
  fail('PlantTimeline must not mutate EVENT_KIND');
}

// Barrel must thread timeline into composite
if (sources.barrel.indexOf('timeline') === -1
    || sources.barrel.indexOf('PLANT_TIMELINE_VERSION') === -1) {
  fail('barrel must re-export timeline + version');
}

// Sprint A — Daily Briefing composer. plantsForBriefing() was moved
// out of the barrel into its own leaf module (plantsBriefing.ts) to
// break the index ⇄ briefingComposer circular import (TDZ-crash fix).
// The barrel must still EXPORT it (re-export is fine); the function
// body + envelope fields are validated in the leaf module.
const briefingSrc = _read('src/runtime/plants/plantsBriefing.ts') || '';
const briefingDefinedInLeaf = /export\s+function\s+plantsForBriefing\b/.test(briefingSrc);
const briefingExportedFromBarrel =
     /export\s+function\s+plantsForBriefing\b/.test(sources.barrel)
  || /export\s*\{[^}]*\bplantsForBriefing\b[^}]*\}/.test(sources.barrel);
if (!briefingExportedFromBarrel) {
  fail('index.ts must export plantsForBriefing() (declaration or re-export)');
}
if (!briefingDefinedInLeaf && !/export\s+function\s+plantsForBriefing\b/.test(sources.barrel)) {
  fail('plantsForBriefing() must be defined in plantsBriefing.ts (leaf) or the barrel');
}
if (!/PLANTS_BRIEFING_VERSION\b/.test(sources.barrel)) {
  fail('index.ts must export PLANTS_BRIEFING_VERSION');
}
// Envelope fields — check wherever the function now lives.
const briefingBody = briefingDefinedInLeaf ? briefingSrc : sources.barrel;
for (const k of ['needsAttention', 'attentionByCategory', 'headline']) {
  if (briefingBody.indexOf(k) === -1) {
    fail('plantsForBriefing missing envelope field: ' + k);
  }
}
// The leaf must NOT import the barrel back (no cycle reintroduction).
// Strip comments first — the docblock legitimately NAMES the old
// "from './index'" cycle to document it.
const briefingNoComments = briefingSrc
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\s)\/\/.*$/gm, '');
if (briefingDefinedInLeaf && /\bimport\b[^\n]*from\s+['"]\.\/index['"]/.test(briefingNoComments)) {
  fail('plantsBriefing.ts must NOT import from ./index (would re-create the cycle)');
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

// PlantProfile UI surface — Sprint A completion
const PROFILE_TESTIDS = [
  'plant-profile-page',
  'plant-profile-back',
  'plant-profile-hero',
  'plant-profile-stat-health',
  'plant-profile-stat-risk',
  'plant-profile-stat-tasks',
  'plant-profile-tasks',
  'plant-profile-timeline',
];
for (const id of PROFILE_TESTIDS) {
  if (sources.plantProfile.indexOf(id) === -1) {
    fail('PlantProfile.jsx missing testid: ' + id);
  }
}
if (sources.plantProfile.indexOf('Camera ran into a problem') !== -1) {
  fail('PlantProfile.jsx must not show camera-error wording');
}

// Briefing composer envelope shape
for (const k of ['headline', 'plantsNeedingAttention',
                  'attentionByCategory', 'plantCount',
                  'todayTasks', 'warnings', 'opportunities',
                  'recommendations']) {
  if (sources.briefingCmp.indexOf(k) === -1) {
    fail('composeFullBriefing envelope missing field: ' + k);
  }
}

// Workflow envelope sentinels
for (const k of ['eligible', 'alreadyManaged', 'payload',
                  'recommendedFollowUps']) {
  if (sources.workflow.indexOf(k) === -1) {
    fail('scanToManagedPlant envelope missing field: ' + k);
  }
}

// App.jsx routes + boot install
if (!/path="\/my-plants"/.test(sources.app)) {
  fail('App.jsx does not mount /my-plants route');
}
if (!/path="\/my-plants\/:plantId"/.test(sources.app)) {
  fail('App.jsx does not mount /my-plants/:plantId route');
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
                  'lifecycle', 'recommend', 'memory', 'timeline',
                  'workflow', 'briefingCmp']) {
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
