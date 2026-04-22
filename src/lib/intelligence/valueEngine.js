/**
 * valueEngine.js — turns a yield-range estimate into a monetary range
 * using the static price tables. Deterministic. Currency-aware.
 *
 *   estimateValue({ yieldEstimate, crop, countryCode }) → {
 *     lowValue, highValue, typicalValue,
 *     currency,                   // ISO-4217
 *     currencySymbol,             // best-effort glyph
 *     unit: 'kg',                 // the unit the price was multiplied against
 *     priceBand: { low, high, typical, currency, source },
 *     source: 'country:<ISO2>' | 'global_usd' | 'fallback',
 *     confidenceLevel: 'low' | 'medium' | 'high',
 *     assumptions: Array<{ tag, detail }>,
 *     formatted: { low, high, typical },   // display-ready strings
 *   } | null
 *
 * Returns null only when there is no yield to value (yieldEstimate is
 * missing / malformed). Always produces a value otherwise — even
 * unpriced countries fall through to USD (with confidence='low').
 */

import { getCropPrice, hasLocalisedPrice } from '../../config/cropPrices.js';
import { getCurrencyForCountry, formatCurrency } from '../../config/currenciesByCountry.js';
import { normalizeCrop } from '../../config/crops.js';

function round2(n) { return Math.round(n * 100) / 100; }

export function estimateValue({ yieldEstimate, crop, countryCode } = {}) {
  if (!yieldEstimate || typeof yieldEstimate !== 'object') return null;
  const lowKg     = Number(yieldEstimate.lowEstimateKg);
  const highKg    = Number(yieldEstimate.highEstimateKg);
  const typKg     = Number(yieldEstimate.typicalEstimateKg);
  if (!Number.isFinite(lowKg) || !Number.isFinite(highKg)) return null;

  const cropCode = normalizeCrop(crop) || yieldEstimate.crop || '';
  if (!cropCode) return null;

  const assumptions = [];
  const priceBand = getCropPrice(cropCode, countryCode);
  const localised = hasLocalisedPrice(cropCode, countryCode);

  assumptions.push({
    tag: `price_band:${priceBand.source}`,
    detail: localised
      ? `Using local price band ${priceBand.low}–${priceBand.high} ${priceBand.currency}/${priceBand.unit}.`
      : priceBand.source === 'global_usd'
        ? `No local price for this crop in ${countryCode || 'your country'} — using the global USD band.`
        : 'No catalogued price — using a conservative generic USD band.',
  });

  // Multiply matched bounds so the range is honest: low×low → high×high.
  const lowValue     = round2(lowKg  * priceBand.low);
  const highValue    = round2(highKg * priceBand.high);
  const typicalValue = round2((Number.isFinite(typKg) ? typKg : (lowKg + highKg) / 2) * priceBand.typical);

  // Confidence inherits from the yield estimate but gets capped:
  //   localised + crop-price entry → keep yield confidence
  //   global_usd fallback          → max 'medium'
  //   generic fallback             → 'low'
  let conf = yieldEstimate.confidenceLevel || 'medium';
  if (priceBand.source === 'global_usd' && conf === 'high') conf = 'medium';
  if (priceBand.source === 'fallback') conf = 'low';
  if (!localised && countryCode) {
    assumptions.push({
      tag: 'fx_caveat',
      detail: 'Value is approximate in USD; real farmgate price in local currency may differ.',
    });
  }

  // Currency symbol resolution — prefer the price band's currency
  // (it's what we multiplied in), but fall back to the country map.
  const countryMeta = getCurrencyForCountry(countryCode);
  const currencySymbol = priceBand.currency === countryMeta.currency
    ? countryMeta.symbol
    : (priceBand.currency === 'USD' ? '$' : priceBand.currency);

  return Object.freeze({
    lowValue,
    highValue,
    typicalValue,
    currency:       priceBand.currency,
    currencySymbol,
    unit:           priceBand.unit || 'kg',
    priceBand:      Object.freeze({
      low: priceBand.low, high: priceBand.high, typical: priceBand.typical,
      currency: priceBand.currency, source: priceBand.source,
    }),
    source:         priceBand.source,
    confidenceLevel: conf,
    assumptions:    Object.freeze(assumptions),
    formatted: Object.freeze({
      low:     formatCurrency(lowValue,     priceBand.currency),
      high:    formatCurrency(highValue,    priceBand.currency),
      typical: formatCurrency(typicalValue, priceBand.currency),
    }),
  });
}

export const _internal = Object.freeze({ round2 });
