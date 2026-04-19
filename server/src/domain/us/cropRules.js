/**
 * cropRules.js — per (farmType × climateSubregion × crop) rules that
 * seed the scoring engine with agronomic priors.
 *
 * The shape intentionally mirrors what a DB-backed CropRule row would
 * look like, so we can later persist these to Prisma without changing
 * the scoring engine signature.
 *
 *   {
 *     crop, farmType, climateSubregion,
 *     suitabilityBaseScore: 0..100,
 *     marketStrength:       'low' | 'medium' | 'high' | 'very_high',
 *     beginnerFriendly:     boolean,
 *     homeUseValue:         'low' | 'medium' | 'high' | null,     // backyard
 *     localSellValue:       'low' | 'medium' | 'high' | null,     // small/backyard
 *     plantingStartMonth:   1..12,
 *     plantingEndMonth:     1..12,
 *     notes:                string,
 *   }
 *
 * If a state has an entry in STATE_OVERRIDES the override is merged
 * on top of the subregion row for that (crop, farmType).
 */

import { CLIMATE_SUBREGIONS as C } from './usStates.js';

/** Common planting windows reused by many rules to keep tables terse. */
const W = Object.freeze({
  WARM_SEASON_N: [4, 6],     // Apr–Jun (cool / temperate)
  WARM_SEASON_S: [3, 5],     // Mar–May (warm south)
  WARM_SEASON_HOT: [2, 4],   // Feb–Apr (very hot / subtropical)
  COOL_SEASON_SPRING: [2, 4],
  COOL_SEASON_FALL:   [8, 10],
  YEAR_ROUND_TROPICAL: [1, 12],
  WINTER_CITRUS:       [2, 4],
  GRAIN_SPRING:        [3, 5],
  GRAIN_FALL:          [9, 11],
});

/* ─────────────────────────────────────────────────────────────
 * BACKYARD RULES
 * Focus: ease of growing, home use, container/raised-bed fit.
 * ───────────────────────────────────────────────────────────── */

