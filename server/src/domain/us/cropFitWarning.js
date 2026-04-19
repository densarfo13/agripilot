/**
 * cropFitWarning.js — pure helper that surfaces trust warnings when
 * a crop recommendation is a weak fit for the farmer's location.
 *
 *   evaluateCropFit({ crop, stateProfile, score }) returns
 *     { show, reasonKey, alternatives } when a warning is warranted.
 *
 * The scoring engine is still the primary filter (cassava, for
 * example, never reaches bestMatch for continental U.S. farmers).
 * This helper gives the UI a reusable way to label any crop that
 * slipped through at a low/borderline score so the farmer sees
 * "your climate is a weak match" instead of blindly trusting the
 * card.
 */

import { CROP_PROFILES } from './cropProfiles.js';

const WEAK_FIT_SCORE = 55;   // anything below this is already in notRecommendedNow
const BORDERLINE_SCORE = 68; // warn at the top of the alsoConsider band

// Crops whose geographic range is narrow enough that any appearance
// outside their native zone should always carry a warning.
const GEOGRAPHICALLY_NARROW = new Set([
  'cassava', 'sugarcane', 'citrus', 'taro', 'banana', 'papaya', 'pineapple',
]);

const TROPICAL_SUBREGIONS = new Set([
  'HAWAII_TROPICAL', 'FLORIDA_SUBTROPICAL',
]);

export function evaluateCropFit({ crop, stateProfile, score }) {
  if (!crop || !stateProfile) return { show: false };
  const cropKey = crop.key || crop.cropKey;
  const profile = CROP_PROFILES[cropKey];
  if (!profile) return { show: false };

  const reasons = [];

  // 1. Hard geographic mismatch: tropical crop outside a tropical subregion.
  if (GEOGRAPHICALLY_NARROW.has(cropKey) && !TROPICAL_SUBREGIONS.has(stateProfile.climateSubregion)) {
    reasons.push('climate_mismatch');
  }

  // 2. Frost-sensitive crop in a high-frost zone.
  if (profile.frostSensitive && stateProfile.frostRisk === 'high') {
    reasons.push('frost_sensitive_in_cold_zone');
  }

  // 3. High-water crop in a dry zone.
  if (profile.waterNeed === 'high' && stateProfile.rainfallBand === 'low') {
    reasons.push('high_water_in_dry_zone');
  }

  // 4. Low score from the engine — catch anything that slipped through.
  if (Number.isFinite(score) && score <= BORDERLINE_SCORE) {
    reasons.push('low_suitability_score');
  }
  if (Number.isFinite(score) && score < WEAK_FIT_SCORE) {
    // Already below the viability cutoff, worth surfacing hard.
    reasons.push('below_viability_cutoff');
  }

  if (reasons.length === 0) return { show: false };

  return {
    show: true,
    reasonKey: 'cropFit.warning.reason',
    reasons,
  };
}

export const _internal = { WEAK_FIT_SCORE, BORDERLINE_SCORE, GEOGRAPHICALLY_NARROW, TROPICAL_SUBREGIONS };
