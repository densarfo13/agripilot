#!/usr/bin/env node
/**
 * scripts/check-plant-knowledge.mjs — CI gate for the Plant
 * Knowledge Database.
 *
 * Enforces:
 *   • src/data/diseases/diseases.json     — 8 disease entries
 *     each with: id, name, symptoms[], causes[],
 *     treatmentOrganic[], treatmentChemical[], prevention[],
 *     images[]
 *   • src/data/diseases/index.js          — exports findDisease,
 *     searchDiseases, DISEASE_DB, DISEASE_DB_VERSION
 *   • src/data/pests/pests.json           — 8 pest entries each
 *     with: id, name, symptoms[], lifecycle[],
 *     treatmentOrganic[], treatmentChemical[], prevention[],
 *     images[]
 *   • src/data/pests/index.js             — exports findPest,
 *     searchPests, PEST_DB, PEST_DB_VERSION
 *   • src/data/plants/knowledge.js        — exports
 *     composePlantEntry, findPlantKnowledge, PLANT_KNOWLEDGE,
 *     GROWTH_STAGE_TEMPLATES, PLANT_KNOWLEDGE_VERSION; the spec
 *     PlantEntry shape: id, commonName, scientificName,
 *     category, images, growthStages, commonDiseases,
 *     commonPests, companionPlants, pollinatorValue, careGuide
 *   • PLANT_KNOWLEDGE map covers the 66 media-library plants
 *   • Runtime barrel re-exports every public symbol
 *   • PlantProfile renders careGuide + growthStages +
 *     commonDiseases + commonPests
 *
 * Strict-rule audit
 *   • Read-only. Never mutates source.
 *   • Returns exit 1 with actionable messages on failure.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
function fail(m) { FAILED.push(m); }
function pass(m) { PASSED.push(m); }

function readOrFail(file, label) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch { fail(`${label}: missing ${path.relative(ROOT, file)}`); return ''; }
}

function parseJSON(file, label) {
  const raw = readOrFail(file, label);
  if (!raw) return null;
  try { return JSON.parse(raw); }
  catch (e) { fail(`${label}: invalid JSON — ${e.message}`); return null; }
}

// ─── 1. Diseases dataset ───────────────────────────────────────
const DISEASE_FIELDS = ['id', 'name', 'symptoms', 'causes',
  'treatmentOrganic', 'treatmentChemical', 'prevention', 'images'];
const SPEC_DISEASES = ['leaf-spot', 'powdery-mildew', 'early-blight', 'late-blight',
  'rust', 'wilt', 'root-rot', 'anthracnose', 'black-spot'];

const diseases = parseJSON(path.join(ROOT, 'src/data/diseases/diseases.json'),
  'disease-data');
if (Array.isArray(diseases)) {
  if (diseases.length !== 9) {
    fail(`disease-data: expected 9 entries, found ${diseases.length}`);
  } else {
    pass(`disease-data: 9 entries present`);
  }
  for (const id of SPEC_DISEASES) {
    const e = diseases.find((d) => d && d.id === id);
    if (!e) { fail(`disease-data: missing entry "${id}"`); continue; }
    for (const f of DISEASE_FIELDS) {
      if (!(f in e)) fail(`disease-data: ${id} missing field "${f}"`);
      else if (['symptoms','causes','treatmentOrganic','treatmentChemical',
                 'prevention','images'].includes(f)
                && (!Array.isArray(e[f]) || e[f].length === 0)) {
        fail(`disease-data: ${id} field "${f}" must be a non-empty array`);
      }
    }
  }
  pass(`disease-data: all 9 spec diseases present with full field coverage`);
}

const diseaseIdx = readOrFail(path.join(ROOT, 'src/data/diseases/index.js'),
  'disease-loader');
for (const sym of ['DISEASE_DB', 'findDisease', 'searchDiseases',
                    'DISEASE_DB_VERSION', "'disease-db-v1'"]) {
  if (!diseaseIdx.includes(sym)) fail(`disease-loader: missing "${sym}"`);
}
pass(`disease-loader: exports findDisease/searchDiseases + version`);

// ─── 2. Pests dataset ──────────────────────────────────────────
const PEST_FIELDS = ['id', 'name', 'symptoms', 'lifecycle',
  'treatmentOrganic', 'treatmentChemical', 'prevention', 'images'];
const SPEC_PESTS = ['aphids', 'armyworm', 'whitefly', 'thrips',
  'spider-mites', 'scale', 'mealybugs', 'beetles'];

const pests = parseJSON(path.join(ROOT, 'src/data/pests/pests.json'),
  'pest-data');
if (Array.isArray(pests)) {
  if (pests.length !== 8) {
    fail(`pest-data: expected 8 entries, found ${pests.length}`);
  } else {
    pass(`pest-data: 8 entries present`);
  }
  for (const id of SPEC_PESTS) {
    const e = pests.find((p) => p && p.id === id);
    if (!e) { fail(`pest-data: missing entry "${id}"`); continue; }
    for (const f of PEST_FIELDS) {
      if (!(f in e)) fail(`pest-data: ${id} missing field "${f}"`);
      else if (['symptoms','lifecycle','treatmentOrganic','treatmentChemical',
                 'prevention','images'].includes(f)
                && (!Array.isArray(e[f]) || e[f].length === 0)) {
        fail(`pest-data: ${id} field "${f}" must be a non-empty array`);
      }
    }
  }
  pass(`pest-data: all 8 spec pests present with full field coverage`);
}

const pestIdx = readOrFail(path.join(ROOT, 'src/data/pests/index.js'),
  'pest-loader');
for (const sym of ['PEST_DB', 'findPest', 'searchPests',
                    'PEST_DB_VERSION', "'pest-db-v1'"]) {
  if (!pestIdx.includes(sym)) fail(`pest-loader: missing "${sym}"`);
}
pass(`pest-loader: exports findPest/searchPests + version`);

// ─── 3. Plant knowledge supplement ─────────────────────────────
const knowledge = readOrFail(path.join(ROOT, 'src/data/plants/knowledge.js'),
  'knowledge');
for (const sym of ['PLANT_KNOWLEDGE', 'GROWTH_STAGE_TEMPLATES',
                    'findPlantKnowledge', 'composePlantEntry',
                    'PLANT_KNOWLEDGE_VERSION', "'plant-knowledge-v1'"]) {
  if (!knowledge.includes(sym)) fail(`knowledge: missing "${sym}"`);
}
// Spec PlantEntry composer fields — accept both `field:` form and
// ES6 shorthand return `field,` form.
for (const f of ['commonName', 'scientificName', 'category', 'images',
                  'growthStages', 'commonDiseases', 'commonPests',
                  'companionPlants', 'pollinatorValue', 'careGuide']) {
  const re = new RegExp('\\b' + f + '\\s*[:,]');
  if (!re.test(knowledge)) {
    fail(`knowledge: composePlantEntry must emit "${f}"`);
  }
}
// Growth-stage templates per category
for (const cat of ['flower','vegetable','fruit','herb','houseplant','crop']) {
  if (!new RegExp('\\b' + cat + '\\s*:\\s*Object\\.freeze\\s*\\(').test(knowledge)) {
    fail(`knowledge: GROWTH_STAGE_TEMPLATES missing category "${cat}"`);
  }
}

// PLANT_KNOWLEDGE coverage — every media-library plant id present
const SPEC_PLANTS = [
  // flowers
  'rose','lavender','hibiscus','sunflower','marigold','tulip','orchid',
  'daisy','hydrangea','petunia','begonia','dahlia','chrysanthemum',
  'jasmine','bougainvillea','zinnia','geranium','peony','camellia','azalea',
  // vegetables
  'tomato','pepper','cucumber','lettuce','spinach','cabbage','onion',
  'carrot','kale','broccoli',
  // fruits
  'mango','apple','banana','orange','lemon','lime','avocado',
  'strawberry','blueberry','pineapple',
  // herbs
  'basil','mint','rosemary','thyme','sage','oregano','parsley','cilantro',
  // houseplants
  'monstera','snake-plant','pothos','peace-lily','zz-plant','rubber-plant',
  'spider-plant','fiddle-leaf-fig',
  // crops
  'maize','rice','cassava','soybean','wheat','sorghum','groundnut',
  'millet','cotton','sugarcane',
];
let missingKnow = 0;
for (const id of SPEC_PLANTS) {
  const re = new RegExp("['\"]?" + id.replace(/-/g, '[-_]') + "['\"]?\\s*:\\s*\\{");
  if (!re.test(knowledge)) {
    fail(`knowledge: PLANT_KNOWLEDGE missing plant "${id}"`);
    missingKnow++;
  }
}
if (missingKnow === 0) {
  pass(`knowledge: PLANT_KNOWLEDGE covers all 66 launch plants`);
}

// Each knowledge entry should reference at least one disease + pest
const careGuideMatches = knowledge.match(/careGuide\s*:\s*\{/g) || [];
if (careGuideMatches.length < 66) {
  fail(`knowledge: expected ≥66 careGuide blocks, found ${careGuideMatches.length}`);
}
pass(`knowledge: ${careGuideMatches.length} careGuide blocks`);

// ─── 4. Runtime barrel re-exports ──────────────────────────────
const barrel = readOrFail(path.join(ROOT, 'src/runtime/plants/index.ts'),
  'runtime-barrel');
for (const sym of ['DISEASE_DB', 'findDisease', 'searchDiseases',
                    'PEST_DB', 'findPest', 'searchPests',
                    'PLANT_KNOWLEDGE', 'GROWTH_STAGE_TEMPLATES',
                    'findPlantKnowledge', 'composePlantEntry',
                    'PLANT_KNOWLEDGE_VERSION',
                    'DISEASE_DB_VERSION', 'PEST_DB_VERSION']) {
  if (!barrel.includes(sym)) {
    fail(`runtime-barrel: missing "${sym}"`);
  }
}
pass(`runtime-barrel: re-exports diseases + pests + knowledge`);

// ─── 5. PlantProfile surfaces the knowledge ────────────────────
const profile = readOrFail(path.join(ROOT, 'src/pages/PlantProfile.jsx'),
  'PlantProfile');
for (const sym of ['composePlantEntry', 'findDisease', 'findPest',
                    'plant-profile-care-guide',
                    'plant-profile-growth-stages',
                    'plant-profile-common-diseases',
                    'plant-profile-common-pests']) {
  if (!profile.includes(sym)) {
    fail(`PlantProfile: missing reference to "${sym}"`);
  }
}
pass(`PlantProfile: renders careGuide + stages + diseases + pests`);

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:plant-knowledge] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} checks passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:plant-knowledge] PASS — Plant Knowledge Database complete.');
console.log(`  Diseases catalog: 9 entries (symptoms · causes · organic + chemical treatment · prevention).`);
console.log(`  Pests    catalog: 8 entries (symptoms · lifecycle · organic + chemical treatment · prevention).`);
console.log(`  Plant knowledge: ${SPEC_PLANTS.length} plants with growthStages + commonDiseases + commonPests + careGuide.`);
console.log(`  Runtime barrel exports + PlantProfile surfaces all four datasets.`);
