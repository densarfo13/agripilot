/**
 * Crop Fit Engine — beginner-aware crop recommendation.
 *
 * Extends the existing recommendCrops() with:
 *   - beginner suitability filtering
 *   - water/budget/goal matching
 *   - timing/season fit signals
 *   - explainable fit reasons (translation keys)
 *
 * Returns top 3 crops with structured fit data.
 */
import { getCropProfile, getProfiledCropCodes } from '../data/cropProfiles.js';
import { getCropByCode, getCropIcon } from '../utils/crops.js';

// Month → likely season (Sub-Saharan Africa general heuristic)
const MONTH_SEASON = {
  0: 'dry', 1: 'dry', 2: 'long_rains', 3: 'long_rains', 4: 'long_rains',
  5: 'long_rains', 6: 'dry', 7: 'dry', 8: 'short_rains', 9: 'short_rains',
  10: 'short_rains', 11: 'dry',
};

function getCurrentSeason() {
  return MONTH_SEASON[new Date().getMonth()] || 'long_rains';
}

/**
 * Get recommended crops for a beginner farmer.
 *
 * @param {Object} params
 * @param {string} params.location - Region or country code
 * @param {string} params.landSize - 'small'|'medium'|'large'
 * @param {string} params.waterAccess - 'rain_only'|'well_or_river'|'irrigation'
 * @param {string} params.budget - 'low'|'medium'|'high'
 * @param {string} params.experience - 'none'|'some'|'experienced'
 * @param {string} params.goal - 'home_food'|'local_sales'|'profit'
 * @param {string|null} params.preferredCrop - Optional preferred crop code
 * @param {string|null} params.country - Country code for regional tuning
 * @returns {Array<Object>} Top 3 crop recommendations
 */
export function getRecommendedCrops({
  location,
  landSize,
  waterAccess,
  budget,
  experience,
  goal,
  preferredCrop,
  country,
}) {
  const season = getCurrentSeason();
  const candidates = getProfiledCropCodes();
  const scored = [];

  for (const code of candidates) {
    const profile = getCropProfile(code);
    if (!profile) continue;

    let score = 0;
    const fitReasons = [];
    const warnings = [];

    // ─── 1. Experience / difficulty fit ────────────────────
    if (experience === 'none') {
      if (profile.difficulty === 'beginner') {
        score += 30;
        fitReasons.push('cropFit.reason.beginnerFriendly');
      } else if (profile.difficulty === 'moderate') {
        score += 5;
        warnings.push('cropFit.warning.moderate');
      } else {
        score -= 20;
        warnings.push('cropFit.warning.advanced');
      }
    } else if (experience === 'some') {
      if (profile.difficulty !== 'advanced') score += 15;
      else warnings.push('cropFit.warning.advanced');
    } else {
      score += 10; // experienced — all crops OK
    }

    // ─── 2. Water fit ─────────────────────────────────────
    if (waterAccess === 'rain_only') {
      if (profile.waterNeed === 'low') {
        score += 20;
        fitReasons.push('cropFit.reason.lowWater');
      } else if (profile.waterNeed === 'moderate') {
        score += 10;
      } else {
        score -= 15;
        warnings.push('cropFit.warning.needsIrrigation');
      }
      if (profile.droughtTolerant) {
        score += 10;
        fitReasons.push('cropFit.reason.droughtTolerant');
      }
    } else if (waterAccess === 'well_or_river') {
      if (profile.waterNeed !== 'high') score += 10;
      else score += 5;
    } else {
      // irrigation available — all crops OK
      score += 10;
    }

    // ─── 3. Budget fit ────────────────────────────────────
    if (budget === 'low') {
      if (profile.costLevel === 'low') {
        score += 20;
        fitReasons.push('cropFit.reason.lowCost');
      } else if (profile.costLevel === 'moderate') {
        score += 5;
      } else {
        score -= 10;
        warnings.push('cropFit.warning.highCost');
      }
    } else if (budget === 'medium') {
      if (profile.costLevel !== 'high') score += 10;
    } else {
      score += 10;
    }

    // ─── 4. Goal fit ──────────────────────────────────────
    if (goal && profile.bestGoals.includes(goal)) {
      score += 15;
      const goalKey = {
        home_food: 'cropFit.reason.goodForFood',
        local_sales: 'cropFit.reason.goodForSales',
        profit: 'cropFit.reason.goodForProfit',
      }[goal];
      if (goalKey) fitReasons.push(goalKey);
    }

    // ─── 5. Season fit ────────────────────────────────────
    if (profile.bestSeasons.includes(season)) {
      score += 15;
      fitReasons.push('cropFit.reason.goodTiming');
    } else if (profile.bestSeasons.includes('dry') && season === 'dry') {
      score += 10;
    }

    // ─── 6. Land size fit ─────────────────────────────────
    if (landSize === 'small') {
      if (profile.effortLevel === 'low' || profile.effortLevel === 'moderate') score += 5;
      fitReasons.push('cropFit.reason.fitsSmallFarm');
    } else if (landSize === 'large') {
      if (profile.marketPotential === 'high') score += 10;
    }

    // ─── 7. Preferred crop bonus ──────────────────────────
    if (preferredCrop && code === preferredCrop.toUpperCase()) {
      score += 25;
      fitReasons.push('cropFit.reason.yourChoice');
    }

    // ─── 8. Timing signal ─────────────────────────────────
    let timingSignal;
    if (profile.bestSeasons.includes(season)) {
      timingSignal = 'cropFit.timing.goodNow';
    } else if (profile.irrigationRequired) {
      timingSignal = 'cropFit.timing.needsIrrigation';
    } else if (season === 'dry' && !profile.droughtTolerant) {
      timingSignal = 'cropFit.timing.waitForRains';
    } else {
      timingSignal = 'cropFit.timing.notIdealNow';
    }

    const crop = getCropByCode(code);
    scored.push({
      code,
      name: crop?.name || code,
      icon: profile.icon || getCropIcon(code),
      difficulty: profile.difficulty,
      harvestWeeks: `${profile.harvestWeeksMin}–${profile.harvestWeeksMax}`,
      waterNeed: profile.waterNeed,
      effortLevel: profile.effortLevel,
      costLevel: profile.costLevel,
      marketPotential: profile.marketPotential,
      timingSignal,
      fitReasons: fitReasons.slice(0, 3), // max 3 reasons
      warnings,
      score,
    });
  }

  // Sort by score descending, take top 3
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3);
}

/**
 * Quick timing label for display.
 */
export function getTimingLabel(seasonKey) {
  return seasonKey || 'cropFit.timing.goodNow';
}
