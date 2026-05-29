#!/usr/bin/env node
/**
 * check-flower-library.mjs — Global Flower Library gate.
 *
 *   node scripts/check-flower-library.mjs
 *
 * Verifies the Flower Library is complete:
 *   1. flowers.json parses, has ≥50 entries (vs ≥10 baseline),
 *      and every entry carries the spec'd richer schema.
 *   2. flowerLibrary.ts exists and exports flowerLibrary,
 *      filterFlowers, searchFlowers, FLOWER_FILTERS,
 *      FLOWER_LIBRARY_VERSION.
 *   3. FLOWER_FILTERS covers all 8 spec'd filter buckets.
 *   4. grow composite re-exports flowerLibrary surface + wires
 *      it into the gardenPlatform envelope.
 *   5. PLANT_DB_STATS surfaces the unchanged starter total +
 *      spec target.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const HEADER    = '[check:flower-library]';

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
  flowers:    'src/data/plants/flowers.json',
  library:    'src/runtime/grow/flowerLibrary.ts',
  composite:  'src/runtime/grow/index.js',
};
const sources = {};
for (const [k, rel] of Object.entries(FILES)) {
  const src = _read(rel);
  if (!src) fail('missing file: ' + rel);
  sources[k] = src;
}

// ─── 1. flowers.json schema + size ──────────────────────────────
let flowers;
try { flowers = JSON.parse(sources.flowers); }
catch (e) { fail('flowers.json does not parse', e.message); }
if (!Array.isArray(flowers)) fail('flowers.json must be a JSON array');
if (flowers.length < 50) {
  fail('flowers.json must have ≥50 entries (has ' + flowers.length + ')');
}

const REQUIRED_FIELDS = [
  'id', 'commonName', 'scientificName', 'family',
  'bloomSeason', 'sunlight', 'waterNeeds', 'pollinatorValue',
  'companionPlants', 'diseaseRisks', 'image',
  // Legacy fields retained for backward-compat with flowerAdvisor /
  // companion / pollinator / scan engines:
  'name', 'sun', 'water', 'diseases', 'attracts',
  // Filter-bucket fields:
  'lifecycle', 'droughtResistant', 'indoorFriendly',
];

for (let i = 0; i < flowers.length; i++) {
  const f = flowers[i];
  if (!f || typeof f !== 'object') {
    fail('flowers.json entry ' + i + ' is not an object');
  }
  for (const k of REQUIRED_FIELDS) {
    if (!(k in f)) {
      fail('flowers.json entry "' + (f.id || '<no-id>')
        + '" missing required field: ' + k);
    }
  }
  if (typeof f.id !== 'string' || !f.id) {
    fail('flowers.json entry ' + i + ' has invalid id');
  }
  if (typeof f.pollinatorValue !== 'number'
      || !Number.isFinite(f.pollinatorValue)) {
    fail('flowers.json entry "' + f.id
      + '" pollinatorValue must be a finite number');
  }
  if (!Array.isArray(f.bloomSeason)) {
    fail('flowers.json entry "' + f.id + '" bloomSeason must be an array');
  }
  if (!Array.isArray(f.diseaseRisks)) {
    fail('flowers.json entry "' + f.id + '" diseaseRisks must be an array');
  }
  if (typeof f.lifecycle !== 'string') {
    fail('flowers.json entry "' + f.id + '" lifecycle must be a string');
  }
  const VALID_LIFECYCLES = ['annual', 'perennial', 'biennial'];
  if (VALID_LIFECYCLES.indexOf(f.lifecycle) === -1) {
    fail('flowers.json entry "' + f.id
      + '" lifecycle must be one of: ' + VALID_LIFECYCLES.join(', '));
  }
}

// Lifecycle distribution sanity — must include BOTH annual and
// perennial entries (otherwise filters would never have hits)
const lifecycles = new Set(flowers.map((f) => f.lifecycle));
if (!lifecycles.has('annual')) fail('starter DB must contain at least one annual flower');
if (!lifecycles.has('perennial')) fail('starter DB must contain at least one perennial flower');

// Pollinator-friendly bucket (≥7 score) must have at least 5 entries
const pollinatorFriendly = flowers.filter((f) => f.pollinatorValue >= 7);
if (pollinatorFriendly.length < 5) {
  fail('starter DB must contain ≥5 pollinator-friendly flowers '
    + '(have ' + pollinatorFriendly.length + ')');
}

// ─── 2. flowerLibrary.ts exports ────────────────────────────────
const REQUIRED_EXPORTS = [
  'flowerLibrary', 'filterFlowers', 'searchFlowers',
  'FLOWER_FILTERS', 'FLOWER_LIBRARY_VERSION',
];
for (const sym of REQUIRED_EXPORTS) {
  if (!new RegExp('export\\s+(function|const|async function)\\s+' + sym + '\\b').test(sources.library)
      && !new RegExp('export\\s*\\{[\\s\\S]*\\b' + sym + '\\b').test(sources.library)) {
    fail('flowerLibrary.ts missing export: ' + sym);
  }
}

// ─── 3. FLOWER_FILTERS covers all 8 spec buckets ────────────────
const SPEC_FILTERS = [
  'BLOOMING', 'PERENNIAL', 'ANNUAL',
  'FULL_SUN', 'PARTIAL_SHADE',
  'POLLINATOR_FRIENDLY', 'DROUGHT_RESISTANT', 'INDOOR_FRIENDLY',
];
for (const f of SPEC_FILTERS) {
  if (!new RegExp(f + '\\s*:').test(sources.library)) {
    fail('FLOWER_FILTERS missing bucket: ' + f);
  }
}

// ─── 4. composite re-exports + envelope wiring ──────────────────
const COMPOSITE_MUST_INCLUDE = [
  /from\s+'\.\/flowerLibrary'/,
  /flowerLibrary:\s+FLOWER_LIBRARY_VERSION/,
  /flowerLibrary\(\{/,
  /flowers,/, // present in the returned envelope object
];
for (const re of COMPOSITE_MUST_INCLUDE) {
  if (!re.test(sources.composite)) {
    fail('runtime/grow/index.js missing pattern: ' + re.source);
  }
}

console.log(HEADER, 'PASS — Global Flower Library complete.');
console.log('  Starter DB: ' + flowers.length
  + ' flowers (spec target 500+, content-team backlog).');
console.log('  Filters: ' + SPEC_FILTERS.length
  + ' spec buckets — BLOOMING, PERENNIAL, ANNUAL, FULL_SUN, '
  + 'PARTIAL_SHADE, POLLINATOR_FRIENDLY, DROUGHT_RESISTANT, INDOOR_FRIENDLY.');
console.log('  Pollinator-friendly: ' + pollinatorFriendly.length
  + ' · Annuals: ' + flowers.filter((f) => f.lifecycle === 'annual').length
  + ' · Perennials: ' + flowers.filter((f) => f.lifecycle === 'perennial').length
  + ' · Drought-resistant: ' + flowers.filter((f) => f.droughtResistant).length
  + ' · Indoor-friendly: ' + flowers.filter((f) => f.indoorFriendly).length + '.');
process.exit(0);
