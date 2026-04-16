/**
 * Season & Profit Rules Engine
 *
 * Deterministic, rule-based assessment of whether a crop is a good choice
 * for profit at the current time of year in the farmer's region.
 *
 * No AI. Every output is traceable to a specific planting-window rule.
 *
 * ─── How it works ───
 *
 * 1. PLANTING_WINDOWS defines per-crop, per-region planting months:
 *    - good:  primary planting window — best chance of profit
 *    - okay:  possible but suboptimal — moderate chance
 *    - (other months): poor timing — not the best time
 *
 * 2. assessSeasonProfit() checks the current month against the window
 *    and returns { seasonFit, profitFit, riskLevel, messageKey, alternatives }.
 *
 * 3. getSeasonScore() returns a numeric score for the recommendation engine.
 *
 * ─── Region season patterns ───
 *
 * East Africa (KE, TZ, UG, ET, RW):
 *   Long rains: Mar–May, Short rains: Oct–Dec, Dry: Jan–Feb, Jun–Sep
 *
 * West Africa (NG, GH, SN, ML):
 *   Main rains: Apr–Sep (south) / Jun–Sep (north), Dry: Oct–Mar
 *
 * Southern Africa (ZA, ZM, ZW, MW, MZ):
 *   Main rains: Nov–Mar, Dry: Apr–Oct
 *
 * Central Africa (CM, CD, CG):
 *   Bimodal near equator: Mar–Jun, Sep–Nov; Dry: Dec–Feb, Jul–Aug
 */

import {
  getRegionForCountry,
  getBeginnerCropsForCountry,
  getCropsForCountry,
  getCatalogEntry,
} from '../data/cropRegionCatalog.js';

// ─── Planting windows ───────────────────────────────────────
// Months are 0-indexed (0=Jan, 11=Dec).
// 'good' = primary planting season, 'okay' = possible but suboptimal.
// Anything not listed is implicitly 'poor'.