const BACKYARD_RULES = [
  // Northeast / Mid-Atlantic — short hot summer, long shoulder seasons.
  r('tomato',  'backyard', C.NORTHEAST_COASTAL, 85, 'medium', true,  'high',   'medium', W.WARM_SEASON_N),
  r('pepper',  'backyard', C.NORTHEAST_COASTAL, 78, 'medium', true,  'high',   'medium', W.WARM_SEASON_N),
  r('lettuce', 'backyard', C.NORTHEAST_COASTAL, 88, 'medium', true,  'high',   'medium', W.COOL_SEASON_SPRING),
  r('kale',    'backyard', C.NORTHEAST_COASTAL, 90, 'medium', true,  'high',   'medium', W.COOL_SEASON_SPRING),
  r('beans',   'backyard', C.NORTHEAST_COASTAL, 82, 'medium', true,  'high',   'low',    W.WARM_SEASON_N),
  r('cucumber','backyard', C.NORTHEAST_COASTAL, 80, 'medium', true,  'high',   'medium', W.WARM_SEASON_N),
  r('zucchini','backyard', C.NORTHEAST_COASTAL, 86, 'medium', true,  'high',   'medium', W.WARM_SEASON_N),
  r('herbs',   'backyard', C.NORTHEAST_COASTAL, 92, 'low',    true,  'high',   'medium', [3, 9]),
  r('carrot',  'backyard', C.NORTHEAST_COASTAL, 80, 'low',    true,  'high',   'low',    W.COOL_SEASON_SPRING),
  r('radish',  'backyard', C.NORTHEAST_COASTAL, 86, 'low',    true,  'high',   'low',    [3, 10]),
  r('peas',    'backyard', C.NORTHEAST_COASTAL, 82, 'medium', true,  'high',   'low',    [3, 5]),
  r('strawberry','backyard',C.NORTHEAST_COASTAL,76, 'medium', false, 'high',   'high',   [4, 6]),

  r('tomato',  'backyard', C.MID_ATLANTIC, 90, 'medium', true,  'high',   'medium', W.WARM_SEASON_N),
  r('pepper',  'backyard', C.MID_ATLANTIC, 85, 'medium', true,  'high',   'medium', W.WARM_SEASON_N),
  r('lettuce', 'backyard', C.MID_ATLANTIC, 84, 'medium', true,  'high',   'medium', W.COOL_SEASON_SPRING),
  r('herbs',   'backyard', C.MID_ATLANTIC, 92, 'low',    true,  'high',   'medium', [3, 10]),
  r('cucumber','backyard', C.MID_ATLANTIC, 82, 'medium', true,  'high',   'medium', W.WARM_SEASON_N),
  r('zucchini','backyard', C.MID_ATLANTIC, 82, 'medium', true,  'high',   'medium', W.WARM_SEASON_N),
  r('kale',    'backyard', C.MID_ATLANTIC, 85, 'medium', true,  'high',   'medium', W.COOL_SEASON_SPRING),
  r('strawberry','backyard',C.MID_ATLANTIC,  80, 'medium', false, 'high',   'high',   [4, 6]),
  r('beans',   'backyard', C.MID_ATLANTIC, 80, 'medium', true,  'high',   'low',    W.WARM_SEASON_N),

  // Southeast / Florida — hot + humid, skew toward heat-tolerant picks.
  r('okra',       'backyard', C.SOUTHEAST_COASTAL, 92, 'medium', true,  'high',   'medium', W.WARM_SEASON_S),
  r('sweet_potato','backyard',C.SOUTHEAST_COASTAL, 90, 'medium', true,  'high',   'medium', [4, 6]),
  r('pepper',     'backyard', C.SOUTHEAST_COASTAL, 88, 'medium', true,  'high',   'medium', W.WARM_SEASON_S),
  r('tomato',     'backyard', C.SOUTHEAST_COASTAL, 82, 'medium', true,  'high',   'medium', W.WARM_SEASON_S),
  r('collards',   'backyard', C.SOUTHEAST_COASTAL, 88, 'medium', true,  'high',   'medium', [8, 10]),
  r('herbs',      'backyard', C.SOUTHEAST_COASTAL, 88, 'low',    true,  'high',   'medium', [1, 12]),
  r('eggplant',   'backyard', C.SOUTHEAST_COASTAL, 84, 'medium', false, 'high',   'medium', W.WARM_SEASON_S),

  r('okra',       'backyard', C.FLORIDA_SUBTROPICAL, 95, 'medium', true,  'high',   'medium', W.WARM_SEASON_HOT),
  r('sweet_potato','backyard',C.FLORIDA_SUBTROPICAL, 92, 'medium', true,  'high',   'medium', [3, 6]),
  r('pepper',     'backyard', C.FLORIDA_SUBTROPICAL, 90, 'medium', true,  'high',   'medium', W.WARM_SEASON_HOT),
  r('tomato',     'backyard', C.FLORIDA_SUBTROPICAL, 82, 'medium', true,  'high',   'medium', W.WARM_SEASON_HOT),
  r('collards',   'backyard', C.FLORIDA_SUBTROPICAL, 86, 'medium', true,  'high',   'medium', [9, 11]),
  r('herbs',      'backyard', C.FLORIDA_SUBTROPICAL, 92, 'low',    true,  'high',   'medium', [1, 12]),
  r('eggplant',   'backyard', C.FLORIDA_SUBTROPICAL, 86, 'medium', false, 'high',   'medium', W.WARM_SEASON_HOT),

  // Midwest — standard home-garden set.
  r('tomato',  'backyard', C.MIDWEST_HUMID, 88, 'medium', true, 'high', 'medium', W.WARM_SEASON_N),
  r('beans',   'backyard', C.MIDWEST_HUMID, 88, 'medium', true, 'high', 'low',    W.WARM_SEASON_N),
  r('kale',    'backyard', C.MIDWEST_HUMID, 88, 'medium', true, 'high', 'medium', W.COOL_SEASON_SPRING),
  r('lettuce', 'backyard', C.MIDWEST_HUMID, 88, 'medium', true, 'high', 'medium', [3, 5]),
  r('zucchini','backyard', C.MIDWEST_HUMID, 90, 'medium', true, 'high', 'medium', W.WARM_SEASON_N),
  r('peas',    'backyard', C.MIDWEST_HUMID, 82, 'medium', true, 'high', 'low',    [3, 5]),
  r('herbs',   'backyard', C.MIDWEST_HUMID, 90, 'low',    true, 'high', 'low',    [4, 9]),
  r('strawberry','backyard',C.MIDWEST_HUMID, 80, 'medium', false,'high', 'medium', [4, 6]),

  // Great Plains — drier, wind, heat.
  r('tomato','backyard', C.GREAT_PLAINS_DRY, 78, 'medium', true, 'medium', 'medium', W.WARM_SEASON_N),
  r('pepper','backyard', C.GREAT_PLAINS_DRY, 80, 'medium', true, 'medium', 'medium', W.WARM_SEASON_N),
  r('okra',  'backyard', C.GREAT_PLAINS_DRY, 80, 'medium', true, 'medium', 'medium', W.WARM_SEASON_S),
  r('herbs', 'backyard', C.GREAT_PLAINS_DRY, 86, 'low',    true, 'high',   'medium', [4, 9]),
  r('beans', 'backyard', C.GREAT_PLAINS_DRY, 76, 'low',    true, 'high',   'low',    W.WARM_SEASON_N),

  // South Central — hot, long season.
  r('tomato','backyard', C.SOUTH_CENTRAL_MIXED, 86, 'medium', true, 'high', 'medium', W.WARM_SEASON_S),
  r('pepper','backyard', C.SOUTH_CENTRAL_MIXED, 92, 'medium', true, 'high', 'medium', W.WARM_SEASON_S),
  r('okra',  'backyard', C.SOUTH_CENTRAL_MIXED, 92, 'medium', true, 'high', 'medium', W.WARM_SEASON_S),
  r('herbs', 'backyard', C.SOUTH_CENTRAL_MIXED, 90, 'low',    true, 'high', 'medium', [2, 11]),
  r('eggplant','backyard',C.SOUTH_CENTRAL_MIXED,86, 'medium', false,'high', 'medium', W.WARM_SEASON_S),
  r('sweet_potato','backyard',C.SOUTH_CENTRAL_MIXED,84, 'medium', true,'high','medium',[3, 6]),

  // Southwest arid / Desert irrigated.
  r('pepper','backyard', C.SOUTHWEST_ARID, 88, 'medium', true, 'high', 'medium', W.WARM_SEASON_S),
  r('herbs', 'backyard', C.SOUTHWEST_ARID, 84, 'low',    true, 'high', 'medium', [3, 11]),
  r('okra',  'backyard', C.SOUTHWEST_ARID, 82, 'medium', true, 'high', 'medium', W.WARM_SEASON_S),
  r('tomato','backyard', C.SOUTHWEST_ARID, 74, 'medium', true, 'medium', 'medium', W.WARM_SEASON_S),

  r('pepper','backyard', C.DESERT_IRRIGATED, 86, 'medium', true, 'high', 'medium', W.WARM_SEASON_S),
  r('herbs', 'backyard', C.DESERT_IRRIGATED, 82, 'low',    true, 'high', 'medium', [3, 11]),
  r('tomato','backyard', C.DESERT_IRRIGATED, 74, 'medium', true, 'medium', 'medium', W.WARM_SEASON_S),

  // West Coast / PNW / Mountain / Subarctic / Tropical Pacific.
  r('tomato', 'backyard', C.WEST_COAST_MEDITERRANEAN, 90, 'medium', true, 'high', 'medium', [3, 5]),
  r('lettuce','backyard', C.WEST_COAST_MEDITERRANEAN, 90, 'medium', true, 'high', 'high',   [2, 10]),
  r('strawberry','backyard',C.WEST_COAST_MEDITERRANEAN, 88, 'medium', false,'high','high',  [3, 5]),
  r('herbs',  'backyard', C.WEST_COAST_MEDITERRANEAN, 92, 'low',    true, 'high', 'medium', [2, 11]),
  r('pepper', 'backyard', C.WEST_COAST_MEDITERRANEAN, 84, 'medium', true, 'high', 'medium', [3, 5]),
  r('peas',   'backyard', C.WEST_COAST_MEDITERRANEAN, 82, 'medium', true, 'high', 'low',    [2, 4]),

  r('lettuce','backyard', C.PACIFIC_NORTHWEST_COOL, 92, 'medium', true, 'high', 'medium', [3, 9]),
  r('kale',   'backyard', C.PACIFIC_NORTHWEST_COOL, 92, 'medium', true, 'high', 'medium', [3, 9]),
  r('peas',   'backyard', C.PACIFIC_NORTHWEST_COOL, 90, 'medium', true, 'high', 'low',    [3, 5]),
  r('herbs',  'backyard', C.PACIFIC_NORTHWEST_COOL, 86, 'low',    true, 'high', 'medium', [4, 9]),
  r('potato', 'backyard', C.PACIFIC_NORTHWEST_COOL, 88, 'medium', true, 'high', 'low',    [3, 5]),
  r('strawberry','backyard',C.PACIFIC_NORTHWEST_COOL, 86, 'medium', false,'high','high',  [4, 6]),

  r('lettuce','backyard', C.MOUNTAIN_COOL_DRY, 86, 'low',    true, 'high', 'low',   [4, 7]),
  r('kale',   'backyard', C.MOUNTAIN_COOL_DRY, 84, 'low',    true, 'high', 'low',   [4, 7]),
  r('peas',   'backyard', C.MOUNTAIN_COOL_DRY, 82, 'medium', true, 'high', 'low',   [4, 6]),
  r('herbs',  'backyard', C.MOUNTAIN_COOL_DRY, 82, 'low',    true, 'high', 'low',   [5, 8]),
  r('potato', 'backyard', C.MOUNTAIN_COOL_DRY, 84, 'low',    true, 'high', 'low',   [4, 6]),

  r('lettuce','backyard', C.SUBARCTIC_SHORT_SEASON, 88, 'low',    true, 'high', 'low', [5, 7]),
  r('kale',   'backyard', C.SUBARCTIC_SHORT_SEASON, 86, 'low',    true, 'high', 'low', [5, 7]),
  r('cabbage','backyard', C.SUBARCTIC_SHORT_SEASON, 82, 'medium', true, 'high', 'low', [5, 6]),
  r('potato', 'backyard', C.SUBARCTIC_SHORT_SEASON, 88, 'low',    true, 'high', 'low', [5, 6]),
  r('radish', 'backyard', C.SUBARCTIC_SHORT_SEASON, 82, 'low',    true, 'high', 'low', [5, 7]),

  r('sweet_potato','backyard',C.TROPICAL_PACIFIC, 92, 'medium', true, 'high', 'medium', [1, 12]),
  r('taro',       'backyard', C.TROPICAL_PACIFIC, 88, 'medium', false,'high', 'medium', [1, 12]),
  r('herbs',      'backyard', C.TROPICAL_PACIFIC, 90, 'low',    true, 'high', 'medium', [1, 12]),
  r('pepper',     'backyard', C.TROPICAL_PACIFIC, 88, 'medium', true, 'high', 'medium', [1, 12]),
  r('eggplant',   'backyard', C.TROPICAL_PACIFIC, 84, 'medium', false,'high', 'medium', [1, 12]),
  r('okra',       'backyard', C.TROPICAL_PACIFIC, 86, 'medium', true, 'high', 'medium', [1, 12]),

  r('lower_miss_tomato', 'backyard', C.LOWER_MISSISSIPPI_HUMID, 0, 'low', false, null, null, [1, 12]), // placeholder
];

