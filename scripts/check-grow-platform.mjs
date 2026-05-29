#!/usr/bin/env node
/**
 * check-grow-platform.mjs — 15-phase grow-platform gate.
 *
 *   node scripts/check-grow-platform.mjs
 *
 * Verifies the grow-platform runtime is complete:
 *   1. growTypes.ts + 5 plant JSON files exist and parse.
 *   2. 12 sub-engines + composite + hook + GrowTypePicker exist.
 *   3. Required exports declared on each.
 *   4. GROW_TYPES covers the 7 spec'd types.
 *   5. GROW_TYPE_ICONS map covers all GROW_TYPES.
 *   6. Marketplace + AI assistant default-gated.
 *   7. Plant DB has ≥10 entries per category.
 *   8. App.jsx installs the global during boot.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const HEADER    = '[check:grow-platform]';

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
  growTypes:    'src/types/growTypes.ts',
  plantsIdx:    'src/data/plants/index.js',
  flowers:      'src/data/plants/flowers.json',
  herbs:        'src/data/plants/herbs.json',
  vegetables:   'src/data/plants/vegetables.json',
  fruits:       'src/data/plants/fruits.json',
  houseplants:  'src/data/plants/houseplants.json',
  flowerAd:     'src/runtime/grow/flowerAdvisor.ts',
  companion:    'src/runtime/grow/companionEngine.ts',
  pollinator:   'src/runtime/grow/pollinatorEngine.ts',
  scanTagger:   'src/runtime/grow/scanGrowType.js',
  gardenMode:   'src/runtime/grow/gardenMode.js',
  indoorCare:   'src/runtime/grow/indoorPlantCare.js',
  marketGate:   'src/runtime/grow/flowerMarketplaceGate.js',
  discover:     'src/runtime/grow/discoverFeed.js',
  library:      'src/runtime/grow/plantLibrary.js',
  assistant:    'src/runtime/grow/aiPlantAssistant.js',
  dashboard:    'src/runtime/grow/gardenDashboard.js',
  multiGarden:  'src/runtime/grow/multiGarden.js',
  composite:    'src/runtime/grow/index.js',
  hook:         'src/hooks/useGardenPlatform.js',
  picker:       'src/components/grow/GrowTypePicker.jsx',
  app:          'src/App.jsx',
};
const sources = {};
for (const [k, rel] of Object.entries(FILES)) {
  const src = _read(rel);
  if (!src) fail('missing file: ' + rel);
  sources[k] = src;
}

const REQUIRED = [
  { src: 'growTypes',    sym: 'GROW_TYPES' },
  { src: 'growTypes',    sym: 'GROW_TYPE_ICONS' },
  { src: 'growTypes',    sym: 'isGrowType' },
  { src: 'plantsIdx',    sym: 'PLANT_DB' },
  { src: 'plantsIdx',    sym: 'findPlant' },
  { src: 'plantsIdx',    sym: 'searchPlants' },
  { src: 'plantsIdx',    sym: 'PLANT_DB_STATS' },
  { src: 'flowerAd',     sym: 'flowerAdvisor' },
  { src: 'flowerAd',     sym: 'FLOWER_ADVISOR_VERSION' },
  { src: 'companion',    sym: 'companionAdvice' },
  { src: 'companion',    sym: 'suggestCompanionsForGarden' },
  { src: 'pollinator',   sym: 'pollinatorScore' },
  { src: 'pollinator',   sym: 'POLLINATOR_CATEGORIES' },
  { src: 'scanTagger',   sym: 'tagScanWithGrowType' },
  { src: 'gardenMode',   sym: 'resolveGardenMode' },
  { src: 'gardenMode',   sym: 'GARDEN_LABEL_MAP' },
  { src: 'indoorCare',   sym: 'composeIndoorCare' },
  { src: 'indoorCare',   sym: 'computeIndoorHealthScore' },
  { src: 'marketGate',   sym: 'flowerMarketplaceState' },
  { src: 'marketGate',   sym: 'FLOWER_MARKETPLACE_CATEGORIES' },
  { src: 'discover',     sym: 'composeDiscoverFeed' },
  { src: 'library',      sym: 'plantLibrary' },
  { src: 'library',      sym: 'plantLibrarySearch' },
  { src: 'assistant',    sym: 'aiPlantAssistant' },
  { src: 'dashboard',    sym: 'composeGardenDashboard' },
  { src: 'multiGarden',  sym: 'resolveActiveGarden' },
  { src: 'multiGarden',  sym: 'GARDEN_KINDS' },
  { src: 'composite',    sym: 'gardenPlatform' },
  { src: 'composite',    sym: 'installGardenPlatformGlobal' },
  { src: 'composite',    sym: 'GARDEN_PLATFORM_VERSION' },
  { src: 'hook',         sym: 'useGardenPlatform' },
];
for (const { src, sym } of REQUIRED) {
  if (!new RegExp('export\\s+(function|const|async function)\\s+' + sym + '\\b').test(sources[src])
      && !new RegExp('export\\s*\\{[\\s\\S]*\\b' + sym + '\\b').test(sources[src])) {
    fail(FILES[src] + ' missing export: ' + sym);
  }
}

// GROW_TYPES — 7 spec'd types
const SPEC_GROW_TYPES = [
  'crop', 'vegetable', 'fruit', 'flower', 'herb',
  'houseplant', 'garden',
];
for (const t of SPEC_GROW_TYPES) {
  if (sources.growTypes.indexOf("'" + t + "'") === -1) {
    fail('GROW_TYPES missing: ' + t);
  }
  if (sources.growTypes.indexOf(t + ':') === -1) {
    fail('GROW_TYPE_ICONS missing entry: ' + t);
  }
}

// GARDEN_KINDS — 5 spec'd kinds
const SPEC_GARDEN_KINDS = [
  'BACKYARD', 'INDOOR', 'FLOWER_BED', 'GREENHOUSE', 'VEGETABLE_PATCH',
];
for (const k of SPEC_GARDEN_KINDS) {
  if (!new RegExp(k + '\\s*:').test(sources.multiGarden)) {
    fail('GARDEN_KINDS missing: ' + k);
  }
}

// Plant JSON files — parse + minimum sizes
const PLANT_FILES = ['flowers', 'herbs', 'vegetables', 'fruits', 'houseplants'];
for (const k of PLANT_FILES) {
  let parsed;
  try { parsed = JSON.parse(sources[k]); }
  catch (e) { fail(FILES[k] + ' does not parse as JSON', e.message); }
  if (!Array.isArray(parsed)) fail(FILES[k] + ' must be a JSON array');
  if (parsed.length < 10) {
    fail(FILES[k] + ' starter db must have ≥10 entries (has '
      + parsed.length + ')');
  }
  for (const p of parsed) {
    if (!p || typeof p !== 'object'
        || typeof p.id !== 'string' || typeof p.name !== 'string'
        || typeof p.type !== 'string') {
      fail(FILES[k] + ' entry missing required fields (id, name, type)');
    }
  }
}

// Marketplace + AI assistant gates
if (!/marketplace_gated/.test(sources.marketGate)) {
  fail('flowerMarketplaceGate.js must default to marketplace_gated null envelope');
}
if (!/llmAssistant/.test(sources.assistant)) {
  fail('aiPlantAssistant.js must name LLM as deferred');
}

// Garden mode label map must cover the 3 spec'd swaps
const LABEL_SWAPS = ['Garden Home', 'Garden Progress', 'Bloom Success', 'Garden Care'];
for (const l of LABEL_SWAPS) {
  if (sources.gardenMode.indexOf(l) === -1) {
    fail('GARDEN_LABEL_MAP.garden missing label: ' + l);
  }
}

// UI testid
if (!sources.picker.includes('grow-type-picker')) {
  fail('GrowTypePicker missing testid: grow-type-picker');
}

// App.jsx installs the global
if (!/installGardenPlatformGlobal\s*\(\s*\)/.test(sources.app)) {
  fail('App.jsx does not call installGardenPlatformGlobal() during boot');
}

console.log(HEADER, 'PASS — 15-phase grow platform runtime complete.');
console.log('  12 engines + composite + hook + GrowTypePicker wired.');
console.log('  Grow types: ' + SPEC_GROW_TYPES.length
  + ' · garden kinds: ' + SPEC_GARDEN_KINDS.length
  + ' · plant DB: ≥' + (PLANT_FILES.length * 10) + ' entries across '
  + PLANT_FILES.length + ' categories.');
console.log('  Marketplace + LLM assistant gated CLOSED.');
process.exit(0);
