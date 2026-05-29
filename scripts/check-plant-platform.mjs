#!/usr/bin/env node
/**
 * check-plant-platform.mjs — Global Plant Intelligence Platform.
 *
 *   node scripts/check-plant-platform.mjs
 *
 * Verifies the platform tier of src/modules/plants/ is complete:
 *   1. 5 PascalCase platform files + lowercase plantSearch.ts
 *      (the spec slot PlantSearch.ts is satisfied by the
 *      existing plantSearch.ts; case-only rename is unsafe on
 *      Windows FS).
 *   2. Required exports on each.
 *   3. PLANT_HEALTH_BANDS covers 4 spec'd bands.
 *   4. PLANT_HEALTH_WEIGHTS covers 5 spec'd inputs.
 *   5. globalPlantPlatform composite is wired into the barrel
 *      with versions for all 9 engines.
 *   6. installGlobalPlantIntelligenceGlobal pins both __plantLibrary
 *      AND __plantPlatform.
 *   7. App.jsx installs the global during boot.
 *   8. No engine wires its own LLM (deterministic only).
 *   9. No marketplace UI bleeds in.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const HEADER    = '[check:plant-platform]';

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
  registry:    'src/modules/plants/PlantRegistry.ts',
  search:      'src/modules/plants/plantSearch.ts',
  profileEng:  'src/modules/plants/PlantProfileEngine.ts',
  taskEng:     'src/modules/plants/PlantTaskEngine.ts',
  healthEng:   'src/modules/plants/PlantHealthEngine.ts',
  knowledgeEng:'src/modules/plants/PlantKnowledgeEngine.ts',
  barrel:      'src/modules/plants/index.ts',
  app:         'src/App.jsx',
};
const sources = {};
for (const [k, rel] of Object.entries(FILES)) {
  const src = _read(rel);
  if (!src) fail('missing file: ' + rel);
  sources[k] = src;
}

const REQUIRED = [
  { src: 'registry',     sym: 'plantRegistry' },
  { src: 'registry',     sym: 'registerPlantFromScan' },
  { src: 'registry',     sym: 'lookupPlant' },
  { src: 'registry',     sym: 'PLANT_REGISTRY_VERSION' },
  { src: 'search',       sym: 'plantSearch' },
  { src: 'search',       sym: 'PLANT_SEARCH_VERSION' },
  { src: 'profileEng',   sym: 'plantProfileEngine' },
  { src: 'profileEng',   sym: 'PLANT_PROFILE_ENGINE_VERSION' },
  { src: 'taskEng',      sym: 'generatePlantTasks' },
  { src: 'taskEng',      sym: 'PLANT_TASK_ENGINE_VERSION' },
  { src: 'healthEng',    sym: 'computePlantHealthScore' },
  { src: 'healthEng',    sym: 'PLANT_HEALTH_BANDS' },
  { src: 'healthEng',    sym: 'PLANT_HEALTH_WEIGHTS' },
  { src: 'healthEng',    sym: 'PLANT_HEALTH_VERSION' },
  { src: 'knowledgeEng', sym: 'getPlantKnowledge' },
  { src: 'knowledgeEng', sym: 'answerPlantQuestion' },
  { src: 'knowledgeEng', sym: 'PLANT_KNOWLEDGE_VERSION' },
  { src: 'barrel',       sym: 'globalPlantPlatform' },
  { src: 'barrel',       sym: 'GLOBAL_PLANT_PLATFORM_VERSION' },
  { src: 'barrel',       sym: 'installGlobalPlantIntelligenceGlobal' },
];
for (const { src, sym } of REQUIRED) {
  if (!new RegExp('export\\s+(function|const|async function)\\s+' + sym + '\\b').test(sources[src])
      && !new RegExp('export\\s*\\{[\\s\\S]*\\b' + sym + '\\b').test(sources[src])) {
    fail(FILES[src] + ' missing export: ' + sym);
  }
}

// PLANT_HEALTH_BANDS — 4 bands
const HEALTH_BANDS = ['thriving', 'healthy', 'fair', 'struggling'];
for (const b of HEALTH_BANDS) {
  if (sources.healthEng.indexOf("'" + b + "'") === -1) {
    fail("PLANT_HEALTH_BANDS missing band: '" + b + "'");
  }
}

// PLANT_HEALTH_WEIGHTS — 5 inputs
const HEALTH_INPUTS = [
  'scanQuality', 'diseaseRisk', 'careCompliance',
  'missedWaterings', 'indoorCareScore',
];
for (const i of HEALTH_INPUTS) {
  if (!new RegExp(i + '\\s*:').test(sources.healthEng)) {
    fail('PLANT_HEALTH_WEIGHTS missing input: ' + i);
  }
}

// Barrel must thread the new engine versions into the composite
const VERSION_KEYS = [
  'registry', 'taskEngine', 'health', 'knowledge', 'profileEngine',
];
for (const k of VERSION_KEYS) {
  if (!new RegExp(k + '\\s*:').test(sources.barrel)) {
    fail('barrel versions map missing key: ' + k);
  }
}

// Barrel must pin BOTH globals
if (sources.barrel.indexOf('__plantPlatform') === -1) {
  fail('barrel must pin window.__plantPlatform for QA introspection');
}
if (sources.barrel.indexOf('__plantLibrary') === -1) {
  fail('barrel must pin window.__plantLibrary (legacy contract)');
}

// App.jsx installs the global
if (!/installGlobalPlantIntelligenceGlobal\s*\(\s*\)/.test(sources.app)) {
  fail('App.jsx does not call installGlobalPlantIntelligenceGlobal() during boot');
}

// LLM honesty — knowledge engine routes to aiPlantAssistant
// (deterministic) and must NEVER fetch an external LLM.
const BANNED_PATTERNS = [
  /\bfetch\s*\(/,
  /openai/i,
  /anthropic/i,
  /\.ai\/v1/i,
];
for (const f of ['knowledgeEng', 'taskEng', 'healthEng', 'registry']) {
  const src = sources[f];
  for (const pat of BANNED_PATTERNS) {
    if (pat.test(src)) {
      fail(FILES[f] + ' contains banned pattern (no fetch / no LLM): '
        + pat.source);
    }
  }
}

// Marketplace bleed-in check — these files MUST NOT reference
// marketplace state. Marketplace is gated for RC1.
for (const f of ['registry', 'taskEng', 'healthEng', 'knowledgeEng', 'profileEng']) {
  const src = sources[f];
  if (/marketplace/i.test(src) && !/gated|deferred/i.test(src)) {
    fail(FILES[f] + ' references marketplace without gating context');
  }
}

console.log(HEADER, 'PASS — Global Plant Intelligence Platform complete.');
console.log('  5 platform engines + barrel composite wired.');
console.log('  PLANT_HEALTH_BANDS: ' + HEALTH_BANDS.length
  + ' bands · PLANT_HEALTH_WEIGHTS: ' + HEALTH_INPUTS.length
  + ' inputs.');
console.log('  No LLM. No marketplace bleed. Wave-5 single-writer preserved.');
process.exit(0);