// Replace placeholder stub above with explicit LOWER_MISS rows.
BACKYARD_RULES.pop();
BACKYARD_RULES.push(
  r('tomato',  'backyard', C.LOWER_MISSISSIPPI_HUMID, 88, 'medium', true, 'high', 'medium', W.WARM_SEASON_S),
  r('okra',    'backyard', C.LOWER_MISSISSIPPI_HUMID, 90, 'medium', true, 'high', 'medium', W.WARM_SEASON_S),
  r('pepper',  'backyard', C.LOWER_MISSISSIPPI_HUMID, 88, 'medium', true, 'high', 'medium', W.WARM_SEASON_S),
  r('sweet_potato','backyard',C.LOWER_MISSISSIPPI_HUMID, 88,'medium', true,'high','medium',[4, 6]),
  r('collards','backyard', C.LOWER_MISSISSIPPI_HUMID, 86, 'medium', true, 'high', 'medium', [8, 10]),
  r('herbs',   'backyard', C.LOWER_MISSISSIPPI_HUMID, 88, 'low',    true, 'high', 'medium', [2, 11]),
);

/* ─────────────────────────────────────────────────────────────
 * SMALL FARM and COMMERCIAL RULES
 * Focus: state agronomic staples, market strength, scale-friendly.
 * ───────────────────────────────────────────────────────────── */

