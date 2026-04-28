/**
 * geoUtils.js — pure geo helpers shared between the farmer
 * outbreak alerts and the NGO map / dashboard.
 *
 *   distanceKm(a, b)          — haversine kilometre distance
 *   getRegionKey(location)    — stable string key for region
 *                                grouping; works without GPS
 *   hasGPS(location)          — boolean: has finite lat/lng?
 *
 * Why a small dedicated module
 *   The codebase has scattered haversine + region-key implementations
 *   inside src/outbreak/outbreakClusterEngine.js (private) and
 *   src/utils/regionNormaliser.js. This module is the public
 *   primitive the new NGO map + the spec's farmer-distance alert
 *   rule consume. Each helper is pure + sync + never throws.
 *
 * Strict-rule audit
 *   * Pure: no I/O, no globals
 *   * Never throws on null / partial input — returns Infinity
 *     for distance + null for region key when inputs are bad
 *     (callers can branch on the sentinel without try/catch)
 *   * Works without GPS: getRegionKey falls through country /
 *     region / district so a farm with NO coords still groups
 *     cleanly with its peers
 */

const EARTH_RADIUS_KM = 6371;

function _toFinite(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function _coordsOf(input) {
  if (!input || typeof input !== 'object') return { lat: null, lng: null };
  // Accept three shapes: { lat, lng } | { latitude, longitude } |
  // { location: { lat, lng } }. Lets callers pass farms / fixes /
  // raw coord pairs without unwrapping first.
  if (input.location && typeof input.location === 'object') {
    return _coordsOf(input.location);
  }
  const lat = _toFinite(input.lat) != null
    ? _toFinite(input.lat)
    : _toFinite(input.latitude);
  const lng = _toFinite(input.lng) != null
    ? _toFinite(input.lng)
    : _toFinite(input.longitude);
  return { lat, lng };
}

function _toRad(deg) { return (deg * Math.PI) / 180; }

/**
 * distanceKm(a, b) — great-circle distance in kilometres.
 *
 * Returns Infinity when either input lacks finite coordinates.
 * Callers comparing against a threshold (e.g. < 30) can use the
 * sentinel without a null guard:
 *
 *   if (distanceKm(farm, cluster) < 30) ...
 */
export function distanceKm(a, b) {
  const A = _coordsOf(a);
  const B = _coordsOf(b);
  if (A.lat == null || A.lng == null || B.lat == null || B.lng == null) {
    return Infinity;
  }
  const dLat = _toRad(B.lat - A.lat);
  const dLng = _toRad(B.lng - A.lng);
  const lat1 = _toRad(A.lat);
  const lat2 = _toRad(B.lat);
  const h = Math.sin(dLat / 2) ** 2
          + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

function _normToken(s) {
  if (s == null) return '';
  return String(s).toLowerCase().trim().replace(/\s+/g, '_');
}

/**
 * getRegionKey(location) — deterministic key for grouping farms
 * + reports + clusters by administrative region. Format:
 *
 *   "<country>:<region>:<district>"
 *
 * Empty slots are kept (so two records both missing district
 * still group together) but missing country falls through to a
 * sentinel "_unknown" so a record with no admin metadata at all
 * still has a stable key. Tokens are lowercase + underscored
 * to absorb minor casing / whitespace drift between sources
 * (admin tools type "Volta Region", farmer wizard writes "volta",
 * regionNormaliser writes "volta_region").
 *
 * Returns null only when `location` is itself null/undefined.
 */
export function getRegionKey(location) {
  if (!location || typeof location !== 'object') return null;
  const country  = _normToken(location.country)  || '_unknown';
  const region   = _normToken(location.region);
  const district = _normToken(location.district);
  return `${country}:${region}:${district}`;
}

/**
 * hasGPS(location) — true when the location object carries a
 * finite (lat, lng) pair. Accepts the same three shapes as
 * distanceKm (top-level, latitude/longitude, or wrapped in
 * `location`).
 */
export function hasGPS(location) {
  const { lat, lng } = _coordsOf(location);
  return lat != null && lng != null;
}

export default { distanceKm, getRegionKey, hasGPS };
