/**
 * New Farmer Recommendation Engine
 *
 * Deterministic, rule-based scoring engine for new farmer onboarding.
 * No AI. Every recommendation has an explicit, traceable reason.
 *
 * Used by: NewFarmerRecommendation.jsx (onboarding wizard)
 *
 * Input:
 *   { countryCode, goal, landSize, budget, preferredCrop, isNew }
 *
 * Output:
 *   { primary, alternatives[], suggestedSize, sizeReason }
 *   where each crop entry = { code, score, reasons[] }
 *   and each reason = { key, weight } (key is an i18n translation key)
 *
 * Scoring weights (designed so beginner-friendliness dominates for new farmers):
 *   Goal match:          +4
 *   Land size fit:       +3
 *   Budget fit:          +2
 *   Country-local crop:  +2
 *   Beginner-friendly:   +3  (only when isNew)
 *   Non-beginner penalty: -3  (only when isNew and crop.beginner === false)
 *   Preferred crop:      +6  (explicit user preference)
 *   Staple crop bonus:   +1  (priority 1 in catalog)
 *   Price trend bonus:   +1  (rising price signal when goal is profit/local_sales)
 */

import {
  getBeginnerCropsForCountry,
  getCropsForCountry,
  isCropLocalToCountry,
  getCatalogEntry,
  getRegionForCountry,
} from '../data/cropRegionCatalog.js';
import { getSeasonScore } from './seasonProfitRules.js';
import { CROPS } from '../data/crops.js';
import { getRule } from '../data/cropRegionRules.js';
import { getPriceTrendScore } from '../services/marketDataService.js';

// ─── Budget & Size compatibility (derived from crops.js) ────
// Built at startup from crops.js master data. Falls back to
// ['low', 'medium'] if a crop has no entry in crops.js.
const BUDGET_FIT = {};
const SIZE_FIT = {};
for (const [key, crop] of Object.entries(CROPS)) {
  BUDGET_FIT[key] = crop.budgetLevels || ['low', 'medium'];
  SIZE_FIT[key] = crop.landSizes || ['small', 'medium'];
}

// ─── Scoring weights ────────────────────────────────────────
const W = {
  GOAL:        4,
  SEASON:      3,   // good season = +3, okay = 0, poor = -2 (from getSeasonScore)
  SIZE:        3,
  BUDGET:      2,
  LOCAL:       2,
  LOCAL_FIT:   2,   // bonus for high local food/profit fit from crop-region rules
  BEGINNER:    3,
  NON_BEGINNER_PENALTY: -3,
  PREFERRED:   6,
  STAPLE:      1,
  PRICE_TREND: 1,   // bonus for rising price when goal is profit/local_sales
};

// ─── Fallback crops (when no country is known) ─────────────
const FALLBACK_CODES = [
  'MAIZE', 'BEAN', 'CASSAVA', 'GROUNDNUT', 'SWEET_POTATO',
  'SORGHUM', 'TOMATO', 'RICE',
];

/**
 * Build the crop pool to score against.
 * When country is known: uses catalog entries for that country.
 * When unknown: uses universal fallback staples.
 */
function buildPool(countryCode, goal, isNew) {
  if (countryCode) {
    // For new farmers: prefer beginner crops; fall back to all country crops if too few
    if (isNew) {
      const beginnerCrops = getBeginnerCropsForCountry(countryCode, goal);
      if (beginnerCrops.length >= 3) return beginnerCrops;
      // Not enough goal-filtered beginners: try without goal filter
      const allBeginner = getBeginnerCropsForCountry(countryCode, null);
      if (allBeginner.length >= 3) return allBeginner;
    }
    // Experienced farmer or not enough beginners: full country list
    return getCropsForCountry(countryCode);
  }
  // No country: build minimal entries from fallback codes
  return FALLBACK_CODES.map(code => getCatalogEntry(code)).filter(Boolean);
}

