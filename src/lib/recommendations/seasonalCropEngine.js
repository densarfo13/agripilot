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
import { getWeatherState } from '../weather/weatherState.js';
import { getRainfallFit } from './rainfallFitEngine.js';

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

  // 2. Resolve the canonical rainfall state from whatever shape the
  //    caller passed in. Returns 'unknown' when no rainfall info is
  //    available, which makes the rainfall layer a safe no-op.
  const weatherState = getWeatherState(ctx.weather);
  const rainfall = getRainfallFit(cropId, weatherState);

  // 3. Rainfall dominates when present. The rainfall engine's
  //    score weights (+30 / +10 / -25) are stronger than the
  //    seasonal weights (+20 / +5 / -15), so real weather data
  //    steers ranking more than calendar month when they disagree.
  let rainfallDominates = rainfall.rainfallFit !== 'unknown';
  let adjustment = ADJ[fit] || 0;
  let messageKey;
  let weatherAdjusted = false;
  let riskMessage = null;
  let taskHint = null;

  if (rainfallDominates) {
    // Promote or demote seasonFit to reflect the combined signal.
    const rainFit = rainfall.rainfallFit;
    if (rainFit === 'high') {
      fit = fit === 'low' ? 'medium' : 'high';
    } else if (rainFit === 'medium') {
      fit = fit === 'high' ? 'high' : 'medium';
    } else if (rainFit === 'low') {
      fit = 'low';
    }

    // Combined score: rainfall weight + a softened seasonal weight
    // so a crop that's both in-season AND has favorable rainfall
    // scores higher than either alone.
    adjustment = rainfall.scoreAdjustment + Math.round((ADJ[fit] || 0) * 0.5);

    // Message comes from the rainfall layer so the UI says
    // "Good time to plant with current rainfall" instead of a
    // generic seasonal line.
    messageKey = rainfall.plantingMessage;
    weatherAdjusted = true;
    riskMessage = rainfall.riskMessage;
    taskHint = rainfall.taskHint;

    // Fold the rainfall reason in; dedupe preserves insertion order.
    for (const r of rainfall.reasons) if (!reasons.includes(r)) reasons.push(r);
  } else {
    // No rainfall data — apply the legacy single-step weather nudge
    // so the pre-rainfall behaviour stays available for crops that
    // only have prefersRain/dislikesHeavyRain flags on their
    // seasonality entry.
    const weatherOut = applyWeatherAdjustment(fit, entry, ctx.weather);
    fit = weatherOut.fit;
    if (weatherOut.reason) reasons.push(weatherOut.reason);
    weatherAdjusted = weatherOut.weatherAdjusted;

    if (fit === 'high') messageKey = MSG.high;
    else if (fit === 'medium') {
      messageKey = weatherAdjusted ? MSG.mediumWeather : MSG.mediumOk;
    } else if (fit === 'low') {
      const preferredMonths = entry.preferredPlantingMonths || [];
      messageKey = preferredMonths.length > 0 ? MSG.low : MSG.veryLow;
    } else {
      messageKey = MSG.unknown;
    }
    adjustment = ADJ[fit] || 0;
  }

  return buildResult({
    cropId, seasonFit: fit,
    messageKey, reasons,
    adjustment,
    weatherAdjusted,
    weatherState,
    rainfallFit: rainfall.rainfallFit,
    riskMessage,
    taskHint,
    window: f({
      preferred:  entry.preferredPlantingMonths || [],
      acceptable: entry.acceptablePlantingMonths || [],
    }),
    source: 'registry',
  });
}

function buildResult({
  cropId, seasonFit, messageKey, reasons, adjustment,
  weatherAdjusted, weatherState, rainfallFit, riskMessage, taskHint,
  window, source,
}) {
  return f({
    cropId,
    seasonFit,
    plantingMessage: messageKey,
    reasons: f(reasons || []),
    scoreAdjustment: adjustment,
    weatherAdjusted: Boolean(weatherAdjusted),
    weatherState: weatherState || 'unknown',
    rainfallFit:   rainfallFit || 'unknown',
    riskMessage:   riskMessage || null,
    taskHint:      taskHint || null,
    window,
    source,
  });
}

export const _internal = f({ ADJ, MSG, classify, applyWeatherAdjustment });
