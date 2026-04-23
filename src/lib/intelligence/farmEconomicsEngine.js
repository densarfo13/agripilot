/**
 * farmEconomicsEngine.js — single entry point for the yield +
 * value + profit stack. Wraps the three individual engines so
 * the UI (and Top Crops secondary boost) only has to call one
 * function.
 *
 *   estimateFarmEconomics({
 *     farm,                  // full farm record or lightweight hash
 *     country, state,
 *     cropId, currentStage, farmType,
 *     normalizedAreaSqm, size, sizeUnit,
 *     seasonFit, rainfallFit,
 *     language,              // reserved; logging only
 *   }) → {
 *     cropId,
 *     yield:  YieldPrediction   | null,
 *     value:  ValueEstimate     | null,
 *     profit: ProfitEstimate    | null,
 *     confidence: 'low' | 'medium' | 'high',
 *     drivers:    i18nKey[],  // deduped + ordered reasons for UI
 *     highlights: i18nKey[],  // Top-Crops-ready badge keys
 *   } | null
 *
 * Never throws. Returns null only when both yield AND value come
 * back null (i.e. we truly have nothing to say).
 */

import { predictYield } from './yieldPredictionEngine.js';
import { estimateValueFromPrediction } from './valueEstimationEngine.js';
import { estimateProfit } from './profitEstimationEngine.js';

const f = Object.freeze;

// Farm records use a few different field names across the app; this
// helper consolidates the most common aliases so the engine Just Works
// whether callers hand it a dashboard farm, an onboarding payload, or
// a recommendation context.
function pick(...candidates) {
  for (const c of candidates) if (c != null && c !== '') return c;
  return null;
}

export function estimateFarmEconomics(ctx = {}) {
  const farm = ctx.farm || {};
  const cropId = pick(
    ctx.cropId,
    farm.cropId,
    farm.cropType,
    farm.crop,
  );
  const country = pick(ctx.country, farm.country, farm.countryCode);
  const state   = pick(ctx.state, farm.state, farm.region);
  const farmType = pick(ctx.farmType, farm.farmType) || 'small_farm';
  const currentStage = pick(
    ctx.currentStage, farm.cropStage, farm.currentStage, farm.stage,
  );
  const normalizedAreaSqm = Number(pick(
    ctx.normalizedAreaSqm,
    farm.normalizedAreaSqm,
    farm.normalized_area_sqm,
  )) || null;
  const size     = pick(ctx.size,     farm.farmSize, farm.size);
  const sizeUnit = pick(ctx.sizeUnit, farm.farmSizeUnit, farm.sizeUnit);

  const yieldPrediction = predictYield({
    cropId, country, state, farmType, currentStage,
    normalizedAreaSqm, size, sizeUnit,
    seasonFit:   ctx.seasonFit,
    rainfallFit: ctx.rainfallFit,
  });

  const valueEstimate = estimateValueFromPrediction({
    yieldPrediction, cropId, country,
  });

  const profitEstimate = estimateProfit({
    valueEstimate, yieldPrediction,
    cropId, country, farmType,
    normalizedAreaSqm: yieldPrediction && yieldPrediction.normalizedAreaSqm,
  });

  if (!yieldPrediction && !valueEstimate && !profitEstimate) return null;

  // Roll up confidence — take the weakest of the three so the UI
  // never over-promises. If a layer is missing, skip it.
  const confidence = weakest([
    yieldPrediction && yieldPrediction.confidence,
    valueEstimate   && valueEstimate.confidence,
    profitEstimate  && profitEstimate.confidence,
  ].filter(Boolean));

  // Drivers — deduped list of reasons in display order.
  const drivers = [];
  const push = (k) => { if (k && !drivers.includes(k)) drivers.push(k); };
  for (const r of (yieldPrediction && yieldPrediction.reasons) || []) push(r);
  for (const r of (valueEstimate   && valueEstimate.reasons)   || []) push(r);
  for (const r of (profitEstimate  && profitEstimate.reasons)  || []) push(r);

  const highlights = collectHighlights({ yieldPrediction, valueEstimate, profitEstimate });

  return f({
    cropId,
    yield:  yieldPrediction,
    value:  valueEstimate,
    profit: profitEstimate,
    confidence,
    drivers:    f(drivers),
    highlights: f(highlights),
  });
}

function weakest(levels) {
  if (!levels || levels.length === 0) return 'low';
  const order = { low: 0, medium: 1, high: 2 };
  let min = 'high';
  for (const l of levels) {
    if ((order[l] ?? 2) < (order[min] ?? 2)) min = l;
  }
  return min;
}

function collectHighlights({ yieldPrediction, valueEstimate, profitEstimate }) {
  const out = [];
  if (profitEstimate && profitEstimate.lowProfit > 0 && profitEstimate.highProfit > 0
      && (profitEstimate.typicalProfit || profitEstimate.lowProfit) > 0) {
    out.push('econ.highlight.positiveProfitRange');
  }
  if (valueEstimate && valueEstimate.source && valueEstimate.source.startsWith('country:')) {
    out.push('econ.highlight.localPrice');
  }
  if (profitEstimate && profitEstimate.lowCost < 2 && profitEstimate.highCost < 20) {
    // Very small nominal cost — useful for Top Crops "low cost to start".
    out.push('econ.highlight.lowCostToStart');
  }
  return out;
}

/**
 * scoreFromEconomics(econ)
 *   Secondary signal for the Top Crops engine: turns economics into
 *   a small integer so a higher expected profit gently breaks ties,
 *   without letting economics dominate recommendation quality.
 *
 *   Output: integer in [-10, +15]
 */
export function scoreFromEconomics(econ) {
  if (!econ || !econ.profit) return 0;
  const { profit } = econ;
  if (!Number.isFinite(profit.highProfit)) return 0;
  if (profit.highProfit <= 0) return -5;
  if (profit.typicalProfit > 0 && profit.lowProfit >= 0) return 15;
  if (profit.typicalProfit > 0) return 10;
  return 5;
}

export const _internal = f({ weakest, collectHighlights });
