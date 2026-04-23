/**
 * seasonalCropEngine.js — month- and weather-aware crop suitability.
 *
 *   evaluateSeasonalFit({
 *     cropId, country?, state?, month?, weather?,
 *   }) → {
 *     cropId,
 *     seasonFit:        'high' | 'medium' | 'low' | 'unknown',
 *     plantingMessage:  i18nKey,   // translation key for the UI
 *     reasons:          i18nKey[], // structured explanation
 *     scoreAdjustment:  number,    // signed; feeds topCropEngine
 *     weatherAdjusted:  boolean,
 *     window:           { preferred, acceptable } | null,
 *     source:           'registry' | 'fallback',
 *   }
 *
 * Contract
 *   • Pure function; no I/O, no Date-new by default (month is passed
 *     in; if omitted we read `new Date().getMonth()+1`).
 *   • Missing registry data → seasonFit='unknown', a neutral message,
 *     zero score adjustment. The engine never throws.
 *   • Weather is LIGHTWEIGHT: it can bump fit up or down one step,
 *     never invent fit out of nothing.
 *
 * Weather summary shape (optional):
 *   {
 *     pattern?: 'dry_conditions' | 'moderate_rain' | 'high_rain'
 *             | 'heat_stress'    | 'cool_conditions',
 *     confidence?: 'low' | 'medium' | 'high',
 *   }
 */

import { normalizeCropId } from '../../config/crops/index.js';
import { getCropSeasonality, hasCropSeasonality } from '../../config/crops/cropSeasonality.js';

const f = Object.freeze;

// ─── Score adjustments ─────────────────────────────────────────
// Kept explicit so tests can lock the contract.
const ADJ = f({
  high:   +20,
  medium: +5,
  low:    -15,
  unknown: 0,
});

const MSG = f({
  high:          'seasonal.msg.goodTimeToPlant',
  mediumOk:      'seasonal.msg.conditionsFavorable',
  mediumWeather: 'seasonal.msg.possibleButLessIdeal',
  low:           'seasonal.msg.usuallyPlantedLater',
  veryLow:       'seasonal.msg.betterAnotherSeason',
  unknown:       'seasonal.msg.suitableManyRegions',
  fallback:      'seasonal.msg.checkLocalConditions',
});

function currentMonth1(now = new Date()) {
  return now.getMonth() + 1;
}

function classify(entry, month) {
  if (!entry) return 'unknown';
  if (entry.preferredPlantingMonths && entry.preferredPlantingMonths.includes(month)) return 'high';
  if (entry.acceptablePlantingMonths && entry.acceptablePlantingMonths.includes(month)) return 'medium';
  return 'low';
}

// Weather nudges — kept minimal + explainable.
function applyWeatherAdjustment(fit, entry, weather) {
  if (!weather || !weather.pattern || !entry) {
    return { fit, reason: null, weatherAdjusted: false };
  }
  const pattern = String(weather.pattern).toLowerCase();

  // Positive nudges.
  if (pattern === 'moderate_rain' && entry.prefersRain) {
    if (fit === 'medium') return { fit: 'high', reason: 'seasonal.reason.rainSupports', weatherAdjusted: true };
    return { fit, reason: 'seasonal.reason.rainSupports', weatherAdjusted: true };
  }

  // Negative nudges.
  if (pattern === 'dry_conditions' && entry.prefersRain) {
    if (fit === 'high')   return { fit: 'medium', reason: 'seasonal.reason.drySlowsEstablishment', weatherAdjusted: true };
    if (fit === 'medium') return { fit: 'low',    reason: 'seasonal.reason.drySlowsEstablishment', weatherAdjusted: true };
  }
  if (pattern === 'high_rain' && entry.dislikesHeavyRain) {
    if (fit === 'high')   return { fit: 'medium', reason: 'seasonal.reason.heavyRainRisk', weatherAdjusted: true };
    if (fit === 'medium') return { fit: 'low',    reason: 'seasonal.reason.heavyRainRisk', weatherAdjusted: true };
  }
  if (pattern === 'heat_stress' && entry.sensitiveToHeatStress) {
    if (fit === 'high')   return { fit: 'medium', reason: 'seasonal.reason.heatStress', weatherAdjusted: true };
    if (fit === 'medium') return { fit: 'low',    reason: 'seasonal.reason.heatStress', weatherAdjusted: true };
  }
  if (pattern === 'cool_conditions' && entry.sensitiveToHeatStress === false) {
    // Cool weather is a non-issue for heat-sensitive crops; leave fit alone.
    return { fit, reason: null, weatherAdjusted: false };
  }

  return { fit, reason: null, weatherAdjusted: false };
}

