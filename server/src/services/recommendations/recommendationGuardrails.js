/**
 * recommendationGuardrails.js — sanity + honesty helpers the
 * scoring layer runs BEFORE returning a recommendation.
 *
 * Five entry points:
 *   validateRecommendationInputs(input)
 *     → { valid, errors, warnings }
 *   applyWeatherTimingGuardrails(crop, weather)
 *     → { softenPlanting, warningKey? }
 *   applyRegionCropGuardrails(crop, region)
 *     → { capScore?, warningKey? }
 *   applyConfidenceDowngrade(confidence, { region, crop })
 *     → downgraded confidence level
 *   getRecommendationSanityChecks({ input, region, crop, weather })
 *     → { warnings: string[], metadata: {...}, confidence?: 'low' }
 *
 * Pure functions; no I/O. The scoring engine reads the warnings
 * array and appends them to `riskNotes` so the UI surfaces
 * farmer-facing wording via t(). `metadata` is returned to the
 * route for internal logging / debug panels — never rendered.
 */

const SENSITIVE_TO_HEAVY_RAIN = new Set([
  'tomato', 'pepper', 'lettuce', 'beans', 'bean', 'peanut', 'groundnut',
  'cucumber', 'strawberry', 'spinach',
]);

// Crops that should never climb above 'low' fit outside their
// climate — cassava / banana / cocoa / coffee in temperate US,
// heavy field crops in a backyard container farm, etc. The scoring
// engine already caps these; this helper just emits the warning.
const OFF_SEASON_HEAVY_PENALTY = 40;

export function validateRecommendationInputs(input = {}) {
  const errors = {};
  const warnings = {};

  const country = String(input.country || '').trim().toUpperCase();
  if (!country) errors.country = 'required';

  const state = String(input.state || input.stateCode || '').trim();
  if (country === 'US' && !state) errors.state = 'required_for_us';

  const month = Number(input.currentMonth);
  if (Number.isFinite(month)) {
    if (month < 1 || month > 12) errors.currentMonth = 'invalid_month';
  }

  if (input.farmType && !['backyard', 'small_farm', 'commercial'].includes(input.farmType)) {
    errors.farmType = 'invalid_enum';
  }

  if (input.beginnerLevel && !['new', 'beginner', 'experienced', 'intermediate', 'advanced']
      .includes(input.beginnerLevel)) {
    errors.beginnerLevel = 'invalid_enum';
  }

  if (input.growingStyle && !['container', 'raised_bed', 'in_ground', 'mixed']
      .includes(input.growingStyle)) {
    errors.growingStyle = 'invalid_enum';
  }

  if (!state) warnings.location = 'state_missing_reduces_accuracy';

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    warnings,
  };
}

/**
 * applyWeatherTimingGuardrails — if the forecast shows heavy rain
 * imminent and the crop is rain-sensitive at planting, soften the
 * "plant now" wording and surface a warning.
 */
export function applyWeatherTimingGuardrails(crop, weather) {
  if (!crop || !weather) return { softenPlanting: false };
  const key = String(crop.crop || crop.key || crop).toLowerCase();
  if (!SENSITIVE_TO_HEAVY_RAIN.has(key)) return { softenPlanting: false };

  const rain24 = Number(weather.rainMmNext24h ?? weather.rainMmToday) || 0;
  const chance = Number(weather.rainChancePct) || 0;
  if (rain24 >= 20 || chance >= 85) {
    return {
      softenPlanting: true,
      warningKey: 'recommendation.warning.heavyRainSoon',
    };
  }
  return { softenPlanting: false };
}

/**
 * applyRegionCropGuardrails — emit a warning when the scorer had
 * to cap a crop because it's clearly off-region (cassava in MD),
 * or off-season (planting window closed), so the UI can render
 * "Experimental for your location" wording honestly.
 */
export function applyRegionCropGuardrails(crop = {}, region = {}) {
  const key = String(crop.crop || '').toLowerCase();
  if (!key) return {};

  // Tropical staples outside tropical/subtropical US states.
  const tropicalOnly = new Set(['cassava', 'cocoa', 'coffee', 'banana', 'papaya', 'sugarcane', 'taro']);
  const isWarmUS = ['FLORIDA_SUBTROPICAL', 'HAWAII_TROPICAL'].includes(region?.climateSubregion);
  if (tropicalOnly.has(key) && region?.country === 'US' && !isWarmUS) {
    return {
      capScore: 35,
      warningKey: 'recommendation.warning.tropicalOutsideClimate',
    };
  }

  // Backyard + row crop mismatch.
  if (crop.farmTypeMismatch) {
    return {
      capScore: 30,
      warningKey: 'recommendation.warning.farmTypeMismatch',
    };
  }

  // Off-season planting.
  if (crop.plantingStatus === 'avoid') {
    return {
      capScore: 100 - OFF_SEASON_HEAVY_PENALTY,
      warningKey: 'recommendation.warning.offSeason',
    };
  }

  return {};
}

/**
 * applyConfidenceDowngrade — soften confidence when we honestly
 * don't know enough. Never lifts confidence; only downgrades.
 */
const RANK = { high: 3, medium: 2, low: 1 };
const UNRANK = ['', 'low', 'medium', 'high'];

export function applyConfidenceDowngrade(confidence, { region, crop } = {}) {
  let lvl = RANK[String(confidence || '').toLowerCase()] || 0;
  if (!lvl) return 'low';

  // Weak location precision.
  if (!region?.stateCode && region?.country === 'US') lvl = Math.min(lvl, 2);

  // Limited country support.
  if (region?.supportTier === 'LIMITED_SUPPORT') lvl = Math.min(lvl, 2);
  if (region?.supportTier === 'COMING_SOON')     lvl = 1;

  // Partial or browse-only crop support.
  const depth = crop?.supportDepth;
  if (depth === 'PARTIAL_GUIDANCE') lvl = Math.min(lvl, 2);
  if (depth === 'BROWSE_ONLY')      lvl = 1;

  return UNRANK[lvl];
}

/**
 * getRecommendationSanityChecks — composes the other helpers into
 * a single payload the scoring entry point can merge into its
 * response. `metadata` is for internal logs / debug panels.
 */
export function getRecommendationSanityChecks({
  input = {}, region = null, crop = {}, weather = null,
} = {}) {
  const warnings = [];
  const metadata = {
    inputRegion: { country: input.country || null, state: input.state || null },
    climateSubregion: region?.climateSubregion || null,
    currentMonth: input.currentMonth ?? null,
    weather: weather ? {
      rainMmNext24h: weather.rainMmNext24h ?? null,
      rainChancePct: weather.rainChancePct ?? null,
      tempHighC: weather.tempHighC ?? null,
    } : null,
    scoreBreakdown: crop?.explain?.components || null,
    guardrailsApplied: [],
  };

  const weatherGuard = applyWeatherTimingGuardrails(crop, weather);
  if (weatherGuard.warningKey) {
    warnings.push(weatherGuard.warningKey);
    metadata.guardrailsApplied.push('weatherTiming');
  }

  const regionGuard = applyRegionCropGuardrails(crop, region);
  if (regionGuard.warningKey) {
    warnings.push(regionGuard.warningKey);
    metadata.guardrailsApplied.push('regionCrop');
  }

  const confidence = applyConfidenceDowngrade(crop?.confidence, { region, crop });

  return { warnings, metadata, confidence, softenPlanting: !!weatherGuard.softenPlanting };
}

export const _internal = { SENSITIVE_TO_HEAVY_RAIN, OFF_SEASON_HEAVY_PENALTY };
