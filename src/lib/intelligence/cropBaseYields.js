/**
 * cropBaseYields.js — per-hectare yield reference table for the
 * NGO decision-layer's quick yield estimate.
 *
 * Numbers in **kilograms per hectare**, drawn from typical
 * smallholder ranges across Sub-Saharan Africa + South Asia. They
 * are intentionally conservative midpoints so the estimate looks
 * reasonable rather than aspirational. Operators can refine the
 * table later without touching call sites — every consumer goes
 * through `getBaseYieldKgPerHa(crop)`.
 *
 * NOT an authoritative agronomic source. The estimator is a
 * sanity-check tool for dashboards, not a forecasting engine.
 *
 * IMPORTANT: this file does NOT alias crops. We deliberately do
 * NOT touch `src/config/crops/cropAliases.js` — strict rule. The
 * lookup uses a lightweight lowercase normalisation only.
 */

const TABLE = Object.freeze({
  // staples
  maize:        2200,
  corn:         2200,
  rice:         3500,
  wheat:        2800,
  sorghum:      1400,
  millet:       1100,
  // roots & tubers
  cassava:     12000,
  yam:         11000,
  potato:      14000,
  sweet_potato: 9000,
  sweetpotato:  9000,
  // legumes
  soybean:      1800,
  bean:         1200,
  beans:        1200,
  groundnut:    1300,
  peanut:       1300,
  cowpea:       1000,
  // cash / industrial
  cotton:       1100,
  sugarcane:   55000,
  coffee:        900,
  cocoa:         600,
  tea:          1400,
  // fruits
  banana:      18000,
  plantain:    11000,
  mango:        9000,
  orange:      14000,
  avocado:      8000,
  // vegetables
  tomato:      18000,
  onion:       16000,
  pepper:       9000,
  cabbage:     22000,
  carrot:      18000,
  okra:         8000,
  // other
  sunflower:    1200,
});

const DEFAULT_BASE_KG_PER_HA = 2000;

function _normCrop(crop) {
  if (!crop) return '';
  return String(crop).trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Look up a base yield (kg/ha) for a crop. Returns the conservative
 * default (`DEFAULT_BASE_KG_PER_HA`) when the crop is unknown so
 * the estimator never silently produces zero.
 */
export function getBaseYieldKgPerHa(crop) {
  const key = _normCrop(crop);
  if (TABLE[key] != null) return TABLE[key];
  return DEFAULT_BASE_KG_PER_HA;
}

export { DEFAULT_BASE_KG_PER_HA, TABLE as _TABLE };
