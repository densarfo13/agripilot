/**
 * farmInsightEngine.js — the farm-intelligence orchestrator.
 *
 * Pulls the four engines (yield, value, weather-action, risk) into a
 * single call so the UI doesn't have to wire four imports in every
 * dashboard panel:
 *
 *   getFarmInsight({ farm, weather, tasks, issues, language, now })
 *     → {
 *       farmId, farmName,
 *       crop,
 *       yieldEstimate:  { ... } | null,
 *       valueEstimate:  { ... } | null,
 *       weatherAction:  { ... } | null,
 *       riskInsight:    { ... } | null,
 *       summaryCards:   [ Card, Card, Card, … ],
 *       depth:          'simple' | 'standard' | 'detailed',
 *       confidenceLevel:'low' | 'medium' | 'high',
 *       generatedAt:    ISO string,
 *     }
 *
 * Cards are UI-ready rows sorted by priority (danger first, then
 * warn, then info). Each card is self-sufficient — title + value +
 * "why" + optional primaryAction — so a panel can map straight to JSX.
 *
 * Depth is derived from farmType:
 *   backyard   → 'simple'     (skip value, skip secondary actions)
 *   small_farm → 'standard'
 *   commercial → 'detailed'   (show price band, assumptions)
 *
 * Pure — no network, no React. Safe to call from both the browser
 * (via useFarmInsight hook) and a node batch job.
 */

import { estimateYield }      from './yieldEngine.js';
import { estimateValue }      from './valueEngine.js';
import { getWeatherAction }   from './weatherActionEngine.js';
import { getRiskInsight }     from './riskInsightEngine.js';
import { getCropLabel, normalizeCrop } from '../../config/crops.js';
import { getCropTimeline }    from '../timeline/cropTimelineEngine.js';

function depthFor(farmType) {
  const s = String(farmType || 'small_farm').toLowerCase().trim();
  if (s === 'backyard' || s === 'home' || s === 'home_food') return 'simple';
  if (s === 'commercial' || s === 'large' || s === 'enterprise') return 'detailed';
  return 'standard';
}

function toneRank(tone) {
  return tone === 'danger' ? 3 : tone === 'warn' ? 2 : tone === 'info' ? 1 : 0;
}

function confidenceFloor(...levels) {
  // Lowest confidence wins — the overall reading is only as strong as
  // its weakest leg.
  const order = { low: 1, medium: 2, high: 3 };
  let min = 3;
  for (const l of levels) {
    const v = order[l];
    if (v && v < min) min = v;
  }
  return min === 1 ? 'low' : min === 2 ? 'medium' : 'high';
}

