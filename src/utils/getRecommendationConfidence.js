/**
 * getRecommendationConfidence(input) → { level, reasons, wordingKey }
 *
 * Inputs:
 *   countrySupportTier       — FULL_SUPPORT / BASIC_SUPPORT / …
 *   stateSupported           — boolean (does the state have rule data?)
 *   cropSupportDepth         — FULLY_GUIDED / PARTIAL_GUIDANCE / BROWSE_ONLY
 *   locationCompleteness     — 0..1 (country=0.5, +state=0.9, +city=1.0)
 *   fitLevel                 — optional 'high' | 'medium' | 'low'
 *
 * Output:
 *   level       — 'high' | 'medium' | 'low'
 *   reasons     — string[] of codes the UI can translate
 *   wordingKey  — i18n key for the section header ("Best for you" vs
 *                 "Suggested crops" vs "Limited confidence")
 */

import { SUPPORT_TIER } from './countrySupport.js';
import { CROP_SUPPORT_DEPTH } from './cropSupport.js';

export function getRecommendationConfidence({
  countrySupportTier,
  stateSupported = false,
  cropSupportDepth,
  locationCompleteness = 0.5,
  fitLevel,
} = {}) {
  const reasons = [];
  let score = 0;

  if (countrySupportTier === SUPPORT_TIER.FULL_SUPPORT)        score += 40;
  else if (countrySupportTier === SUPPORT_TIER.BASIC_SUPPORT)  score += 24;
  else if (countrySupportTier === SUPPORT_TIER.LIMITED_SUPPORT){ score += 8; reasons.push('country_limited'); }
  else                                                         { score += 0; reasons.push('country_not_supported'); }

  if (stateSupported) score += 20;
  else { score += 5; reasons.push('state_not_mapped'); }

  if (cropSupportDepth === CROP_SUPPORT_DEPTH.FULLY_GUIDED)      score += 25;
  else if (cropSupportDepth === CROP_SUPPORT_DEPTH.PARTIAL_GUIDANCE) score += 12;
  else                                                         { score += 3; reasons.push('crop_browse_only'); }

  score += Math.round(Math.max(0, Math.min(1, locationCompleteness)) * 15);
  if (locationCompleteness < 0.7) reasons.push('location_incomplete');

  // Fit level fine-tunes confidence — if the scorer says low fit,
  // confidence should never be high regardless of metadata.
  let level;
  if (fitLevel === 'low') level = 'low';
  else if (score >= 75) level = 'high';
  else if (score >= 50) level = 'medium';
  else level = 'low';

  const wordingKey =
    level === 'high' ? 'onboarding.crops.best' :
    level === 'medium' ? 'recConfidence.wording.suggested' :
    'recConfidence.wording.limited';

  return { level, reasons, wordingKey, score };
}

export const CONFIDENCE_I18N_KEY = Object.freeze({
  high:   'recConfidence.level.high',
  medium: 'recConfidence.level.medium',
  low:    'recConfidence.level.low',
});
