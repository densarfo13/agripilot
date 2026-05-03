/**
 * unitUtils.js — single source of truth for size-unit math used by
 * the farm/garden data model. Spec: "Fix Farroway Data Model
 * Properly — Validation + Unit Normalization", §1.
 *
 *   import { normalizeSizeInput, convertToAcres, convertToSqFt }
 *     from '../core/unitUtils.js';
 *
 *   normalizeSizeInput(2.5, 'acres')
 *     → { ok: true, value: 2.5, unit: 'acres',
 *         sizeInAcres: 2.5, sizeInSqFt: 108900 }
 *
 *   normalizeSizeInput(4356000, 'sqft')
 *     → { ok: true, value: 4356000, unit: 'sqft',
 *         sizeInAcres: 100, sizeInSqFt: 4356000 }
 *
 *   normalizeSizeInput(0,   'acres') → { ok: false, error: 'NON_POSITIVE' }
 *   normalizeSizeInput(NaN, 'acres') → { ok: false, error: 'NAN' }
 *   normalizeSizeInput(2,   'foo')   → { ok: false, error: 'UNKNOWN_UNIT' }
 *
 * Why this lives in src/core
 * ──────────────────────────
 * The lower-level src/lib/units/areaConversion.js gives us SQM-based
 * primitives (toSquareMeters, fromSquareMeters, convertArea). That
 * module is intentionally generic. The data-model spec wants two
 * canonical fields on every saved row:
 *
 *   sizeInAcres  (number | null)   — always derived from input
 *   sizeInSqFt   (number | null)   — always derived from input
 *
 * `unitUtils.js` is the thin spec-shaped layer that returns BOTH
 * fields in a single call so callers don't have to remember which
 * primitive to invoke. It also pre-validates the input so the
 * downstream contextValidation layer doesn't have to repeat the
 * NaN / non-positive guards.
 *
 * Strict-rule audit
 *   • Pure functions. No I/O, no side effects.
 *   • Never throws. Every conversion guards against NaN / non-finite
 *     numbers and unknown units; failure cases return a tagged
 *     error object so callers can branch without a try/catch.
 *   • Idempotent. Two calls with the same input return identical
 *     output (fields, ordering, numeric value rounding).
 *   • Lowercase canonical units only. Uppercase storage codes
 *     ('ACRE', 'HECTARE', 'SQFT', 'SQM') normalise via the existing
 *     areaConversion.normalizeUnit helper.
 */

import {
  toSquareMeters, fromSquareMeters, normalizeUnit,
} from '../lib/units/areaConversion.js';

// Canonical conversion constants from the spec. We don't read these
// directly — toSquareMeters() in areaConversion.js owns the SQM
// factors — but they document the expectation so a reviewer can
// cross-check numeric correctness without leaving this file.
//
//   1 acre     = 43,560 sq ft        (exact)
//   1 hectare  = 2.47105 acres        (4-place rounded; 2.4710538147 is the
//                                     full IEEE round-trip via SQM)
//   1 sq meter = 10.7639 sq ft        (4-place rounded)
//
// The spec lists these as "Conversion" reference numbers; the actual
// math in toSquareMeters / fromSquareMeters uses the exact SQM-per-
// unit factors so a 100-acre round trip matches to <0.0001 acre.
export const SQFT_PER_ACRE = 43_560;
export const ACRES_PER_HECTARE = 2.47105;
export const SQFT_PER_SQM = 10.7639;

/**
 * Supported user-facing units. Lowercase canonical codes; the
 * storage layer normalises uppercase / aliases via normalizeUnit.
 */
export const SUPPORTED_UNITS = Object.freeze(['acres', 'hectares', 'sqft', 'sqm']);

/**
 * Round to 4 decimal places. Matches the rest of the area-conversion
 * surface — keeps the displayed number tidy without losing meaningful
 * precision for any realistic farm size (< 0.0001 acre drift even on
 * a 100-hectare round trip).
 */
function _round4(n) {
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10000) / 10000;
}

/**
 * convertToAcres(value, unit) — value in any supported unit → acres.
 *
 * Returns a finite Number rounded to 4 decimal places, OR null when
 * the input is invalid. Never throws.
 *
 *   convertToAcres(4356000, 'sqft') → 100
 *   convertToAcres(1,        'hectares') → 2.4711   (≈ ACRES_PER_HECTARE)
 *   convertToAcres(NaN,      'acres') → null
 *   convertToAcres(5,        'foo')   → null
 */
export function convertToAcres(value, unit) {
  const sqm = toSquareMeters(value, unit);
  if (sqm == null) return null;
  // 1 acre = 4046.8564224 m² (exact). Use fromSquareMeters('acres')
  // so we share a single source of truth for the constant.
  const acres = fromSquareMeters(sqm, 'acres');
  return _round4(acres);
}

/**
 * convertToSqFt(value, unit) — value in any supported unit → sq ft.
 *
 *   convertToSqFt(100, 'acres')    → 4356000
 *   convertToSqFt(1,   'sqm')      → 10.7639
 *   convertToSqFt('',  'acres')    → null
 */
export function convertToSqFt(value, unit) {
  const sqm = toSquareMeters(value, unit);
  if (sqm == null) return null;
  const sqft = fromSquareMeters(sqm, 'sqft');
  return _round4(sqft);
}

/**
 * normalizeSizeInput(value, unit) — produce the canonical size shape
 * stored on every garden / farm row.
 *
 * Output shape (success):
 *   {
 *     ok:          true,
 *     value:       number,        // user-supplied value coerced to Number
 *     unit:        string,        // lowercase canonical unit
 *     sizeInAcres: number,        // 4-decimal rounded
 *     sizeInSqFt:  number,        // 4-decimal rounded
 *   }
 *
 * Output shape (failure):
 *   {
 *     ok:    false,
 *     error: 'EMPTY' | 'NAN' | 'NON_POSITIVE' | 'UNKNOWN_UNIT',
 *   }
 *
 * Spec §1 explicitly bans running decision logic on raw mixed units —
 * callers that need to feed the engine should always go through this
 * helper so `sizeInAcres` and `sizeInSqFt` are pre-computed.
 *
 * The function NEVER returns "ok with NaN" or "ok with negative" —
 * those are filtered out as `error`. Saving / displaying a NaN is the
 * exact bug class §3 tells us to block.
 */
export function normalizeSizeInput(value, unit) {
  const u = normalizeUnit(unit);
  if (!u) {
    return { ok: false, error: 'UNKNOWN_UNIT' };
  }
  if (value === '' || value == null) {
    return { ok: false, error: 'EMPTY' };
  }
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    return { ok: false, error: 'NAN' };
  }
  if (n <= 0) {
    return { ok: false, error: 'NON_POSITIVE' };
  }
  const sizeInAcres = convertToAcres(n, u);
  const sizeInSqFt  = convertToSqFt(n,  u);
  // Defensive: convertToAcres / convertToSqFt should always succeed
  // when toSquareMeters did, but guard anyway so the output shape's
  // ok-true branch never carries a null.
  if (sizeInAcres == null || sizeInSqFt == null) {
    return { ok: false, error: 'UNKNOWN_UNIT' };
  }
  return {
    ok:          true,
    value:       n,
    unit:        u,
    sizeInAcres,
    sizeInSqFt,
  };
}

export default {
  SQFT_PER_ACRE,
  ACRES_PER_HECTARE,
  SQFT_PER_SQM,
  SUPPORTED_UNITS,
  convertToAcres,
  convertToSqFt,
  normalizeSizeInput,
};
