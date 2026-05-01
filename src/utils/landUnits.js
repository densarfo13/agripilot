/**
 * landUnits.js — spec-shape land-size helper.
 *
 * Thin façade over the canonical `src/lib/units/areaConversion.js`
 * module so call sites that follow the simpler spec §5 shape
 * (`sq_ft` / `sq_m` underscored) get a one-import API:
 *
 *   import {
 *     LAND_SIZE_UNITS, formatLandSize, convertToSquareFeet,
 *   } from '../utils/landUnits.js';
 *
 *   formatLandSize(500, 'sq_ft')        → '500 sq ft'
 *   convertToSquareFeet(1, 'acres')     → 43560
 *   convertToSquareFeet(0.5, 'hectares') → 53819.55  (≈ 0.5 × 107639)
 *
 * Why this exists alongside areaConversion.js
 *   The launch spec uses `sq_ft` / `sq_m` underscore codes; the
 *   canonical module uses `sqft` / `sqm` (no underscore). Both
 *   shapes already round-trip through `normalizeUnit()` — this
 *   façade makes the spec shape ergonomic for new code without
 *   touching the canonical module's lowercase API.
 *
 * Strict-rule audit
 *   * Pure functions; no I/O.
 *   * Never throws — invalid input returns null / 'Not set'.
 *   * Spec list is FROZEN so consumers can iterate safely.
 */

import {
  toSquareMeters as _toSqm,
  fromSquareMeters as _fromSqm,
  normalizeUnit as _normalize,
} from '../lib/units/areaConversion.js';

/**
 * LAND_SIZE_UNITS — the spec-shape ordered list. Use this as the
 * source of truth for any unit dropdown so the option set stays
 * aligned across Add Farm / Edit Farm / Garden Setup.
 */
export const LAND_SIZE_UNITS = Object.freeze([
  { label: 'Square feet',   value: 'sq_ft' },
  { label: 'Square meters', value: 'sq_m' },
  { label: 'Acres',         value: 'acres' },
  { label: 'Hectares',      value: 'hectares' },
]);

const _DISPLAY = Object.freeze({
  sq_ft:    'sq ft',
  sq_m:     'sq m',
  acres:    'acres',
  hectares: 'hectares',
});

// Conversion factors expressed in square FEET (so the helper
// matches the spec's `convertToSquareFeet` signature exactly).
const _SQFT_PER_UNIT = Object.freeze({
  sq_ft:    1,
  sq_m:     10.7639,
  acres:    43560,
  hectares: 107639,
});

/**
 * formatLandSize(size, unit) — small display formatter.
 *
 *   formatLandSize(500, 'sq_ft')        → '500 sq ft'
 *   formatLandSize(1, 'acres')          → '1 acres'
 *   formatLandSize(0, 'sq_m')           → 'Not set'   (treats 0 / null / undefined as missing)
 *   formatLandSize(undefined, anything) → 'Not set'
 *
 * Accepts both the spec shape (`sq_ft`/`sq_m`) and the canonical
 * shape (`sqft`/`sqm`) — the canonical normaliser collapses them.
 */
export function formatLandSize(size, unit) {
  if (size == null || size === '' || Number(size) === 0) return 'Not set';
  // Try the spec-shape display first; fall back to the canonical
  // normaliser when the caller passed `sqft` / `sqm`.
  let label = _DISPLAY[unit];
  if (!label) {
    const canon = _normalize(unit);
    if (canon === 'sqft')     label = 'sq ft';
    else if (canon === 'sqm') label = 'sq m';
    else if (canon)           label = canon;
    else                       label = unit ? String(unit) : '';
  }
  return `${size} ${label}`.trim();
}

/**
 * convertToSquareFeet(size, unit) → number | null
 *
 * Returns the value expressed in square feet, or null when
 * either input is invalid. Accepts both spec-shape (`sq_ft`)
 * and canonical (`sqft`) unit codes.
 */
export function convertToSquareFeet(size, unit) {
  const n = Number(size);
  if (!Number.isFinite(n)) return null;

  // Spec shape — fast path.
  if (Object.prototype.hasOwnProperty.call(_SQFT_PER_UNIT, unit)) {
    return n * _SQFT_PER_UNIT[unit];
  }

  // Canonical fallback via the m² round-trip — keeps drift below
  // four decimal places for the largest farms we ship to.
  const sqm = _toSqm(n, unit);
  if (sqm == null) return null;
  // 1 m² = 10.7639 ft². Use the same constant the spec lists.
  const ftFromSqm = _fromSqm(sqm, 'sqft');
  return ftFromSqm == null ? null : ftFromSqm;
}

export default {
  LAND_SIZE_UNITS,
  formatLandSize,
  convertToSquareFeet,
};
