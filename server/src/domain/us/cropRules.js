/**
 * cropRules.js — rule tables generated from the spec's seed
 * templates (sections C, D, E, F).
 *
 * Rather than hand-authoring hundreds of rows, we:
 *   1. Start from subregion defaults (commercial + backyard).
 *   2. Apply state-specific overrides that boost the stronger crops.
 *   3. Derive small-farm rules from commercial + a direct-market tilt.
 *
 * Each generated row has the shape:
 *   {
 *     crop, farmType, climateSubregion,
 *     suitabilityBaseScore: 0..100,
 *     marketStrength:       'low' | 'medium' | 'high',
 *     beginnerFriendly:     boolean,
 *     homeUseValue:         'low' | 'medium' | 'high' | null,
 *     localSellValue:       'low' | 'medium' | 'high' | null,
 *     plantingStartMonth:   1..12,
 *     plantingEndMonth:     1..12,
 *   }
 *
 * stateCode on a row is optional; when present it means the row was
 * produced by an override and should outrank a generic subregion row.
 * The scoring engine keeps the higher base.
 */

import { CLIMATE_SUBREGIONS as C, US_STATES } from './usStates.js';
import { CROP_PROFILES } from './cropProfiles.js';

/**
 * Map the spec's human crop names to our CROP_PROFILES keys.
 * Adding aliases here keeps the spec templates human-readable while
 * preserving a single canonical key space in cropProfiles.js.
 */
const CROP_NAME_TO_KEY = {
  'Tomato': 'tomato', 'Pepper': 'pepper', 'Chili Pepper': 'chili_pepper',
  'Lettuce': 'lettuce', 'Spinach': 'spinach', 'Kale': 'kale',
  'Onion': 'onion', 'Garlic': 'garlic', 'Beans': 'beans',
  'Bush Beans': 'bush_beans', 'Pole Beans': 'pole_beans',
  'Cucumber': 'cucumber', 'Squash': 'squash', 'Zucchini': 'zucchini',
  'Herbs': 'herbs', 'Okra': 'okra', 'Sweet Potato': 'sweet_potato',
  'Strawberry': 'strawberry', 'Eggplant': 'eggplant', 'Carrot': 'carrot',
  'Radish': 'radish', 'Beets': 'beets', 'Cabbage': 'cabbage',
  'Broccoli': 'broccoli', 'Peas': 'peas', 'Green Onion': 'green_onion',
  'Collards': 'collards', 'Swiss Chard': 'swiss_chard', 'Pumpkin': 'pumpkin',
  'Peppers': 'pepper', 'Sweet Corn': 'sweet_corn',
  'Peanut': 'peanut', 'Cotton': 'cotton', 'Soybean': 'soybean',
  'Corn': 'corn', 'Wheat': 'wheat', 'Sorghum': 'sorghum',
  'Oats': 'oats', 'Alfalfa': 'alfalfa', 'Rice': 'rice',
  'Citrus': 'citrus', 'Sugarcane': 'sugarcane', 'Grapes': 'grapes',
  'Almonds': 'almonds', 'Potato': 'potato', 'Apple': 'apple',
  'Blueberry': 'blueberry', 'Raspberry': 'raspberry',
  'Sunflower': 'sunflower', 'Barley': 'barley',
  'Taro': 'taro', 'Banana': 'banana', 'Papaya': 'papaya',
  'Pineapple': 'pineapple', 'Melon': 'melon', 'Pecan': 'pecan',
  'Cassava': 'cassava',
  // Collective labels from spec — mapped to a representative crop so
  // they still produce a real card. They're kept as strong-market
  // signals rather than separate profiles.
  'Vegetables': 'tomato',
  'Berry Crops': 'blueberry',
};

/** Turn a spec crop label into the canonical profile key. */
function key(label) { return CROP_NAME_TO_KEY[label] || null; }

