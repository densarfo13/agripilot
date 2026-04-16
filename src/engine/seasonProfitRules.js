/**
 * Season & Profit Rules Engine
 *
 * Deterministic, rule-based assessment of whether a crop is a good choice
 * for profit at the current time of year in the farmer's region.
 *
 * No AI. Every output is traceable to a specific seasonal rule.
 *
 * ─── Data source ───
 * Planting windows are now derived from src/data/seasonalRules.js,
 * the structured seasonal rules table. The engine converts each rule's
 * plantStart/plantEnd into good/okay month arrays at startup.
 *
 * Profit potential and beginner risk are derived from src/data/crops.js
 * master crop metadata where possible, with manual overrides retained.
 */

import {
  getRegionForCountry,
  getBeginnerCropsForCountry,
  getCropsForCountry,
  getCatalogEntry,
} from '../data/cropRegionCatalog.js';

import { SEASONAL_RULES, ruleToMonthArrays } from '../data/seasonalRules.js';
import { CROPS } from '../data/crops.js';

// ─── Build PLANTING_WINDOWS from seasonal rules ─────────────
// Converts the structured rules into the { region: { crop: { good, okay } } }
// format used by the scoring functions.

function buildPlantingWindows() {
  const windows = {};
  for (const rule of SEASONAL_RULES) {
    const regionKey = rule.region;
    if (!regionKey) continue;
    if (!windows[regionKey]) windows[regionKey] = {};
    // Country-specific rules don't override region-wide here — the lookup
    // in getSeasonFit handles precedence via getSeasonalRule.
    // For backward compat, we store the broadest data per region.
    if (!windows[regionKey][rule.crop]) {
      windows[regionKey][rule.crop] = ruleToMonthArrays(rule);
    }
  }
  return windows;
}

const PLANTING_WINDOWS = buildPlantingWindows();

// ─── Profit potential per crop ──────────────────────────────
// Derived from crops.js defaultProfitFit, with overrides for nuance
const PROFIT_POTENTIAL = {};
for (const [key, crop] of Object.entries(CROPS)) {
  PROFIT_POTENTIAL[key] = crop.defaultProfitFit || 'low';
}

// ─── Risk level per crop for beginners ──────────────────────
// Derived from crops.js difficulty, mapped to risk tiers
const BEGINNER_RISK = {};
for (const [key, crop] of Object.entries(CROPS)) {
  if (crop.difficulty === 'easy') BEGINNER_RISK[key] = 'low';
  else if (crop.difficulty === 'hard') BEGINNER_RISK[key] = 'high';
  else BEGINNER_RISK[key] = 'medium';
}

// ─── Core assessment ────────────────────────────────────────

/**
 * Determine the season fit for a crop in a given region at a given month.
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
 */
function computeProfitFit(seasonFit, profitPotential) {
  if (seasonFit === 'good' && profitPotential === 'high') return 'high';
  if (seasonFit === 'good' && profitPotential === 'medium') return 'medium';
  if (seasonFit === 'good') return 'medium';

  if (seasonFit === 'okay' && profitPotential === 'high') return 'medium';
  if (seasonFit === 'okay') return 'low';

  return 'low';
}

/**
 * Compute risk level considering season timing + inherent risk.
 */
function computeRiskLevel(seasonFit, isNew, cropCode) {
  const inherent = BEGINNER_RISK[cropCode] || 'medium';

  if (seasonFit === 'poor') {
    if (inherent === 'low') return 'medium';
    return 'high';
  }
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

  let candidates = scoreAndFilter(
    isNew ? getBeginnerCropsForCountry(countryCode, goal) : getCropsForCountry(countryCode)
  );

  if (candidates.length < 2 && isNew) {
    candidates = scoreAndFilter(getBeginnerCropsForCountry(countryCode, null));
  }

  if (candidates.length < 2) {
    candidates = scoreAndFilter(getCropsForCountry(countryCode));
  }

  return candidates.map(c => ({ code: c.code, seasonFit: c.seasonFit, profitPotential: c.profitPotential }));
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Assess whether a crop is a good choice for profit at the current time.
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
