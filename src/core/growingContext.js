/**
 * growingContext.js — single source of truth for "what does the
 * daily-plan engine know about this user RIGHT NOW?"
 *
 *   import { buildGrowingContext } from '../core/growingContext.js';
 *
 *   const ctx = buildGrowingContext({ farm, weather });
 *   // → {
 *   //     type:         'garden' | 'farm',
 *   //     cropOrPlant:  string|null,
 *   //     setup:        'container'|'raised_bed'|'ground'|'indoor_balcony'|'unknown',
 *   //     size:         'small'|'medium'|'large'|'unknown',
 *   //     location:     { country, region, city }|null,
 *   //     plantedAt:    string|null,
 *   //     weather:      object|null,
 *   //   }
 *
 * Why this exists
 * ───────────────
 * The daily-plan engine spec (Final Daily Plan Engine Upgrade §1)
 * mandates a normalised context object so:
 *   • every consumer (Today's Plan, scan engine, voice summary)
 *     reads the SAME shape, no matter where the underlying farm
 *     row was loaded from (legacy partition, post-migration
 *     gardens/farms arrays, FastFlow draft);
 *   • missing fields collapse to safe defaults instead of
 *     undefined — the engine never has to null-check; and
 *   • garden vs farm vocabulary lives in ONE place. Garden uses
 *     `setup`; farm uses `size` (small / medium / large). The
 *     other field is always 'unknown' so callers can branch on
 *     `type` without reading the wrong vocabulary.
 *
 * Strict-rule audit
 *   • Pure function. No I/O, no localStorage reads — caller
 *     passes the row they already loaded.
 *   • Never throws. Every read is wrapped + falls through to
 *     safe defaults.
 *   • Idempotent. Two consecutive calls with the same input
 *     return identical structural data.
 *   • Coexists with `core/contextResolver.resolveUserContext`
 *     (which reads localStorage to find the active row).
 *     contextResolver is the LOOKUP layer; growingContext is
 *     the NORMALISER layer that the engines consume.
 */

// Canonical garden-setup taxonomy. Mirrors the QuickGardenSetup
// pickers + the farrowayIntelligenceEngine fallthrough.
const ALLOWED_SETUPS = new Set([
  'container', 'raised_bed', 'ground', 'indoor_balcony', 'unknown',
]);
// Legacy aliases that pre-merge-spec saves still carry. We
// migrate them silently so an older garden record doesn't lose
// its personalisation when the engine reads it.
const SETUP_ALIAS = Object.freeze({
  bed:    'raised_bed',
  indoor: 'indoor_balcony',
});

// Canonical farm-size buckets. Maps from a numeric sqft figure
// (the canonical land-size field landSizeSqFt) into a 4-bucket
// label the engine uses to switch between "small farm" and
// "medium / large farm" task lists.
//
// Thresholds (in square feet, rounded so the math is obvious):
//   <  43 560 sqft   ≈ < 1  acre   → small
//   <  217 800 sqft  ≈ < 5  acres  → medium
//   ≥  217 800 sqft  ≈ ≥ 5 acres   → large
//
// Spec rule: garden flow MUST NEVER receive a 'small/medium/
// large' value here — gardens use `setup`, not size buckets.
const SQFT_PER_ACRE = 43_560;
function _bucketFromSqFt(sqft) {
  if (!Number.isFinite(sqft) || sqft <= 0) return 'unknown';
  if (sqft < 1   * SQFT_PER_ACRE) return 'small';
  if (sqft < 5   * SQFT_PER_ACRE) return 'medium';
  return 'large';
}

// Pull the canonical `crop` / `plant` name. Garden rows persist
// `crop` (lowercased) + optional `cropLabel` (display); farm
// rows do the same. The engine only reads the lowercased value
// for switch-style branching, so we surface that as primary.
function _pickCropOrPlant(row) {
  const r = (row && typeof row === 'object') ? row : {};
  return r.crop
      || r.cropId
      || r.plantName
      || r.plant
      || r.cropLabel
      || null;
}

function _pickLocation(row) {
  const r = (row && typeof row === 'object') ? row : {};
  const country = r.country     || r.countryCode  || r.countryLabel || null;
  const region  = r.region      || r.state        || r.stateLabel   || null;
  const city    = r.city        || r.cityLabel    || null;
  if (!country && !region && !city) return null;
  return {
    country: country || null,
    region:  region  || null,
    city:    city    || null,
  };
}

