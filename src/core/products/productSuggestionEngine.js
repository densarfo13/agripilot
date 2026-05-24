/**
 * productSuggestionEngine.js — context-aware product CATEGORY
 * suggestions (never exact chemical prescriptions).
 *
 *   import { suggestProducts, PRODUCT_CATEGORY }
 *     from 'src/core/products/productSuggestionEngine.js';
 *
 *   const s = suggestProducts({
 *     crop: 'tomato', stage: 'planting',
 *     weather: { daysSinceRain: 8 },
 *     scan: { issueCategory: 'water_stress' },
 *     mode: 'simple', experience: 'simple',
 *   });
 *   // s.items      → [{ category, reason, restricted, urgency }]
 *   // s.disclaimer → { key, fallback } | null   (when restricted item is present)
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A safety-conscious helper that converts the intelligence
 *   snapshot (crop / lifecycle stage / weather / scan) into a
 *   short list of helpful product CATEGORIES the farmer might
 *   need today.
 *
 *   It NEVER prescribes a specific chemical, NEVER guarantees
 *   results, and ALWAYS gates restricted categories
 *   (pesticides / herbicides / fungicides / chemical fertilizers)
 *   behind an explicit consult-an-expert disclaimer.
 *
 *   Simple mode caps the list at 2 items with plain wording.
 *   Standard mode allows up to 4 with the "why" reason attached.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe. Every text envelope is
 *     `{ key, fallback, params }`.
 */

import { RESTRICTED_DISCLAIMER } from '../suppliers/supplierTrustRules.js';

export const PRODUCT_CATEGORY = Object.freeze({
  // Allowed — show freely.
  SEEDS:           'seeds',
  SEEDLINGS:       'seedlings',
  COMPOST:         'compost',
  MULCH:           'mulch',
  ORGANIC_MATTER:  'organic_matter',
  WATERING_TOOLS:  'watering_tools',
  PRUNING_TOOLS:   'pruning_tools',
  STAKES:          'stakes',
  SUPPORT_TIES:    'support_ties',
  HARVEST_BASKETS: 'harvest_baskets',
  SOIL_TEST_KITS:  'soil_test_kits',
  GLOVES:          'gloves',
  POTS_TRAYS:      'pots_trays',
  DRIP_SUPPLIES:   'drip_supplies',
  // Restricted — surfaced ONLY behind the disclaimer envelope.
  PESTICIDES:      'pesticides',
  HERBICIDES:      'herbicides',
  FUNGICIDES:      'fungicides',
  CHEMICAL_FERT:   'chemical_fertilizers',
});

const _RESTRICTED = new Set([
  PRODUCT_CATEGORY.PESTICIDES,
  PRODUCT_CATEGORY.HERBICIDES,
  PRODUCT_CATEGORY.FUNGICIDES,
  PRODUCT_CATEGORY.CHEMICAL_FERT,
]);

const _str = (v) => String(v == null ? '' : v).toLowerCase();
function _msg(key, fallback, params) {
  return { key, fallback, params: (params && typeof params === 'object') ? { ...params } : {} };
}

// ─── Rule definitions ────────────────────────────────────
//
// Each rule returns 0+ items. The composer dedupes by category
// (first wins) and ranks by urgency.

function _ruleByStage(stage, crop) {
  const out = [];
  switch (_str(stage)) {
    case 'planning':
    case 'planting':
      out.push({ category: PRODUCT_CATEGORY.SEEDS,        reason: _msg('product.reason.starting', 'Starting a new planting today.') });
      out.push({ category: PRODUCT_CATEGORY.COMPOST,      reason: _msg('product.reason.improveSoil', 'Compost helps young plants set roots.') });
      out.push({ category: PRODUCT_CATEGORY.WATERING_TOOLS, reason: _msg('product.reason.firstWater', 'New plantings need steady watering.') });
      break;
    case 'germination':
    case 'seedling':
      out.push({ category: PRODUCT_CATEGORY.POTS_TRAYS,    reason: _msg('product.reason.seedlingShelter', 'Seedlings do best in shelter.') });
      out.push({ category: PRODUCT_CATEGORY.ORGANIC_MATTER, reason: _msg('product.reason.gentleNutrients', 'Gentle organic matter feeds young roots.') });
      break;
    case 'vegetative':
      out.push({ category: PRODUCT_CATEGORY.STAKES,        reason: _msg('product.reason.supportGrowth', 'Stakes keep plants upright as they grow.') });
      out.push({ category: PRODUCT_CATEGORY.MULCH,         reason: _msg('product.reason.mulchHelps', 'Mulch holds moisture and cools the soil.') });
      break;
    case 'flowering':
    case 'fruiting':
      out.push({ category: PRODUCT_CATEGORY.SUPPORT_TIES,  reason: _msg('product.reason.fruitWeight', 'Ties keep branches steady as fruit forms.') });
      out.push({ category: PRODUCT_CATEGORY.MULCH,         reason: _msg('product.reason.steadyMoisture', 'Steady moisture helps even fruit set.') });
      break;
    case 'harvest_ready':
    case 'harvest':
      out.push({ category: PRODUCT_CATEGORY.HARVEST_BASKETS, reason: _msg('product.reason.harvestPrep', 'Clean baskets keep harvest safe.') });
      out.push({ category: PRODUCT_CATEGORY.GLOVES,          reason: _msg('product.reason.harvestGloves', 'Gloves protect your hands during harvest.') });
      break;
    case 'post_harvest':
      out.push({ category: PRODUCT_CATEGORY.COMPOST,         reason: _msg('product.reason.soilRecovery', 'Compost helps the soil recover for the next season.') });
      break;
    default: break;
  }
  if (_str(crop) === 'tomato' && (_str(stage) === 'fruiting' || _str(stage) === 'flowering')) {
    out.push({ category: PRODUCT_CATEGORY.PRUNING_TOOLS, reason: _msg('product.reason.tomatoPrune', 'Pruning helps airflow and fruit size.') });
  }
  return out;
}

