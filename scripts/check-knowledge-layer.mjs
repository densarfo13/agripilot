#!/usr/bin/env node
/**
 * scripts/check-knowledge-layer.mjs — CI gate for the Farroway
 * Knowledge Layer.
 *
 * Enforces:
 *   • src/knowledge/plants/PlantKnowledgeService.ts exists with
 *     version constant + lookupPlantKnowledge + listPlantKnowledge
 *     + companionsFor + pollinatorIntelligenceFor
 *   • src/knowledge/diseases/DiseaseKnowledgeService.ts with
 *     lookupDisease + diseasesForPlant + diseasesBySymptom
 *   • src/knowledge/pests/PestKnowledgeService.ts with lookupPest
 *     + pestsForPlant + pestsBySymptom
 *   • src/knowledge/index.ts barrel with knowledgeForPlant +
 *     farrowayKnowledge + installFarrowayKnowledgeGlobal +
 *     FARROWAY_KNOWLEDGE_VERSION
 *   • PlantEntry contains all 15 spec fields (id, commonName,
 *     scientificName, category, subtype, images, growthStages,
 *     careGuide, companionPlants, commonDiseases, commonPests,
 *     pollinatorValue, bloomMonths, waterNeed, sunlightNeed,
 *     soilNeed)
 *   • Disease catalog covers 15 spec entries (incl. early-blight,
 *     late-blight)
 *   • Pest catalog covers all 15 spec entries
 *   • PlantProfile reads from src/knowledge (not direct data
 *     imports)
 *   • ScanResultPage calls knowledgeForPlant on scan result
 *   • App.jsx wires installFarrowayKnowledgeGlobal
 *
 * Strict-rule audit
 *   • Read-only. Never mutates source.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT  = process.cwd();
const KROOT = path.join(ROOT, 'src/knowledge');

const FAILED = [];
const PASSED = [];
function fail(m) { FAILED.push(m); }
function pass(m) { PASSED.push(m); }

function readOrFail(file, label) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch { fail(`${label}: missing ${path.relative(ROOT, file)}`); return ''; }
}

// ─── 1. PlantKnowledgeService ──────────────────────────────────
const plantSvc = readOrFail(
  path.join(KROOT, 'plants/PlantKnowledgeService.ts'),
  'plant-service');
for (const sym of ['PLANT_KNOWLEDGE_SERVICE_VERSION',
                    "'plant-knowledge-service-v1'",
                    'lookupPlantKnowledge', 'listPlantKnowledge',
                    'listPlantKnowledgeByCategory',
                    'searchPlantKnowledge',
                    'companionsFor', 'pollinatorIntelligenceFor']) {
  if (!plantSvc.includes(sym)) fail(`plant-service: missing "${sym}"`);
}

// PlantEntry interface fields (the spec's 15 + helpers)
const PLANT_ENTRY_FIELDS = [
  'id', 'commonName', 'scientificName', 'category', 'subtype',
  'images', 'growthStages', 'careGuide',
  'companionPlants', 'commonDiseases', 'commonPests',
  'pollinatorValue', 'bloomMonths',
  'waterNeed', 'sunlightNeed', 'soilNeed',
];
for (const f of PLANT_ENTRY_FIELDS) {
  if (!new RegExp('\\b' + f + '\\s*[:,]').test(plantSvc)) {
    fail(`plant-service: PlantEntry missing field "${f}"`);
  }
}
pass(`plant-service: 16 PlantEntry fields wired`);

// ─── 2. DiseaseKnowledgeService ────────────────────────────────
const diseaseSvc = readOrFail(
  path.join(KROOT, 'diseases/DiseaseKnowledgeService.ts'),
  'disease-service');
for (const sym of ['DISEASE_KNOWLEDGE_SERVICE_VERSION',
                    "'disease-knowledge-service-v1'",
                    'lookupDisease', 'listDiseases',
                    'searchDiseaseKnowledge',
                    'diseasesForPlant', 'diseasesBySymptom']) {
  if (!diseaseSvc.includes(sym)) fail(`disease-service: missing "${sym}"`);
}
pass(`disease-service: lookup/list/search/forPlant/bySymptom wired`);

// ─── 3. PestKnowledgeService ───────────────────────────────────
const pestSvc = readOrFail(
  path.join(KROOT, 'pests/PestKnowledgeService.ts'),
  'pest-service');
for (const sym of ['PEST_KNOWLEDGE_SERVICE_VERSION',
                    "'pest-knowledge-service-v1'",
                    'lookupPest', 'listPests', 'searchPestKnowledge',
                    'pestsForPlant', 'pestsBySymptom']) {
  if (!pestSvc.includes(sym)) fail(`pest-service: missing "${sym}"`);
}
pass(`pest-service: lookup/list/search/forPlant/bySymptom wired`);

// ─── 4. Knowledge barrel + composite ───────────────────────────
const barrel = readOrFail(path.join(KROOT, 'index.ts'), 'barrel');
for (const sym of ['FARROWAY_KNOWLEDGE_VERSION',
                    "'farroway-knowledge-v1'",
                    'knowledgeForPlant', 'farrowayKnowledge',
                    'installFarrowayKnowledgeGlobal',
                    'BriefingTask', 'todaysTasks']) {
  if (!barrel.includes(sym)) fail(`barrel: missing "${sym}"`);
}
pass(`barrel: composite knowledgeForPlant + briefing tasks + global pin`);

// ─── 5. Disease catalog has the spec's 9 entries ───────────────
const diseaseJson = (() => {
  try { return JSON.parse(fs.readFileSync(
      path.join(ROOT, 'src/data/diseases/diseases.json'), 'utf8')); }
  catch { return null; }
})();
const SPEC_DISEASES_V2 = ['powdery-mildew', 'black-spot', 'leaf-spot',
  'anthracnose', 'rust', 'wilt', 'root-rot', 'early-blight', 'late-blight',
  'downy-mildew', 'fusarium-wilt', 'mosaic-virus', 'fire-blight',
  'sooty-mold', 'clubroot'];
// Wave-32 knowledge expansion — floor of 15; spec IDs must remain.
if (!Array.isArray(diseaseJson) || diseaseJson.length < 15) {
  fail(`disease-data: expected ≥15 entries, found ${
    Array.isArray(diseaseJson) ? diseaseJson.length : 'invalid'}`);
} else {
  for (const id of SPEC_DISEASES_V2) {
    if (!diseaseJson.find((d) => d && d.id === id)) {
      fail(`disease-data: missing spec entry "${id}"`);
    }
  }
  pass(`disease-data: ${diseaseJson.length} entries including early-blight + late-blight`);
}

// ─── 6. Pest catalog has 8 spec entries ────────────────────────
const pestJson = (() => {
  try { return JSON.parse(fs.readFileSync(
      path.join(ROOT, 'src/data/pests/pests.json'), 'utf8')); }
  catch { return null; }
})();
const SPEC_PESTS_V2 = ['aphids', 'armyworm', 'whitefly', 'thrips',
  'spider-mites', 'scale', 'mealybugs', 'beetles',
  'caterpillars', 'leaf-miners', 'fruit-flies', 'snails-and-slugs',
  'root-knot-nematodes', 'weevils', 'grasshoppers'];
// Wave-32 knowledge expansion — floor of 15; spec IDs must remain.
if (!Array.isArray(pestJson) || pestJson.length < 15) {
  fail(`pest-data: expected ≥15 entries, found ${
    Array.isArray(pestJson) ? pestJson.length : 'invalid'}`);
} else {
  for (const id of SPEC_PESTS_V2) {
    if (!pestJson.find((p) => p && p.id === id)) {
      fail(`pest-data: missing spec entry "${id}"`);
    }
  }
  pass(`pest-data: ${pestJson.length} entries including 15 spec pests`);
}

// ─── 7. PlantProfile reads from the knowledge layer ────────────
const profile = readOrFail(path.join(ROOT, 'src/pages/PlantProfile.jsx'),
  'PlantProfile');
for (const sym of ['knowledgeForPlant',
                    'plant-profile-facts',
                    'plant-profile-pollinator-intel',
                    'plant-profile-companion-planting',
                    'soilNeed', 'bloomMonths']) {
  if (!profile.includes(sym)) {
    fail(`PlantProfile: missing reference to "${sym}"`);
  }
}
// And it must import from '../knowledge/index'
if (!/from\s+['"]\.\.\/knowledge\/index['"]/.test(profile)) {
  fail(`PlantProfile: must import knowledgeForPlant from '../knowledge/index'`);
}
pass(`PlantProfile: reads from canonical knowledge layer`);

// ─── 8. ScanResultPage calls knowledgeForPlant ─────────────────
const scanResult = readOrFail(path.join(ROOT, 'src/pages/ScanResultPage.jsx'),
  'ScanResultPage');
for (const sym of ['knowledgeForPlant',
                    'scan-result-knowledge',
                    'todaysTasks']) {
  if (!scanResult.includes(sym)) {
    fail(`ScanResultPage: missing reference to "${sym}"`);
  }
}
if (!/from\s+['"]\.\.\/knowledge\/index['"]/.test(scanResult)) {
  fail(`ScanResultPage: must import knowledgeForPlant from '../knowledge/index'`);
}
pass(`ScanResultPage: invokes knowledgeForPlant on scan result`);

// ─── 9. App.jsx wires the global ───────────────────────────────
const appJsx = readOrFail(path.join(ROOT, 'src/App.jsx'), 'App.jsx');
if (!appJsx.includes('installFarrowayKnowledgeGlobal')) {
  fail(`App.jsx: must wire installFarrowayKnowledgeGlobal() in boot`);
} else {
  pass(`App.jsx: installFarrowayKnowledgeGlobal wired`);
}

// ─── 10. Layer-purity — engines outside src/knowledge must NOT
//        import from src/data/diseases or src/data/pests. The
//        canonical service is the single read API.            ──
function walkSrc(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      walkSrc(full, out);
    } else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}
const violators = [];
const KNOWLEDGE_DIR = path.join(ROOT, 'src/knowledge');
const ALLOWED_OUTSIDE = new Set([
  // Backwards-compat re-exports from the runtime barrel — these
  // were the public API in the prior sprint and still serve as a
  // soft-deprecated path. Engines should migrate to src/knowledge.
  path.join(ROOT, 'src/runtime/plants/index.ts').toLowerCase(),
  // The plant-knowledge composer itself joins the raw data files;
  // it lives inside src/data and is OK to import them.
  path.join(ROOT, 'src/data/plants/knowledge.js').toLowerCase(),
  // The data loaders themselves.
  path.join(ROOT, 'src/data/diseases/index.js').toLowerCase(),
  path.join(ROOT, 'src/data/pests/index.js').toLowerCase(),
]);
for (const f of walkSrc(path.join(ROOT, 'src'))) {
  if (f.startsWith(KNOWLEDGE_DIR)) continue;
  if (ALLOWED_OUTSIDE.has(f.toLowerCase())) continue;
  const src = fs.readFileSync(f, 'utf8');
  if (/from\s+['"][^'"]*\bdata\/diseases\b/.test(src)
      || /from\s+['"][^'"]*\bdata\/pests\b/.test(src)) {
    violators.push(path.relative(ROOT, f));
  }
}
if (violators.length > 0) {
  for (const v of violators) {
    fail(`layer-purity: ${v} imports from src/data/diseases or src/data/pests directly — use src/knowledge`);
  }
} else {
  pass(`layer-purity: all engines consume the canonical knowledge layer`);
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:knowledge-layer] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} checks passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:knowledge-layer] PASS — Farroway Knowledge Layer complete.');
console.log(`  3 services (PlantKnowledgeService · DiseaseKnowledgeService · PestKnowledgeService) wired.`);
console.log(`  PlantEntry: 16 fields including the spec's bloomMonths · waterNeed · sunlightNeed · soilNeed · subtype.`);
console.log(`  Diseases:    15 entries (incl. early-blight + late-blight).`);
console.log(`  Pests:       15 entries.`);
console.log(`  knowledgeForPlant() one-call envelope for scan + profile · todaysTasks generated from care guide.`);
console.log(`  Layer purity: no engine imports raw data/diseases or data/pests outside the knowledge layer.`);
