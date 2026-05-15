/**
 * canonicalCropMap.js — the canonical crop TAXONOMY.
 *
 *   import {
 *     CANONICAL_CROPS, normalizeCropId, getCanonicalCrop,
 *     isKnownCrop, listCanonicalCropIds,
 *   } from 'src/core/agriculture/canonicalCropMap.js';
 *
 *   normalizeCropId('Corn')      // → 'maize'
 *   normalizeCropId('chilli')    // → 'pepper'
 *   getCanonicalCrop('yuca')     // → the cassava entry
 *
 * What this is — and is NOT
 * ─────────────────────────
 *   This is the crop TAXONOMY layer: the canonical id, the aliases
 *   that all normalise to it, the marketplace category, the scan
 *   categories a scan of that crop can yield, and the generic
 *   growth stages. It is the single place "what crop is this, by
 *   any name" is answered, so no screen has to carry its own crop
 *   alias logic.
 *
 *   It deliberately does NOT carry localized crop NAMES — those
 *   already live in src/i18n/cropNames.js and are reached through
 *   agricultureRegistry.getCropLabel(id, language). Embedding names
 *   here would duplicate that registry. Taxonomy here, names there.
 *
 *   Regional suitability likewise stays in config/regionConfig.js
 *   (getRegionCrops) — this map does not restate it.
 *
 * Strict-rule audit
 *   • Pure data + pure lookup functions. No I/O, no React, SSR-safe.
 *   • Frozen exports. Never throws.
 */

// Generic scan outcome categories. The rule-based scan engine
// classifies into these regardless of crop; a crop entry may
// narrow them later if a crop-specific scan model is added.
const DEFAULT_SCAN_CATEGORIES = Object.freeze([
  'healthy', 'disease', 'pest', 'fungal', 'nutrient_deficiency',
]);

// Generic growth stages used by the task/stage engine. Crops with
// a distinct lifecycle can be given an explicit `stages` later.
const DEFAULT_STAGES = Object.freeze([
  'seedling', 'vegetative', 'flowering', 'maturity', 'harvest',
]);

// [ canonical id, marketplace category, aliases[] ]
// `maize` is canonical; `corn` is one of its aliases (same plant).
const _DEFS = [
  ['pepper',       'vegetable', ['chilli', 'chili', 'capsicum', 'bell pepper', 'hot pepper', 'peppers']],
  ['tomato',       'vegetable', ['tomatoes']],
  ['maize',        'grain',     ['corn', 'maize corn', 'sweetcorn']],
  ['cassava',      'root',      ['manioc', 'yuca', 'yucca', 'tapioca']],
  ['rice',         'grain',     ['paddy', 'paddy rice']],
  ['okra',         'vegetable', ['lady finger', 'ladyfinger', 'gumbo', 'okro']],
  ['onion',        'vegetable', ['onions', 'shallot', 'shallots']],
  ['lettuce',      'vegetable', ['lettuces']],
  ['cabbage',      'vegetable', ['cabbages']],
  ['cucumber',     'vegetable', ['cucumbers']],
  ['carrot',       'vegetable', ['carrots']],
  ['potato',       'root',      ['potatoes', 'irish potato']],
  ['sweet_potato', 'root',      ['sweet potato', 'sweetpotato', 'kumara']],
  ['banana',       'fruit',     ['bananas', 'plantain', 'plantains']],
  ['mango',        'fruit',     ['mangoes', 'mangos']],
  ['avocado',      'fruit',     ['avocados', 'avocado pear']],
  ['citrus',       'fruit',     ['orange', 'oranges', 'lemon', 'lime', 'grapefruit', 'tangerine']],
  ['beans',        'legume',    ['bean', 'common bean', 'green beans', 'cowpea']],
  ['soybean',      'legume',    ['soya', 'soybeans', 'soy', 'soya bean']],
  ['wheat',        'grain',     ['wheats']],
  ['spinach',      'vegetable', ['spinaches']],
  ['herbs',        'herb',      ['herb', 'basil', 'mint', 'coriander', 'cilantro', 'parsley', 'thyme']],
];

/** The frozen canonical crop registry, keyed by canonical id. */
export const CANONICAL_CROPS = Object.freeze(_DEFS.reduce((acc, [id, market, aliases]) => {
  acc[id] = Object.freeze({
    id,
    aliases:             Object.freeze([...aliases]),
    marketplaceCategory: market,
    scanCategories:      DEFAULT_SCAN_CATEGORIES,
    stages:              DEFAULT_STAGES,
  });
  return acc;
}, {}));

/** Spelling-tolerant lookup keys: id, alias, and their space/under-
 *  score variants → canonical id. Built once at module load. */
const _LOOKUP = (() => {
  const map = {};
  const add = (token, id) => {
    if (typeof token !== 'string') return;
    const t = token.trim().toLowerCase();
    if (!t) return;
    map[t] = id;
    map[t.replace(/_/g, ' ')] = id;
    map[t.replace(/\s+/g, '_')] = id;
    map[t.replace(/[\s_]+/g, '')] = id;
  };
  for (const [id, , aliases] of _DEFS) {
    add(id, id);
    for (const a of aliases) add(a, id);
  }
  return Object.freeze(map);
})();

/**
 * Resolve any crop string — a canonical id, an alias, a plural, a
 * different spelling — to its canonical id. Returns null when the
 * input matches no known crop. Pure, never throws.
 *
 * @param {string} input
 * @returns {?string} canonical crop id
 */
export function normalizeCropId(input) {
  try {
    if (typeof input !== 'string') return null;
    const raw = input.trim().toLowerCase();
    if (!raw) return null;
    return _LOOKUP[raw]
        || _LOOKUP[raw.replace(/_/g, ' ')]
        || _LOOKUP[raw.replace(/\s+/g, '_')]
        || _LOOKUP[raw.replace(/[\s_]+/g, '')]
        || null;
  } catch {
    return null;
  }
}

/** The canonical crop entry for any crop string, or null. */
export function getCanonicalCrop(input) {
  const id = normalizeCropId(input);
  return id ? CANONICAL_CROPS[id] : null;
}

/** Whether a crop string resolves to a known canonical crop. */
export function isKnownCrop(input) {
  return normalizeCropId(input) !== null;
}

/** Every canonical crop id. */
export function listCanonicalCropIds() {
  return Object.keys(CANONICAL_CROPS);
}

/** Marketplace category for any crop string ('vegetable' | 'grain'
 *  | 'root' | 'fruit' | 'legume' | 'herb'), or null. */
export function getCropMarketplaceCategory(input) {
  const crop = getCanonicalCrop(input);
  return crop ? crop.marketplaceCategory : null;
}

const _module = {
  CANONICAL_CROPS,
  normalizeCropId,
  getCanonicalCrop,
  isKnownCrop,
  listCanonicalCropIds,
  getCropMarketplaceCategory,
};
export default _module;
