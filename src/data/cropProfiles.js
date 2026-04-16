/**
 * Crop Profiles — structured data for beginner crop selection & summary screens.
 *
 * Each profile provides everything needed for the crop summary A-Z screen:
 *   overview, stages, needs, risks, economics, timing.
 *
 * Only the most common Sub-Saharan / tropical crops are profiled here.
 * Crops not in this list still work in the app — they just don't get
 * a rich summary screen.
 *
 * All user-facing text uses translation key patterns:
 *   cropProfile.{code}.{field}
 * The actual translations live in translations.js.
 */

/**
 * @typedef {Object} CropProfile
 * @property {string} code - Matches crops.js code
 * @property {string} icon
 * @property {'beginner'|'moderate'|'advanced'} difficulty
 * @property {number} harvestWeeksMin
 * @property {number} harvestWeeksMax
 * @property {'low'|'moderate'|'high'} waterNeed
 * @property {'low'|'moderate'|'high'} effortLevel
 * @property {'low'|'moderate'|'high'} costLevel
 * @property {'low'|'moderate'|'high'} marketPotential
 * @property {string[]} stages - Crop-specific simplified stages (6 items)
 * @property {string[]} needs - What you need (icon keys)
 * @property {string[]} risks - Main risk keys
 * @property {string[]} bestSeasons - Season keys when this crop is ideal
 * @property {string[]} bestGoals - Goal keys this crop fits
 * @property {boolean} droughtTolerant
 * @property {boolean} irrigationRequired
 */