/**
 * evaluateSeasonalFit(ctx)
 *   See module header for shape. Always returns a frozen object;
 *   never throws.
 */
export function evaluateSeasonalFit(ctx = {}) {
  const cropId = normalizeCropId(ctx.cropId);
  const country = ctx.country ? String(ctx.country).toUpperCase() : null;
  const month = Number.isFinite(ctx.month)
    ? ((Number(ctx.month) - 1) % 12 + 12) % 12 + 1
    : currentMonth1(ctx.now);

  // No crop → unknown, neutral.
  if (!cropId) {
    return buildResult({
      cropId: null, seasonFit: 'unknown',
      messageKey: MSG.unknown, reasons: [], adjustment: 0,
      weatherAdjusted: false, window: null, source: 'fallback',
    });
  }

  const entry = getCropSeasonality(cropId, country);
  if (!entry) {
    // Registry doesn't know this crop's seasonality — return unknown
    // but with the safe fallback message so the UI never goes blank.
    return buildResult({
      cropId, seasonFit: 'unknown',
      messageKey: hasCropSeasonality(cropId) ? MSG.unknown : MSG.fallback,
      reasons: [], adjustment: 0, weatherAdjusted: false,
      window: null, source: 'fallback',
    });
  }

  // 1. Classify by month alone.
  let fit = classify(entry, month);
  const reasons = [];
  if (fit === 'high') reasons.push('seasonal.reason.preferredMonth');
  else if (fit === 'medium') reasons.push('seasonal.reason.acceptableMonth');
  else if (fit === 'low') reasons.push('seasonal.reason.outOfWindow');

  // 2. Apply weather adjustment (single step).
  const weatherOut = applyWeatherAdjustment(fit, entry, ctx.weather);
  fit = weatherOut.fit;
  if (weatherOut.reason) reasons.push(weatherOut.reason);

  // 3. Map fit → message key. When weather pulled us to medium, show
  //    the "possible but less ideal" copy instead of "favorable".
  let messageKey;
  if (fit === 'high') messageKey = MSG.high;
  else if (fit === 'medium') {
    messageKey = weatherOut.weatherAdjusted ? MSG.mediumWeather : MSG.mediumOk;
  } else if (fit === 'low') {
    // Original month classification was low; distinguish "out of
    // window" (could plant later) from "really poor fit".
    const preferredMonths = entry.preferredPlantingMonths || [];
    const hasPreferred = preferredMonths.length > 0;
    messageKey = hasPreferred ? MSG.low : MSG.veryLow;
  } else {
    messageKey = MSG.unknown;
  }

  return buildResult({
    cropId, seasonFit: fit,
    messageKey, reasons,
    adjustment: ADJ[fit] || 0,
    weatherAdjusted: weatherOut.weatherAdjusted,
    window: f({
      preferred:  entry.preferredPlantingMonths || [],
      acceptable: entry.acceptablePlantingMonths || [],
    }),
    source: 'registry',
  });
}

function buildResult({
  cropId, seasonFit, messageKey, reasons, adjustment,
  weatherAdjusted, window, source,
}) {
  return f({
    cropId,
    seasonFit,
    plantingMessage: messageKey,
    reasons: f(reasons || []),
    scoreAdjustment: adjustment,
    weatherAdjusted: Boolean(weatherAdjusted),
    window,
    source,
  });
}

export const _internal = f({ ADJ, MSG, classify, applyWeatherAdjustment });
