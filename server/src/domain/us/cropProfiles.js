/**
 * cropProfiles.js — static per-crop attributes used by the scoring
 * engine regardless of state/region.
 *
 * Each profile answers "what is this crop like in general"; the
 * state/region-specific part ("is this crop commonly grown in
 * Georgia?") lives in cropRules.js. Keeping the two apart means we
 * can add a new state without touching crop attributes, and add a
 * new crop without touching every state.
 *
 * Fields:
 *   difficulty        'easy' | 'medium' | 'hard'
 *   waterNeed         'low' | 'medium' | 'high'
 *   frostSensitive    boolean
 *   heatTolerance     'low' | 'medium' | 'high'
 *   containerFriendly boolean
 *   raisedBedFriendly boolean
 *   inGroundFriendly  boolean
 *   growthWeeksMin/Max approximate seed-to-harvest window
 *   category          'vegetable' | 'grain' | 'fruit' | 'legume' | 'root' | 'herb' | 'industrial' | 'tropical'
 *   defaultTags       free-form tags the UI can render as badges
 */

export const CROP_PROFILES = Object.freeze({
  // ─── Backyard staples ─────────────────────────────────────
  tomato: {
    name: 'Tomato', category: 'vegetable', difficulty: 'easy', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 10, growthWeeksMax: 14,
    defaultTags: ['beginner_friendly', 'container_friendly', 'popular'],
  },
  pepper: {
    name: 'Pepper', category: 'vegetable', difficulty: 'easy', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 10, growthWeeksMax: 14,
    defaultTags: ['beginner_friendly', 'container_friendly', 'heat_tolerant'],
  },
  lettuce: {
    name: 'Lettuce', category: 'vegetable', difficulty: 'easy', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'low',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 4, growthWeeksMax: 8,
    defaultTags: ['beginner_friendly', 'cool_season', 'fast'],
  },
  spinach: {
    name: 'Spinach', category: 'vegetable', difficulty: 'easy', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'low',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 5, growthWeeksMax: 8,
    defaultTags: ['beginner_friendly', 'cool_season', 'fast'],
  },
  kale: {
    name: 'Kale', category: 'vegetable', difficulty: 'easy', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'low',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 7, growthWeeksMax: 10,
    defaultTags: ['beginner_friendly', 'cool_season', 'hardy'],
  },
  onion: {
    name: 'Onion', category: 'vegetable', difficulty: 'medium', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: false, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 14, growthWeeksMax: 20,
    defaultTags: ['long_season'],
  },
  garlic: {
    name: 'Garlic', category: 'vegetable', difficulty: 'easy', waterNeed: 'low',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: false, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 30, growthWeeksMax: 40,
    defaultTags: ['overwinter', 'long_season'],
  },
  beans: {
    name: 'Beans', category: 'legume', difficulty: 'easy', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'medium',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 7, growthWeeksMax: 11,
    defaultTags: ['beginner_friendly'],
  },
  bush_beans: {
    name: 'Bush Beans', category: 'legume', difficulty: 'easy', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'medium',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 7, growthWeeksMax: 10,
    defaultTags: ['beginner_friendly', 'container_friendly'],
  },
  pole_beans: {
    name: 'Pole Beans', category: 'legume', difficulty: 'easy', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'medium',
    containerFriendly: false, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 8, growthWeeksMax: 12,
    defaultTags: ['beginner_friendly', 'vertical'],
  },
  cucumber: {
    name: 'Cucumber', category: 'vegetable', difficulty: 'easy', waterNeed: 'high',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 8, growthWeeksMax: 10,
    defaultTags: ['beginner_friendly', 'warm_season'],
  },
  squash: {
    name: 'Squash', category: 'vegetable', difficulty: 'easy', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 8, growthWeeksMax: 14,
    defaultTags: ['warm_season'],
  },
  zucchini: {
    name: 'Zucchini', category: 'vegetable', difficulty: 'easy', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 7, growthWeeksMax: 9,
    defaultTags: ['beginner_friendly', 'warm_season'],
  },
  herbs: {
    name: 'Herbs', category: 'herb', difficulty: 'easy', waterNeed: 'low',
    frostSensitive: false, heatTolerance: 'high',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 4, growthWeeksMax: 12,
    defaultTags: ['beginner_friendly', 'container_friendly', 'compact'],
  },
  okra: {
    name: 'Okra', category: 'vegetable', difficulty: 'easy', waterNeed: 'low',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 8, growthWeeksMax: 10,
    defaultTags: ['heat_tolerant', 'drought_tolerant'],
  },
  sweet_potato: {
    name: 'Sweet Potato', category: 'root', difficulty: 'medium', waterNeed: 'low',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 14, growthWeeksMax: 18,
    defaultTags: ['heat_tolerant', 'storage_friendly'],
  },
  strawberry: {
    name: 'Strawberry', category: 'fruit', difficulty: 'medium', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 18, growthWeeksMax: 30,
    defaultTags: ['perennial_option', 'container_friendly'],
  },
  eggplant: {
    name: 'Eggplant', category: 'vegetable', difficulty: 'medium', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 10, growthWeeksMax: 14,
    defaultTags: ['heat_tolerant'],
  },
  carrot: {
    name: 'Carrot', category: 'root', difficulty: 'easy', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 10, growthWeeksMax: 12,
    defaultTags: ['beginner_friendly'],
  },
  radish: {
    name: 'Radish', category: 'root', difficulty: 'easy', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 3, growthWeeksMax: 5,
    defaultTags: ['beginner_friendly', 'fast'],
  },
  beets: {
    name: 'Beets', category: 'root', difficulty: 'easy', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 7, growthWeeksMax: 10,
    defaultTags: ['beginner_friendly', 'cool_season'],
  },
  cabbage: {
    name: 'Cabbage', category: 'vegetable', difficulty: 'medium', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'low',
    containerFriendly: false, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 10, growthWeeksMax: 16,
    defaultTags: ['cool_season'],
  },
  broccoli: {
    name: 'Broccoli', category: 'vegetable', difficulty: 'medium', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'low',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 8, growthWeeksMax: 12,
    defaultTags: ['cool_season'],
  },
  peas: {
    name: 'Peas', category: 'legume', difficulty: 'easy', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'low',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 8, growthWeeksMax: 10,
    defaultTags: ['beginner_friendly', 'cool_season'],
  },
  green_onion: {
    name: 'Green Onion', category: 'vegetable', difficulty: 'easy', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 4, growthWeeksMax: 8,
    defaultTags: ['beginner_friendly', 'container_friendly', 'fast'],
  },
  collards: {
    name: 'Collards', category: 'vegetable', difficulty: 'easy', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 8, growthWeeksMax: 10,
    defaultTags: ['beginner_friendly', 'hardy'],
  },
  swiss_chard: {
    name: 'Swiss Chard', category: 'vegetable', difficulty: 'easy', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 8, growthWeeksMax: 10,
    defaultTags: ['beginner_friendly', 'hardy'],
  },
  pumpkin: {
    name: 'Pumpkin', category: 'vegetable', difficulty: 'medium', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 14, growthWeeksMax: 20,
    defaultTags: ['warm_season', 'needs_space'],
  },

  // ─── Commercial / small-farm crops ────────────────────────
  corn: {
    name: 'Corn', category: 'grain', difficulty: 'medium', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 12, growthWeeksMax: 16,
    defaultTags: ['commercial', 'needs_space'],
  },
  soybean: {
    name: 'Soybean', category: 'legume', difficulty: 'medium', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'medium',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 14, growthWeeksMax: 20,
    defaultTags: ['commercial'],
  },
  wheat: {
    name: 'Wheat', category: 'grain', difficulty: 'medium', waterNeed: 'low',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 24, growthWeeksMax: 32,
    defaultTags: ['commercial', 'overwinter'],
  },
  sorghum: {
    name: 'Sorghum', category: 'grain', difficulty: 'medium', waterNeed: 'low',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 14, growthWeeksMax: 18,
    defaultTags: ['commercial', 'drought_tolerant', 'heat_tolerant'],
  },
  cotton: {
    name: 'Cotton', category: 'industrial', difficulty: 'hard', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 20, growthWeeksMax: 28,
    defaultTags: ['commercial', 'long_season'],
  },
  peanut: {
    name: 'Peanut', category: 'legume', difficulty: 'medium', waterNeed: 'low',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 18, growthWeeksMax: 24,
    defaultTags: ['commercial', 'heat_tolerant'],
  },
  oats: {
    name: 'Oats', category: 'grain', difficulty: 'medium', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'low',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 14, growthWeeksMax: 18,
    defaultTags: ['commercial', 'cool_season'],
  },
  alfalfa: {
    name: 'Alfalfa', category: 'legume', difficulty: 'medium', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 40, growthWeeksMax: 260,
    defaultTags: ['commercial', 'perennial_option', 'livestock_feed'],
  },
  barley: {
    name: 'Barley', category: 'grain', difficulty: 'medium', waterNeed: 'low',
    frostSensitive: false, heatTolerance: 'low',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 12, growthWeeksMax: 16,
    defaultTags: ['commercial', 'cool_season'],
  },
  potato: {
    name: 'Potato', category: 'root', difficulty: 'medium', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 12, growthWeeksMax: 18,
    defaultTags: ['commercial', 'storage_friendly'],
  },
  apple: {
    name: 'Apple', category: 'fruit', difficulty: 'hard', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 130, growthWeeksMax: 260,
    defaultTags: ['perennial', 'orchard'],
  },
  berry: {
    name: 'Berries', category: 'fruit', difficulty: 'medium', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 40, growthWeeksMax: 100,
    defaultTags: ['perennial_option'],
  },
  grapes: {
    name: 'Grapes', category: 'fruit', difficulty: 'hard', waterNeed: 'low',
    frostSensitive: false, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 100, growthWeeksMax: 200,
    defaultTags: ['perennial', 'orchard'],
  },
  almonds: {
    name: 'Almonds', category: 'fruit', difficulty: 'hard', waterNeed: 'high',
    frostSensitive: false, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 150, growthWeeksMax: 260,
    defaultTags: ['perennial', 'orchard', 'high_water'],
  },
  citrus: {
    name: 'Citrus', category: 'fruit', difficulty: 'hard', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 130, growthWeeksMax: 260,
    defaultTags: ['perennial', 'orchard', 'frost_sensitive'],
  },
  sugarcane: {
    name: 'Sugarcane', category: 'industrial', difficulty: 'hard', waterNeed: 'high',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 40, growthWeeksMax: 70,
    defaultTags: ['commercial', 'tropical'],
  },
  taro: {
    name: 'Taro', category: 'root', difficulty: 'medium', waterNeed: 'high',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 32, growthWeeksMax: 52,
    defaultTags: ['tropical', 'wetland'],
  },
  cassava: {
    name: 'Cassava', category: 'root', difficulty: 'medium', waterNeed: 'low',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 32, growthWeeksMax: 52,
    defaultTags: ['tropical', 'drought_tolerant'],
  },
});

/** Convenience: all valid crop keys. */
export const CROP_KEYS = Object.freeze(Object.keys(CROP_PROFILES));

export function getCropProfile(key) {
  return CROP_PROFILES[key] || null;
}
