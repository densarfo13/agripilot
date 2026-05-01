/**
 * areaConversion.js — canonical area-unit logic for Farroway.
 *
 * Spec canonical codes (lowercase, exactly one of):
 *   'sqft' | 'sqm' | 'acres' | 'hectares'
 *
 * Every farm row also carries a `normalizedAreaSqm` field (number,
 * square meters) so downstream features (yield-per-area, value-per-
 * area, NGO summaries, dashboard comparisons) never have to re-do
 * unit math.
 *
 * Two surfaces coexist intentionally:
 *   • storage layer (farrowayLocal.saveFarm) writes sizeUnit in the
 *     pre-existing UPPERCASE shape ('ACRE', 'HECTARE', 'SQFT',
 *     'SQM') alongside the new normalizedAreaSqm number. Existing
 *     readers keep working unchanged.
 *   • this module is the spec-canonical lowercase surface for new
 *     code + tests. normalizeUnit() collapses every known shape
 *     (upper / lower / plural / legacy label / alias) back to the
 *     lowercase canonical so both worlds interoperate.
 */

// ─── Canonical factors (all expressed in square meters) ──────────
const SQM_PER_UNIT = Object.freeze({
  sqft:     0.09290304,      // 1 ft² = 0.09290304 m²  (exact)
  sqm:      1,
  acres:    4046.8564224,    // 1 acre = 4046.8564224 m²  (exact)
  hectares: 10000,           // 1 ha = 10,000 m²          (exact)
});

export const AREA_UNITS          = Object.freeze(['sqft', 'sqm', 'acres', 'hectares']);
export const SMALL_AREA_UNITS_LC = Object.freeze(['sqft', 'sqm']);
export const LAND_AREA_UNITS_LC  = Object.freeze(['acres', 'hectares']);

// Accept every reasonable storage drift — the old codebase used
// uppercase singular forms, some modules carried lowercase plurals,
// a handful of records stored the localized label. This normaliser
// unifies all of them back to the spec-canonical lowercase code.
const ALIASES = Object.freeze({
  // acres
  acre: 'acres', acres: 'acres', ac: 'acres', ACRE: 'acres',
  // hectares
  hectare: 'hectares', hectares: 'hectares', ha: 'hectares', HECTARE: 'hectares',
  // square feet
  sqft: 'sqft', SQFT: 'sqft',
  'sq ft': 'sqft', 'sq_ft': 'sqft',
  'square foot': 'sqft', 'square feet': 'sqft',
  'ft2': 'sqft', 'ft^2': 'sqft',
  // square meters
  sqm: 'sqm', SQM: 'sqm',
  'sq m': 'sqm', 'sq_m': 'sqm',
  'square meter': 'sqm', 'square meters': 'sqm',
  'm2': 'sqm', 'm^2': 'sqm',
  // legacy localized storage drift
  ekari: 'acres', hekta: 'hectares',
});

/**
 * normalizeUnit — collapse any storage shape to the spec-canonical
 * lowercase code. Returns null when the input can't be mapped so
 * callers can decide whether to reject or fall back.
 */
export function normalizeUnit(unit) {
  if (unit == null) return null;
  const raw = String(unit).trim();
  if (!raw) return null;
  if (ALIASES[raw] != null) return ALIASES[raw];
  const lower = raw.toLowerCase();
  if (ALIASES[lower] != null) return ALIASES[lower];
  return null;
}

/**
 * toSquareMeters — numeric conversion into m². Returns null on any
 * invalid input (null / empty / non-numeric / unknown unit) so
 * callers can branch without a try/catch. Never throws.
 */
