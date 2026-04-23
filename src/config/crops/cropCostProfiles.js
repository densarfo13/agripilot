/**
 * cropCostProfiles.js — conservative per-m² cost bands in USD.
 *
 * Shape:
 *   CROP_COST_PROFILES[canonicalKey] = {
 *     baseCostPerSqmLow:  number,   // USD / m² / cycle
 *     baseCostPerSqmHigh: number,   // USD / m² / cycle
 *     notes?:             string,
 *   }
 *
 * The profit engine uses these bands the same way the value engine
 * uses price bands: lowProfit = lowValue − highCost, highProfit =
 * highValue − lowCost. Costs stay in USD and get converted at display
 * time via the existing currenciesByCountry helpers — the farmer sees
 * whichever currency they already transact in for price/value.
 *
 * Numbers are intentionally coarse and lean toward the higher end so
 * the engine under-promises profit. Categories of cost rolled in:
 *   - seed / cuttings / grafts
 *   - a single fertiliser top-dress (unless the crop really needs more)
 *   - basic manual labour + tool depreciation
 *   - a modest loss allowance (5–10%)
 *
 * Country-level overrides aren't modelled in v1 — the numbers are
 * conservative enough that country dispersion is absorbed into the
 * wide low/high band. Adding per-country rows later is additive.
 */

const f = Object.freeze;

function cost({ low, high, notes }) {
  return f({
    baseCostPerSqmLow:  low,
    baseCostPerSqmHigh: high,
    currency:           'USD',
    notes:              notes || null,
  });
}

export const GENERIC_COST_PROFILE = cost({
  low: 0.05, high: 0.15,
  notes: 'Generic fallback — use when crop has no catalogued cost.',
});

export const CROP_COST_PROFILES = f({
  // ─── Staples + grains ────────────────────────────────────────
  maize:          cost({ low: 0.04, high: 0.10 }),
  rice:           cost({ low: 0.06, high: 0.14 }),
  wheat:          cost({ low: 0.05, high: 0.12 }),
  sorghum:        cost({ low: 0.03, high: 0.08 }),
  millet:         cost({ low: 0.03, high: 0.07 }),

  // ─── Roots + tubers ──────────────────────────────────────────
  cassava:        cost({ low: 0.03, high: 0.07 }),
  yam:            cost({ low: 0.06, high: 0.18 }),
  potato:         cost({ low: 0.08, high: 0.22 }),
  'sweet-potato': cost({ low: 0.03, high: 0.08 }),

  // ─── Legumes ─────────────────────────────────────────────────
  beans:          cost({ low: 0.04, high: 0.10 }),
  soybean:        cost({ low: 0.05, high: 0.12 }),
  groundnut:      cost({ low: 0.05, high: 0.12 }),
  cowpea:         cost({ low: 0.03, high: 0.08 }),

  // ─── Vegetables ──────────────────────────────────────────────
  tomato:         cost({ low: 0.12, high: 0.35 }),
  onion:          cost({ low: 0.10, high: 0.28 }),
  pepper:         cost({ low: 0.10, high: 0.28 }),
  okra:           cost({ low: 0.05, high: 0.14 }),
  cabbage:        cost({ low: 0.08, high: 0.22 }),
  cucumber:       cost({ low: 0.08, high: 0.22 }),
  carrot:         cost({ low: 0.07, high: 0.18 }),
  eggplant:       cost({ low: 0.07, high: 0.18 }),
  watermelon:     cost({ low: 0.06, high: 0.16 }),
  spinach:        cost({ low: 0.05, high: 0.14 }),
  lettuce:        cost({ low: 0.05, high: 0.14 }),
  garlic:         cost({ low: 0.12, high: 0.30 }),
  ginger:         cost({ low: 0.12, high: 0.30 }),

  // ─── Fruit / tree ────────────────────────────────────────────
  banana:         cost({ low: 0.05, high: 0.14 }),
  plantain:       cost({ low: 0.05, high: 0.14 }),
  mango:          cost({ low: 0.04, high: 0.12,
                          notes: 'Annualised after establishment.' }),
  orange:         cost({ low: 0.05, high: 0.14 }),
  pineapple:      cost({ low: 0.08, high: 0.22 }),
  avocado:        cost({ low: 0.05, high: 0.15 }),

  // ─── Cash / tree crops ───────────────────────────────────────
  cocoa:          cost({ low: 0.04, high: 0.12,
                          notes: 'Per year once established.' }),
  coffee:         cost({ low: 0.05, high: 0.15 }),
  cotton:         cost({ low: 0.06, high: 0.16 }),
  sugarcane:      cost({ low: 0.05, high: 0.14 }),
  'oil-palm':     cost({ low: 0.05, high: 0.15 }),
  sunflower:      cost({ low: 0.04, high: 0.10 }),
  sesame:         cost({ low: 0.03, high: 0.08 }),
  tea:            cost({ low: 0.05, high: 0.15 }),
});

/**
 * getCropCostProfile(canonicalKey) — frozen profile, falling back to
 * GENERIC_COST_PROFILE so callers can always destructure.
 */
export function getCropCostProfile(canonicalKey) {
  if (!canonicalKey) return GENERIC_COST_PROFILE;
  return CROP_COST_PROFILES[canonicalKey] || GENERIC_COST_PROFILE;
}

export function hasCropCostProfile(canonicalKey) {
  return Boolean(canonicalKey && CROP_COST_PROFILES[canonicalKey]);
}

export const _internal = f({ CROP_COST_PROFILES, GENERIC_COST_PROFILE });