export function getFarmInsight({
  farm     = null,
  weather  = null,
  tasks    = [],
  issues   = [],
  completions = [],
  language = 'en',
  now      = null,
} = {}) {
  if (!farm || typeof farm !== 'object') {
    return Object.freeze({
      farmId: null, farmName: null, crop: null,
      yieldEstimate: null, valueEstimate: null,
      weatherAction: null, riskInsight: null,
      summaryCards: Object.freeze([]),
      depth: 'standard',
      confidenceLevel: 'low',
      generatedAt: new Date().toISOString(),
    });
  }

  const crop = normalizeCrop(farm.crop);
  const cropLabel = crop ? getCropLabel(crop, language) : null;
  const farmType = farm.farmType || 'small_farm';
  const depth    = depthFor(farmType);

  // Source of truth for stage = timeline engine (handles manual
  // override, planting-date auto-advance, and fallback to the
  // persisted cropStage when no date anchor exists). Downstream
  // engines (yield, weather action) now read this instead of the
  // stored farm.cropStage so they stay honest when the farmer was
  // away while the crop progressed.
  const timeline = getCropTimeline({ farm, now });
  const computedStage = (timeline && timeline.currentStage)
    || farm.cropStage || farm.stage;

  // ─── Yield ───────────────────────────────────────────────────
  const yieldEstimate = crop ? estimateYield({
    crop,
    normalizedAreaSqm: farm.normalizedAreaSqm,
    size:              farm.size,
    sizeUnit:          farm.sizeUnit,
    farmType,
    cropStage:         computedStage,
    countryCode:       farm.countryCode || farm.country,
  }) : null;

  // ─── Value ───────────────────────────────────────────────────
  // Backyard skips the $$ line by default — it's noisy when the
  // plot only produces a few kilos and the prices are wholesale.
  const wantValue = yieldEstimate && depth !== 'simple';
  const valueEstimate = wantValue ? estimateValue({
    yieldEstimate,
    crop,
    countryCode: farm.countryCode || farm.country,
  }) : null;

  // ─── Weather action ──────────────────────────────────────────
  const weatherAction = getWeatherAction({
    weather,
    crop,
    cropStage: computedStage,
    farmType,
    forecastDays: 3,
  });

  // ─── Risk insight ────────────────────────────────────────────
  const riskInsight = getRiskInsight({
    farm, tasks, completions, issues, weather, crop, farmType, now,
  });

  // ─── Summary cards (priority-ordered) ────────────────────────
  const cards = [];

  if (weatherAction) {
    cards.push(Object.freeze({
      id:          'weather-action',
      kind:        'weather_action',
      tone:        weatherAction.tone,
      title:       weatherAction.condition,
      titleKey:    weatherAction.conditionKey,
      timeWindow:  weatherAction.timeWindow,
      timeWindowKey: weatherAction.timeWindowKey,
      primary:     weatherAction.primaryAction,
      primaryKey:  weatherAction.primaryActionKey,
      secondary:   depth === 'simple' ? null : weatherAction.secondaryAction,
      secondaryKey:depth === 'simple' ? null : weatherAction.secondaryActionKey,
      why:         weatherAction.why,
      whyKey:      weatherAction.whyKey,
      ruleTag:     weatherAction.ruleTag,
    }));
  }

  if (riskInsight) {
    cards.push(Object.freeze({
      id:          'risk-insight',
      kind:        'risk',
      tone:        riskInsight.tone,
      title:       riskInsight.message,
      titleKey:    riskInsight.messageKey,
      timeWindow:  riskInsight.timeWindow,
      timeWindowKey: riskInsight.timeWindowKey,
      primary:     riskInsight.primaryAction,
      primaryKey:  riskInsight.primaryActionKey,
      secondary:   null,
      secondaryKey:null,
      why:         riskInsight.why,
      whyKey:      riskInsight.whyKey,
      ruleTag:     riskInsight.ruleTag,
      meta:        { level: riskInsight.level, type: riskInsight.type,
                     requiresReview: riskInsight.requiresReview },
    }));
  }

  if (yieldEstimate) {
    cards.push(Object.freeze({
      id:          'yield-estimate',
      kind:        'yield',
      tone:        'info',
      title:       cropLabel
        ? `Expected harvest — ${cropLabel}`
        : 'Expected harvest',
      titleKey:    'farmer.insight.yield.title',
      valueLow:    yieldEstimate.lowEstimateKg,
      valueHigh:   yieldEstimate.highEstimateKg,
      valueTypical:yieldEstimate.typicalEstimateKg,
      unit:        'kg',
      tonsLow:     yieldEstimate.lowEstimateTons,
      tonsHigh:    yieldEstimate.highEstimateTons,
      why:         (yieldEstimate.assumptions[0] && yieldEstimate.assumptions[0].detail) || '',
      confidenceLevel: yieldEstimate.confidenceLevel,
      assumptions: depth === 'detailed' ? yieldEstimate.assumptions : null,
    }));
  }

  if (valueEstimate) {
    cards.push(Object.freeze({
      id:          'value-estimate',
      kind:        'value',
      tone:        'info',
      title:       cropLabel
        ? `Estimated harvest value — ${cropLabel}`
        : 'Estimated harvest value',
      titleKey:    'farmer.insight.value.title',
      valueLow:    valueEstimate.lowValue,
      valueHigh:   valueEstimate.highValue,
      valueTypical:valueEstimate.typicalValue,
      currency:    valueEstimate.currency,
      currencySymbol: valueEstimate.currencySymbol,
      formatted:   valueEstimate.formatted,
      why:         (valueEstimate.assumptions[0] && valueEstimate.assumptions[0].detail) || '',
      confidenceLevel: valueEstimate.confidenceLevel,
      priceBand:   depth === 'detailed' ? valueEstimate.priceBand : null,
    }));
  }

  // Stable priority sort so danger weather > danger risk > warn > info.
  cards.sort((a, b) => toneRank(b.tone) - toneRank(a.tone));

  const confidenceLevel = confidenceFloor(
    yieldEstimate && yieldEstimate.confidenceLevel,
    valueEstimate && valueEstimate.confidenceLevel,
    riskInsight   && riskInsight.confidenceLevel,
  );

  return Object.freeze({
    farmId:    farm.id || farm._id || null,
    farmName:  farm.name || farm.farmName || null,
    crop,
    cropLabel,
    yieldEstimate,
    valueEstimate,
    weatherAction,
    riskInsight,
    summaryCards:   Object.freeze(cards),
    depth,
    confidenceLevel,
    farmType,
    generatedAt: new Date().toISOString(),
  });
}

export const _internal = Object.freeze({ depthFor, toneRank, confidenceFloor });
