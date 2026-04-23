/**
 * profitEstimationEngine.js — low/high cost + profit bands.
 *
 *   estimateProfit({
 *     valueEstimate,          // output of estimateValueFromPrediction
 *     yieldPrediction,        // for normalizedAreaSqm fallback
 *     cropId, country, farmType,
 *     normalizedAreaSqm,      // overrides yieldPrediction.normalizedAreaSqm
 *   }) → {
 *     cropId,
 *     lowCost, highCost,
 *     lowProfit, highProfit, typicalProfit,
 *     currency,
 *     confidence: 'low' | 'medium' | 'high',
 *     reasons: i18nKey[],
 *     source: 'crop_cost_profile' | 'generic_fallback',
 *   } | null
 *
 * Math
 *   costPerSqm (USD) × normalizedAreaSqm → cost band in USD
 *   → convert to the currency of valueEstimate using the legacy
 *     price table's USD↔local ratio (we reuse what the valueEngine
 *     already computed in valueEstimate so we don't need a FX API).
 *   lowProfit  = lowValue  − highCost
 *   highProfit = highValue − lowCost
 *
 * If valueEstimate or area is missing, we can't make a responsible
 * profit range — return null. Confidence never exceeds the
 * valueEstimate's confidence.
 */

import {
  getCropCostProfile, hasCropCostProfile,
} from '../../config/crops/cropCostProfiles.js';
import { normalizeCropId } from '../../config/crops/index.js';

const f = Object.freeze;

function round2(n) { return Math.round(n * 100) / 100; }

export function estimateProfit({
  valueEstimate, yieldPrediction,
  cropId, country, farmType,
  normalizedAreaSqm,
} = {}) {
  const id = normalizeCropId(cropId
    || (valueEstimate && valueEstimate.cropId)
    || (yieldPrediction && yieldPrediction.cropId));
  if (!id) return null;

  // Resolve area from whichever source carries it.
  const area = Number(
    normalizedAreaSqm
    || (yieldPrediction && yieldPrediction.normalizedAreaSqm)
  );
  if (!Number.isFinite(area) || area <= 0) return null;
  if (!valueEstimate) return null;

  const cost = getCropCostProfile(id);
  const reasons = [];

  // Cost in USD per the catalogue.
  const lowCostUsd  = area * cost.baseCostPerSqmLow;
  const highCostUsd = area * cost.baseCostPerSqmHigh;

  // Convert to the farmer's currency by using the same scale the
  // valueEstimate used. valueEstimate.source tells us whether the
  // numbers are already in the local currency or in USD.
  let lowCost, highCost, currency;
  if (valueEstimate.source && valueEstimate.source.startsWith('country:')
      && valueEstimate.priceBand
      && valueEstimate.priceBand.currency
      && valueEstimate.priceBand.currency !== 'USD') {
    // Use the local price band's typical rate to estimate a rough
    // USD↔local FX ratio. globalFor(crop) is always USD; we compare
    // the localized price band's typical vs GLOBAL_USD's typical for
    // the same crop. When that ratio isn't available fall back to USD
    // display so we never show a misleading number.
    currency = valueEstimate.currency;
    const ratio = deriveUsdToLocalRatio(valueEstimate);
    if (ratio && ratio > 0) {
      lowCost  = round2(lowCostUsd  * ratio);
      highCost = round2(highCostUsd * ratio);
      reasons.push('econ.reason.costConvertedLocal');
    } else {
      currency = 'USD';
      lowCost  = round2(lowCostUsd);
      highCost = round2(highCostUsd);
      reasons.push('econ.reason.costUsdFallback');
    }
  } else {
    currency = valueEstimate.currency || 'USD';
    lowCost  = round2(lowCostUsd);
    highCost = round2(highCostUsd);
    reasons.push('econ.reason.costUsdBase');
  }

  // Farm-type nudges — commercial farms carry more overhead.
  const ftMult = farmTypeMultiplier(farmType);
  if (ftMult !== 1) {
    lowCost  = round2(lowCost  * ftMult);
    highCost = round2(highCost * ftMult);
    reasons.push(ftMult > 1 ? 'econ.reason.commercialOverhead'
                             : 'econ.reason.backyardLowInput');
  }

  const lowValue  = Number(valueEstimate.lowValue)     || 0;
  const highValue = Number(valueEstimate.highValue)    || 0;
  const typValue  = Number(valueEstimate.typicalValue) || ((lowValue + highValue) / 2);

  const lowProfit     = round2(lowValue  - highCost);
  const highProfit    = round2(highValue - lowCost);
  const typicalProfit = round2(typValue  - ((lowCost + highCost) / 2));

  // Confidence: cap at value confidence; downgrade one step when we
  // had to fall back to the generic cost profile.
  let confidence = valueEstimate.confidence || 'medium';
  if (!hasCropCostProfile(id)) {
    confidence = softer(confidence);
    reasons.push('econ.reason.costProfileFallback');
  }
  if (highProfit < 0) reasons.push('econ.reason.profitNegativeWarning');
  if ((highProfit - lowProfit) > Math.abs(typValue) * 2) {
    reasons.push('econ.reason.profitRangeWide');
  }

  return f({
    cropId: id,
    lowCost, highCost,
    lowProfit, highProfit, typicalProfit,
    currency,
    confidence,
    reasons: f(reasons),
    source:  hasCropCostProfile(id) ? 'crop_cost_profile' : 'generic_fallback',
  });
}

function softer(c) {
  if (c === 'high') return 'medium';
  if (c === 'medium') return 'low';
  return c;
}

function farmTypeMultiplier(farmType) {
  const t = String(farmType || '').toLowerCase();
  if (t === 'backyard')   return 0.8;
  if (t === 'commercial') return 1.2;
  return 1;
}

/**
 * deriveUsdToLocalRatio(valueEstimate)
 *   Heuristic ratio from the localized price band typical to the
 *   global USD typical for the same crop. Example: cassava in GH
 *   ~2.0 GHS/kg, global ~0.20 USD/kg → ratio ≈ 10 GHS per 1 USD.
 *   Returns null when we can't trust the ratio (missing bands, non-
 *   positive, etc.).
 */
function deriveUsdToLocalRatio(valueEstimate) {
  const pb = valueEstimate && valueEstimate.priceBand;
  if (!pb) return null;
  const typLocal = Number(pb.typical);
  const typUsd   = Number(pb.typicalUsd || pb.typical_usd || NaN);
  if (Number.isFinite(typLocal) && Number.isFinite(typUsd) && typUsd > 0) {
    return typLocal / typUsd;
  }
  // If the band has no USD reference, skip conversion. The legacy
  // priceBand often carries only local numbers — we prefer showing
  // USD cost honestly over fabricating an FX rate.
  return null;
}

export const _internal = f({ farmTypeMultiplier, deriveUsdToLocalRatio });