const COMMERCIAL_RULES = [
  // Southeast coastal (GA / NC / SC / AL).
  c('peanut',       'commercial', C.SOUTHEAST_COASTAL, 92, 'very_high', false, [4, 6]),
  c('cotton',       'commercial', C.SOUTHEAST_COASTAL, 88, 'very_high', false, [4, 6]),
  c('soybean',      'commercial', C.SOUTHEAST_COASTAL, 82, 'high',      false, [4, 6]),
  c('corn',         'commercial', C.SOUTHEAST_COASTAL, 82, 'high',      false, [3, 5]),
  c('sweet_potato', 'commercial', C.SOUTHEAST_COASTAL, 80, 'high',      false, [5, 6]),

  // Florida subtropical.
  c('peanut',    'commercial', C.FLORIDA_SUBTROPICAL, 84, 'high',      false, [3, 5]),
  c('citrus',    'commercial', C.FLORIDA_SUBTROPICAL, 92, 'very_high', false, W.WINTER_CITRUS),
  c('sugarcane', 'commercial', C.FLORIDA_SUBTROPICAL, 82, 'high',      false, [10, 2]),
  c('tomato',    'commercial', C.FLORIDA_SUBTROPICAL, 80, 'high',      false, [9, 11]),
  c('pepper',    'commercial', C.FLORIDA_SUBTROPICAL, 80, 'high',      false, [9, 11]),

  // Midwest humid (IA / IL / IN / OH).
  c('corn',    'commercial', C.MIDWEST_HUMID, 95, 'very_high', false, [4, 5]),
  c('soybean', 'commercial', C.MIDWEST_HUMID, 92, 'very_high', false, [5, 6]),
  c('oats',    'commercial', C.MIDWEST_HUMID, 78, 'medium',    false, [3, 5]),
  c('alfalfa', 'commercial', C.MIDWEST_HUMID, 80, 'medium',    false, [4, 5]),

  // Great Plains dry.
  c('sorghum', 'commercial', C.GREAT_PLAINS_DRY, 94, 'very_high', false, [5, 6]),
  c('wheat',   'commercial', C.GREAT_PLAINS_DRY, 92, 'very_high', false, [9, 10]),
  c('corn',    'commercial', C.GREAT_PLAINS_DRY, 80, 'high',      false, [4, 5]),
  c('soybean', 'commercial', C.GREAT_PLAINS_DRY, 74, 'medium',    false, [5, 6]),

  // South Central mixed (TX / OK).
  c('sorghum', 'commercial', C.SOUTH_CENTRAL_MIXED, 94, 'very_high', false, [3, 5]),
  c('cotton',  'commercial', C.SOUTH_CENTRAL_MIXED, 92, 'very_high', false, [3, 5]),
  c('peanut',  'commercial', C.SOUTH_CENTRAL_MIXED, 88, 'very_high', false, [4, 6]),
  c('corn',    'commercial', C.SOUTH_CENTRAL_MIXED, 80, 'high',      false, [3, 4]),
  c('wheat',   'commercial', C.SOUTH_CENTRAL_MIXED, 78, 'high',      false, [9, 11]),

  // Southwest arid / Desert irrigated.
  c('cotton',  'commercial', C.SOUTHWEST_ARID, 80, 'high',      false, [3, 5]),
  c('sorghum', 'commercial', C.SOUTHWEST_ARID, 78, 'high',      false, [4, 6]),
  c('alfalfa', 'commercial', C.SOUTHWEST_ARID, 82, 'high',      false, [3, 4]),
  c('alfalfa', 'commercial', C.DESERT_IRRIGATED, 86, 'high',    false, [3, 4]),
  c('cotton',  'commercial', C.DESERT_IRRIGATED, 80, 'high',    false, [3, 5]),

  // West Coast Mediterranean (California).
  c('tomato',     'commercial', C.WEST_COAST_MEDITERRANEAN, 92, 'very_high', false, [3, 5]),
  c('lettuce',    'commercial', C.WEST_COAST_MEDITERRANEAN, 92, 'very_high', false, [2, 10]),
  c('strawberry', 'commercial', C.WEST_COAST_MEDITERRANEAN, 90, 'very_high', false, [2, 4]),
  c('almonds',    'commercial', C.WEST_COAST_MEDITERRANEAN, 88, 'very_high', false, [12, 2]),
  c('grapes',     'commercial', C.WEST_COAST_MEDITERRANEAN, 88, 'very_high', false, [12, 2]),
  c('citrus',     'commercial', C.WEST_COAST_MEDITERRANEAN, 80, 'high',      false, W.WINTER_CITRUS),

  // Pacific Northwest cool (WA / OR).
  c('apple',  'commercial', C.PACIFIC_NORTHWEST_COOL, 92, 'very_high', false, [3, 4]),
  c('potato', 'commercial', C.PACIFIC_NORTHWEST_COOL, 90, 'very_high', false, [3, 5]),
  c('wheat',  'commercial', C.PACIFIC_NORTHWEST_COOL, 84, 'high',      false, [9, 11]),
  c('berry',  'commercial', C.PACIFIC_NORTHWEST_COOL, 84, 'high',      false, [3, 5]),

  // Mountain cool dry (ID / CO / MT / WY / UT).
  c('barley',  'commercial', C.MOUNTAIN_COOL_DRY, 86, 'high',      false, [4, 5]),
  c('wheat',   'commercial', C.MOUNTAIN_COOL_DRY, 84, 'high',      false, [9, 10]),
  c('potato',  'commercial', C.MOUNTAIN_COOL_DRY, 88, 'very_high', false, [4, 5]),
  c('alfalfa', 'commercial', C.MOUNTAIN_COOL_DRY, 82, 'high',      false, [4, 5]),

  // Subarctic — very limited commercial, greenhouse-heavy.
  c('potato',  'commercial', C.SUBARCTIC_SHORT_SEASON, 78, 'medium', false, [5, 6]),
  c('cabbage', 'commercial', C.SUBARCTIC_SHORT_SEASON, 72, 'medium', false, [5, 6]),
  c('kale',    'commercial', C.SUBARCTIC_SHORT_SEASON, 70, 'medium', false, [5, 6]),

  // Tropical Pacific — Hawaii.
  c('sweet_potato','commercial', C.TROPICAL_PACIFIC, 86, 'high', false, [1, 12]),
  c('taro',        'commercial', C.TROPICAL_PACIFIC, 86, 'high', false, [1, 12]),
  c('sugarcane',   'commercial', C.TROPICAL_PACIFIC, 82, 'high', false, [1, 12]),
  c('citrus',      'commercial', C.TROPICAL_PACIFIC, 80, 'high', false, [1, 12]),

  // Mid-Atlantic (PA / MD / DE / NJ / VA / DC / WV).
  c('corn',    'commercial', C.MID_ATLANTIC, 88, 'very_high', false, [4, 5]),
  c('soybean', 'commercial', C.MID_ATLANTIC, 88, 'very_high', false, [5, 6]),
  c('tomato',  'commercial', C.MID_ATLANTIC, 76, 'high',      false, [4, 6]),
  c('wheat',   'commercial', C.MID_ATLANTIC, 78, 'high',      false, [9, 11]),

  // Lower Mississippi humid (LA / MS / AR / TN).
  c('cotton',  'commercial', C.LOWER_MISSISSIPPI_HUMID, 90, 'very_high', false, [4, 5]),
  c('soybean', 'commercial', C.LOWER_MISSISSIPPI_HUMID, 90, 'very_high', false, [5, 6]),
  c('corn',    'commercial', C.LOWER_MISSISSIPPI_HUMID, 84, 'high',      false, [3, 5]),
  c('sugarcane','commercial',C.LOWER_MISSISSIPPI_HUMID, 80, 'high',      false, [1, 3]),
  c('sweet_potato','commercial',C.LOWER_MISSISSIPPI_HUMID, 80,'high',   false, [4, 6]),

  // Northeast coastal — small-scale focus, limited large-scale commodity.
  c('corn',    'commercial', C.NORTHEAST_COASTAL, 72, 'medium', false, [4, 6]),
  c('apple',   'commercial', C.NORTHEAST_COASTAL, 82, 'high',   false, [3, 5]),
  c('berry',   'commercial', C.NORTHEAST_COASTAL, 80, 'high',   false, [4, 6]),
  c('potato',  'commercial', C.NORTHEAST_COASTAL, 78, 'medium', false, [4, 6]),
];

