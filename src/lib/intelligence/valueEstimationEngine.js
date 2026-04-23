/**
 * valueEstimationEngine.js — spec-aligned wrapper around the existing
 * valueEngine that speaks the yieldPredictionEngine shape.
 *
 *   estimateValue({
 *     yieldPrediction,   // output of predictYield()
 *     cropId,
 *     country,
 *   }) → {
 *     cropId,
 *     lowValue, highValue, typicalValue,
 *     currency, currencySymbol,
 *     source,                         // 'country:<CC>' | 'global_usd' | 'fallback'
 *     confidence: 'low' | 'medium' | 'high',
 *     reasons:    i18nKey[],
 *     formatted:  { low, high, typical },
 *   } | null
 *
 * Design notes
 *   • The legacy estimateValue accepts a yieldEstimate shape with
 *     lowEstimateKg/highEstimateKg/typicalEstimateKg. We adapt
 *     yieldPrediction.{lowYield, highYield, typicalYield} onto that
 *     shape so the price + currency resolution stays in one place.
 *   • Reasons come back as stable i18n keys so the UI never has to
 *     author copy from legacy engine strings.
 */

import { estimateValue as legacyEstimateValue } from './valueEngine.js';
import { normalizeCropId } from '../../config/crops/index.js';

const f = Object.freeze;

export function estimateValueFromPrediction({
  yieldPrediction, cropId, country,
} = {}) {
  if (!yieldPrediction) return null;
  const id = normalizeCropId(cropId || yieldPrediction.cropId);
  if (!id) return null;

  const legacyInput = {
    lowEstimateKg:     yieldPrediction.lowYield,
    highEstimateKg:    yieldPrediction.highYield,
    typicalEstimateKg: yieldPrediction.typicalYield,
    confidenceLevel:   yieldPrediction.confidence || 'medium',
    crop:              id,
  };
  // Legacy engine uses `cropCode` in uppercase / underscore form; we
  // hand it the canonical id too — legacy normalizes internally.
  const legacy = legacyEstimateValue({
    yieldEstimate: legacyInput,
    crop:          id,
    countryCode:   country || null,
  });
  if (!legacy) return null;

  const reasons = [];
  if (legacy.source && legacy.source.startsWith('country:')) {
    reasons.push('econ.reason.localPrice');
  } else if (legacy.source === 'global_usd') {
    reasons.push('econ.reason.globalUsdFallback');
  } else {
    reasons.push('econ.reason.genericPriceFallback');
  }

  return f({
    cropId: id,
    lowValue:     legacy.lowValue,
    highValue:    legacy.highValue,
    typicalValue: legacy.typicalValue,
    currency:       legacy.currency,
    currencySymbol: legacy.currencySymbol,
    source:       legacy.source,
    confidence:   legacy.confidenceLevel,
    reasons:      f(reasons),
    formatted:    f(legacy.formatted || {}),
    priceBand:    legacy.priceBand || null,
  });
}