function _pickType(row, explicitType) {
  if (explicitType === 'garden' || explicitType === 'farm') return explicitType;
  const r = (row && typeof row === 'object') ? row : {};
  // farmType is the canonical partition key. 'backyard' is the
  // legacy garden value; the post-migration store mints the same
  // row with farmType: 'small_farm' for farms.
  if (r.farmType === 'backyard') return 'garden';
  if (r.farmType) return 'farm';
  // Fallthrough: the row didn't tell us; default to 'farm' which
  // is the safer engine path (farms get a generic crop-leaf task
  // while gardens get a setup-specific task that needs `setup`).
  return 'farm';
}

function _pickSetup(row) {
  const r = (row && typeof row === 'object') ? row : {};
  const raw = String(r.growingSetup || '').toLowerCase();
  const aliased = SETUP_ALIAS[raw] || raw;
  if (ALLOWED_SETUPS.has(aliased)) return aliased;
  return 'unknown';
}

function _pickSize(row) {
  const r = (row && typeof row === 'object') ? row : {};
  // Prefer the explicit bucket the user picked during onboarding
  // (when present). FARM_SIZE_BUCKETS values are 'lt1' / '1to5'
  // / 'gt5' / 'unknown' — we collapse the first three into the
  // engine's small / medium / large vocabulary.
  const bucket = String(r.sizeBucket || r.farmSizeBucket || '').toLowerCase();
  if (bucket === 'lt1')     return 'small';
  if (bucket === '1to5')    return 'medium';
  if (bucket === 'gt5')     return 'large';
  if (bucket === 'unknown') return 'unknown';
  // Fallthrough: derive from the canonical sqft field. Both farm
  // saves (QuickFarmSetup + AdaptiveFarmSetup) write
  // `landSizeSqFt`; the legacy partition uses `farmSize`.
  const sqftRaw = Number(r.landSizeSqFt ?? r.farmSize);
  return _bucketFromSqFt(sqftRaw);
}

function _pickPlantedAt(row, explicit) {
  if (typeof explicit === 'string' && explicit) return explicit;
  if (explicit instanceof Date && !Number.isNaN(explicit.getTime())) {
    return explicit.toISOString();
  }
  const r = (row && typeof row === 'object') ? row : {};
  return r.plantingDate
      || r.plantedAt
      || r.plantingDateIso
      || null;
}

function _pickWeather(weather) {
  if (!weather || typeof weather !== 'object') return null;
  // Engine reads either short or long field names. We pass the
  // weather object through verbatim — the engine's reader
  // tolerates either shape — but we still gate on it being a
  // non-empty object so a stray empty {} doesn't claim to be
  // "real weather data".
  const keys = Object.keys(weather);
  if (keys.length === 0) return null;
  return weather;
}

/**
 * buildGrowingContext({ farm, weather, type, plantedAt }) → context
 *
 * @param {object}  input
 * @param {object}  [input.farm]      — active farm/garden row
 * @param {object}  [input.weather]   — cached weather object
 * @param {string}  [input.type]      — explicit override ('garden'|'farm')
 * @param {*}       [input.plantedAt] — explicit override (string|Date)
 * @returns {{
 *   type:        'garden'|'farm',
 *   cropOrPlant: string|null,
 *   setup:       string,
 *   size:        string,
 *   location:    {country:string|null, region:string|null, city:string|null}|null,
 *   plantedAt:   string|null,
 *   weather:     object|null,
 * }}
 *
 * Spec rule (§1): never returns undefined. Every key is a
 * usable value (string, null, or the location object). The
 * `setup` and `size` strings always belong to their canonical
 * taxonomies even when the source row is missing the field.
 */
export function buildGrowingContext(input = {}) {
  const farm     = (input && typeof input.farm    === 'object') ? input.farm    : null;
  const weather  = (input && typeof input.weather === 'object') ? input.weather : null;
  const type     = _pickType(farm, input?.type);

  // Garden vocabulary lives on `setup`; farm vocabulary lives on
  // `size`. The OTHER field stays at 'unknown' so callers can
  // safely branch on `type` without reading the wrong taxonomy.
  const setup = (type === 'garden') ? _pickSetup(farm) : 'unknown';
  const size  = (type === 'farm')   ? _pickSize(farm)  : 'unknown';

  return {
    type,
    cropOrPlant: _pickCropOrPlant(farm),
    setup,
    size,
    location:    _pickLocation(farm),
    plantedAt:   _pickPlantedAt(farm, input?.plantedAt),
    weather:     _pickWeather(weather),
  };
}

export default buildGrowingContext;