/**
 * Score a single crop entry against the farmer's inputs.
 *
 * @param {Object} entry - Catalog entry (code, countries, regions, beginner, goals, priority)
 * @param {Object} inputs - { goal, landSize, budget, preferredCrop, countryCode, isNew }
 * @returns {{ code, score, reasons[] }}
 */
function scoreCrop(entry, { goal, landSize, budget, preferredCrop, countryCode, isNew }) {
  let score = 0;
  const reasons = [];

  // 1. Goal match
  if (entry.goals && entry.goals.includes(goal)) {
    score += W.GOAL;
    reasons.push({ key: `recommendReason.goalFit.${goal}`, weight: W.GOAL });
  }

  // 2. Season fit (good = +3, okay = 0, poor = -2)
  if (countryCode) {
    const seasonPts = getSeasonScore(entry.code, countryCode);
    if (seasonPts !== 0) {
      score += seasonPts;
      const seasonKey = seasonPts > 0 ? 'recommendReason.goodSeason' : 'recommendReason.poorSeason';
      reasons.push({ key: seasonKey, weight: seasonPts });
    }
  }

  // 3. Land size fit
  const sizes = SIZE_FIT[entry.code];
  if (sizes && sizes.includes(landSize)) {
    score += W.SIZE;
    reasons.push({ key: `recommendReason.sizeFit.${landSize}`, weight: W.SIZE });
  }

  // 4. Budget fit
  const budgets = BUDGET_FIT[entry.code];
  if (budgets && budgets.includes(budget)) {
    score += W.BUDGET;
    reasons.push({ key: `recommendReason.budgetFit.${budget}`, weight: W.BUDGET });
  }

  // 5. Country-local
  if (countryCode && isCropLocalToCountry(entry.code, countryCode)) {
    score += W.LOCAL;
    reasons.push({ key: 'recommendReason.localCrop', weight: W.LOCAL });
  }

  // 6. Beginner friendliness (key differentiator for new farmers)
  if (isNew) {
    if (entry.beginner) {
      score += W.BEGINNER;
      reasons.push({ key: 'recommendReason.beginnerFriendly', weight: W.BEGINNER });
    } else {
      score += W.NON_BEGINNER_PENALTY;
      reasons.push({ key: 'recommendReason.complexCrop', weight: W.NON_BEGINNER_PENALTY });
    }
  }

  // 7. Preferred crop bonus
  if (preferredCrop && entry.code === preferredCrop) {
    score += W.PREFERRED;
    reasons.push({ key: 'recommendReason.preferredCrop', weight: W.PREFERRED });
  }

  // 8. Staple crop bonus (priority 1 = widely grown, safer bet)
  if (entry.priority === 1) {
    score += W.STAPLE;
    reasons.push({ key: 'recommendReason.stapleCrop', weight: W.STAPLE });
  }

  // 9. Local food/profit fit bonus (from crop-region rules)
  if (countryCode) {
    const localRule = getRule(entry.code, countryCode);
    if (localRule) {
      // Bonus for high local food fit when goal is home_food
      if (goal === 'home_food' && localRule.foodFit === 'high') {
        score += W.LOCAL_FIT;
        reasons.push({ key: 'recommendReason.localFoodFit', weight: W.LOCAL_FIT });
      }
      // Bonus for high local profit fit when goal is profit
      if (goal === 'profit' && localRule.profitFit === 'high') {
        score += W.LOCAL_FIT;
        reasons.push({ key: 'recommendReason.localProfitFit', weight: W.LOCAL_FIT });
      }
    }
  }

  // 10. Market price trend bonus (small signal, not dominant)
  if (countryCode && (goal === 'profit' || goal === 'local_sales')) {
    const trendScore = getPriceTrendScore(entry.code, countryCode);
    if (trendScore > 0) {
      score += W.PRICE_TREND;
      reasons.push({ key: 'recommendReason.priceRising', weight: W.PRICE_TREND });
    }
    // Note: falling prices don't penalize — we don't discourage planting
  }

  return { code: entry.code, score, reasons };
}

