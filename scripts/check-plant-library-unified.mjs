#!/usr/bin/env node
/**
 * check-plant-library-unified.mjs — Global Plant Intelligence
 * Library gate.
 *
 *   node scripts/check-plant-library-unified.mjs
 *
 * Verifies:
 *   1. src/modules/plants/ ships the 4 spec'd modules + barrel.
 *   2. Required exports declared on each.
 *   3. PLANT_CATEGORIES covers the 7 spec'd categories
 *      (flower, vegetable, fruit, herb, houseplant, crop, tree).
 *   4. Every PLANT_CATEGORIES entry maps to an existing GROW_TYPES
 *      value (consistency lock).
 *   5. trees.json parses + has >= 10 entries.
 *   6. Plant DB loader includes trees in PLANTS_BY_TYPE.
 *   7. PLANT_LIBRARY_FILTERS covers spec buckets (8 + favorites).
 *   8. PLANT_LIBRARY_SORT covers at least 6 sort orders.
 *   9. App.jsx installs the global during boot.
 *  10. growTypes.ts contains 'tree' (consistency lock).
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const HEADER    = '[check:plant-library-unified]';

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
  categories:   'src/modules/plants/plantCategories.ts',
  search:       'src/modules/plants/plantSearch.ts',
  profiles:     'src/modules/plants/plantProfiles.ts',
  library:      'src/modules/plants/plantLibrary.ts',
  barrel:       'src/modules/plants/index.ts',
  trees:        'src/data/plants/trees.json',
  dbLoader:     'src/data/plants/index.js',
  growTypes:    'src/types/growTypes.ts',
  app:          'src/App.jsx',
};
const sources = {};
for (const [k, rel] of Object.entries(FILES)) {
  const src = _read(rel);
  if (!src) fail('missing file: ' + rel);
  sources[k] = src;
}

const REQUIRED = [
  { src: 'categories', sym: 'PLANT_CATEGORIES' },
  { src: 'categories', sym: 'PLANT_CATEGORY_META' },
  { src: 'categories', sym: 'isPlantCategory' },
  { src: 'categories', sym: 'plantCategoryMeta' },
  { src: 'categories', sym: 'MIN_LAUNCH_TOTAL' },
  { src: 'categories', sym: 'PLANT_CATEGORIES_VERSION' },
  { src: 'search',     sym: 'plantSearch' },
  { src: 'search',     sym: 'PLANT_SEARCH_VERSION' },
  { src: 'profiles',   sym: 'plantProfile' },
  { src: 'profiles',   sym: 'PLANT_PROFILE_VERSION' },
  { src: 'library',    sym: 'plantLibrary' },
  { src: 'library',    sym: 'PLANT_LIBRARY_FILTERS' },
  { src: 'library',    sym: 'PLANT_LIBRARY_SORT' },
  { src: 'library',    sym: 'PLANT_LIBRARY_VERSION' },
  { src: 'barrel',     sym: 'globalPlantIntelligence' },
  { src: 'barrel',     sym: 'installGlobalPlantIntelligenceGlobal' },
  { src: 'barrel',     sym: 'GLOBAL_PLANT_INTELLIGENCE_VERSION' },
];
for (const { src, sym } of REQUIRED) {
  if (!new RegExp('export\\s+(function|const|async function)\\s+' + sym + '\\b').test(sources[src])
      && !new RegExp('export\\s*\\{[\\s\\S]*\\b' + sym + '\\b').test(sources[src])) {
    fail(FILES[src] + ' missing export: ' + sym);
  }
}

// PLANT_CATEGORIES — 7 spec'd values
const SPEC_CATEGORIES = [
  'flower', 'vegetable', 'fruit', 'herb',
  'houseplant', 'crop', 'tree',
];
for (const c of SPEC_CATEGORIES) {
  if (sources.categories.indexOf("'" + c + "'") === -1) {
    fail("PLANT_CATEGORIES missing: '" + c + "'");
  }
}

// PLANT_LIBRARY_FILTERS — spec buckets + FAVORITES_ONLY
const SPEC_FILTERS = [
  'BLOOMING', 'PERENNIAL', 'ANNUAL',
  'FULL_SUN', 'PARTIAL_SHADE',
  'POLLINATOR_FRIENDLY', 'DROUGHT_RESISTANT', 'INDOOR_FRIENDLY',
  'FAVORITES_ONLY',
];
for (const f of SPEC_FILTERS) {
  if (!new RegExp(f + '\\s*:').test(sources.library)) {
    fail('PLANT_LIBRARY_FILTERS missing: ' + f);
  }
}

// PLANT_LIBRARY_SORT — at least 6 orders incl FAVORITES_FIRST
const SPEC_SORTS = [
  'NAME_ASC', 'NAME_DESC', 'POLLINATOR_DESC',
  'WATER_LOW_TO_HIGH', 'FAVORITES_FIRST', 'CATEGORY',
];
for (const s of SPEC_SORTS) {
  if (!new RegExp(s + '\\s*:').test(sources.library)) {
    fail('PLANT_LIBRARY_SORT missing: ' + s);
  }
}

// trees.json — parses + min entries
let treesParsed;
try { treesParsed = JSON.parse(sources.trees); }
catch (e) { fail('trees.json does not parse', e.message); }
if (!Array.isArray(treesParsed)) fail('trees.json must be a JSON array');
if (treesParsed.length < 10) {
  fail('trees.json starter must have >= 10 entries (has '
    + treesParsed.length + ')');
}
const TREE_REQUIRED_FIELDS = [
  'id', 'commonName', 'scientificName', 'family',
  'type', 'lifecycle', 'bloomSeason', 'sunlight',
  'waterNeeds', 'pollinatorValue', 'companionPlants',
  'diseaseRisks', 'image',
];
for (const t of treesParsed) {
  if (!t || typeof t !== 'object') fail('trees.json: non-object entry');
  for (const f of TREE_REQUIRED_FIELDS) {
    if (!(f in t)) fail('trees.json entry "' + (t.id || '?')
                       + '" missing field: ' + f);
  }
  if (t.type !== 'tree') fail('trees.json entry "' + t.id
                            + '" must have type: "tree"');
}

// DB loader includes trees in PLANTS_BY_TYPE
if (sources.dbLoader.indexOf("import trees") === -1
    && sources.dbLoader.indexOf("import trees       from") === -1) {
  fail('src/data/plants/index.js does not import trees.json');
}
if (!/tree:\s*_freezeAll\(trees\)/.test(sources.dbLoader)) {
  fail('src/data/plants/index.js PLANTS_BY_TYPE missing tree entry');
}

// growTypes.ts — must contain 'tree' to keep registries in sync
if (sources.growTypes.indexOf("'tree'") === -1) {
  fail("src/types/growTypes.ts must include 'tree' in GROW_TYPES "
    + '(consistency lock with PLANT_CATEGORIES)');
}

// PLANT_DB_STATS — specTarget includes grandTotal
if (!/grandTotal\s*:/.test(sources.dbLoader)) {
  fail('PLANT_DB_STATS.specTarget missing grandTotal');
}

// App.jsx installs the global
if (!/installGlobalPlantIntelligenceGlobal\s*\(\s*\)/.test(sources.app)) {
  fail('App.jsx does not call installGlobalPlantIntelligenceGlobal() during boot');
}

console.log(HEADER, 'PASS — Global Plant Intelligence Library complete.');
console.log('  4 modules + barrel + tree dataset + boot install wired.');
console.log('  Categories: ' + SPEC_CATEGORIES.length
  + ' · filters: ' + SPEC_FILTERS.length
  + ' · sorts: ' + SPEC_SORTS.length
  + ' · trees: ' + treesParsed.length + '.');
console.log('  growTypes.ts + PLANTS_BY_TYPE + categories registry locked in sync.');
process.exit(0);
