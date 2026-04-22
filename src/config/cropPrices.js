/**
 * cropPrices.js — per-kg farmgate price ranges used by the value
 * intelligence engine.
 *
 * Two layers:
 *   1. Country-specific prices already live in src/config/prices.js
 *      (GH, NG, IN, US, FR). The valueEngine prefers those when the
 *      farm's country has an entry — their currency is the one the
 *      farmer actually transacts in.
 *   2. GLOBAL_USD is a per-kg USD fallback range for every crop we
 *      know. It keeps the engine from going silent when a farmer
 *      signs up from a country we haven't priced yet; the UI can
 *      always show an approximate USD value with a clear "approximate"
 *      label.
 *
 * Prices are *conservative low/high ranges*, not point estimates — the
 * valueEngine multiplies yield lowEstimate × priceLow and yield
 * highEstimate × priceHigh, so a wider price band maps 1:1 to a wider
 * value band on the farmer's screen.
 *
 * Sources:
 *   - FAO, World Bank commodity monthly, USDA NASS,
 *     smallholder market surveys (2024–25)
 *   - ranges err low; we'd rather under-promise than anchor a farmer
 *     to a number they can't get at the local buyer's gate
 *
 * Shape:
 *   GLOBAL_USD[cropCode] = { low, high, typical, currency: 'USD',
 *                            unit: 'kg', updatedAt: 'YYYY-MM' }
 */

import { PRICES, COUNTRY_CURRENCY } from './prices.js';

// Per-kg price bands in USD. Conservative. Use only when the farm's
// country isn't in the localized PRICES table.
export const GLOBAL_USD = Object.freeze({
  // Staples + grains
  maize:        { low: 0.15, high: 0.40, typical: 0.25 },
  rice:         { low: 0.40, high: 0.90, typical: 0.60 },
  wheat:        { low: 0.20, high: 0.50, typical: 0.30 },
  sorghum:      { low: 0.15, high: 0.35, typical: 0.22 },
  millet:       { low: 0.25, high: 0.55, typical: 0.35 },
  // Roots + tubers
  cassava:      { low: 0.12, high: 0.35, typical: 0.20 },
  yam:          { low: 0.40, high: 1.00, typical: 0.60 },
  potato:       { low: 0.30, high: 0.90, typical: 0.55 },
  sweet_potato: { low: 0.35, high: 0.95, typical: 0.55 },
  // Legumes
  beans:        { low: 0.80, high: 2.00, typical: 1.20 },
  soybean:      { low: 0.35, high: 0.75, typical: 0.50 },
  groundnut:    { low: 0.80, high: 1.80, typical: 1.20 },
  cowpea:       { low: 0.70, high: 1.60, typical: 1.00 },
  chickpea:     { low: 0.80, high: 1.80, typical: 1.20 },
  lentil:       { low: 0.80, high: 1.80, typical: 1.20 },
  // Vegetables
  tomato:       { low: 0.50, high: 2.50, typical: 1.20 },
  onion:        { low: 0.40, high: 1.50, typical: 0.80 },
  pepper:       { low: 0.80, high: 3.00, typical: 1.50 },
  cabbage:      { low: 0.25, high: 0.90, typical: 0.50 },
  carrot:       { low: 0.40, high: 1.20, typical: 0.70 },
  okra:         { low: 0.80, high: 2.50, typical: 1.40 },
  cucumber:     { low: 0.40, high: 1.30, typical: 0.70 },
  watermelon:   { low: 0.20, high: 0.70, typical: 0.40 },
  // Tree + permanent crops
  banana:       { low: 0.25, high: 0.90, typical: 0.50 },
  plantain:     { low: 0.30, high: 1.00, typical: 0.55 },
  mango:        { low: 0.40, high: 1.50, typical: 0.80 },
  avocado:      { low: 0.80, high: 2.50, typical: 1.40 },
  coffee:       { low: 3.00, high: 7.00, typical: 4.50 }, // green beans
  tea:          { low: 2.00, high: 5.00, typical: 3.00 }, // made tea
  cocoa:        { low: 2.50, high: 6.50, typical: 4.00 }, // dry beans
  cotton:       { low: 1.50, high: 3.00, typical: 2.20 }, // lint
  sugarcane:    { low: 0.03, high: 0.08, typical: 0.05 },
  sunflower:    { low: 0.30, high: 0.70, typical: 0.45 },
  sesame:       { low: 1.00, high: 2.50, typical: 1.50 },
});

// Very last-resort band — used when a crop isn't priced anywhere.
// Covers the engine's promise to "never crash"; UI flags confidence
// as 'low' when it lands here.
const GENERIC_USD = Object.freeze({ low: 0.30, high: 1.20, typical: 0.60 });

/**
 * getCropPrice — resolve a per-kg price band for a (crop, country)
 * pair. Never returns null; the engine always has something to show.
 *
 *   { low, high, typical, currency, unit: 'kg', source, updatedAt? }
 *
 * Resolution order:
 *   1. country-specific entry in PRICES → wraps point price into a
 *      ±25% band so valueEngine still produces a range
 *   2. GLOBAL_USD[crop] → global USD fallback (source='global_usd')
 *   3. GENERIC_USD     → last-resort fallback (source='fallback')
 */
export function getCropPrice(cropCode, countryCode) {
  const key = String(cropCode || '').toLowerCase().trim();
  const iso2 = String(countryCode || '').trim().toUpperCase();

  // Layer 1 — localised country table (point price → symmetric band)
  const countryTable = iso2 ? PRICES[iso2] : null;
  if (countryTable && countryTable[key]) {
    const row = countryTable[key];
    const p = Number(row.price);
    if (Number.isFinite(p) && p > 0) {
      return Object.freeze({
        low:       round2(p * 0.75),
        high:      round2(p * 1.25),
        typical:   round2(p),
        currency:  row.currency,
        unit:      row.unit || 'kg',
        updatedAt: row.updatedAt || null,
        source:    `country:${iso2}`,
      });
    }
  }

  // Layer 2 — global USD band
  if (GLOBAL_USD[key]) {
    const g = GLOBAL_USD[key];
    return Object.freeze({
      low:       g.low,
      high:      g.high,
      typical:   g.typical,
      currency:  'USD',
      unit:      'kg',
      updatedAt: null,
      source:    'global_usd',
    });
  }

  // Layer 3 — generic USD fallback
  return Object.freeze({
    low:       GENERIC_USD.low,
    high:      GENERIC_USD.high,
    typical:   GENERIC_USD.typical,
    currency:  'USD',
    unit:      'kg',
    updatedAt: null,
    source:    'fallback',
  });
}

/**
 * hasLocalisedPrice — did the crop × country combo hit the localised
 * table (layer 1)? Used by the UI to decide whether to show a "~USD
 * approximate" caption.
 */
export function hasLocalisedPrice(cropCode, countryCode) {
  const key = String(cropCode || '').toLowerCase().trim();
  const iso2 = String(countryCode || '').trim().toUpperCase();
  return !!(iso2 && PRICES[iso2] && PRICES[iso2][key]);
}

function round2(n) { return Math.round(n * 100) / 100; }

export const _internal = Object.freeze({ GLOBAL_USD, GENERIC_USD, PRICES, COUNTRY_CURRENCY });