/**
 * Compute a suggested starting size for a new farmer.
 *
 * Logic:
 *   - New farmers with large land → suggest medium (don't overextend)
 *   - Goal is home_food → suggest small regardless
 *   - Otherwise → echo the farmer's stated land size
 *
 * @returns {{ size: string, reasonKey: string }}
 */
function computeSuggestedSize({ landSize, goal, isNew }) {
  // New farmer + large land: recommend starting smaller
  if (isNew && landSize === 'large') {
    return { size: 'medium', reasonKey: 'recommendReason.startSmaller' };
  }
  // Home food goal: small is enough
  if (goal === 'home_food' && landSize !== 'small') {
    return { size: 'small', reasonKey: 'recommendReason.homeFoodSmall' };
  }
  // Default: use their stated size
  return { size: landSize || 'small', reasonKey: 'recommendReason.matchesYourLand' };
}

/**
 * Generate a structured recommendation for a new (or returning) farmer.
 *
 * @param {Object} inputs
 * @param {string}  inputs.countryCode     — ISO 2-letter code (optional)
 * @param {string}  inputs.goal            — 'home_food' | 'local_sales' | 'profit'
 * @param {string}  inputs.landSize        — 'small' | 'medium' | 'large'
 * @param {string}  inputs.budget          — 'low' | 'medium' | 'high'
 * @param {string}  inputs.preferredCrop   — crop code or '' (optional)
 * @param {boolean} inputs.isNew           — true for first-time farmers
 *
 * @returns {{
 *   primary:       { code, score, reasons[], whyKey },
 *   alternatives:  { code, score, reasons[], whyKey }[],
 *   suggestedSize: { size, reasonKey },
 * }}
 */
export function recommendForNewFarmer(inputs) {
  const {
    countryCode = '',
    goal = 'home_food',
    landSize = 'small',
    budget = 'low',
    preferredCrop = '',
    isNew = true,
  } = inputs;

  // 1. Build crop pool
  const pool = buildPool(countryCode, goal, isNew);

  // 2. Score every crop in the pool
  const scored = pool.map(entry =>
    scoreCrop(entry, { goal, landSize, budget, preferredCrop, countryCode, isNew })
  );

  // 3. Deduplicate (pool may have overlaps from beginner + country fallback)
  const seen = new Set();
  const unique = [];
  for (const item of scored) {
    if (!seen.has(item.code)) {
      seen.add(item.code);
      unique.push(item);
    }
  }

  // 4. Sort by score descending, then by catalog priority for ties
  unique.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const pA = getCatalogEntry(a.code)?.priority ?? 9;
    const pB = getCatalogEntry(b.code)?.priority ?? 9;
    return pA - pB;
  });

  // 5. Take top 3 with positive scores
  const top = unique.filter(c => c.score > 0).slice(0, 3);

  // 6. Add whyKey for backward compatibility with existing i18n keys
  const withWhy = top.map(c => ({
    ...c,
    whyKey: buildWhyKey(c.code),
  }));

  // 7. Compute suggested size
  const suggestedSize = computeSuggestedSize({ landSize, goal, isNew });

  return {
    primary: withWhy[0] || null,
    alternatives: withWhy.slice(1),
    suggestedSize,
  };
}

/**
 * Build the i18n key for a crop's "why" text.
 * Maps SWEET_POTATO → recommend.whySweetPotato, etc.
 */
function buildWhyKey(code) {
  const camel = code.charAt(0).toUpperCase()
    + code.slice(1).toLowerCase().replace(/_(\w)/g, (_, c) => c.toUpperCase());
  return `recommend.why${camel}`;
}

// ─── Exported for testing ───────────────────────────────────
export { W as SCORING_WEIGHTS, scoreCrop, computeSuggestedSize, buildPool };