/* ─── C) Commercial defaults by subregion (from spec) ────── */
const COMMERCIAL_DEFAULTS = {
  [C.NORTHEAST_COASTAL]:        ['Tomato', 'Lettuce', 'Potato', 'Apple', 'Cabbage', 'Blueberry', 'Corn', 'Soybean'],
  [C.MID_ATLANTIC]:              ['Corn', 'Soybean', 'Tomato', 'Lettuce', 'Wheat', 'Peppers', 'Sweet Corn', 'Cucumber'],
  [C.SOUTHEAST_COASTAL]:         ['Peanut', 'Cotton', 'Soybean', 'Corn', 'Sweet Potato', 'Tomato', 'Pepper', 'Okra'],
  [C.FLORIDA_SUBTROPICAL]:       ['Peanut', 'Citrus', 'Tomato', 'Pepper', 'Sugarcane', 'Vegetables', 'Sweet Potato'],
  [C.MIDWEST_HUMID]:             ['Corn', 'Soybean', 'Oats', 'Alfalfa', 'Wheat', 'Potato', 'Tomato'],
  [C.GREAT_PLAINS_DRY]:          ['Sorghum', 'Wheat', 'Corn', 'Soybean', 'Alfalfa', 'Sunflower'],
  [C.SOUTH_CENTRAL_MIXED]:       ['Sorghum', 'Cotton', 'Peanut', 'Corn', 'Wheat', 'Soybean', 'Okra', 'Sweet Potato'],
  [C.SOUTHWEST_ARID]:            ['Cotton', 'Alfalfa', 'Sorghum', 'Chili Pepper', 'Onion', 'Pecan'],
  [C.WEST_COAST_MEDITERRANEAN]:  ['Tomato', 'Lettuce', 'Strawberry', 'Grapes', 'Almonds', 'Citrus', 'Vegetables'],
  [C.PACIFIC_NORTHWEST_COOL]:    ['Potato', 'Wheat', 'Apple', 'Blueberry', 'Raspberry', 'Lettuce', 'Cabbage'],
  [C.MOUNTAIN_COOL_DRY]:         ['Barley', 'Wheat', 'Potato', 'Alfalfa', 'Cabbage', 'Carrot'],
  [C.DESERT_IRRIGATED]:          ['Alfalfa', 'Cotton', 'Lettuce', 'Onion', 'Melon', 'Tomato'],
  [C.LOWER_MISSISSIPPI_HUMID]:   ['Soybean', 'Rice', 'Corn', 'Cotton', 'Sweet Potato', 'Tomato', 'Pepper'],
  [C.ALASKA_SHORT_SEASON]:       ['Potato', 'Cabbage', 'Kale', 'Carrot', 'Lettuce'],
  [C.HAWAII_TROPICAL]:           ['Sweet Potato', 'Taro', 'Tomato', 'Pepper', 'Banana', 'Papaya', 'Pineapple'],
};

