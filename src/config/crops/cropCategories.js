/**
 * cropCategories.js — per-crop category assignment.
 *
 * Categories drive high-level grouping in UI (root/grain/vegetable/
 * fruit/cash_crop) and feed a few heuristics in the risk + task
 * engines (e.g. "tubers in wet season → root-rot watch").
 *
 * Values are canonical hyphenated keys from cropAliases.js.
 */

export const CROP_CATEGORIES = Object.freeze({
  // Roots & tubers
  cassava:        'root',
  yam:            'root',
  potato:         'root',
  'sweet-potato': 'root',
  taro:           'root',
  ginger:         'root',
  garlic:         'root',

  // Grains / cereals
  maize:    'grain',
  rice:     'grain',
  sorghum:  'grain',
  millet:   'grain',
  wheat:    'grain',

  // Legumes (grouped under grain for operational simplicity —
  // pulses share the planting/scouting/threshing rhythm).
  beans:     'grain',
  soybean:   'grain',
  cowpea:    'grain',
  chickpea:  'grain',
  lentil:    'grain',
  groundnut: 'grain',

  // Vegetables
  tomato:     'vegetable',
  onion:      'vegetable',
  okra:       'vegetable',
  pepper:     'vegetable',
  cabbage:    'vegetable',
  carrot:     'vegetable',
  cucumber:   'vegetable',
  spinach:    'vegetable',
  watermelon: 'vegetable',
  lettuce:    'vegetable',
  eggplant:   'vegetable',

  // Fruit
  banana:   'fruit',
  plantain: 'fruit',
  mango:    'fruit',
  orange:   'fruit',
  avocado:  'fruit',

  // Cash crops / tree crops
  cocoa:      'cash_crop',
  coffee:     'cash_crop',
  cotton:     'cash_crop',
  tea:        'cash_crop',
  sugarcane:  'cash_crop',
  sunflower:  'cash_crop',
  sesame:     'cash_crop',
  'oil-palm': 'cash_crop',
});

export function getCropCategory(canonicalKey) {
  if (!canonicalKey) return null;
  return CROP_CATEGORIES[canonicalKey] || null;
}