const PLANTING_WINDOWS = {
  // ── East Africa ──
  east_africa: {
    MAIZE:        { good: [2, 3, 4],       okay: [8, 9] },
    BEAN:         { good: [2, 3, 9, 10],   okay: [4, 8] },
    RICE:         { good: [2, 3, 4],       okay: [8, 9] },
    SORGHUM:      { good: [2, 3],          okay: [8, 9, 10] },
    MILLET:       { good: [2, 3],          okay: [9, 10] },
    WHEAT:        { good: [5, 6, 7],       okay: [8] },
    GROUNDNUT:    { good: [2, 3, 4],       okay: [9, 10] },
    COWPEA:       { good: [2, 3, 9],       okay: [4, 10] },
    CASSAVA:      { good: [2, 3, 4],       okay: [9, 10] },
    SWEET_POTATO: { good: [2, 3, 4],       okay: [9, 10] },
    YAM:          { good: [2, 3],          okay: [4] },
    POTATO:       { good: [2, 3, 8, 9],    okay: [4, 10] },
    TOMATO:       { good: [8, 9, 10],      okay: [2, 3] },
    ONION:        { good: [5, 6],          okay: [0, 1, 7] },
    PEPPER:       { good: [2, 3, 9],       okay: [4, 10] },
    OKRA:         { good: [2, 3],          okay: [9, 10] },
    CABBAGE:      { good: [2, 3, 8, 9],    okay: [4, 10] },
    KALE:         { good: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], okay: [] },  // year-round
    SPINACH:      { good: [2, 3, 4, 8, 9, 10], okay: [0, 1, 5, 6, 7, 11] },
    BANANA:       { good: [2, 3, 4],       okay: [9, 10] },
    PLANTAIN:     { good: [2, 3, 4],       okay: [9, 10] },
    MANGO:        { good: [9, 10, 11],     okay: [2, 3] },
    COFFEE:       { good: [3, 4],          okay: [9, 10] },
    TEA:          { good: [2, 3, 4],       okay: [9, 10] },
    SUGARCANE:    { good: [2, 3],          okay: [9, 10] },
    SUNFLOWER:    { good: [2, 3],          okay: [8, 9] },
    AVOCADO:      { good: [2, 3, 4],       okay: [9, 10] },
    CUCUMBER:     { good: [2, 3, 9, 10],   okay: [4, 8] },
    WATERMELON:   { good: [9, 10],         okay: [2, 3] },
    CARROT:       { good: [2, 3, 8, 9],    okay: [4, 10] },
    EGGPLANT:     { good: [2, 3, 9, 10],   okay: [4, 8] },
    CHILI:        { good: [2, 3, 9],       okay: [4, 10] },
    GINGER:       { good: [2, 3],          okay: [4] },
    GARLIC:       { good: [2, 3],          okay: [8, 9] },
    PAPAYA:       { good: [2, 3, 9, 10],   okay: [4, 8] },
    SOYBEAN:      { good: [2, 3],          okay: [9, 10] },
    PEA:          { good: [2, 3, 8, 9],    okay: [4, 10] },
    SESAME:       { good: [2, 3],          okay: [9] },
    PINEAPPLE:    { good: [2, 3, 4],       okay: [9, 10] },
    COTTON:       { good: [2, 3],          okay: [4] },
  },

  // ── West Africa ──
  west_africa: {
    MAIZE:        { good: [3, 4, 5],       okay: [7, 8] },
    BEAN:         { good: [6, 7],          okay: [3, 4] },
    RICE:         { good: [5, 6, 7],       okay: [3, 4] },
    SORGHUM:      { good: [5, 6],          okay: [7] },
    MILLET:       { good: [5, 6],          okay: [7] },
    WHEAT:        { good: [10, 11],        okay: [0] },
    GROUNDNUT:    { good: [4, 5, 6],       okay: [7] },
    COWPEA:       { good: [6, 7],          okay: [5, 8] },
    CASSAVA:      { good: [3, 4, 5],       okay: [8, 9] },
    SWEET_POTATO: { good: [4, 5],          okay: [6, 7] },
    YAM:          { good: [2, 3, 4],       okay: [5] },
    POTATO:       { good: [9, 10],         okay: [3, 4] },
    TOMATO:       { good: [8, 9, 10],      okay: [2, 3] },
    ONION:        { good: [9, 10, 11],     okay: [0, 1] },
    PEPPER:       { good: [3, 4, 5],       okay: [8, 9] },
    OKRA:         { good: [3, 4, 5],       okay: [6, 7] },
    CABBAGE:      { good: [8, 9],          okay: [3, 4] },
    SPINACH:      { good: [3, 4, 8, 9],    okay: [5, 10] },
    BANANA:       { good: [3, 4, 5],       okay: [8, 9] },
    PLANTAIN:     { good: [3, 4, 5],       okay: [8, 9] },
    MANGO:        { good: [4, 5],          okay: [3] },
    COFFEE:       { good: [4, 5],          okay: [3] },
    COCOA:        { good: [3, 4, 5],       okay: [6] },
    PALM_OIL:     { good: [3, 4, 5],       okay: [6] },
    SUGARCANE:    { good: [3, 4],          okay: [9, 10] },
    COTTON:       { good: [5, 6],          okay: [7] },
    CUCUMBER:     { good: [3, 4, 8, 9],    okay: [5, 10] },
    WATERMELON:   { good: [9, 10, 11],     okay: [2, 3] },
    CARROT:       { good: [8, 9, 10],      okay: [3, 4] },
    EGGPLANT:     { good: [3, 4, 8, 9],    okay: [5, 10] },
    CHILI:        { good: [3, 4, 5],       okay: [8, 9] },
    GINGER:       { good: [3, 4],          okay: [5] },
    GARLIC:       { good: [9, 10],         okay: [11] },
    PAPAYA:       { good: [3, 4, 5],       okay: [8, 9] },
    SOYBEAN:      { good: [5, 6],          okay: [7] },
    SESAME:       { good: [6, 7],          okay: [5] },
    SUNFLOWER:    { good: [5, 6],          okay: [7, 8] },
    PINEAPPLE:    { good: [3, 4, 5],       okay: [8, 9] },
  },

  // ── Southern Africa ──
  southern_africa: {
    MAIZE:        { good: [10, 11, 0],     okay: [1] },
    BEAN:         { good: [10, 11, 0],     okay: [1, 2] },
    RICE:         { good: [10, 11],        okay: [0, 1] },
    SORGHUM:      { good: [10, 11, 0],     okay: [1] },
    MILLET:       { good: [10, 11],        okay: [0] },
    WHEAT:        { good: [4, 5, 6],       okay: [3, 7] },
    GROUNDNUT:    { good: [10, 11, 0],     okay: [1] },
    COWPEA:       { good: [10, 11],        okay: [0, 1] },
    CASSAVA:      { good: [9, 10, 11],     okay: [0] },
    SWEET_POTATO: { good: [9, 10, 11],     okay: [0, 1] },
    YAM:          { good: [9, 10],         okay: [11] },
    POTATO:       { good: [7, 8, 9],       okay: [1, 2] },
    TOMATO:       { good: [7, 8, 9],       okay: [1, 2, 10] },
    ONION:        { good: [3, 4, 5],       okay: [2, 6] },
    PEPPER:       { good: [8, 9, 10],      okay: [11, 0] },
    OKRA:         { good: [9, 10, 11],     okay: [0, 1] },
    CABBAGE:      { good: [2, 3, 4],       okay: [7, 8] },
    SPINACH:      { good: [2, 3, 8, 9],    okay: [4, 10] },
    BANANA:       { good: [9, 10, 11],     okay: [0, 1] },
    PLANTAIN:     { good: [9, 10, 11],     okay: [0, 1] },
    MANGO:        { good: [9, 10],         okay: [8, 11] },
    COFFEE:       { good: [10, 11],        okay: [0] },
    TEA:          { good: [9, 10, 11],     okay: [0] },
    SUGARCANE:    { good: [8, 9, 10],      okay: [11] },
    COTTON:       { good: [10, 11],        okay: [0] },
    SUNFLOWER:    { good: [10, 11],        okay: [0] },
    SOYBEAN:      { good: [10, 11, 0],     okay: [1] },
    CUCUMBER:     { good: [9, 10],         okay: [8, 11] },
    WATERMELON:   { good: [9, 10],         okay: [11] },
    CARROT:       { good: [2, 3, 7, 8],    okay: [4, 9] },
    EGGPLANT:     { good: [8, 9, 10],      okay: [11] },
    AVOCADO:      { good: [9, 10, 11],     okay: [0] },
    PINEAPPLE:    { good: [9, 10],         okay: [11, 0] },
  },

  // ── Central Africa ──
  central_africa: {
    MAIZE:        { good: [2, 3, 4],       okay: [8, 9] },
    BEAN:         { good: [2, 3, 8, 9],    okay: [4, 10] },
    RICE:         { good: [3, 4, 5],       okay: [8, 9] },
    SORGHUM:      { good: [3, 4],          okay: [8, 9] },
    CASSAVA:      { good: [2, 3, 4],       okay: [8, 9] },
    SWEET_POTATO: { good: [2, 3, 4],       okay: [8, 9] },
    YAM:          { good: [2, 3],          okay: [4] },
    PLANTAIN:     { good: [2, 3, 4],       okay: [8, 9] },
    BANANA:       { good: [2, 3, 4],       okay: [8, 9] },
    COCOA:        { good: [3, 4],          okay: [5, 9] },
    PALM_OIL:     { good: [2, 3, 4],       okay: [9, 10] },
    COFFEE:       { good: [3, 4],          okay: [9, 10] },
    TOMATO:       { good: [8, 9],          okay: [2, 3] },
    PEPPER:       { good: [2, 3, 8, 9],    okay: [4, 10] },
    OKRA:         { good: [2, 3, 4],       okay: [8, 9] },
    CABBAGE:      { good: [8, 9],          okay: [2, 3] },
    GROUNDNUT:    { good: [3, 4],          okay: [8, 9] },
    COWPEA:       { good: [3, 4],          okay: [8, 9] },
    CUCUMBER:     { good: [2, 3, 8, 9],    okay: [4, 10] },
    EGGPLANT:     { good: [2, 3, 8, 9],    okay: [4, 10] },
    GINGER:       { good: [2, 3],          okay: [4] },
    COTTON:       { good: [3, 4, 5],       okay: [6] },
    ONION:        { good: [9, 10],         okay: [3, 4] },
    MANGO:        { good: [2, 3],          okay: [9, 10] },
    PAPAYA:       { good: [2, 3, 8, 9],    okay: [4, 10] },
    PINEAPPLE:    { good: [2, 3, 4],       okay: [8, 9] },
  },
};

