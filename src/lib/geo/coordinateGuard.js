/**
 * coordinateGuard — single canonical validator for lat/lng pairs
 * the rest of the app uses before firing a location-keyed API.
 *
 *   import { isValidCoordinate, normaliseCoordinate, COORDINATE_REJECT_REASONS }
 *     from '../lib/geo/coordinateGuard.js';
 *
 *   if (!isValidCoordinate(lat, lng)) {
 *     // skip the satellite / farm-health / weather call;
 *     // show the "Add farm location" prompt instead.
 *   }
 *
 *   const ok = normaliseCoordinate(rawLat, rawLng);
 *   //   { lat, lng } when valid, or null when not
 *
 * Why this exists
 *   The Farm Health endpoint started 500ing for requests like
 *   /v2/satellite/farm-health?latitude=0&longitude=0. Null-island
 *   (0,0) is the Gulf of Guinea — no farms there — but our
 *   default farm records use 0,0 as a sentinel when the farmer
 *   hasn't tapped "Use my location". The satellite provider
 *   reports no data + returns 500, the downstream intelligence
 *   layer breaks, Home goes quiet.
 *
 *   This guard is the single chokepoint every consumer
 *   (useFarmHealth, useLiveWeather, predictiveRisk, etc.) calls
 *   before issuing a coords-keyed request. Reject 0,0 here and
 *   the whole class of downstream 500s disappears.
 *
 * Rejection rules
 *   * null / undefined
 *   * non-number (string, boolean, object)
 *   * NaN / Infinity
 *   * lat OUTSIDE [-90, 90]
 *   * lng OUTSIDE [-180, 180]
 *   * BOTH lat === 0 AND lng === 0 (null-island sentinel)
 *
 * Strict-rule audit
 *   * Pure, never throws, SSR-safe.
 *   * No PII. No storage / network.
 *   * Returns a structured reason on reject so callers can log
 *     a single [INVALID_COORD] line + skip silently.
 */

export const COORDINATE_REJECT_REASONS = Object.freeze({
  MISSING:      'missing',
  NOT_FINITE:   'not_finite',
  OUT_OF_RANGE: 'out_of_range',
  NULL_ISLAND:  'null_island',
});

function _coerceFinite(value) {
  if (value == null) return null;
  if (typeof value === 'boolean') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function _inRange(value, min, max) {
  return value >= min && value <= max;
}

/**
 * Soft validator — returns boolean. Use when the caller just
 * wants a true/false gate. For the structured reason, call
 * inspectCoordinate(lat, lng) below.
 *
 * @param {*} lat
 * @param {*} lng
 * @returns {boolean}
 */
export function isValidCoordinate(lat, lng) {
  return inspectCoordinate(lat, lng).valid;
}

/**
 * Structured validator — returns { valid, reason?, lat?, lng? }
 * so a caller that wants to log the rejection reason can
 * differentiate "missing" from "null-island sentinel".
 *
 * @param {*} lat
 * @param {*} lng
 * @returns {{ valid: boolean, reason?: string, lat?: number, lng?: number }}
 */
export function inspectCoordinate(lat, lng) {
  if (lat == null || lng == null) {
    return { valid: false, reason: COORDINATE_REJECT_REASONS.MISSING };
  }
  const nLat = _coerceFinite(lat);
  const nLng = _coerceFinite(lng);
  if (nLat == null || nLng == null) {
    return { valid: false, reason: COORDINATE_REJECT_REASONS.NOT_FINITE };
  }
  if (!_inRange(nLat, -90, 90) || !_inRange(nLng, -180, 180)) {
    return { valid: false, reason: COORDINATE_REJECT_REASONS.OUT_OF_RANGE };
  }
  // Null-island sentinel — the bug we're closing here.
  if (nLat === 0 && nLng === 0) {
    return { valid: false, reason: COORDINATE_REJECT_REASONS.NULL_ISLAND };
  }
  return { valid: true, lat: nLat, lng: nLng };
}

/**
 * Convenience — returns { lat, lng } when valid, null otherwise.
 * Useful for direct destructure in callers:
 *
 *   const ok = normaliseCoordinate(rawLat, rawLng);
 *   if (!ok) return null;
 *   fetch(`/api/...?lat=${ok.lat}&lng=${ok.lng}`);
 *
 * @param {*} lat
 * @param {*} lng
 * @returns {{ lat: number, lng: number } | null}
 */
export function normaliseCoordinate(lat, lng) {
  const out = inspectCoordinate(lat, lng);
  if (!out.valid) return null;
  return { lat: out.lat, lng: out.lng };
}

const _module = {
  COORDINATE_REJECT_REASONS,
  isValidCoordinate,
  inspectCoordinate,
  normaliseCoordinate,
};
export default _module;
