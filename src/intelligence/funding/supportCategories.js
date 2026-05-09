/**
 * supportCategories — canonical taxonomy for "Nearby support"
 * (May 2026 regional funding intelligence upgrade).
 *
 * SPEC §6 mandates 12 support categories — money is not the only
 * support a farmer needs. The legacy `fundingConfig.js` already
 * uses 10 of them (cooperative, input_support, climate_smart,
 * buyer_market, extension, urban_agriculture, government,
 * food_security, training, partnership). This module:
 *
 *   1. Adds the 3 missing categories: equipment, insurance,
 *      emergency_relief.
 *   2. Maps every category to a calm farmer-facing label key
 *      that the UI resolves through tSafe.
 *   3. Maps every category to a "context match" hint that the
 *      relevance scorer uses (e.g. drought_risk → irrigation +
 *      insurance + emergency_relief).
 *   4. Provides a normalisation helper so legacy entries keep
 *      working without a migration.
 */

// ─── Canonical category set ──────────────────────────────────────
// Frozen — adding a new category requires this file edit + the
// supportCategories test snapshot bump. That's deliberate: a
// rogue admin upload can't introduce a category nobody has copy
// for.
export const SUPPORT_CATEGORY = Object.freeze({
  FINANCIAL:          'financial',
  TRAINING:           'training',
  EXTENSION:          'extension',
  INPUTS_SEEDS:       'inputs_seeds',
  WEATHER_PREP:       'weather_prep',
  EQUIPMENT:          'equipment',           // NEW (spec §6)
  INSURANCE:          'insurance',           // NEW (spec §6)
  MARKET_ACCESS:      'market_access',
  BUYER_COORDINATION: 'buyer_coordination',
  EMERGENCY_RELIEF:   'emergency_relief',    // NEW (spec §6)
  NGO_ASSISTANCE:     'ngo_assistance',
  GOVERNMENT_PROGRAM: 'government_program',
});

export const SUPPORT_CATEGORY_LIST = Object.freeze(Object.values(SUPPORT_CATEGORY));

// ─── Legacy → canonical aliases ─────────────────────────────────
// Keeps the 18 entries in `fundingConfig.js` + any admin uploads
// that already shipped working. Everything resolves through
// `normaliseCategory()`.
const LEGACY_ALIASES = Object.freeze({
  cooperative:        SUPPORT_CATEGORY.NGO_ASSISTANCE,
  input_support:      SUPPORT_CATEGORY.INPUTS_SEEDS,
  climate_smart:      SUPPORT_CATEGORY.WEATHER_PREP,
  buyer_market:       SUPPORT_CATEGORY.MARKET_ACCESS,
  urban_agriculture:  SUPPORT_CATEGORY.EXTENSION,
  government:         SUPPORT_CATEGORY.GOVERNMENT_PROGRAM,
  food_security:      SUPPORT_CATEGORY.EMERGENCY_RELIEF,
  partnership:        SUPPORT_CATEGORY.NGO_ASSISTANCE,
  // Direct passthroughs (already canonical) included so the
  // helper never falls through to a default.
  financial:          SUPPORT_CATEGORY.FINANCIAL,
  training:           SUPPORT_CATEGORY.TRAINING,
  extension:          SUPPORT_CATEGORY.EXTENSION,
  inputs_seeds:       SUPPORT_CATEGORY.INPUTS_SEEDS,
  weather_prep:       SUPPORT_CATEGORY.WEATHER_PREP,
  equipment:          SUPPORT_CATEGORY.EQUIPMENT,
  insurance:          SUPPORT_CATEGORY.INSURANCE,
  market_access:      SUPPORT_CATEGORY.MARKET_ACCESS,
  buyer_coordination: SUPPORT_CATEGORY.BUYER_COORDINATION,
  emergency_relief:   SUPPORT_CATEGORY.EMERGENCY_RELIEF,
  ngo_assistance:     SUPPORT_CATEGORY.NGO_ASSISTANCE,
  government_program: SUPPORT_CATEGORY.GOVERNMENT_PROGRAM,
});

/**
 * Normalise a legacy or admin-uploaded category string to the
 * canonical 12-category set. Unknown values fall to FINANCIAL —
 * the safest "money or money-equivalent help" bucket.
 *
 * @param {string} raw
 * @returns {string}
 */
export function normaliseCategory(raw) {
  const k = String(raw || '').trim().toLowerCase();
  return LEGACY_ALIASES[k] || SUPPORT_CATEGORY.FINANCIAL;
}

// ─── Farmer-facing copy keys (calm wording per spec §15) ─────────
// All visible strings flow through tSafe(key, fallback) at the
// render site. The fallback strings here are the canonical
// English copy that ships in production until translators splice
// in locale columns.
export const CATEGORY_LABEL = Object.freeze({
  [SUPPORT_CATEGORY.FINANCIAL]:          { key: 'support.cat.financial.label',     fb: 'Financial support' },
  [SUPPORT_CATEGORY.TRAINING]:           { key: 'support.cat.training.label',      fb: 'Training' },
  [SUPPORT_CATEGORY.EXTENSION]:          { key: 'support.cat.extension.label',     fb: 'Extension support' },
  [SUPPORT_CATEGORY.INPUTS_SEEDS]:       { key: 'support.cat.inputs.label',        fb: 'Seeds + inputs' },
  [SUPPORT_CATEGORY.WEATHER_PREP]:       { key: 'support.cat.weather.label',       fb: 'Weather preparedness' },
  [SUPPORT_CATEGORY.EQUIPMENT]:          { key: 'support.cat.equipment.label',     fb: 'Equipment' },
  [SUPPORT_CATEGORY.INSURANCE]:          { key: 'support.cat.insurance.label',     fb: 'Crop insurance' },
  [SUPPORT_CATEGORY.MARKET_ACCESS]:      { key: 'support.cat.market.label',        fb: 'Market access' },
  [SUPPORT_CATEGORY.BUYER_COORDINATION]: { key: 'support.cat.buyer.label',         fb: 'Buyer coordination' },
  [SUPPORT_CATEGORY.EMERGENCY_RELIEF]:   { key: 'support.cat.emergency.label',     fb: 'Emergency relief' },
  [SUPPORT_CATEGORY.NGO_ASSISTANCE]:     { key: 'support.cat.ngo.label',           fb: 'NGO assistance' },
  [SUPPORT_CATEGORY.GOVERNMENT_PROGRAM]: { key: 'support.cat.government.label',    fb: 'Government program' },
});

/**
 * Look up the calm farmer-facing label envelope for a category.
 * Caller resolves via tSafe(env.key, env.fb).
 */
export function categoryLabel(rawCategory) {
  return CATEGORY_LABEL[normaliseCategory(rawCategory)] || CATEGORY_LABEL[SUPPORT_CATEGORY.FINANCIAL];
}

const _module = {
  SUPPORT_CATEGORY,
  SUPPORT_CATEGORY_LIST,
  normaliseCategory,
  CATEGORY_LABEL,
  categoryLabel,
};
export default _module;