// ─── Profit potential per crop (inherent, not seasonal) ─────
// Simplified: high = strong market demand, medium = steady local demand, low = mostly subsistence
const PROFIT_POTENTIAL = {
  MAIZE: 'medium',  BEAN: 'medium',  RICE: 'high',  SORGHUM: 'low',  MILLET: 'low',
  WHEAT: 'medium',  GROUNDNUT: 'medium',  COWPEA: 'low',  SOYBEAN: 'medium',
  CASSAVA: 'low',  YAM: 'medium',  SWEET_POTATO: 'low',  POTATO: 'high',
  TOMATO: 'high',  ONION: 'high',  PEPPER: 'medium',  OKRA: 'medium',
  CABBAGE: 'medium',  KALE: 'medium',  SPINACH: 'low',  EGGPLANT: 'medium',
  CUCUMBER: 'medium',  CARROT: 'medium',  WATERMELON: 'high',
  BANANA: 'medium',  PLANTAIN: 'medium',  MANGO: 'high',  PAPAYA: 'medium',
  AVOCADO: 'high',  PINEAPPLE: 'high',  ORANGE: 'high',
  COFFEE: 'high',  TEA: 'high',  COCOA: 'high',  COTTON: 'medium',
  SUGARCANE: 'high',  PALM_OIL: 'high',  SESAME: 'medium',  SUNFLOWER: 'medium',
  GINGER: 'high',  GARLIC: 'high',  CHILI: 'medium',  PEA: 'low',
};

