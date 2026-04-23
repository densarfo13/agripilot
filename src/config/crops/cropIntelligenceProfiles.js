/**
 * cropIntelligenceProfiles.js — per-canonical-crop traits consumed by
 * the Top Crops recommendation engine and the registry's getCrop()
 * composer.
 *
 * Shape:
 *   CROP_INTELLIGENCE_PROFILES[canonicalKey] = {
 *     difficulty:       'beginner' | 'moderate' | 'advanced',
 *     beginnerFriendly: boolean,
 *     waterNeed:        'low' | 'moderate' | 'high',
 *     droughtTolerance: 'low' | 'moderate' | 'high',
 *     costLevel:        'low' | 'moderate' | 'high',
 *     effortLevel:      'low' | 'moderate' | 'high',
 *     marketPotential:  'low' | 'moderate' | 'high',
 *     cycleRangeWeeks:  [min, max],
 *     bestGoals:        ['home_food' | 'local_sales' | 'profit']
 *     tags:             ['low_water', 'low_cost', 'drought_tolerant', ...],
 *   }
 *
 * All values are rough, conservative heuristics — the engine uses
 * these to score "fit"; it never tells a farmer a crop is the wrong
 * choice. When a crop has no entry here, the engine treats it as
 * `moderate` across the board and surfaces fewer badges.
 *
 * Why a standalone file vs reusing src/data/cropProfiles.js?
 *   cropProfiles.js is keyed by legacy UPPERCASE codes (MAIZE,
 *   SWEET_POTATO, CHILI) and targets the legacy crop-summary screen.
 *   This file uses the canonical hyphen-lowercase ids the new
 *   intelligence engine speaks (maize, sweet-potato, pepper), so the
 *   top-crops engine doesn't have to keep round-tripping codes.
 */

const f = Object.freeze;

function tags(profile) {
  const out = [];
  if (profile.waterNeed === 'low') out.push('low_water');
  if (profile.costLevel === 'low') out.push('low_cost');
  if (profile.droughtTolerance === 'high') out.push('drought_tolerant');
  if (profile.beginnerFriendly) out.push('beginner_friendly');
  if (profile.marketPotential === 'high') out.push('good_market');
  if (profile.effortLevel === 'low') out.push('low_effort');
  return f(out);
}

function build(partial) {
  const p = {
    difficulty:       partial.difficulty       || 'moderate',
    beginnerFriendly: partial.beginnerFriendly ?? (partial.difficulty === 'beginner'),
    waterNeed:        partial.waterNeed        || 'moderate',
    droughtTolerance: partial.droughtTolerance || 'moderate',
    costLevel:        partial.costLevel        || 'moderate',
    effortLevel:      partial.effortLevel      || 'moderate',
    marketPotential:  partial.marketPotential  || 'moderate',
    cycleRangeWeeks:  f(partial.cycleRangeWeeks || [12, 20]),
    bestGoals:        f(partial.bestGoals      || ['home_food', 'local_sales']),
  };
  p.tags = tags(p);
  return f(p);
}

