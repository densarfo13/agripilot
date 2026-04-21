/**
 * priceEngine.js — safe-lookup helpers for the static price table
 * in src/config/prices.js.
 *
 *   getReferencePrice({ country, crop }) → {
 *     price, unit, currency, updatedAt,
 *     source: 'country_crop' | 'country_default' | 'missing',
 *   } | null
 *
 *   getExpectedValue({ country, crop, estimatedYield, unit? }) → {
 *     value,                // numeric
 *     currency,
 *     unit,                 // unit the value is computed for
 *     reference,            // per-unit reference snapshot
 *     source,
 *   } | null
 *
 * Pure. Missing data → `null` so callers must branch explicitly.
 * Never throws.
 */

import { PRICES, COUNTRY_CURRENCY } from '../../config/prices.js';

function normalizeCountry(code) {
  return code ? String(code).trim().toUpperCase() : '';
}
function normalizeCrop(code) {
  return code ? String(code).trim().toLowerCase() : '';
}

/**
 * getReferencePrice — look up the per-unit price for a
 * (country, crop) pair. Falls through to the country's currency +
 * unit default when the crop isn't in the static table so callers
 * can still render a "—" cell with the right currency symbol.
 */
export function getReferencePrice({ country, crop } = {}) {
  const c = normalizeCountry(country);
  const k = normalizeCrop(crop);
  if (!c) return null;

  const countryTable = PRICES[c];
  if (!countryTable) return null;

  const row = countryTable[k];
  if (row) {
    return Object.freeze({
      price:     Number(row.price),
      unit:      row.unit,
      currency:  row.currency,
      updatedAt: row.updatedAt || null,
      source:    'country_crop',
    });
  }
  const fallback = COUNTRY_CURRENCY[c];
  if (!fallback) return null;
  return Object.freeze({
    price:     null,
    unit:      fallback.unit,
    currency:  fallback.currency,
    updatedAt: null,
    source:    'country_default',
  });
}

/**
 * getExpectedValue — compute `estimatedYield × referencePrice` with
 * unit + currency metadata. Safe-divides + clamps non-finite inputs
 * to 0 so the UI never renders NaN.
 *
 *   country:        ISO-2 code
 *   crop:           storage code ('maize', 'cassava', …)
 *   estimatedYield: number
 *   unit:           'kg' | 't' — the unit `estimatedYield` is in;
 *                   converted to the price's unit before multiplying.
 */
export function getExpectedValue({
  country, crop, estimatedYield, unit = 'kg',
} = {}) {
  const ref = getReferencePrice({ country, crop });
  if (!ref || ref.price == null) return null;
  const y = Number(estimatedYield);
  if (!Number.isFinite(y) || y < 0) {
    return Object.freeze({
      value: 0,
      currency: ref.currency,
      unit: ref.unit,
      reference: ref,
      source: ref.source,
    });
  }

  // Unit conversion — the config stores per-kg by default. When the
  // caller reports tonnes, scale into kilograms before multiplying.
  let yieldInRefUnit = y;
  const callerUnit = String(unit || '').toLowerCase();
  const refUnit    = String(ref.unit || '').toLowerCase();
  if (callerUnit === 't' && refUnit === 'kg') yieldInRefUnit = y * 1000;
  else if (callerUnit === 'kg' && refUnit === 't') yieldInRefUnit = y / 1000;
  // For any unsupported unit combination, pass through unchanged and
  // rely on the caller to use matching units.

  const raw = yieldInRefUnit * ref.price;
  // Round to 2 decimals for currency-friendly display.
  const value = Math.round(raw * 100) / 100;
  return Object.freeze({
    value,
    currency:  ref.currency,
    unit:      ref.unit,
    reference: ref,
    source:    ref.source,
  });
}

/**
 * listPricesForCountry — returns the full crop → price table for a
 * country (for the printable report's "Reference prices" block).
 * Frozen, alphabetical by crop.
 */
export function listPricesForCountry(country) {
  const c = normalizeCountry(country);
  if (!c) return [];
  const table = PRICES[c];
  if (!table) return [];
  const keys = Object.keys(table).sort();
  return keys.map((k) => Object.freeze({
    crop: k,
    ...table[k],
  }));
}

export const _internal = Object.freeze({
  normalizeCountry, normalizeCrop,
});