// ─── Risk level per crop for beginners ──────────────────────
// high = perishable/disease-prone/needs expertise, medium = moderate, low = hardy/forgiving
const BEGINNER_RISK = {
  MAIZE: 'low',  BEAN: 'low',  RICE: 'medium',  SORGHUM: 'low',  MILLET: 'low',
  WHEAT: 'medium',  GROUNDNUT: 'low',  COWPEA: 'low',  SOYBEAN: 'medium',
  CASSAVA: 'low',  YAM: 'low',  SWEET_POTATO: 'low',  POTATO: 'medium',
  TOMATO: 'high',  ONION: 'medium',  PEPPER: 'medium',  OKRA: 'low',
  CABBAGE: 'medium',  KALE: 'low',  SPINACH: 'low',  EGGPLANT: 'medium',
  CUCUMBER: 'medium',  CARROT: 'medium',  WATERMELON: 'medium',
  BANANA: 'low',  PLANTAIN: 'low',  MANGO: 'low',  PAPAYA: 'low',
  AVOCADO: 'medium',  PINEAPPLE: 'medium',  ORANGE: 'medium',
  COFFEE: 'high',  TEA: 'high',  COCOA: 'high',  COTTON: 'medium',
  SUGARCANE: 'medium',  PALM_OIL: 'high',  SESAME: 'low',  SUNFLOWER: 'low',
  GINGER: 'medium',  GARLIC: 'medium',  CHILI: 'low',  PEA: 'low',
};

// ─── Core assessment ────────────────────────────────────────

