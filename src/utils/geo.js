/**
 * geo.js — small geo helpers for the outbreak / weather layer.
 *
 *   distanceKm(a, b)    haversine distance in km
 *   midpoint(a, b)      arithmetic centroid (good enough at the
 *                       small radii we use; not great-circle)
 *   bbox(points, padDeg) bounding-box debug helper
 *
 * Strict-rule audit:
 *   * pure: no I/O, no globals
 *   * never throws on missing fields - returns +Infinity for
 *     invalid pairs so callers can compare safely
 *   * lightweight: zero dependencies, ~80 lines
 */

const R_KM = 6371;
const D2R  = Math.PI / 180;

function _isLatLng(p) {
  if (!p || typeof p !== 'object') return false;
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90)   return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

/**
 * distanceKm({ lat, lng }, { lat, lng })
 *
 * Returns the great-circle distance in km. Returns
 * Number.POSITIVE_INFINITY for invalid input so a caller doing
 * `if (distanceKm(a, b) < 30)` short-circuits cleanly.
 */
export function distanceKm(a, b) {
  if (!_isLatLng(a) || !_isLatLng(b)) return Number.POSITIVE_INFINITY;

  const lat1 = Number(a.lat);
  const lng1 = Number(a.lng);
  const lat2 = Number(b.lat);
  const lng2 = Number(b.lng);

  const dLat = (lat2 - lat1) * D2R;
  const dLng = (lng2 - lng1) * D2R;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const x = sinDLat * sinDLat
          + sinDLng * sinDLng * Math.cos(lat1 * D2R) * Math.cos(lat2 * D2R);

  return R_KM * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * midpoint(a, b)
 *
 * Arithmetic mean - fine at the radii we cluster (< ~50km).
 * Returns null when either input is invalid.
 */
export function midpoint(a, b) {
  if (!_isLatLng(a) || !_isLatLng(b)) return null;
  return {
    lat: (Number(a.lat) + Number(b.lat)) / 2,
    lng: (Number(a.lng) + Number(b.lng)) / 2,
  };
}

/**
 * centroid(points)
 *
 * Mean lat/lng across an array of {lat, lng} points. Skips
 * invalid entries. Returns null when no valid points.
 */
export function centroid(points) {
  if (!Array.isArray(points) || points.length === 0) return null;
  let lat = 0, lng = 0, n = 0;
  for (const p of points) {
    if (!_isLatLng(p)) continue;
    lat += Number(p.lat);
    lng += Number(p.lng);
    n += 1;
  }
  if (n === 0) return null;
  return { lat: lat / n, lng: lng / n };
}

/** Pretty print "lat,lng" with fixed precision; '' when invalid. */
export function formatLatLng(p, digits = 4) {
  if (!_isLatLng(p)) return '';
  return `${Number(p.lat).toFixed(digits)}, ${Number(p.lng).toFixed(digits)}`;
}

export const _internal = Object.freeze({ R_KM, D2R, _isLatLng });