// Small-farm rules cover the same staples as commercial, but with a
// slight premium on beginner/diverse picks and direct-market crops
// (berries, strawberries, vegetables, herbs).
const SMALL_FARM_RULES = [
  ...COMMERCIAL_RULES.map((row) => ({
    ...row,
    farmType: 'small_farm',
    beginnerFriendly: ['peanut', 'sorghum', 'tomato', 'soybean', 'sweet_potato', 'potato', 'berry'].includes(row.crop)
      ? true
      : row.beginnerFriendly,
    localSellValue: 'high',
  })),
  // Small-farm specific additions — direct-market vegetables & berries.
  c('strawberry','small_farm', C.MID_ATLANTIC,            86, 'high', true, [4, 5], { localSellValue: 'very_high' }),
  c('berry',     'small_farm', C.MID_ATLANTIC,            82, 'high', true, [4, 6], { localSellValue: 'very_high' }),
  c('tomato',    'small_farm', C.NORTHEAST_COASTAL,       82, 'high', true, [4, 6], { localSellValue: 'very_high' }),
  c('berry',     'small_farm', C.NORTHEAST_COASTAL,       84, 'high', true, [4, 6], { localSellValue: 'very_high' }),
  c('strawberry','small_farm', C.NORTHEAST_COASTAL,       84, 'high', true, [4, 5], { localSellValue: 'very_high' }),
  c('tomato',    'small_farm', C.MIDWEST_HUMID,           84, 'high', true, [4, 6], { localSellValue: 'high' }),
  c('strawberry','small_farm', C.MIDWEST_HUMID,           80, 'high', true, [4, 5], { localSellValue: 'high' }),
];

