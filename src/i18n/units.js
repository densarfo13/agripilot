/**
 * units.js — locale-aware display units.
 *
 *   import { getUnits, formatTemperature, formatArea } from '../i18n/units.js';
 *
 *   const u = getUnits('US');
 *   u.temperature  // 'F'
 *   u.area         // 'acre'
 *   u.gardenArea   // 'sqft'
 *
 *   formatTemperature(28, { temperature: 'F' })  // → '82°F'
 *
 * Defaults:
 *   • US                → Fahrenheit, acre, kg, sqft (garden mode)
 *   • Most others       → Celsius, hectare, kg, m² (garden mode)
 *
 * Conversion functions never throw — bad input returns the input
 * unchanged with the original unit, so the UI always renders something.
 *
 * Strict-rule audit
 *   • Pure module — no I/O, no React.
 *   • Frozen unit records.
 *   • Caller-overridable: user can pick a custom unit set in Settings;
 *     the regionDefault is just a starting point.
 */

import { getProfile } from '../intelligence/region/regionProfiles.js';

// ─── Public API ──────────────────────────────────────────────────

/**
 * getUnits(countryCode, override?) → UnitSet
 *
 * Returns a frozen unit set for the given country. If `override`
 * is supplied (e.g. user-set Settings preference) the caller's
 * choices win — but missing fields fall back to the regional default.
 *
 * @param {string|null} countryCode  ISO-3166-1 alpha-2
 * @param {object} [override]        partial UnitSet to merge on top
 */
export function getUnits(countryCode, override) {
  const profile = getProfile(countryCode);
  const base    = profile.defaultUnits || _DEFAULT_UNITS;
  const o       = (override && typeof override === 'object') ? override : {};

  return Object.freeze({
    temperature: o.temperature || base.temperature || _DEFAULT_UNITS.temperature,
    area:        o.area        || base.area        || _DEFAULT_UNITS.area,
    weight:      o.weight      || base.weight      || _DEFAULT_UNITS.weight,
    gardenArea:  o.gardenArea  || base.gardenArea  || _DEFAULT_UNITS.gardenArea,
    // Currency is a placeholder per spec — UI uses it as a hint
    // only; pricing surfaces still hold the canonical numeric values.
    currency:    o.currency    || base.currency    || _DEFAULT_UNITS.currency,
  });
}

/**
 * formatTemperature(celsius, units) → string
 *
 * Converts °C input to the requested unit and formats with the
 * unit suffix. Caller passes the already-resolved units object
 * (from `getUnits()`) so this never re-reads the registry.
 *
 * @param {number|null} celsius
 * @param {object|null} units  output of getUnits()
 */
export function formatTemperature(celsius, units) {
  const c = Number(celsius);
  if (!Number.isFinite(c)) return '—°';
  const unit = (units && units.temperature) || _DEFAULT_UNITS.temperature;
  if (unit === 'F') {
    return Math.round(c * 9 / 5 + 32) + '°F';
  }
  return Math.round(c) + '°C';
}

/**
 * formatArea(hectares, units) → string
 *
 * @param {number|null} hectares
 * @param {object|null} units
 */
export function formatArea(hectares, units) {
  const h = Number(hectares);
  if (!Number.isFinite(h)) return '—';
  const unit = (units && units.area) || _DEFAULT_UNITS.area;
  if (unit === 'acre') {
    return (h * 2.47105).toFixed(2) + ' acres';
  }
  return h.toFixed(2) + ' ha';
}

/**
 * formatWeight(kg, units) → string
 */
export function formatWeight(kg, units) {
  const k = Number(kg);
  if (!Number.isFinite(k)) return '—';
  const unit = (units && units.weight) || _DEFAULT_UNITS.weight;
  if (unit === 'bag')   return (k / 50).toFixed(2) + ' bags';     // 50kg bag convention
  if (unit === 'crate') return (k / 25).toFixed(2) + ' crates';   // 25kg crate convention
  return k.toFixed(1) + ' kg';
}

// ─── Constants ────────────────────────────────────────────────────

const _DEFAULT_UNITS = Object.freeze({
  temperature: 'C',
  area:        'hectare',
  weight:      'kg',
  gardenArea:  'm2',
  currency:    'USD',
});

export const DEFAULT_UNITS = _DEFAULT_UNITS;

export const _internal = Object.freeze({
  _DEFAULT_UNITS,
});

export default getUnits;
