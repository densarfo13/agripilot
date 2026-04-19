/**
 * cropProfiles.js — crop-level attributes that don't depend on state.
 *
 * Enum conventions (locked to spec):
 *   difficulty:     'beginner' | 'intermediate' | 'advanced'
 *   waterNeed:      'low' | 'medium' | 'high'
 *   heatTolerance:  'low' | 'medium' | 'high'
 *   category:       'vegetable' | 'fruit' | 'grain' | 'legume' | 'root' |
 *                   'herb' | 'industrial' | 'tropical' | 'nut' | 'tree_fruit'
 *
 * Notes baked into these profiles:
 *   • Cassava  — frostSensitive, tropical, not container-friendly.
 *   • Corn     — in_ground only, never flagged container-friendly.
 *   • Sorghum  — commercial warm/dry; backyard rules treat it as weak.
 *   • Cotton/Rice/Sugarcane/Almonds — commercial only by default
 *     (enforced in cropRules.js, not here).
 */

export const CROP_PROFILES = Object.freeze({
  // ─── Backyard staples ─────────────────────────────────────
  tomato: {
    name: 'Tomato', category: 'vegetable', difficulty: 'beginner', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 10, growthWeeksMax: 14,
    defaultTags: ['beginner_friendly', 'container_friendly', 'popular'],
  },
  pepper: {
    name: 'Pepper', category: 'vegetable', difficulty: 'beginner', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 10, growthWeeksMax: 14,
    defaultTags: ['beginner_friendly', 'container_friendly', 'heat_tolerant'],
  },
  chili_pepper: {
    name: 'Chili Pepper', category: 'vegetable', difficulty: 'beginner', waterNeed: 'low',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 10, growthWeeksMax: 16,
    defaultTags: ['heat_tolerant', 'drought_tolerant'],
  },
  lettuce: {
    name: 'Lettuce', category: 'vegetable', difficulty: 'beginner', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'low',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 4, growthWeeksMax: 8,
    defaultTags: ['beginner_friendly', 'cool_season', 'fast'],
  },
  spinach: {
    name: 'Spinach', category: 'vegetable', difficulty: 'beginner', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'low',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 5, growthWeeksMax: 8,
    defaultTags: ['beginner_friendly', 'cool_season', 'fast'],
  },
  kale: {
    name: 'Kale', category: 'vegetable', difficulty: 'beginner', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'low',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 7, growthWeeksMax: 10,
    defaultTags: ['beginner_friendly', 'cool_season', 'hardy'],
  },
  onion: {
    name: 'Onion', category: 'vegetable', difficulty: 'intermediate', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: false, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 14, growthWeeksMax: 20,
    defaultTags: ['long_season'],
  },
  garlic: {
    name: 'Garlic', category: 'vegetable', difficulty: 'beginner', waterNeed: 'low',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: false, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 30, growthWeeksMax: 40,
    defaultTags: ['overwinter', 'long_season'],
  },
  beans: {
    name: 'Beans', category: 'legume', difficulty: 'beginner', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'medium',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 7, growthWeeksMax: 11,
    defaultTags: ['beginner_friendly'],
  },
  bush_beans: {
    name: 'Bush Beans', category: 'legume', difficulty: 'beginner', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'medium',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 7, growthWeeksMax: 10,
    defaultTags: ['beginner_friendly', 'container_friendly'],
  },
  pole_beans: {
    name: 'Pole Beans', category: 'legume', difficulty: 'beginner', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'medium',
    containerFriendly: false, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 8, growthWeeksMax: 12,
    defaultTags: ['beginner_friendly', 'vertical'],
  },
  cucumber: {
    name: 'Cucumber', category: 'vegetable', difficulty: 'beginner', waterNeed: 'high',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 8, growthWeeksMax: 10,
    defaultTags: ['beginner_friendly', 'warm_season'],
  },
  squash: {
    name: 'Squash', category: 'vegetable', difficulty: 'beginner', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 8, growthWeeksMax: 14,
    defaultTags: ['warm_season'],
  },
  zucchini: {
    name: 'Zucchini', category: 'vegetable', difficulty: 'beginner', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 7, growthWeeksMax: 9,
    defaultTags: ['beginner_friendly', 'warm_season'],
  },
  herbs: {
    name: 'Herbs', category: 'herb', difficulty: 'beginner', waterNeed: 'low',
    frostSensitive: false, heatTolerance: 'high',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 4, growthWeeksMax: 12,
    defaultTags: ['beginner_friendly', 'container_friendly', 'compact'],
  },
  okra: {
    name: 'Okra', category: 'vegetable', difficulty: 'beginner', waterNeed: 'low',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 8, growthWeeksMax: 10,
    defaultTags: ['heat_tolerant', 'drought_tolerant'],
  },
  sweet_potato: {
    name: 'Sweet Potato', category: 'root', difficulty: 'intermediate', waterNeed: 'low',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 14, growthWeeksMax: 18,
    defaultTags: ['heat_tolerant', 'storage_friendly'],
  },
  strawberry: {
    name: 'Strawberry', category: 'fruit', difficulty: 'intermediate', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 18, growthWeeksMax: 30,
    defaultTags: ['perennial_option', 'container_friendly'],
  },
  eggplant: {
    name: 'Eggplant', category: 'vegetable', difficulty: 'intermediate', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 10, growthWeeksMax: 14,
    defaultTags: ['heat_tolerant'],
  },
  carrot: {
    name: 'Carrot', category: 'root', difficulty: 'beginner', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 10, growthWeeksMax: 12,
    defaultTags: ['beginner_friendly'],
  },
  radish: {
    name: 'Radish', category: 'root', difficulty: 'beginner', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 3, growthWeeksMax: 5,
    defaultTags: ['beginner_friendly', 'fast'],
  },
  beets: {
    name: 'Beets', category: 'root', difficulty: 'beginner', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 7, growthWeeksMax: 10,
    defaultTags: ['beginner_friendly', 'cool_season'],
  },
  cabbage: {
    name: 'Cabbage', category: 'vegetable', difficulty: 'intermediate', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'low',
    containerFriendly: false, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 10, growthWeeksMax: 16,
    defaultTags: ['cool_season'],
  },
  broccoli: {
    name: 'Broccoli', category: 'vegetable', difficulty: 'intermediate', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'low',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 8, growthWeeksMax: 12,
    defaultTags: ['cool_season'],
  },
  peas: {
    name: 'Peas', category: 'legume', difficulty: 'beginner', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'low',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 8, growthWeeksMax: 10,
    defaultTags: ['beginner_friendly', 'cool_season'],
  },
  green_onion: {
    name: 'Green Onion', category: 'vegetable', difficulty: 'beginner', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 4, growthWeeksMax: 8,
    defaultTags: ['beginner_friendly', 'container_friendly', 'fast'],
  },
  collards: {
    name: 'Collards', category: 'vegetable', difficulty: 'beginner', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 8, growthWeeksMax: 10,
    defaultTags: ['beginner_friendly', 'hardy'],
  },
  swiss_chard: {
    name: 'Swiss Chard', category: 'vegetable', difficulty: 'beginner', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 8, growthWeeksMax: 10,
    defaultTags: ['beginner_friendly', 'hardy'],
  },
  pumpkin: {
    name: 'Pumpkin', category: 'vegetable', difficulty: 'intermediate', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 14, growthWeeksMax: 20,
    defaultTags: ['warm_season', 'needs_space'],
  },
  melon: {
    name: 'Melon', category: 'fruit', difficulty: 'intermediate', waterNeed: 'high',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 10, growthWeeksMax: 14,
    defaultTags: ['warm_season', 'needs_space'],
  },

  // ─── Commercial / small-farm crops ────────────────────────
  corn: {
    name: 'Corn', category: 'grain', difficulty: 'intermediate', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 12, growthWeeksMax: 16,
    defaultTags: ['commercial', 'needs_space'],
  },
  sweet_corn: {
    name: 'Sweet Corn', category: 'vegetable', difficulty: 'intermediate', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 10, growthWeeksMax: 14,
    defaultTags: ['warm_season', 'needs_space'],
  },
  soybean: {
    name: 'Soybean', category: 'legume', difficulty: 'intermediate', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'medium',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 14, growthWeeksMax: 20,
    defaultTags: ['commercial'],
  },
  wheat: {
    name: 'Wheat', category: 'grain', difficulty: 'intermediate', waterNeed: 'low',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 24, growthWeeksMax: 32,
    defaultTags: ['commercial', 'overwinter'],
  },
  sorghum: {
    name: 'Sorghum', category: 'grain', difficulty: 'intermediate', waterNeed: 'low',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 14, growthWeeksMax: 18,
    defaultTags: ['commercial', 'drought_tolerant', 'heat_tolerant'],
  },
  cotton: {
    name: 'Cotton', category: 'industrial', difficulty: 'advanced', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 20, growthWeeksMax: 28,
    defaultTags: ['commercial', 'long_season'],
  },
  peanut: {
    name: 'Peanut', category: 'legume', difficulty: 'intermediate', waterNeed: 'low',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 18, growthWeeksMax: 24,
    defaultTags: ['commercial', 'heat_tolerant'],
  },
  oats: {
    name: 'Oats', category: 'grain', difficulty: 'intermediate', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'low',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 14, growthWeeksMax: 18,
    defaultTags: ['commercial', 'cool_season'],
  },
  alfalfa: {
    name: 'Alfalfa', category: 'legume', difficulty: 'intermediate', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 40, growthWeeksMax: 260,
    defaultTags: ['commercial', 'perennial_option', 'livestock_feed'],
  },
  barley: {
    name: 'Barley', category: 'grain', difficulty: 'intermediate', waterNeed: 'low',
    frostSensitive: false, heatTolerance: 'low',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 12, growthWeeksMax: 16,
    defaultTags: ['commercial', 'cool_season'],
  },
  rice: {
    name: 'Rice', category: 'grain', difficulty: 'advanced', waterNeed: 'high',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 16, growthWeeksMax: 22,
    defaultTags: ['commercial', 'wetland'],
  },
  sunflower: {
    name: 'Sunflower', category: 'industrial', difficulty: 'intermediate', waterNeed: 'low',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 12, growthWeeksMax: 16,
    defaultTags: ['commercial', 'drought_tolerant'],
  },
  potato: {
    name: 'Potato', category: 'root', difficulty: 'intermediate', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 12, growthWeeksMax: 18,
    defaultTags: ['commercial', 'storage_friendly'],
  },
  apple: {
    name: 'Apple', category: 'tree_fruit', difficulty: 'advanced', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 130, growthWeeksMax: 260,
    defaultTags: ['perennial', 'orchard'],
  },
  blueberry: {
    name: 'Blueberry', category: 'fruit', difficulty: 'intermediate', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: true, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 40, growthWeeksMax: 130,
    defaultTags: ['perennial_option'],
  },
  raspberry: {
    name: 'Raspberry', category: 'fruit', difficulty: 'intermediate', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'medium',
    containerFriendly: false, raisedBedFriendly: true, inGroundFriendly: true,
    growthWeeksMin: 40, growthWeeksMax: 130,
    defaultTags: ['perennial_option'],
  },
  grapes: {
    name: 'Grapes', category: 'fruit', difficulty: 'advanced', waterNeed: 'low',
    frostSensitive: false, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 100, growthWeeksMax: 200,
    defaultTags: ['perennial', 'orchard'],
  },
  almonds: {
    name: 'Almonds', category: 'nut', difficulty: 'advanced', waterNeed: 'high',
    frostSensitive: false, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 150, growthWeeksMax: 260,
    defaultTags: ['perennial', 'orchard', 'high_water'],
  },
  pecan: {
    name: 'Pecan', category: 'nut', difficulty: 'advanced', waterNeed: 'medium',
    frostSensitive: false, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 200, growthWeeksMax: 520,
    defaultTags: ['perennial', 'orchard'],
  },
  citrus: {
    name: 'Citrus', category: 'tree_fruit', difficulty: 'advanced', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 130, growthWeeksMax: 260,
    defaultTags: ['perennial', 'orchard', 'frost_sensitive'],
  },
  sugarcane: {
    name: 'Sugarcane', category: 'industrial', difficulty: 'advanced', waterNeed: 'high',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 40, growthWeeksMax: 70,
    defaultTags: ['commercial', 'tropical'],
  },
  taro: {
    name: 'Taro', category: 'root', difficulty: 'intermediate', waterNeed: 'high',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 32, growthWeeksMax: 52,
    defaultTags: ['tropical', 'wetland'],
  },
  banana: {
    name: 'Banana', category: 'tropical', difficulty: 'intermediate', waterNeed: 'high',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 40, growthWeeksMax: 60,
    defaultTags: ['tropical', 'perennial_option'],
  },
  papaya: {
    name: 'Papaya', category: 'tropical', difficulty: 'intermediate', waterNeed: 'medium',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 28, growthWeeksMax: 52,
    defaultTags: ['tropical'],
  },
  pineapple: {
    name: 'Pineapple', category: 'tropical', difficulty: 'intermediate', waterNeed: 'low',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 80, growthWeeksMax: 130,
    defaultTags: ['tropical', 'long_season'],
  },
  cassava: {
    // Capped to low suitability in most U.S. states (see cropRules /
    // STATE_OVERRIDES). Only limited suitability in Hawaii.
    name: 'Cassava', category: 'root', difficulty: 'intermediate', waterNeed: 'low',
    frostSensitive: true, heatTolerance: 'high',
    containerFriendly: false, raisedBedFriendly: false, inGroundFriendly: true,
    growthWeeksMin: 32, growthWeeksMax: 52,
    defaultTags: ['tropical', 'drought_tolerant'],
  },
});

export const CROP_KEYS = Object.freeze(Object.keys(CROP_PROFILES));

export function getCropProfile(key) {
  return CROP_PROFILES[key] || null;
}
