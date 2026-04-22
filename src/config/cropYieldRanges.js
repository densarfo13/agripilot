/**
 * cropYieldRanges.js — conservative low/high yield ranges per crop
 * per square meter. Used by the yield intelligence engine as a
 * deterministic baseline; every range is intentionally wide so the
 * UI can say "between 2.0 and 3.5 tons" without implying false
 * precision the data doesn't support.
 *
 * Sources consulted for v1 defaults:
 *   - FAO STAT 2022 country averages (maize, rice, wheat, sorghum,
 *     cassava, banana, cocoa, potato, tomato, onion)
 *   - USDA NASS for US-specific overrides where they differ
 *     significantly from world average
 *
 * All values are in KILOGRAMS per SQUARE METER (kg/m²). Multiply
 * by normalizedAreaSqm to get kg per farm. Divide kg by 1000 to
 * show tons in the UI when the number gets unwieldy.
 *
 * Adding a new crop:
 *   1. add an entry here keyed by the canonical code from
 *      src/config/crops.js (lowercase, e.g. 'millet')
 *   2. if the crop is US-sensitive, add a key to COUNTRY_OVERRIDES
 *   3. a matching price in src/config/cropPrices.js is optional
 *      (value estimate degrades to null if missing)
 *
 * Crops without an entry fall back to a "safe generic" range so the
 * engine never crashes; confidenceLevel drops to 'low' in that case.
 */

// Canonical low/high kg per m² per season. Reviewed against FAO +
// common smallholder baselines; values err on the conservative side
// so the UI never over-promises.
const YIELD_KG_PER_SQM = Object.freeze({
  // Staples + grains
  maize:        { low: 0.15, high: 0.60, typical: 0.30 },  // ≈1.5–6 t/ha
  rice:         { low: 0.25, high: 0.70, typical: 0.45 },  // paddy rice
  wheat:        { low: 0.20, high: 0.65, typical: 0.35 },
  sorghum:      { low: 0.10, high: 0.40, typical: 0.20 },
  millet:       { low: 0.08, high: 0.30, typical: 0.15 },
  // Roots + tubers
  cassava:      { low: 0.60, high: 2.50, typical: 1.20 },  // fresh tubers
  yam:          { low: 0.50, high: 1.80, typical: 1.00 },
  potato:       { low: 1.00, high: 3.50, typical: 2.00 },
  sweet_potato: { low: 0.70, high: 2.50, typical: 1.30 },
  // Legumes
  beans:        { low: 0.08, high: 0.30, typical: 0.15 },
  soybean:      { low: 0.10, high: 0.35, typical: 0.20 },
  groundnut:    { low: 0.10, high: 0.35, typical: 0.18 },
  cowpea:       { low: 0.06, high: 0.25, typical: 0.12 },
  chickpea:     { low: 0.08, high: 0.25, typical: 0.14 },
  lentil:       { low: 0.06, high: 0.20, typical: 0.12 },
  // Vegetables (higher kg/m² because of intensive growing)
  tomato:       { low: 2.00, high: 6.00, typical: 3.50 },
  onion:        { low: 1.50, high: 4.00, typical: 2.50 },
  pepper:       { low: 0.80, high: 2.50, typical: 1.50 },
  cabbage:      { low: 2.00, high: 5.00, typical: 3.00 },
  carrot:       { low: 1.80, high: 4.50, typical: 2.80 },
  okra:         { low: 0.50, high: 1.50, typical: 0.90 },
  cucumber:     { low: 2.00, high: 5.00, typical: 3.00 },
  watermelon:   { low: 1.50, high: 4.00, typical: 2.50 },
  // Tree + permanent crops (per m² of planted area per year)
  banana:       { low: 1.50, high: 4.00, typical: 2.50 },
  plantain:     { low: 1.00, high: 3.00, typical: 2.00 },
  mango:        { low: 0.80, high: 2.00, typical: 1.20 },
  avocado:      { low: 0.60, high: 1.80, typical: 1.00 },
  coffee:       { low: 0.04, high: 0.15, typical: 0.08 },   // green beans
  tea:          { low: 0.10, high: 0.40, typical: 0.20 },   // made tea
  cocoa:        { low: 0.04, high: 0.15, typical: 0.07 },   // dry beans
  cotton:       { low: 0.15, high: 0.50, typical: 0.28 },   // lint
  sugarcane:    { low: 4.00, high: 12.00, typical: 7.00 },
  sunflower:    { low: 0.10, high: 0.35, typical: 0.18 },
  sesame:       { low: 0.05, high: 0.20, typical: 0.09 },
});

// US often sits higher than the global baseline for mechanised row
// crops. Only override when the gap is >30% to keep the table tidy.
const COUNTRY_OVERRIDES = Object.freeze({
  US: Object.freeze({
    maize:   { low: 0.60, high: 1.30, typical: 0.95 },   // ≈6–13 t/ha
    wheat:   { low: 0.30, high: 0.60, typical: 0.45 },
    soybean: { low: 0.25, high: 0.45, typical: 0.33 },
    sorghum: { low: 0.30, high: 0.60, typical: 0.40 },
    cotton:  { low: 0.08, high: 0.18, typical: 0.12 },   // lint, bale-adjusted
    sunflower: { low: 0.15, high: 0.30, typical: 0.21 },
  }),
});

// Safe generic range for any crop we don't have in the table yet —
// roughly what a leafy / small-plot backyard grower could produce.
// Used only as a last-resort fallback; the engine flags
// confidenceLevel 'low' when it hits this row.
const GENERIC_FALLBACK = Object.freeze({ low: 0.10, high: 1.00, typical: 0.30 });

/**
 * getYieldRange — the range the yield engine multiplies against
 * normalizedAreaSqm. Returns the country override when available,
 * otherwise the global baseline, otherwise the safe generic row.
 * Never returns null — the engine can always compute a range.
 */
export function getYieldRange(cropCode, countryCode) {
  const iso2 = String(countryCode || '').trim().toUpperCase();
  const country = iso2 ? COUNTRY_OVERRIDES[iso2] : null;
  const key = String(cropCode || '').toLowerCase();
  if (country && country[key]) return { ...country[key], source: iso2 };
  if (YIELD_KG_PER_SQM[key])   return { ...YIELD_KG_PER_SQM[key], source: 'global' };
  return { ...GENERIC_FALLBACK, source: 'fallback' };
}

export const _internal = Object.freeze({
  YIELD_KG_PER_SQM, COUNTRY_OVERRIDES, GENERIC_FALLBACK,
});