function _ruleByWeather(weather) {
  const out = [];
  if (!weather || typeof weather !== 'object') return out;
  const days = Number(weather.daysSinceRain);
  if (Number.isFinite(days) && days >= 7) {
    out.push({ category: PRODUCT_CATEGORY.MULCH,           reason: _msg('product.reason.drySpell', 'A dry spell is making the soil work harder.'), urgency: 'high' });
    out.push({ category: PRODUCT_CATEGORY.DRIP_SUPPLIES,   reason: _msg('product.reason.dripEfficient', 'Drip lines use less water during dry weeks.') });
  }
  const temp = Number(weather.temperatureC);
  if (Number.isFinite(temp) && temp >= 32) {
    out.push({ category: PRODUCT_CATEGORY.WATERING_TOOLS,  reason: _msg('product.reason.heatWater', 'Hot weather means more frequent watering.') });
  }
  return out;
}

function _ruleByScan(scan) {
  const out = [];
  if (!scan || typeof scan !== 'object') return out;
  const cat = _str(scan.issueCategory);
  switch (cat) {
    case 'water_stress':
      out.push({ category: PRODUCT_CATEGORY.WATERING_TOOLS, reason: _msg('product.reason.scanThirsty', 'Plants look thirsty — steady watering helps.') });
      out.push({ category: PRODUCT_CATEGORY.MULCH,          reason: _msg('product.reason.scanMulch',   'Mulch keeps soil moisture more even.') });
      break;
    case 'nutrient_stress':
      out.push({ category: PRODUCT_CATEGORY.COMPOST,        reason: _msg('product.reason.scanCompost', 'Compost can support plants showing weak growth.') });
      out.push({ category: PRODUCT_CATEGORY.SOIL_TEST_KITS, reason: _msg('product.reason.scanTestSoil', 'A soil test can show what the soil is missing.') });
      break;
    case 'fungal_risk':
      // Restricted category gated by the disclaimer.
      out.push({ category: PRODUCT_CATEGORY.FUNGICIDES,     reason: _msg('product.reason.scanFungalConsult', 'Fungal symptoms — talk to a local expert first.'), urgency: 'high' });
      break;
    case 'pest_damage':
      out.push({ category: PRODUCT_CATEGORY.PESTICIDES,     reason: _msg('product.reason.scanPestConsult', 'Pest damage — talk to a local expert before treating.'), urgency: 'high' });
      break;
    default: break;
  }
  return out;
}

function _dedupe(items, cap) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!it || !it.category || seen.has(it.category)) continue;
    seen.add(it.category);
    out.push({
      category:   it.category,
      reason:     it.reason || null,
      restricted: _RESTRICTED.has(it.category),
      urgency:    it.urgency || 'normal',
    });
    if (out.length >= cap) break;
  }
  return out;
}

/**
 * Suggest products for the current context.
 *
 * @param {object} ctx
 * @returns {{ items: Array, disclaimer: object|null, mode: string }}
 */
export function suggestProducts(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const mode = _str(c.mode) === 'standard' ? 'standard' : 'simple';
    const cap  = mode === 'standard' ? 4 : 2;

    const all = []
      .concat(_ruleByStage(c.stage, c.crop))
      .concat(_ruleByWeather(c.weather))
      .concat(_ruleByScan(c.scan));

    // Rank: high-urgency first, then weather (most actionable
    // right now), then stage, then scan — but dedupe so the same
    // category never appears twice.
    all.sort((a, b) => {
      const _rank = (it) => it.urgency === 'high' ? 0 : 1;
      return _rank(a) - _rank(b);
    });

    const items = _dedupe(all, cap);
    const hasRestricted = items.some((i) => i.restricted);

    return {
      mode,
      items,
      disclaimer: hasRestricted ? { ...RESTRICTED_DISCLAIMER } : null,
    };
  } catch {
    return { mode: 'simple', items: [], disclaimer: null };
  }
}

const _module = { PRODUCT_CATEGORY, suggestProducts };
export default _module;