const PROFILES = {
  MAIZE: {
    code: 'MAIZE', icon: '\uD83C\uDF3D',
    difficulty: 'beginner', harvestWeeksMin: 10, harvestWeeksMax: 16,
    waterNeed: 'moderate', effortLevel: 'moderate', costLevel: 'low', marketPotential: 'moderate',
    stages: ['land_prep', 'planting', 'early_growth', 'maintenance', 'harvest', 'post_harvest'],
    needs: ['seeds', 'fertilizer', 'water', 'basic_tools'],
    risks: ['drought', 'pests', 'poor_storage'],
    bestSeasons: ['long_rains', 'masika'],
    bestGoals: ['home_food', 'local_sales'],
    droughtTolerant: false, irrigationRequired: false,
  },
  BEAN: {
    code: 'BEAN', icon: '\uD83E\uDED8',
    difficulty: 'beginner', harvestWeeksMin: 8, harvestWeeksMax: 12,
    waterNeed: 'moderate', effortLevel: 'low', costLevel: 'low', marketPotential: 'moderate',
    stages: ['land_prep', 'planting', 'early_growth', 'maintenance', 'harvest', 'post_harvest'],
    needs: ['seeds', 'water', 'basic_tools'],
    risks: ['pests', 'disease', 'drought'],
    bestSeasons: ['long_rains', 'short_rains', 'masika', 'vuli'],
    bestGoals: ['home_food', 'local_sales'],
    droughtTolerant: false, irrigationRequired: false,
  },
  CASSAVA: {
    code: 'CASSAVA', icon: '\uD83E\uDD54',
    difficulty: 'beginner', harvestWeeksMin: 36, harvestWeeksMax: 72,
    waterNeed: 'low', effortLevel: 'low', costLevel: 'low', marketPotential: 'moderate',
    stages: ['land_prep', 'planting', 'early_growth', 'maintenance', 'harvest', 'post_harvest'],
    needs: ['cuttings', 'basic_tools'],
    risks: ['pests', 'disease', 'poor_storage'],
    bestSeasons: ['long_rains', 'masika', 'dry'],
    bestGoals: ['home_food', 'local_sales'],
    droughtTolerant: true, irrigationRequired: false,
  },
  SWEET_POTATO: {
    code: 'SWEET_POTATO', icon: '\uD83C\uDF60',
    difficulty: 'beginner', harvestWeeksMin: 12, harvestWeeksMax: 20,
    waterNeed: 'low', effortLevel: 'low', costLevel: 'low', marketPotential: 'low',
    stages: ['land_prep', 'planting', 'early_growth', 'maintenance', 'harvest', 'post_harvest'],
    needs: ['vine_cuttings', 'water', 'basic_tools'],
    risks: ['pests', 'poor_storage'],
    bestSeasons: ['long_rains', 'masika'],
    bestGoals: ['home_food'],
    droughtTolerant: true, irrigationRequired: false,
  },
  GROUNDNUT: {
    code: 'GROUNDNUT', icon: '\uD83E\uDD5C',
    difficulty: 'beginner', harvestWeeksMin: 12, harvestWeeksMax: 20,
    waterNeed: 'low', effortLevel: 'moderate', costLevel: 'low', marketPotential: 'moderate',
    stages: ['land_prep', 'planting', 'early_growth', 'maintenance', 'harvest', 'post_harvest'],
    needs: ['seeds', 'water', 'basic_tools'],
    risks: ['drought', 'pests', 'poor_storage'],
    bestSeasons: ['long_rains', 'masika'],
    bestGoals: ['home_food', 'local_sales'],
    droughtTolerant: true, irrigationRequired: false,
  },
  COWPEA: {
    code: 'COWPEA', icon: '\uD83E\uDED8',
    difficulty: 'beginner', harvestWeeksMin: 8, harvestWeeksMax: 14,
    waterNeed: 'low', effortLevel: 'low', costLevel: 'low', marketPotential: 'low',
    stages: ['land_prep', 'planting', 'early_growth', 'maintenance', 'harvest', 'post_harvest'],
    needs: ['seeds', 'basic_tools'],
    risks: ['pests', 'disease'],
    bestSeasons: ['short_rains', 'vuli', 'dry'],
    bestGoals: ['home_food'],
    droughtTolerant: true, irrigationRequired: false,
  },
  TOMATO: {
    code: 'TOMATO', icon: '\uD83C\uDF45',
    difficulty: 'moderate', harvestWeeksMin: 10, harvestWeeksMax: 16,
    waterNeed: 'high', effortLevel: 'high', costLevel: 'moderate', marketPotential: 'high',
    stages: ['land_prep', 'planting', 'early_growth', 'maintenance', 'harvest', 'post_harvest'],
    needs: ['seeds', 'fertilizer', 'water', 'pesticide', 'stakes', 'labor'],
    risks: ['disease', 'pests', 'drought', 'low_market_price'],
    bestSeasons: ['long_rains', 'masika'],
    bestGoals: ['local_sales', 'profit'],
    droughtTolerant: false, irrigationRequired: true,
  },
  RICE: {
    code: 'RICE', icon: '\uD83C\uDF3E',
    difficulty: 'moderate', harvestWeeksMin: 14, harvestWeeksMax: 24,
    waterNeed: 'high', effortLevel: 'high', costLevel: 'moderate', marketPotential: 'high',
    stages: ['land_prep', 'planting', 'early_growth', 'maintenance', 'harvest', 'post_harvest'],
    needs: ['seeds', 'fertilizer', 'water', 'labor', 'basic_tools'],
    risks: ['drought', 'pests', 'disease', 'poor_storage'],
    bestSeasons: ['long_rains', 'masika'],
    bestGoals: ['local_sales', 'profit'],
    droughtTolerant: false, irrigationRequired: true,
  },
  SORGHUM: {
    code: 'SORGHUM', icon: '\uD83C\uDF3E',
    difficulty: 'beginner', harvestWeeksMin: 12, harvestWeeksMax: 20,
    waterNeed: 'low', effortLevel: 'low', costLevel: 'low', marketPotential: 'low',
    stages: ['land_prep', 'planting', 'early_growth', 'maintenance', 'harvest', 'post_harvest'],
    needs: ['seeds', 'basic_tools'],
    risks: ['pests', 'poor_storage'],
    bestSeasons: ['long_rains', 'short_rains', 'dry'],
    bestGoals: ['home_food', 'local_sales'],
    droughtTolerant: true, irrigationRequired: false,
  },
  MILLET: {
    code: 'MILLET', icon: '\uD83C\uDF3E',
    difficulty: 'beginner', harvestWeeksMin: 10, harvestWeeksMax: 16,
    waterNeed: 'low', effortLevel: 'low', costLevel: 'low', marketPotential: 'low',
    stages: ['land_prep', 'planting', 'early_growth', 'maintenance', 'harvest', 'post_harvest'],
    needs: ['seeds', 'basic_tools'],
    risks: ['pests'],
    bestSeasons: ['short_rains', 'vuli', 'dry'],
    bestGoals: ['home_food'],
    droughtTolerant: true, irrigationRequired: false,
  },
  KALE: {
    code: 'KALE', icon: '\uD83E\uDD66',
    difficulty: 'beginner', harvestWeeksMin: 6, harvestWeeksMax: 10,
    waterNeed: 'moderate', effortLevel: 'moderate', costLevel: 'low', marketPotential: 'moderate',
    stages: ['land_prep', 'planting', 'early_growth', 'maintenance', 'harvest', 'post_harvest'],
    needs: ['seeds', 'fertilizer', 'water', 'basic_tools'],
    risks: ['pests', 'disease'],
    bestSeasons: ['long_rains', 'short_rains', 'masika'],
    bestGoals: ['home_food', 'local_sales'],
    droughtTolerant: false, irrigationRequired: false,
  },
  ONION: {
    code: 'ONION', icon: '\uD83E\uDDC5',
    difficulty: 'moderate', harvestWeeksMin: 12, harvestWeeksMax: 20,
    waterNeed: 'moderate', effortLevel: 'moderate', costLevel: 'moderate', marketPotential: 'high',
    stages: ['land_prep', 'planting', 'early_growth', 'maintenance', 'harvest', 'post_harvest'],
    needs: ['seeds', 'fertilizer', 'water', 'labor', 'basic_tools'],
    risks: ['disease', 'pests', 'poor_storage'],
    bestSeasons: ['long_rains', 'masika'],
    bestGoals: ['local_sales', 'profit'],
    droughtTolerant: false, irrigationRequired: false,
  },
  CABBAGE: {
    code: 'CABBAGE', icon: '\uD83E\uDD66',
    difficulty: 'moderate', harvestWeeksMin: 10, harvestWeeksMax: 16,
    waterNeed: 'moderate', effortLevel: 'moderate', costLevel: 'moderate', marketPotential: 'moderate',
    stages: ['land_prep', 'planting', 'early_growth', 'maintenance', 'harvest', 'post_harvest'],
    needs: ['seeds', 'fertilizer', 'water', 'pesticide', 'basic_tools'],
    risks: ['pests', 'disease'],
    bestSeasons: ['long_rains', 'masika'],
    bestGoals: ['local_sales'],
    droughtTolerant: false, irrigationRequired: false,
  },
  COFFEE: {
    code: 'COFFEE', icon: '\u2615',
    difficulty: 'advanced', harvestWeeksMin: 156, harvestWeeksMax: 208,
    waterNeed: 'moderate', effortLevel: 'high', costLevel: 'high', marketPotential: 'high',
    stages: ['land_prep', 'planting', 'early_growth', 'maintenance', 'harvest', 'post_harvest'],
    needs: ['seedlings', 'fertilizer', 'water', 'pesticide', 'labor', 'shade_trees'],
    risks: ['disease', 'pests', 'drought', 'low_market_price'],
    bestSeasons: ['long_rains'],
    bestGoals: ['profit'],
    droughtTolerant: false, irrigationRequired: false,
  },
  BANANA: {
    code: 'BANANA', icon: '\uD83C\uDF4C',
    difficulty: 'beginner', harvestWeeksMin: 36, harvestWeeksMax: 60,
    waterNeed: 'high', effortLevel: 'moderate', costLevel: 'moderate', marketPotential: 'moderate',
    stages: ['land_prep', 'planting', 'early_growth', 'maintenance', 'harvest', 'post_harvest'],
    needs: ['suckers', 'fertilizer', 'water', 'basic_tools'],
    risks: ['disease', 'pests', 'drought'],
    bestSeasons: ['long_rains', 'masika'],
    bestGoals: ['home_food', 'local_sales'],
    droughtTolerant: false, irrigationRequired: false,
  },
  POTATO: {
    code: 'POTATO', icon: '\uD83E\uDD54',
    difficulty: 'moderate', harvestWeeksMin: 12, harvestWeeksMax: 18,
    waterNeed: 'moderate', effortLevel: 'moderate', costLevel: 'moderate', marketPotential: 'moderate',
    stages: ['land_prep', 'planting', 'early_growth', 'maintenance', 'harvest', 'post_harvest'],
    needs: ['seed_potatoes', 'fertilizer', 'water', 'basic_tools'],
    risks: ['disease', 'pests', 'poor_storage'],
    bestSeasons: ['long_rains', 'masika'],
    bestGoals: ['home_food', 'local_sales'],
    droughtTolerant: false, irrigationRequired: false,
  },
  SUGARCANE: {
    code: 'SUGARCANE', icon: '\uD83C\uDF3F',
    difficulty: 'advanced', harvestWeeksMin: 48, harvestWeeksMax: 72,
    waterNeed: 'high', effortLevel: 'high', costLevel: 'high', marketPotential: 'high',
    stages: ['land_prep', 'planting', 'early_growth', 'maintenance', 'harvest', 'post_harvest'],
    needs: ['cuttings', 'fertilizer', 'water', 'labor', 'transport'],
    risks: ['drought', 'pests', 'low_market_price'],
    bestSeasons: ['long_rains'],
    bestGoals: ['profit'],
    droughtTolerant: false, irrigationRequired: true,
  },
  WHEAT: {
    code: 'WHEAT', icon: '\uD83C\uDF3E',
    difficulty: 'moderate', harvestWeeksMin: 14, harvestWeeksMax: 20,
    waterNeed: 'moderate', effortLevel: 'moderate', costLevel: 'moderate', marketPotential: 'moderate',
    stages: ['land_prep', 'planting', 'early_growth', 'maintenance', 'harvest', 'post_harvest'],
    needs: ['seeds', 'fertilizer', 'water', 'basic_tools'],
    risks: ['disease', 'pests', 'drought'],
    bestSeasons: ['long_rains'],
    bestGoals: ['local_sales', 'profit'],
    droughtTolerant: false, irrigationRequired: false,
  },
};

/**
 * Get a crop profile by code.
 * @param {string} code - Crop code (e.g. 'MAIZE')
 * @returns {CropProfile|null}
 */
export function getCropProfile(code) {
  if (!code) return null;
  return PROFILES[code.toUpperCase()] || null;
}

/**
 * Get all profiled crop codes.
 * @returns {string[]}
 */
export function getProfiledCropCodes() {
  return Object.keys(PROFILES);
}

/**
 * Check if a crop has a detailed profile.
 * @param {string} code
 * @returns {boolean}
 */
export function hasProfile(code) {
  return !!PROFILES[code?.toUpperCase()];
}

export default PROFILES;