export function toSquareMeters(value, unit) {
  const key = normalizeUnit(unit);
  if (!key) return null;
  if (value === '' || value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n * SQM_PER_UNIT[key];
}

/**
 * fromSquareMeters — inverse of toSquareMeters. Accepts a value
 * already in m² and converts to the target unit. Preserves full
 * precision; call round() on the result if you want a tidy display.
 */
export function fromSquareMeters(valueSqm, unit) {
  const key = normalizeUnit(unit);
  if (!key) return null;
  if (valueSqm === '' || valueSqm == null) return null;
  const n = typeof valueSqm === 'number' ? valueSqm : Number(valueSqm);
  if (!Number.isFinite(n)) return null;
  return n / SQM_PER_UNIT[key];
}

/**
 * convertArea — cross-unit conversion. Works across tiers too
 * (e.g. sqft → acres) so the onboarding / edit flows can keep the
 * farmer's typed value when they flip farmType. 4-decimal rounding
 * keeps the UI tidy; toSquareMeters / fromSquareMeters preserve
 * full precision when a caller needs it.
 */
export function convertArea(value, fromUnit, toUnit) {
  const sqm = toSquareMeters(value, fromUnit);
  if (sqm == null) return null;
  const out = fromSquareMeters(sqm, toUnit);
  if (out == null) return null;
  // 4 decimal places is enough for every meaningful farm size — a
  // 100-hectare farm rounds to ≤0.0001 ha of drift over a round trip.
  return Math.round(out * 10000) / 10000;
}

/**
 * getDefaultUnit — smart default per spec §2.
 *
 *   backyard:
 *     US → 'sqft'
 *     any other country → 'sqm'
 *
 *   small_farm | commercial:
 *     US → 'acres'
 *     any other country → 'hectares'
 *
 * Unknown / missing farmType falls back to the land-area tier so
 * existing non-backyard farms keep working unchanged. Unknown
 * country defaults to the metric side.
 */
export function getDefaultUnit({ farmType, countryCode } = {}) {
  const ft = normalizeFarmType(farmType);
  const iso2 = String(countryCode || '').trim().toUpperCase();
  if (ft === 'backyard') {
    return iso2 === 'US' ? 'sqft' : 'sqm';
  }
  return iso2 === 'US' ? 'acres' : 'hectares';
}

/**
 * getAllowedUnits — canonical lowercase list of units the UI
 * should offer for this farmType + country combo. Order matters:
 * the first entry is the preferred default. Same rules as
 * getDefaultUnit, expanded to both units per tier.
 *
 * Spec §4 (square foot land size option):
 *   * US backyard:  sqft, sqm                  (existing)
 *   * US farm:      acres, sqft, hectares      (NEW: sqft added)
 *   * Ghana farm:   hectares, acres, sqm, sqft (NEW: sqft optional)
 *   * Other farm:   hectares, acres            (existing)
 */
export function getAllowedUnits({ farmType, countryCode } = {}) {
  const def = getDefaultUnit({ farmType, countryCode });
  const ft  = normalizeFarmType(farmType);
  const iso = String(countryCode || '').trim().toUpperCase();

  if (ft === 'backyard') {
    return def === 'sqft' ? ['sqft', 'sqm'] : ['sqm', 'sqft'];
  }
  // Farm / commercial tier
  if (iso === 'US') {
    // Default acres but farmers occasionally enter raised-bed
    // plots in sq ft — offer sqft as the second option.
    return ['acres', 'sqft', 'hectares'];
  }
  if (iso === 'GH') {
    // Ghana farms work in acres + hectares historically. Keep
    // both as primaries; expose sqm + sqft as opt-in tail.
    return ['acres', 'hectares', 'sqm', 'sqft'];
  }
  return def === 'acres' ? ['acres', 'hectares'] : ['hectares', 'acres'];
}

/**
 * getAreaUnitLabel — localized display label for a unit. Falls
 * back to an English word pair when the language is missing so
 * the UI never renders the raw code.
 *
 * Delegates to the existing getUnitLabel helper in
 * config/onboardingLabels.js — which already carries the full
 * 6-language table + normalizer — via a tiny shape-adapter so
 * both uppercase and lowercase codes work.
 */
const DISPLAY_FALLBACKS = Object.freeze({
  sqft: 'Square feet', sqm: 'Square meters',
  acres: 'Acres',      hectares: 'Hectares',
});
export function getAreaUnitLabel(unitKey, language) {
  const key = normalizeUnit(unitKey);
  if (!key) return '';
  // Lazy require to avoid a circular import at module load.
  try {
    // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports
    const { getUnitLabel } = require('../../config/onboardingLabels.js');
    // Existing helper uses UPPERCASE canonical; map our lowercase
    // back to its shape for the lookup.
    const upper = ({ sqft: 'SQFT', sqm: 'SQM', acres: 'ACRE', hectares: 'HECTARE' })[key];
    const label = getUnitLabel(upper, language);
    if (label) return label;
  } catch { /* fall through */ }
  return DISPLAY_FALLBACKS[key];
}

// ─── Small helpers ───────────────────────────────────────────────
function normalizeFarmType(value) {
  if (value == null) return 'small_farm';
  const s = String(value).toLowerCase().trim().replace(/[-\s]+/g, '_');
  if (s === 'backyard' || s === 'home' || s === 'home_food' || s === 'backyard_home') return 'backyard';
  if (s === 'small' || s === 'small_farm' || s === 'sell_locally') return 'small_farm';
  if (s === 'commercial' || s === 'commercial_farm' || s === 'large' || s === 'enterprise') return 'commercial';
  return 'small_farm';
}

export const _internal = Object.freeze({
  SQM_PER_UNIT, ALIASES, normalizeFarmType,
});