/* ─── D) Backyard defaults by subregion (from spec) ────── */
const BACKYARD_DEFAULTS = {
  [C.NORTHEAST_COASTAL]:        ['Tomato', 'Lettuce', 'Spinach', 'Kale', 'Carrot', 'Beans', 'Cucumber', 'Herbs', 'Peas', 'Cabbage'],
  [C.MID_ATLANTIC]:              ['Tomato', 'Pepper', 'Lettuce', 'Beans', 'Cucumber', 'Squash', 'Herbs', 'Kale', 'Carrot'],
  [C.SOUTHEAST_COASTAL]:         ['Tomato', 'Pepper', 'Okra', 'Beans', 'Cucumber', 'Squash', 'Sweet Potato', 'Herbs', 'Collards'],
  [C.FLORIDA_SUBTROPICAL]:       ['Tomato', 'Pepper', 'Okra', 'Sweet Potato', 'Eggplant', 'Herbs', 'Beans', 'Cucumber'],
  [C.MIDWEST_HUMID]:             ['Tomato', 'Lettuce', 'Kale', 'Beans', 'Cucumber', 'Carrot', 'Onion', 'Zucchini', 'Herbs'],
  [C.GREAT_PLAINS_DRY]:          ['Tomato', 'Pepper', 'Beans', 'Onion', 'Squash', 'Cucumber', 'Herbs', 'Kale'],
  [C.SOUTH_CENTRAL_MIXED]:       ['Tomato', 'Pepper', 'Okra', 'Beans', 'Cucumber', 'Squash', 'Herbs', 'Sweet Potato'],
  [C.SOUTHWEST_ARID]:            ['Pepper', 'Tomato', 'Onion', 'Beans', 'Herbs', 'Squash', 'Melon'],
  [C.WEST_COAST_MEDITERRANEAN]:  ['Tomato', 'Pepper', 'Lettuce', 'Strawberry', 'Beans', 'Cucumber', 'Herbs', 'Zucchini'],
  [C.PACIFIC_NORTHWEST_COOL]:    ['Lettuce', 'Kale', 'Cabbage', 'Peas', 'Carrot', 'Potato', 'Herbs', 'Strawberry'],
  [C.MOUNTAIN_COOL_DRY]:         ['Lettuce', 'Kale', 'Carrot', 'Beans', 'Potato', 'Cabbage', 'Herbs'],
  [C.DESERT_IRRIGATED]:          ['Pepper', 'Tomato', 'Herbs', 'Onion', 'Beans', 'Melon'],
  [C.LOWER_MISSISSIPPI_HUMID]:   ['Tomato', 'Pepper', 'Okra', 'Beans', 'Sweet Potato', 'Herbs', 'Squash'],
  [C.ALASKA_SHORT_SEASON]:       ['Lettuce', 'Kale', 'Cabbage', 'Potato', 'Carrot', 'Herbs'],
  [C.HAWAII_TROPICAL]:           ['Sweet Potato', 'Tomato', 'Pepper', 'Eggplant', 'Herbs', 'Taro'],
};

/* ─── E) State-specific commercial overrides ────────────── */
const STATE_COMMERCIAL_OVERRIDES = {
  'Georgia':       ['Peanut', 'Cotton', 'Soybean', 'Corn', 'Sweet Potato'],
  'Florida':       ['Peanut', 'Citrus', 'Tomato', 'Pepper', 'Sugarcane', 'Vegetables'],
  'Texas':         ['Sorghum', 'Cotton', 'Peanut', 'Corn', 'Wheat'],
  'Kansas':        ['Sorghum', 'Wheat', 'Corn', 'Soybean'],
  'Iowa':          ['Corn', 'Soybean', 'Oats', 'Alfalfa'],
  'California':    ['Tomato', 'Lettuce', 'Strawberry', 'Grapes', 'Almonds', 'Citrus'],
  'Washington':    ['Apple', 'Potato', 'Wheat', 'Blueberry'],
  'Oregon':        ['Potato', 'Berry Crops', 'Wheat', 'Vegetables'],
  'Maryland':      ['Corn', 'Soybean', 'Tomato', 'Vegetables'],
  'Pennsylvania':  ['Corn', 'Soybean', 'Apple', 'Potato'],
  'Louisiana':     ['Rice', 'Soybean', 'Sugarcane', 'Cotton'],
  'Mississippi':   ['Soybean', 'Rice', 'Cotton', 'Corn'],
  'Arkansas':      ['Rice', 'Soybean', 'Cotton', 'Corn'],
  'Nebraska':      ['Corn', 'Soybean', 'Alfalfa', 'Wheat'],
  'North Dakota':  ['Wheat', 'Barley', 'Sunflower', 'Soybean'],
  'South Dakota':  ['Corn', 'Soybean', 'Wheat', 'Sunflower'],
  'Arizona':       ['Cotton', 'Lettuce', 'Alfalfa', 'Onion'],
  'Nevada':        ['Alfalfa', 'Onion', 'Melon'],
  'Alaska':        ['Potato', 'Cabbage', 'Kale'],
  'Hawaii':        ['Taro', 'Sweet Potato', 'Banana', 'Papaya', 'Pineapple'],
};

