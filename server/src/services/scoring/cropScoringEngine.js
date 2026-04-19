/**
 * cropScoringEngine.js — entry point the API + frontend call to get
 * crop recommendations. Wraps the lower-level `scoreCropSuitability`
 * (which already implements the weighted formula and guardrails) and
 * produces the output shape specified for the connected engine:
 *
 *   {
 *     crop, cropName, score, fitLevel, confidence,
 *     reasons[], riskNotes[], plantingStatus,
 *     supportDepth,
 *   }
 *
 * And the top-level payload:
 *
 *   { locationProfile, bestMatch[], alsoConsider[], notRecommendedNow[] }
 *
 * The learning engine (see feedback/learningEngine.js) feeds optional
 * per-crop confidence multipliers so past successful harvests raise
 * future confidence and repeated failures lower it.
 */

import {
  scoreCropSuitability,
  buildRecommendationBuckets,
} from '../../domain/us/scoreCropSuitability.js';
import { resolveRegionProfile } from '../region/regionProfile.js';

/**
 * Confidence calculation separates "how strong is the evidence" from
 * "how well does the crop fit". High fit + high support tier + full
 * data = high confidence. Low/unknown data narrows confidence even
 * when the score is high.
 */
function deriveConfidence({ score, fitLevel, supportTier, beginnerLevel, purpose, growingStyle, learningMultiplier = 1 }) {
  let points = 0;
  if (fitLevel === 'high') points += 40;
  else if (fitLevel === 'medium') points += 20;

  if (supportTier === 'FULL_SUPPORT') points += 30;
  else if (supportTier === 'BASIC_SUPPORT') points += 20;
  else if (supportTier === 'LIMITED_SUPPORT') points += 10;

  if (beginnerLevel) points += 10;
  if (purpose) points += 10;
  if (growingStyle) points += 10;

  points = Math.round(points * learningMultiplier);

  if (points >= 75) return 'high';
  if (points >= 50) return 'medium';
  return 'low';
}

/**
 * supportDepth is a per-crop UI classifier — how much tailored
 * guidance we have for this specific crop in this specific region.
 * FULL_SUPPORT countries with a known crop get FULLY_GUIDED; crops
 * without a full rule fall back to PARTIAL_GUIDANCE; anything where
 * we don't have the rule + stage templates = BROWSE_ONLY.
 */
const FULLY_GUIDED_CROPS = new Set([
  'tomato', 'lettuce', 'peanut', 'sorghum', 'sweet_potato',
  'pepper', 'bean', 'beans', 'corn',
]);

function deriveSupportDepth({ crop, supportTier, fitLevel }) {
  if (supportTier === 'COMING_SOON') return 'BROWSE_ONLY';
  if (FULLY_GUIDED_CROPS.has(crop) && supportTier === 'FULL_SUPPORT' && fitLevel !== 'low') {
    return 'FULLY_GUIDED';
  }
  if (supportTier === 'FULL_SUPPORT' || supportTier === 'BASIC_SUPPORT') {
    return 'PARTIAL_GUIDANCE';
  }
  return 'BROWSE_ONLY';
}

/**
 * shapeCropResult(raw, ctx) — turn the raw `scoreCropSuitability`
 * output into the spec'd shape with confidence + supportDepth.
 */
function shapeCropResult(raw, ctx) {
  const confidence = deriveConfidence({
    score: raw.suitabilityScore,
    fitLevel: raw.fitLevel,
    supportTier: ctx.region?.supportTier,
    beginnerLevel: ctx.input?.beginnerLevel,
    purpose: ctx.input?.purpose,
    growingStyle: ctx.input?.growingStyle,
    learningMultiplier: ctx.learningMultipliers?.[raw.crop] || 1,
  });
  const supportDepth = deriveSupportDepth({
    crop: raw.crop,
    supportTier: ctx.region?.supportTier,
    fitLevel: raw.fitLevel,
  });
  return {
    crop: raw.crop,
    cropName: raw.cropName || raw.crop,
    score: raw.suitabilityScore,
    fitLevel: raw.fitLevel,
    confidence,
    reasons: raw.reasons || [],
    riskNotes: raw.riskNotes || [],
    plantingStatus: raw.plantingStatus,
    supportDepth,
    regionLabel: raw.regionLabel,
    plantingWindowExplanation: raw.plantingWindowExplanation || null,
    explain: raw.explain,
  };
}

/**
 * scoreCrop(input, { learningMultipliers }) — the single-crop entry
 * point used by the crop-plan page. `learningMultipliers` is a map
 * of cropKey → multiplier (1.0 = neutral) from the learning engine.
 */
export function scoreCrop(input, opts = {}) {
  const region = resolveRegionProfile({
    country: input.country || 'US',
    state: input.state,
    city: input.city,
  });
  const raw = scoreCropSuitability({
    ...input,
    country: region?.country || input.country,
    state: input.state,
    climateSubregion: region?.climateSubregion,
  });
  return shapeCropResult(raw, {
    region,
    input,
    learningMultipliers: opts.learningMultipliers || {},
  });
}

/**
 * scoreAllCrops(input, { crops, learningMultipliers })
 *
 * Produces the full recommendation payload:
 *   { locationProfile, bestMatch, alsoConsider, notRecommendedNow }
 *
 * Guardrails inside `scoreCropSuitability` keep things like cassava
 * in Maryland out of the bestMatch bucket even when other components
 * score well.
 */
export function scoreAllCrops(input = {}, opts = {}) {
  const region = resolveRegionProfile({
    country: input.country || 'US',
    state: input.state,
    city: input.city,
  });

  const buckets = buildRecommendationBuckets({
    country: region?.country || input.country || 'US',
    state: input.state,
    farmType: input.farmType,
    growingStyle: input.growingStyle,
    purpose: input.purpose,
    beginnerLevel: input.beginnerLevel,
    currentMonth: input.currentMonth,
    crops: opts.crops,
  });

  const ctx = {
    region,
    input,
    learningMultipliers: opts.learningMultipliers || {},
  };
  const shape = (arr) => (arr || []).map((r) => shapeCropResult(r, ctx));

  return {
    locationProfile: region,
    bestMatch: shape(buckets.bestMatch),
    alsoConsider: shape(buckets.alsoConsider),
    notRecommendedNow: shape(buckets.notRecommendedNow),
    weights: buckets.weights,
    fitBands: buckets.fitBands,
  };
}

export const _internal = { deriveConfidence, deriveSupportDepth, FULLY_GUIDED_CROPS };