/**
 * Determine the season fit for a crop in a given region at a given month.
 *
 * @param {string} cropCode
 * @param {string} regionKey - 'east_africa', 'west_africa', etc.
 * @param {number} month - 0-indexed (0=Jan, 11=Dec)
 * @returns {'good' | 'okay' | 'poor'}
 */
function getSeasonFit(cropCode, regionKey, month) {
  const regionWindows = PLANTING_WINDOWS[regionKey];
  if (!regionWindows) return 'okay';  // unknown region → neutral
  const window = regionWindows[cropCode];
  if (!window) return 'okay';  // unknown crop in region → neutral
  if (window.good.includes(month)) return 'good';
  if (window.okay.includes(month)) return 'okay';
  return 'poor';
}

/**
 * Compute the combined profit fit considering season timing + inherent potential.
 *
 * @param {'good'|'okay'|'poor'} seasonFit
 * @param {'high'|'medium'|'low'} profitPotential
 * @returns {'high' | 'medium' | 'low'}
 */
function computeProfitFit(seasonFit, profitPotential) {
  // Good season + high profit = high
  if (seasonFit === 'good' && profitPotential === 'high') return 'high';
  if (seasonFit === 'good' && profitPotential === 'medium') return 'medium';
  if (seasonFit === 'good') return 'medium';  // good season rescues low-profit crops a bit

  // Okay season — everything drops one tier
  if (seasonFit === 'okay' && profitPotential === 'high') return 'medium';
  if (seasonFit === 'okay') return 'low';

  // Poor season — low regardless of inherent potential
  return 'low';
}

/**
 * Compute risk level considering season timing + inherent risk.
 *
 * @param {'good'|'okay'|'poor'} seasonFit
 * @param {boolean} isNew
 * @param {string} cropCode
 * @returns {'low' | 'medium' | 'high'}
 */
function computeRiskLevel(seasonFit, isNew, cropCode) {
  const inherent = BEGINNER_RISK[cropCode] || 'medium';

  // Poor season → raise risk one level
  if (seasonFit === 'poor') {
    if (inherent === 'low') return 'medium';
    return 'high';
  }
  // New farmer + inherently risky crop → bump to high
  if (isNew && inherent === 'high') return 'high';
  return inherent;
}

/**
 * Pick the right guidance message key based on the assessment.
 */
function pickMessageKey(seasonFit, profitFit, riskLevel, isNew) {
  if (seasonFit === 'good' && profitFit === 'high') return 'seasonGuide.goodTimeHighProfit';
  if (seasonFit === 'good' && profitFit === 'medium') return 'seasonGuide.goodTimeMediumProfit';
  if (seasonFit === 'good') return 'seasonGuide.goodTimeLowProfit';

  if (seasonFit === 'okay' && profitFit !== 'low') return 'seasonGuide.okayTimeSomeProfit';
  if (seasonFit === 'okay') return 'seasonGuide.okayTimeLowProfit';

  if (isNew) return 'seasonGuide.poorTimeNewFarmer';
  return 'seasonGuide.poorTime';
}

/**
 * Find 2-3 alternative crops that have better season fit right now.
 *
 * @param {string} currentCropCode - The crop to find alternatives for
 * @param {string} countryCode
 * @param {string} regionKey
 * @param {number} month
 * @param {Object} opts - { goal, isNew, landSize }
 * @returns {Array<{ code, seasonFit, profitPotential }>}
 */
