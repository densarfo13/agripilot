/**
 * yieldPredictionEngine.js — seasonal/rainfall-aware wrapper around
 * the existing rule-based yieldEngine.
 *
 *   predictYield({
 *     cropId, normalizedAreaSqm, size, sizeUnit,
 *     country, state, currentStage, farmType,
 *     seasonFit?,    // 'high' | 'medium' | 'low' | 'unknown'
 *     rainfallFit?,  // 'high' | 'medium' | 'low' | 'unknown'
 *   }) → {
 *     cropId,
 *     lowYield, highYield, typicalYield,
 *     lowYieldTons, highYieldTons, typicalYieldTons,
 *     unit: 'kg',
 *     confidence: 'low' | 'medium' | 'high',
 *     reasons:     i18nKey[],
 *     adjustments: { tag, factor, detail }[],
 *     source,
 *     normalizedAreaSqm,
 *   } | null
 *
 * The base numbers come from yieldEngine — we simply layer a single
 * multiplicative adjustment step for `seasonFit` + `rainfallFit` and
 * translate the output shape into the spec-aligned names so the rest
 * of the economics pipeline (value, profit) can consume it.
 *
 * Contract
 *   • Pure + deterministic. Never throws.
 *   • Returns null only when the base yield engine returns null
 *     (i.e. no crop or no area at all).
 *   • All `reasons` are translation keys, never raw English.
 */

import { estimateYield } from './yieldEngine.js';
import { normalizeCropId } from '../../config/crops/index.js';

const f = Object.freeze;

const SEASON_MULT = f({
  high:    { low: 1.10, high: 1.10, tag: 'season.high',
             reason: 'econ.reason.seasonFitHigh' },
  medium:  { low: 1.00, high: 1.00, tag: 'season.medium', reason: null },
  low:     { low: 0.85, high: 0.85, tag: 'season.low',
             reason: 'econ.reason.seasonFitLow' },
  unknown: { low: 1.00, high: 1.00, tag: 'season.unknown', reason: null },
});

const RAIN_MULT = f({
  high:    { low: 1.10, high: 1.10, tag: 'rainfall.high',
             reason: 'econ.reason.rainfallFitHigh' },
  medium:  { low: 1.00, high: 1.00, tag: 'rainfall.medium', reason: null },
  low:     { low: 0.80, high: 0.80, tag: 'rainfall.low',
             reason: 'econ.reason.rainfallFitLow' },
  unknown: { low: 1.00, high: 1.00, tag: 'rainfall.unknown', reason: null },
});

function round(n, d = 0) { const p = 10 ** d; return Math.round(n * p) / p; }

/**
 * predictYield — spec-aligned wrapper. Accepts `cropId` (preferred)
 * or `crop`; either way normalizes to the canonical registry id.
 */
export function predictYield(input = {}) {
  const cropId = normalizeCropId(input.cropId || input.crop);
  if (!cropId) return null;

  // Delegate the heavy lifting to the rule-based engine. `state` is
  // accepted at the API surface for forward compatibility but
  // intentionally dropped here — no current yield/price data source
  // is state-scoped, so threading it would create a fake parameter.
  const base = estimateYield({
    crop:              cropId,
    normalizedAreaSqm: input.normalizedAreaSqm,
    size:              input.size,
    sizeUnit:          input.sizeUnit,
    farmType:          input.farmType,
    cropStage:         input.currentStage,
    countryCode:       input.country,
  });
  if (!base) return null;

  // Collect adjustments.
  const adjustments = [];
  const reasons     = [];
  const sAdj = SEASON_MULT[input.seasonFit] || SEASON_MULT.unknown;
  const rAdj = RAIN_MULT[input.rainfallFit] || RAIN_MULT.unknown;

  if (sAdj.low !== 1) {
    adjustments.push({ tag: sAdj.tag, factor: sAdj.low, detail: 'seasonal fit' });
    if (sAdj.reason) reasons.push(sAdj.reason);
  }
  if (rAdj.low !== 1) {
    adjustments.push({ tag: rAdj.tag, factor: rAdj.low, detail: 'rainfall fit' });
    if (rAdj.reason) reasons.push(rAdj.reason);
  }

  const lowKg  = base.lowEstimateKg  * sAdj.low  * rAdj.low;
  const highKg = base.highEstimateKg * sAdj.high * rAdj.high;
  const typKg  = (base.typicalEstimateKg != null
                   ? base.typicalEstimateKg
                   : (base.lowEstimateKg + base.highEstimateKg) / 2)
                 * ((sAdj.low + sAdj.high) / 2)
                 * ((rAdj.low + rAdj.high) / 2);

  // Confidence gets capped when either fit is unknown OR low — we
  // don't want "high confidence" numbers when a bad weather read is
  // pulling the range down.
  let confidence = base.confidenceLevel || 'medium';
  if (input.seasonFit === 'unknown' && input.rainfallFit === 'unknown') {
    confidence = softer(confidence);
  }
  if (input.seasonFit === 'low' || input.rainfallFit === 'low') {
    confidence = softer(confidence);
  }

  // Map base engine assumptions into i18n-keyed reasons — the base
  // engine uses structured tags we can project onto stable keys.
  for (const a of base.assumptions || []) {
    const key = ASSUMPTION_TO_KEY[a.tag];
    if (key && !reasons.includes(key)) reasons.push(key);
  }

  return f({
    cropId,
    lowYield:     round(lowKg),
    highYield:    round(highKg),
    typicalYield: round(typKg),
    lowYieldTons:     round(lowKg  / 1000, 2),
    highYieldTons:    round(highKg / 1000, 2),
    typicalYieldTons: round(typKg  / 1000, 2),
    unit:          'kg',
    confidence,
    reasons:       f(reasons),
    adjustments:   f(adjustments.map(f)),
    source:        base.source || 'registry',
    normalizedAreaSqm: base.normalizedAreaSqm,
  });
}

function softer(conf) {
  if (conf === 'high') return 'medium';
  if (conf === 'medium') return 'low';
  return conf;
}

// Map base engine assumption tags → i18n keys surfaced on the
// economics card. Tags we don't map silently get swallowed so we
// never leak raw English into the UI.
const ASSUMPTION_TO_KEY = f({
  planning_buffer:      'econ.reason.stagePlanningBuffer',
  planted_buffer:       'econ.reason.stagePlantedBuffer',
  growing_buffer:       'econ.reason.stageGrowingBuffer',
  harvest_ready:        'econ.reason.stageHarvestReady',
  post_harvest:         'econ.reason.stagePostHarvest',
  stage_unknown:        'econ.reason.stageUnknown',
  'farm_type:backyard': 'econ.reason.farmTypeBackyard',
  'farm_type:commercial':'econ.reason.farmTypeCommercial',
});

export const _internal = f({ SEASON_MULT, RAIN_MULT, ASSUMPTION_TO_KEY });