/* ─── F) State-specific backyard overrides ──────────────── */
const STATE_BACKYARD_OVERRIDES = {
  'Texas':       ['Tomato', 'Pepper', 'Okra', 'Herbs', 'Bush Beans', 'Squash', 'Cucumber', 'Sweet Potato'],
  'Florida':     ['Tomato', 'Pepper', 'Okra', 'Sweet Potato', 'Eggplant', 'Herbs'],
  'Georgia':     ['Tomato', 'Pepper', 'Okra', 'Bush Beans', 'Squash', 'Sweet Potato', 'Herbs'],
  'Iowa':        ['Tomato', 'Lettuce', 'Kale', 'Beans', 'Carrot', 'Onion', 'Cucumber'],
  'California':  ['Tomato', 'Pepper', 'Lettuce', 'Strawberry', 'Herbs', 'Beans', 'Cucumber'],
  'Maryland':    ['Tomato', 'Pepper', 'Lettuce', 'Herbs', 'Beans', 'Kale', 'Cucumber'],
  'Washington':  ['Lettuce', 'Kale', 'Herbs', 'Peas', 'Strawberry', 'Potato'],
  'Alaska':      ['Lettuce', 'Kale', 'Cabbage', 'Potato', 'Carrot'],
  'Hawaii':      ['Sweet Potato', 'Tomato', 'Pepper', 'Eggplant', 'Herbs', 'Taro'],
};

/* ─── Planting window heuristics by subregion ─────────────
 * Spec section H maps months 3–5 / 6–8 / 9–11 / 12–2 to
 * spring / summer / fall / winter. These windows approximate the
 * primary outdoor planting window for a crop family in each climate.
 * The scoring engine uses them to give in-window +8 / out-of-window -12. */
const COOL_SEASON_WINDOW_N  = [3, 5];   // Mar–May cool zones
const COOL_SEASON_WINDOW_S  = [2, 4];   // Feb–Apr shoulder
const WARM_SEASON_WINDOW_N  = [4, 6];   // Apr–Jun cool/temperate
const WARM_SEASON_WINDOW_S  = [3, 5];   // Mar–May warm south
const WARM_SEASON_WINDOW_HS = [2, 5];   // Feb–May very hot subtropical
const YEAR_ROUND_TROPICAL   = [1, 12];
const YEAR_ROUND_SUBTROPICAL_VEG = [9, 4]; // Sep–Apr (wrap) for FL veg winter
const WINTER_CITRUS         = [2, 4];
const GRAIN_FALL            = [9, 11];
const GRAIN_SPRING          = [4, 5];
const ORCHARD_PREP          = [3, 4];

/** Heuristic picker: given a subregion + crop, return its planting window. */
function pickWindow(subregion, cropKey) {
  const p = CROP_PROFILES[cropKey];
  if (!p) return [3, 5];
  const isCool = p.heatTolerance === 'low';
  const isWarm = p.heatTolerance === 'high' || p.frostSensitive;

  switch (subregion) {
    case C.ALASKA_SHORT_SEASON:
      return [5, 6]; // only a short summer window works outdoors
    case C.HAWAII_TROPICAL:
      return YEAR_ROUND_TROPICAL;
    case C.FLORIDA_SUBTROPICAL:
      if (['citrus'].includes(cropKey)) return WINTER_CITRUS;
      if (['tomato', 'pepper', 'eggplant', 'lettuce'].includes(cropKey)) return YEAR_ROUND_SUBTROPICAL_VEG;
      if (['sugarcane', 'peanut'].includes(cropKey)) return [3, 5];
      return WARM_SEASON_WINDOW_HS;
    case C.SOUTHEAST_COASTAL:
    case C.SOUTH_CENTRAL_MIXED:
    case C.LOWER_MISSISSIPPI_HUMID:
      if (isCool) return COOL_SEASON_WINDOW_S;
      return WARM_SEASON_WINDOW_S;
    case C.SOUTHWEST_ARID:
    case C.DESERT_IRRIGATED:
      if (['wheat', 'barley'].includes(cropKey)) return GRAIN_FALL;
      if (isCool) return COOL_SEASON_WINDOW_S;
      return WARM_SEASON_WINDOW_S;
    case C.WEST_COAST_MEDITERRANEAN:
      if (['citrus', 'grapes', 'almonds', 'pecan'].includes(cropKey)) return ORCHARD_PREP;
      if (isCool) return [2, 4];
      return WARM_SEASON_WINDOW_S;
    case C.PACIFIC_NORTHWEST_COOL:
    case C.MOUNTAIN_COOL_DRY:
      if (['wheat', 'barley'].includes(cropKey)) return GRAIN_FALL;
      if (isCool) return [3, 5];
      return WARM_SEASON_WINDOW_N;
    case C.GREAT_PLAINS_DRY:
      if (['wheat'].includes(cropKey)) return GRAIN_FALL;
      if (['barley', 'oats'].includes(cropKey)) return GRAIN_SPRING;
      return WARM_SEASON_WINDOW_N;
    case C.MIDWEST_HUMID:
      if (['wheat'].includes(cropKey)) return GRAIN_FALL;
      if (isCool) return [3, 5];
      return WARM_SEASON_WINDOW_N;
    case C.MID_ATLANTIC:
    case C.NORTHEAST_COASTAL:
    default:
      if (isCool) return [3, 5];
      if (isWarm) return WARM_SEASON_WINDOW_N;
      return [4, 6];
  }
}