/**
 * STATE_OVERRIDES — narrow adjustments keyed by (state, crop, farmType).
 * Rare; most logic lives at the climate subregion level.
 */
export const STATE_OVERRIDES = Object.freeze({
  // Cassava is tropical-only. Keep it quietly suppressed everywhere
  // except HI (even then it's capped; Hawaii skews to taro/sweet potato).
  HI: {
    cassava: { commercial: { suitabilityBaseScore: 55, marketStrength: 'medium' } },
  },
});

/** All rule rows in one flat list. */
export const ALL_RULES = Object.freeze([
  ...BACKYARD_RULES,
  ...SMALL_FARM_RULES,
  ...COMMERCIAL_RULES,
]);

/**
 * Index rules for fast lookup:
 *   ruleIndex[farmType][climateSubregion] = [row, row, …]
 */
export function buildRuleIndex(rows = ALL_RULES) {
  const ix = {};
  for (const row of rows) {
    ((ix[row.farmType] ||= {})[row.climateSubregion] ||= []).push(row);
  }
  return ix;
}

/** Pre-built default index (most callers want this). */
export const RULE_INDEX = buildRuleIndex();

// ─── helpers to keep rule tables compact ─────────────────────
function r(crop, farmType, climateSubregion, base, market, beginnerFriendly, homeUseValue, localSellValue, window) {
  return {
    crop, farmType, climateSubregion,
    suitabilityBaseScore: base,
    marketStrength: market,
    beginnerFriendly: !!beginnerFriendly,
    homeUseValue: homeUseValue || null,
    localSellValue: localSellValue || null,
    plantingStartMonth: window[0],
    plantingEndMonth: window[1],
  };
}

function c(crop, farmType, climateSubregion, base, market, beginnerFriendly, window, extras = {}) {
  return {
    crop, farmType, climateSubregion,
    suitabilityBaseScore: base,
    marketStrength: market,
    beginnerFriendly: !!beginnerFriendly,
    homeUseValue: null,
    localSellValue: null,
    plantingStartMonth: window[0],
    plantingEndMonth: window[1],
    ...extras,
  };
}