export const CROP_INTELLIGENCE_PROFILES = f({
  // ─── Staples + grains ─────────────────────────────────────────
  maize: build({
    difficulty: 'beginner', waterNeed: 'moderate',
    droughtTolerance: 'low', costLevel: 'low',
    effortLevel: 'moderate', marketPotential: 'moderate',
    cycleRangeWeeks: [10, 16],
    bestGoals: ['home_food', 'local_sales'],
  }),
  rice: build({
    difficulty: 'moderate', waterNeed: 'high',
    droughtTolerance: 'low', costLevel: 'moderate',
    effortLevel: 'high', marketPotential: 'moderate',
    cycleRangeWeeks: [14, 22],
    bestGoals: ['home_food', 'local_sales'],
  }),
  wheat: build({
    difficulty: 'moderate', waterNeed: 'moderate',
    droughtTolerance: 'moderate', costLevel: 'moderate',
    effortLevel: 'moderate', marketPotential: 'moderate',
    cycleRangeWeeks: [16, 22],
    bestGoals: ['home_food', 'local_sales'],
  }),
  sorghum: build({
    difficulty: 'beginner', waterNeed: 'low',
    droughtTolerance: 'high', costLevel: 'low',
    effortLevel: 'low', marketPotential: 'moderate',
    cycleRangeWeeks: [12, 18],
    bestGoals: ['home_food', 'local_sales'],
  }),
  millet: build({
    difficulty: 'beginner', waterNeed: 'low',
    droughtTolerance: 'high', costLevel: 'low',
    effortLevel: 'low', marketPotential: 'low',
    cycleRangeWeeks: [10, 16],
    bestGoals: ['home_food'],
  }),

  // ─── Roots + tubers ───────────────────────────────────────────
  cassava: build({
    difficulty: 'beginner', waterNeed: 'low',
    droughtTolerance: 'high', costLevel: 'low',
    effortLevel: 'low', marketPotential: 'moderate',
    cycleRangeWeeks: [36, 72],
    bestGoals: ['home_food', 'local_sales'],
  }),
  yam: build({
    difficulty: 'moderate', waterNeed: 'moderate',
    droughtTolerance: 'moderate', costLevel: 'moderate',
    effortLevel: 'high', marketPotential: 'moderate',
    cycleRangeWeeks: [32, 52],
    bestGoals: ['home_food', 'local_sales'],
  }),
  potato: build({
    difficulty: 'moderate', waterNeed: 'moderate',
    droughtTolerance: 'low', costLevel: 'moderate',
    effortLevel: 'moderate', marketPotential: 'high',
    cycleRangeWeeks: [12, 18],
    bestGoals: ['local_sales', 'profit'],
  }),
  'sweet-potato': build({
    difficulty: 'beginner', waterNeed: 'low',
    droughtTolerance: 'high', costLevel: 'low',
    effortLevel: 'low', marketPotential: 'moderate',
    cycleRangeWeeks: [12, 20],
    bestGoals: ['home_food', 'local_sales'],
  }),

  // ─── Legumes ──────────────────────────────────────────────────
  beans: build({
    difficulty: 'beginner', waterNeed: 'moderate',
    droughtTolerance: 'moderate', costLevel: 'low',
    effortLevel: 'low', marketPotential: 'moderate',
    cycleRangeWeeks: [8, 14],
    bestGoals: ['home_food', 'local_sales'],
  }),
  soybean: build({
    difficulty: 'moderate', waterNeed: 'moderate',
    droughtTolerance: 'moderate', costLevel: 'moderate',
    effortLevel: 'moderate', marketPotential: 'high',
    cycleRangeWeeks: [14, 20],
    bestGoals: ['local_sales', 'profit'],
  }),
  groundnut: build({
    difficulty: 'beginner', waterNeed: 'low',
    droughtTolerance: 'high', costLevel: 'low',
    effortLevel: 'moderate', marketPotential: 'moderate',
    cycleRangeWeeks: [14, 20],
    bestGoals: ['home_food', 'local_sales'],
  }),
  cowpea: build({
    difficulty: 'beginner', waterNeed: 'low',
    droughtTolerance: 'high', costLevel: 'low',
    effortLevel: 'low', marketPotential: 'low',
    cycleRangeWeeks: [10, 14],
    bestGoals: ['home_food'],
  }),

  // ─── Vegetables ───────────────────────────────────────────────
  tomato: build({
    difficulty: 'moderate', waterNeed: 'high',
    droughtTolerance: 'low', costLevel: 'moderate',
    effortLevel: 'high', marketPotential: 'high',
    cycleRangeWeeks: [10, 16],
    bestGoals: ['local_sales', 'profit'],
  }),
  onion: build({
    difficulty: 'moderate', waterNeed: 'moderate',
    droughtTolerance: 'moderate', costLevel: 'moderate',
    effortLevel: 'moderate', marketPotential: 'high',
    cycleRangeWeeks: [14, 22],
    bestGoals: ['local_sales', 'profit'],
  }),
  pepper: build({
    difficulty: 'moderate', waterNeed: 'moderate',
    droughtTolerance: 'moderate', costLevel: 'moderate',
    effortLevel: 'moderate', marketPotential: 'high',
    cycleRangeWeeks: [14, 22],
    bestGoals: ['local_sales', 'profit'],
  }),
  okra: build({
    difficulty: 'beginner', waterNeed: 'moderate',
    droughtTolerance: 'moderate', costLevel: 'low',
    effortLevel: 'low', marketPotential: 'moderate',
    cycleRangeWeeks: [8, 14],
    bestGoals: ['home_food', 'local_sales'],
  }),
  cabbage: build({
    difficulty: 'moderate', waterNeed: 'high',
    droughtTolerance: 'low', costLevel: 'moderate',
    effortLevel: 'moderate', marketPotential: 'moderate',
    cycleRangeWeeks: [10, 16],
    bestGoals: ['local_sales'],
  }),
  cucumber: build({
    difficulty: 'beginner', waterNeed: 'moderate',
    droughtTolerance: 'low', costLevel: 'low',
    effortLevel: 'low', marketPotential: 'moderate',
    cycleRangeWeeks: [7, 12],
    bestGoals: ['home_food', 'local_sales'],
  }),
  carrot: build({
    difficulty: 'moderate', waterNeed: 'moderate',
    droughtTolerance: 'low', costLevel: 'low',
    effortLevel: 'moderate', marketPotential: 'moderate',
    cycleRangeWeeks: [10, 14],
    bestGoals: ['local_sales'],
  }),
  eggplant: build({
    difficulty: 'moderate', waterNeed: 'moderate',
    droughtTolerance: 'moderate', costLevel: 'low',
    effortLevel: 'moderate', marketPotential: 'moderate',
    cycleRangeWeeks: [12, 18],
    bestGoals: ['home_food', 'local_sales'],
  }),
  watermelon: build({
    difficulty: 'moderate', waterNeed: 'moderate',
    droughtTolerance: 'moderate', costLevel: 'moderate',
    effortLevel: 'moderate', marketPotential: 'high',
    cycleRangeWeeks: [10, 14],
    bestGoals: ['local_sales', 'profit'],
  }),
  spinach: build({
    difficulty: 'beginner', waterNeed: 'moderate',
    droughtTolerance: 'low', costLevel: 'low',
    effortLevel: 'low', marketPotential: 'moderate',
    cycleRangeWeeks: [4, 8],
    bestGoals: ['home_food', 'local_sales'],
  }),
  lettuce: build({
    difficulty: 'beginner', waterNeed: 'moderate',
    droughtTolerance: 'low', costLevel: 'low',
    effortLevel: 'low', marketPotential: 'moderate',
    cycleRangeWeeks: [6, 10],
    bestGoals: ['local_sales'],
  }),

  // ─── Fruit / tree ─────────────────────────────────────────────
  banana: build({
    difficulty: 'moderate', waterNeed: 'moderate',
    droughtTolerance: 'moderate', costLevel: 'moderate',
    effortLevel: 'moderate', marketPotential: 'moderate',
    cycleRangeWeeks: [48, 72],
    bestGoals: ['home_food', 'local_sales'],
  }),
  plantain: build({
    difficulty: 'moderate', waterNeed: 'moderate',
    droughtTolerance: 'moderate', costLevel: 'moderate',
    effortLevel: 'moderate', marketPotential: 'moderate',
    cycleRangeWeeks: [40, 60],
    bestGoals: ['home_food', 'local_sales'],
  }),
  mango: build({
    difficulty: 'advanced', waterNeed: 'moderate',
    droughtTolerance: 'high', costLevel: 'high',
    effortLevel: 'moderate', marketPotential: 'high',
    cycleRangeWeeks: [156, 260],   // 3–5 years to first fruit
    bestGoals: ['profit', 'local_sales'],
  }),
  orange: build({
    difficulty: 'advanced', waterNeed: 'moderate',
    droughtTolerance: 'moderate', costLevel: 'high',
    effortLevel: 'moderate', marketPotential: 'high',
    cycleRangeWeeks: [156, 260],
    bestGoals: ['profit', 'local_sales'],
  }),
  pineapple: build({
    difficulty: 'moderate', waterNeed: 'low',
    droughtTolerance: 'high', costLevel: 'moderate',
    effortLevel: 'moderate', marketPotential: 'high',
    cycleRangeWeeks: [52, 80],
    bestGoals: ['local_sales', 'profit'],
  }),

  // ─── Cash / tree crops ────────────────────────────────────────
  cocoa: build({
    difficulty: 'advanced', waterNeed: 'moderate',
    droughtTolerance: 'low', costLevel: 'high',
    effortLevel: 'high', marketPotential: 'high',
    cycleRangeWeeks: [156, 260],
    bestGoals: ['profit'],
  }),
  coffee: build({
    difficulty: 'advanced', waterNeed: 'moderate',
    droughtTolerance: 'moderate', costLevel: 'high',
    effortLevel: 'high', marketPotential: 'high',
    cycleRangeWeeks: [156, 260],
    bestGoals: ['profit'],
  }),
  cotton: build({
    difficulty: 'moderate', waterNeed: 'moderate',
    droughtTolerance: 'moderate', costLevel: 'moderate',
    effortLevel: 'moderate', marketPotential: 'moderate',
    cycleRangeWeeks: [20, 28],
    bestGoals: ['profit'],
  }),
  sugarcane: build({
    difficulty: 'advanced', waterNeed: 'high',
    droughtTolerance: 'low', costLevel: 'high',
    effortLevel: 'high', marketPotential: 'high',
    cycleRangeWeeks: [48, 72],
    bestGoals: ['profit'],
  }),
  'oil-palm': build({
    difficulty: 'advanced', waterNeed: 'moderate',
    droughtTolerance: 'moderate', costLevel: 'high',
    effortLevel: 'high', marketPotential: 'high',
    cycleRangeWeeks: [208, 312],
    bestGoals: ['profit'],
  }),
});

/**
 * getCropIntelligenceProfile(canonicalKey) — returns the frozen
 * profile or a neutral fallback when the crop has no entry. The
 * fallback returns `beginnerFriendly: false` with moderate
 * everything so the engine won't promote an unknown crop.
 */
export function getCropIntelligenceProfile(canonicalKey) {
  if (!canonicalKey) return FALLBACK_PROFILE;
  return CROP_INTELLIGENCE_PROFILES[canonicalKey] || FALLBACK_PROFILE;
}

const FALLBACK_PROFILE = build({
  difficulty:      'moderate',
  beginnerFriendly: false,
  waterNeed:       'moderate',
  droughtTolerance: 'moderate',
  costLevel:       'moderate',
  effortLevel:     'moderate',
  marketPotential: 'moderate',
  cycleRangeWeeks: [12, 20],
  bestGoals:       ['home_food'],
});

export { FALLBACK_PROFILE };