/** Commercial-only crops are never emitted into the backyard table. */
const COMMERCIAL_ONLY = new Set(['cotton', 'rice', 'sugarcane', 'almonds', 'pecan', 'alfalfa', 'sorghum']);

/** Strong market signal used when a state override boosts a crop. */
function marketFor(crop, isOverridden) {
  const p = CROP_PROFILES[crop] || {};
  if (isOverridden) return 'high';
  if (p.defaultTags?.includes('commercial')) return 'medium';
  return 'medium';
}

/** Home-use value for backyard rules. */
function homeUseFor(crop) {
  const p = CROP_PROFILES[crop];
  if (!p) return null;
  if (['tomato', 'pepper', 'lettuce', 'herbs', 'beans', 'bush_beans', 'pole_beans',
       'cucumber', 'sweet_potato', 'kale', 'okra'].includes(crop)) return 'high';
  return 'medium';
}

/** Seasonal sell-market value for backyard rules. */
function localSellFor(crop) {
  if (['tomato', 'pepper', 'herbs', 'strawberry', 'lettuce', 'cucumber', 'blueberry', 'raspberry'].includes(crop)) {
    return 'high';
  }
  return 'medium';
}

function isBeginnerFriendly(crop) {
  const p = CROP_PROFILES[crop];
  return !!p && p.difficulty === 'beginner';
}

// ─── Rule builders ────────────────────────────────────────────

function buildBackyardRow({ cropLabel, climateSubregion, stateCode, override }) {
  const crop = key(cropLabel);
  if (!crop) return null;
  if (COMMERCIAL_ONLY.has(crop)) return null;
  if (!CROP_PROFILES[crop].containerFriendly && !CROP_PROFILES[crop].raisedBedFriendly && !CROP_PROFILES[crop].inGroundFriendly) {
    return null;
  }
  const base = override ? 90 : 82;
  const [plantingStartMonth, plantingEndMonth] = pickWindow(climateSubregion, crop);
  return {
    crop, farmType: 'backyard', climateSubregion,
    stateCode: stateCode || null,
    suitabilityBaseScore: base,
    marketStrength: 'medium',
    beginnerFriendly: isBeginnerFriendly(crop),
    homeUseValue: homeUseFor(crop),
    localSellValue: localSellFor(crop),
    plantingStartMonth, plantingEndMonth,
  };
}

function buildCommercialRow({ cropLabel, climateSubregion, stateCode, override }) {
  const crop = key(cropLabel);
  if (!crop) return null;
  const base = override ? 93 : 84;
  const [plantingStartMonth, plantingEndMonth] = pickWindow(climateSubregion, crop);
  return {
    crop, farmType: 'commercial', climateSubregion,
    stateCode: stateCode || null,
    suitabilityBaseScore: base,
    marketStrength: marketFor(crop, !!override),
    beginnerFriendly: false,
    homeUseValue: null,
    localSellValue: null,
    plantingStartMonth, plantingEndMonth,
  };
}

