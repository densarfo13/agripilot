/**
 * coordsPrivacy.js — coarse coordinate rounding applied at every
 * persistence boundary.
 *
 * Default precision: 3 decimal places (~110 m at the equator,
 * shrinking near the poles). That's enough for per-country crop
 * guidance and weather lookups while hiding the farmer's exact
 * house / plot / barn position.
 *
 * The raw precise coordinates may still be used in-memory during
 * the detection + reverse-geocode step — nothing here blocks that.
 * This module is purely about what touches localStorage / the
 * backend.
 */

export const DEFAULT_COORD_PRECISION = 3;

/**
 * roundCoord — rounds one latitude or longitude value.
 * Returns null when the input isn't a finite number so callers can
 * treat "no coord" and "bad coord" the same way.
 */
export function roundCoord(value, decimals = DEFAULT_COORD_PRECISION) {
  // Guard against JS coercion surprises: Number(null) === 0,
  // Number('') === 0, which would otherwise treat an explicitly-
  // absent coord as the equator. Require an actual number or a
  // non-empty numeric string.
  if (value == null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const d = Number.isFinite(Number(decimals)) ? Math.max(0, Math.floor(decimals)) : DEFAULT_COORD_PRECISION;
  const mult = 10 ** d;
  return Math.round(n * mult) / mult;
}

/**
 * roundCoords — pair-round `{ latitude, longitude }`.
 * Returns { latitude, longitude } with null values when inputs are
 * missing / non-finite; never throws.
 */
export function roundCoords({ latitude, longitude } = {}, decimals = DEFAULT_COORD_PRECISION) {
  return {
    latitude:  roundCoord(latitude,  decimals),
    longitude: roundCoord(longitude, decimals),
  };
}

export const _internal = Object.freeze({ DEFAULT_COORD_PRECISION });