function findAlternatives(currentCropCode, countryCode, regionKey, month, opts = {}) {
  const { goal, isNew } = opts;

  function scoreAndFilter(pool) {
    return pool
      .filter(entry => entry.code !== currentCropCode)
      .map(entry => {
        const sf = getSeasonFit(entry.code, regionKey, month);
        const pp = PROFIT_POTENTIAL[entry.code] || 'low';
        const pf = computeProfitFit(sf, pp);
        return { code: entry.code, seasonFit: sf, profitPotential: pp, profitFit: pf, entry };
      })
      .filter(c => c.seasonFit === 'good' || c.seasonFit === 'okay')
      .sort((a, b) => {
        const sfOrder = { good: 0, okay: 1 };
        if (sfOrder[a.seasonFit] !== sfOrder[b.seasonFit]) return sfOrder[a.seasonFit] - sfOrder[b.seasonFit];
        const pfOrder = { high: 0, medium: 1, low: 2 };
        if (pfOrder[a.profitFit] !== pfOrder[b.profitFit]) return pfOrder[a.profitFit] - pfOrder[b.profitFit];
        if (a.entry.beginner !== b.entry.beginner) return a.entry.beginner ? -1 : 1;
        return 0;
      })
      .slice(0, 3);
  }

  if (!countryCode) return [];

  // Try narrow pool first: beginner crops matching goal
  let candidates = scoreAndFilter(
    isNew ? getBeginnerCropsForCountry(countryCode, goal) : getCropsForCountry(countryCode)
  );

  // Widen: beginner crops (any goal) if too few results
  if (candidates.length < 2 && isNew) {
    candidates = scoreAndFilter(getBeginnerCropsForCountry(countryCode, null));
  }

  // Widen further: all country crops
  if (candidates.length < 2) {
    candidates = scoreAndFilter(getCropsForCountry(countryCode));
  }

  return candidates.map(c => ({ code: c.code, seasonFit: c.seasonFit, profitPotential: c.profitPotential }));
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Assess whether a crop is a good choice for profit at the current time.
 *
 * @param {Object} params
 * @param {string}  params.cropCode       — e.g. 'MAIZE'
 * @param {string}  params.countryCode    — e.g. 'KE' (optional)
 * @param {string}  params.goal           — 'home_food' | 'local_sales' | 'profit' (optional)
 * @param {boolean} params.isNew          — true for first-time farmers (optional)
 * @param {string}  params.landSize       — 'small' | 'medium' | 'large' (optional)
 * @param {number}  params.month          — override current month for testing (optional)
 *
 * @returns {{
 *   seasonFit:       'good' | 'okay' | 'poor',
 *   profitFit:       'high' | 'medium' | 'low',
 *   riskLevel:       'low' | 'medium' | 'high',
 *   messageKey:      string,           — i18n key for the guidance text
 *   alternatives:    Array<{ code, seasonFit, profitPotential }>,
 *   cropCode:        string,
 *   regionKey:       string|null,
 * }}
 */
export function assessSeasonProfit({
  cropCode,
  countryCode = '',
  goal = '',
  isNew = false,
  landSize = '',
  month = new Date().getMonth(),
}) {
  const regionKey = getRegionForCountry(countryCode);
  const seasonFit = getSeasonFit(cropCode, regionKey, month);
  const profitPotential = PROFIT_POTENTIAL[cropCode] || 'low';
  const profitFit = computeProfitFit(seasonFit, profitPotential);
  const riskLevel = computeRiskLevel(seasonFit, isNew, cropCode);
  const messageKey = pickMessageKey(seasonFit, profitFit, riskLevel, isNew);

  // Only find alternatives when timing is poor or okay-but-low
  const needAlts = seasonFit === 'poor' || (seasonFit === 'okay' && profitFit === 'low');
  const alternatives = needAlts
    ? findAlternatives(cropCode, countryCode, regionKey, month, { goal, isNew, landSize })
    : [];

  return { seasonFit, profitFit, riskLevel, messageKey, alternatives, cropCode, regionKey };
}

/**
 * Numeric score for use in the recommendation engine.
 * good = +3, okay = 0, poor = -2
 */
export function getSeasonScore(cropCode, countryCode, month) {
  const regionKey = getRegionForCountry(countryCode);
  const fit = getSeasonFit(cropCode, regionKey, month ?? new Date().getMonth());
  if (fit === 'good') return 3;
  if (fit === 'okay') return 0;
  return -2;
}

// Exported for testing
export { getSeasonFit, computeProfitFit, computeRiskLevel, findAlternatives, PLANTING_WINDOWS, PROFIT_POTENTIAL, BEGINNER_RISK };