function buildSmallFarmRowFromCommercial(row) {
  return {
    ...row,
    farmType: 'small_farm',
    // Small farms lean into direct-market. Strawberries, berries,
    // tomatoes, peppers, herbs score better on local sell value.
    beginnerFriendly: ['tomato', 'strawberry', 'sweet_potato', 'potato', 'blueberry', 'raspberry'].includes(row.crop),
    localSellValue: ['tomato', 'strawberry', 'blueberry', 'raspberry', 'pepper', 'herbs'].includes(row.crop) ? 'high' : 'medium',
  };
}

// ─── Build the default rule tables from seed templates ────────

const ALL_RULES_RAW = [];

// 1) Commercial defaults by subregion.
for (const [subregion, cropList] of Object.entries(COMMERCIAL_DEFAULTS)) {
  for (const label of cropList) {
    const row = buildCommercialRow({ cropLabel: label, climateSubregion: subregion, override: false });
    if (row) ALL_RULES_RAW.push(row);
  }
}
// 2) Backyard defaults by subregion.
for (const [subregion, cropList] of Object.entries(BACKYARD_DEFAULTS)) {
  for (const label of cropList) {
    const row = buildBackyardRow({ cropLabel: label, climateSubregion: subregion, override: false });
    if (row) ALL_RULES_RAW.push(row);
  }
}

// 3) State-specific commercial overrides — emitted with higher base.
for (const [stateName, cropList] of Object.entries(STATE_COMMERCIAL_OVERRIDES)) {
  const stateCode = stateNameToCode(stateName);
  if (!stateCode) continue;
  const climateSubregion = US_STATES[stateCode].climateSubregion;
  for (const label of cropList) {
    const row = buildCommercialRow({
      cropLabel: label, climateSubregion, stateCode, override: true,
    });
    if (row) ALL_RULES_RAW.push(row);
  }
}

// 4) State-specific backyard overrides.
for (const [stateName, cropList] of Object.entries(STATE_BACKYARD_OVERRIDES)) {
  const stateCode = stateNameToCode(stateName);
  if (!stateCode) continue;
  const climateSubregion = US_STATES[stateCode].climateSubregion;
  for (const label of cropList) {
    const row = buildBackyardRow({
      cropLabel: label, climateSubregion, stateCode, override: true,
    });
    if (row) ALL_RULES_RAW.push(row);
  }
}

// 5) Small-farm rules derived from commercial (spec says small_farm
//    may blend but must stay distinct).
const commercialRows = ALL_RULES_RAW.filter((r) => r.farmType === 'commercial');
const smallFarmRows = commercialRows.map(buildSmallFarmRowFromCommercial);
ALL_RULES_RAW.push(...smallFarmRows);

// 6) STATE_OVERRIDES — narrow score adjustments applied after match.
export const STATE_OVERRIDES = Object.freeze({
  // Hawaii gets a modest cassava entry; elsewhere cassava stays suppressed.
  HI: {
    cassava: { commercial: { suitabilityBaseScore: 55, marketStrength: 'medium' } },
  },
});

/**
 * De-duplicate rows so each (crop × farmType × subregion × stateCode)
 * appears once, keeping the highest base score. Deterministic.
 */
function dedupeRules(rows) {
  const byKey = new Map();
  for (const r of rows) {
    const k = `${r.crop}|${r.farmType}|${r.climateSubregion}|${r.stateCode || ''}`;
    const prev = byKey.get(k);
    if (!prev || r.suitabilityBaseScore > prev.suitabilityBaseScore) byKey.set(k, r);
  }
  return Array.from(byKey.values());
}

export const ALL_RULES = Object.freeze(dedupeRules(ALL_RULES_RAW));

/**
 * Index rules for fast lookup:
 *   ruleIndex[farmType][climateSubregion] = row[]
 * If a state-level override exists it's emitted before the generic
 * row; the scoring engine picks the higher base.
 */
export function buildRuleIndex(rows = ALL_RULES) {
  const ix = {};
  for (const row of rows) {
    ((ix[row.farmType] ||= {})[row.climateSubregion] ||= []).push(row);
  }
  return ix;
}

export const RULE_INDEX = buildRuleIndex();

// ─── helpers ─────────────────────────────────────────────────

function stateNameToCode(name) {
  for (const [code, entry] of Object.entries(US_STATES)) {
    if (entry.name === name) return code;
  }
  return null;
}
