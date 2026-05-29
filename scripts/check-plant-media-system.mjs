#!/usr/bin/env node
/**
 * scripts/check-plant-media-system.mjs — CI gate for the Verified
 * Plant Media System.
 *
 * Enforces:
 *   • 5 engine files exist with correct version constants
 *   • PlantMedia interface carries every spec'd field
 *   • PLANT_MEDIA_TYPES enumerates all 10 spec types
 *   • Folder map covers every type, paths match `plants/<folder>`
 *   • 8 launch libraries exist with spec'd counts
 *   • Auto-seed + bridge are wired in media/index.ts
 *   • PlantProfile renders gallery + diseases + stages
 *   • ScanResultPage renders reference images via composer
 *   • Barrel re-exports every key symbol from src/runtime/plants
 *   • App boot calls installPlantMediaGlobal()
 *
 * Run via:
 *   npm run check:plant-media-system
 *
 * Strict-rule audit
 *   • Read-only. Never mutates source.
 *   • Returns exit 1 on failure with actionable message.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT      = process.cwd();
const MEDIA_DIR = path.join(ROOT, 'src/runtime/plants/media');
const LIB_DIR   = path.join(MEDIA_DIR, 'libraries');

const FAILED = [];
const PASSED = [];
function fail(msg) { FAILED.push(msg); }
function pass(msg) { PASSED.push(msg); }

function readOrFail(file, label) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch { fail(`${label}: missing file ${path.relative(ROOT, file)}`); return ''; }
}

// ─── 1. Five engine files exist ────────────────────────────────
const ENGINES = [
  ['PlantMediaRegistry.ts',      'plant-media-registry-v1'],
  ['PlantMediaService.ts',       'plant-media-service-v1'],
  ['PlantMediaCache.ts',         'plant-media-cache-v1'],
  ['PlantGalleryService.ts',     'plant-gallery-v1'],
  ['PlantImageVerification.ts',  'plant-image-verification-v1'],
];
const sources = {};
for (const [file, version] of ENGINES) {
  const full = path.join(MEDIA_DIR, file);
  const src  = readOrFail(full, 'engine');
  sources[file] = src;
  if (!src) continue;
  if (!src.includes(version)) {
    fail(`engine: ${file} missing version constant "${version}"`);
  } else {
    pass(`engine: ${file} (${version})`);
  }
}

// ─── 2. PlantMedia interface fields ────────────────────────────
const SPEC_FIELDS = [
  'id', 'plantId', 'type',
  'imageUrl', 'thumbnailUrl',
  'verified', 'source', 'attribution', 'createdAt',
];
const registry = sources['PlantMediaRegistry.ts'] || '';
for (const f of SPEC_FIELDS) {
  if (!new RegExp('\\b' + f + '\\??\\s*:').test(registry)) {
    fail(`registry: PlantMedia interface missing field "${f}"`);
  }
}

// PLANT_MEDIA_TYPES — 10 entries from spec
const SPEC_TYPES = [
  'plant', 'flower', 'fruit', 'vegetable',
  'herb', 'houseplant', 'crop', 'tree',
  'disease', 'pest',
];
for (const t of SPEC_TYPES) {
  if (!new RegExp("'" + t + "'").test(registry)) {
    fail(`registry: PLANT_MEDIA_TYPES missing "${t}"`);
  }
}
pass(`registry: PlantMedia interface + ${SPEC_TYPES.length} types`);

// ─── 3. Service folder map + Cloudinary convention ─────────────
const service = sources['PlantMediaService.ts'] || '';
const SPEC_FOLDERS = [
  ['flower',     'flowers'],
  ['fruit',      'fruits'],
  ['vegetable',  'vegetables'],
  ['herb',       'herbs'],
  ['houseplant', 'houseplants'],
  ['crop',       'crops'],
  ['tree',       'trees'],
  ['disease',    'diseases'],
  ['pest',       'pests'],
];
for (const [t, f] of SPEC_FOLDERS) {
  if (!new RegExp("\\b" + t + "\\s*:\\s*'" + f + "'").test(service)) {
    fail(`service: PLANT_MEDIA_FOLDERS missing ${t} → '${f}'`);
  }
}
if (!service.includes("'farroway-media'")) {
  fail(`service: PLANT_MEDIA_CLOUD_NAME must be 'farroway-media'`);
}
if (!service.includes("'plants/'")
    && !service.includes("'/plants/'")
    && !service.includes("plants/' + f + '/'")) {
  fail(`service: must use 'plants/<folder>/' URL convention`);
}
pass(`service: cloud=farroway-media · 9 folders mapped · plants/* base`);

// ─── 4. Cache: LRU + subscriber + event constants ──────────────
const cache = sources['PlantMediaCache.ts'] || '';
for (const sym of ['cacheMedia', 'getCachedMedia',
                    'subscribeMediaCacheEvents', 'CACHE_EVENT',
                    'PLANT_MEDIA_CACHE_MAX']) {
  if (!cache.includes(sym)) fail(`cache: missing export "${sym}"`);
}
for (const evt of ['HIT', 'MISS', 'ADD', 'EVICT', 'CLEAR']) {
  if (!cache.includes(evt + ':')) fail(`cache: CACHE_EVENT missing "${evt}"`);
}
pass(`cache: LRU + 5 events + subscriber model`);

// ─── 5. Gallery + Verification exports ─────────────────────────
const gallery = sources['PlantGalleryService.ts'] || '';
for (const sym of ['composePlantGallery', 'composeReferenceImagesForScan',
                    'regionMatched', 'lifecycleStage']) {
  if (!gallery.includes(sym)) fail(`gallery: missing reference to "${sym}"`);
}
pass(`gallery: composePlantGallery + composeReferenceImagesForScan + regional sort`);

const verif = sources['PlantImageVerification.ts'] || '';
for (const sym of ['submitForVerification', 'approveVerification',
                    'rejectVerification', 'listPendingVerifications',
                    'VERIFICATION_STATUS']) {
  if (!verif.includes(sym)) fail(`verification: missing export "${sym}"`);
}
for (const status of ['PENDING', 'APPROVED', 'REJECTED']) {
  if (!verif.includes(status + ':')) {
    fail(`verification: VERIFICATION_STATUS missing "${status}"`);
  }
}
pass(`verification: submit/approve/reject + 3 statuses`);

// ─── 6. Eight launch libraries with spec'd counts ──────────────
const LIBS = [
  ['flowerLibrary.ts',     'FLOWER_LIBRARY',     20],
  ['vegetableLibrary.ts',  'VEGETABLE_LIBRARY',  10],
  ['fruitLibrary.ts',      'FRUIT_LIBRARY',      10],
  ['herbLibrary.ts',       'HERB_LIBRARY',        8],
  ['houseplantLibrary.ts', 'HOUSEPLANT_LIBRARY',  8],
  ['cropLibrary.ts',       'CROP_LIBRARY',       10],
  ['diseaseLibrary.ts',    'DISEASE_LIBRARY',     9],
  ['pestLibrary.ts',       'PEST_LIBRARY',        8],
];
let totalEntries = 0;
for (const [file, name, expected] of LIBS) {
  const src = readOrFail(path.join(LIB_DIR, file), 'library');
  if (!src) continue;
  if (!src.includes(`export const ${name}`)) {
    fail(`library: ${file} missing export "${name}"`);
    continue;
  }
  const slugMatches = src.match(/slug:\s*'/g) || [];
  if (slugMatches.length !== expected) {
    fail(`library: ${file} expected ${expected} entries, found ${slugMatches.length}`);
  } else {
    pass(`library: ${file} → ${expected} entries`);
    totalEntries += expected;
  }
}
const EXPECTED_TOTAL = 83; // 20+10+10+8+8+10+9+8 (disease split early/late)
if (totalEntries !== EXPECTED_TOTAL) {
  fail(`library: total entries ${totalEntries} ≠ ${EXPECTED_TOTAL}`);
} else {
  pass(`library: ${totalEntries} total verified media entries`);
}

// ─── 7. Library spec coverage — every spec plant present ───────
const SPEC_FLOWERS = ['rose','lavender','hibiscus','sunflower','marigold',
  'tulip','orchid','daisy','hydrangea','petunia','begonia','dahlia',
  'chrysanthemum','jasmine','bougainvillea','zinnia','geranium','peony',
  'camellia','azalea'];
const SPEC_VEG = ['tomato','pepper','cucumber','lettuce','spinach',
  'cabbage','onion','carrot','kale','broccoli'];
const SPEC_FRUIT = ['mango','apple','banana','orange','lemon','lime',
  'avocado','strawberry','blueberry','pineapple'];
const SPEC_HERB = ['basil','mint','rosemary','thyme','sage','oregano',
  'parsley','cilantro'];
const SPEC_HOUSE = ['monstera','snake-plant','pothos','peace-lily',
  'zz-plant','rubber-plant','spider-plant','fiddle-leaf-fig'];
const SPEC_CROP = ['maize','rice','cassava','soybean','wheat',
  'sorghum','groundnut','millet','cotton','sugarcane'];
const SPEC_DISEASE = ['leaf-spot','powdery-mildew','early-blight','late-blight',
  'rust','wilt','root-rot','anthracnose','black-spot'];
const SPEC_PEST = ['aphids','armyworm','whitefly','thrips','spider-mites',
  'scale','mealybugs','beetles'];

function checkSpec(libFile, label, ids) {
  const src = readOrFail(path.join(LIB_DIR, libFile), 'library-spec');
  for (const id of ids) {
    if (!src.includes(`'${id}'`)) {
      fail(`library-spec: ${label} missing plant "${id}"`);
    }
  }
}
checkSpec('flowerLibrary.ts',     'flowers',     SPEC_FLOWERS);
checkSpec('vegetableLibrary.ts',  'vegetables',  SPEC_VEG);
checkSpec('fruitLibrary.ts',      'fruits',      SPEC_FRUIT);
checkSpec('herbLibrary.ts',       'herbs',       SPEC_HERB);
checkSpec('houseplantLibrary.ts', 'houseplants', SPEC_HOUSE);
checkSpec('cropLibrary.ts',       'crops',       SPEC_CROP);
checkSpec('diseaseLibrary.ts',    'diseases',    SPEC_DISEASE);
checkSpec('pestLibrary.ts',       'pests',       SPEC_PEST);

// ─── 8. media/index.ts barrel + seed + bridge ──────────────────
const barrel = readOrFail(path.join(MEDIA_DIR, 'index.ts'), 'barrel');
for (const sym of ['_seedLibrary', 'bridgeToImageRegistry',
                    'verifiedPlantMedia', 'installPlantMediaGlobal',
                    'PLANT_MEDIA_SYSTEM_VERSION',
                    'plant-media-system-v1']) {
  if (!barrel.includes(sym)) fail(`barrel: missing "${sym}"`);
}
for (const [lib] of LIBS) {
  const libName = lib.replace('.ts', '');
  if (!barrel.includes(libName)) {
    fail(`barrel: must import library "${libName}"`);
  }
}
pass(`barrel: auto-seeds 8 libraries + bridges into image registry`);

// ─── 9. Runtime barrel re-exports media ────────────────────────
const runtimeBarrel = readOrFail(
  path.join(ROOT, 'src/runtime/plants/index.ts'), 'runtime-barrel');
for (const sym of ['composePlantGallery', 'composeReferenceImagesForScan',
                    'submitForVerification', 'approveVerification',
                    'rejectVerification', 'PlantMedia',
                    'installPlantMediaGlobal', 'verifiedPlantMedia',
                    'PLANT_MEDIA_TYPES', 'PLANT_MEDIA_FOLDERS',
                    'PLANT_MEDIA_SYSTEM_VERSION']) {
  if (!runtimeBarrel.includes(sym)) {
    fail(`runtime-barrel: src/runtime/plants/index.ts missing "${sym}"`);
  }
}
pass(`runtime-barrel: re-exports all media symbols`);

// ─── 10. UI consumer wiring ────────────────────────────────────
const profile = readOrFail(
  path.join(ROOT, 'src/pages/PlantProfile.jsx'), 'PlantProfile');
for (const sym of ['composePlantGallery',
                    'plant-profile-gallery',
                    'plant-profile-diseases',
                    'plant-profile-stages']) {
  if (!profile.includes(sym)) {
    fail(`PlantProfile: missing reference to "${sym}"`);
  }
}
pass(`PlantProfile: gallery + diseases + stages wired`);

const scanResult = readOrFail(
  path.join(ROOT, 'src/pages/ScanResultPage.jsx'), 'ScanResultPage');
for (const sym of ['composeReferenceImagesForScan',
                    'scan-result-reference-images',
                    'plantReferences', 'diseaseReferences']) {
  if (!scanResult.includes(sym)) {
    fail(`ScanResultPage: missing reference to "${sym}"`);
  }
}
pass(`ScanResultPage: reference images section wired`);

// ─── 11. App.jsx boot install ──────────────────────────────────
const appJsx = readOrFail(path.join(ROOT, 'src/App.jsx'), 'App.jsx');
if (!appJsx.includes('installPlantMediaGlobal')) {
  fail(`App.jsx: must call installPlantMediaGlobal() in boot sequence`);
} else {
  pass(`App.jsx: installPlantMediaGlobal() wired into boot`);
}

// ─── 12. No cartoon assets — block any obvious cartoon URL ─────
for (const [file, src] of Object.entries(sources)) {
  if (/\b(cartoon|illustration|illustrative|sketch|clip[-_]?art|comic|vector[-_]?art)\b/i.test(src)
      && !/CARTOON_BLOCK_RE|cartoon-block|cartoon block|cartoon \//i.test(src)
      && !src.includes('blockedInProduction')
      && file !== 'PlantImageVerification.ts') {
    fail(`no-cartoon: ${file} appears to reference cartoon/illustration assets directly`);
  }
}
pass(`no-cartoon: no engine ships cartoon/illustration URLs`);

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:plant-media-system] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error('\nFix the items above. ' +
    `${PASSED.length} checks passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:plant-media-system] PASS — Verified Plant Media System complete.');
console.log('  5 engines (registry · service · cache · gallery · verification) wired.');
console.log('  8 launch libraries → 83 verified media entries seeded.');
console.log('  Cloudinary convention: plants/<folder>/<slug> · cloud=farroway-media.');
console.log('  PlantProfile gallery + diseases + stages live · ScanResultPage shows references.');
console.log('  Boot install (__plantMediaHealth) + bridge into PlantImageRegistry wired.');
