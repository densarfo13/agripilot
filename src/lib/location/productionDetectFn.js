/**
 * productionDetectFn.js — the single "Use my location" function
 * shared by every onboarding flow (fast, v2, and any future
 * screens).
 *
 * Pipeline:
 *   1. Cache hit (24h, local time)? → return cached result
 *   2. getBrowserCoords() — classified errors (permission_denied /
 *      timeout / position_unavailable / insecure_context /
 *      unsupported / unknown). THROWS a BrowserLocationError the
 *      caller can map to localized copy.
 *   3. reverseGeocode(lat, lng) via the provider chain (bigdatacloud
 *      → Nominatim → coarse bounding-box fallback).
 *   4. Persist a COARSE-ROUNDED copy (3 decimals) to the cache so
 *      the raw device precision never leaves memory.
 *   5. Return `{ country, stateCode, city, accuracyM, latitude,
 *      longitude, source, cached }` to the caller. Lat/long
 *      returned here are ALREADY rounded so every downstream
 *      consumer persists the same coarse values.
 *
 * Dependency injection keeps this testable: every IO touchpoint
 * can be swapped via `opts`.
 */

import { getBrowserCoords } from './browserLocation.js';
import { reverseGeocode }   from './reverseGeocode.js';
import { roundCoord, DEFAULT_COORD_PRECISION } from './coordsPrivacy.js';
import { readCache, writeCache, clearCache } from './locationCache.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * sameRoundedCoords — compares the cached rounded coord pair against
 * the current rounded coord pair. Matches when BOTH are finite and
 * equal at the configured precision. A null value on either side is
 * treated as "no match" so an old cache without coords can't be
 * reused in place of a live detection.
 */
function sameRoundedCoords(a, b) {
  if (!a || !b) return false;
  if (!Number.isFinite(a.latitude)  || !Number.isFinite(a.longitude))  return false;
  if (!Number.isFinite(b.latitude)  || !Number.isFinite(b.longitude))  return false;
  return a.latitude === b.latitude && a.longitude === b.longitude;
}

/**
 * productionDetectFn — the default export.
 *
 * Pipeline (new order as of the hardening pass):
 *   1. Get fresh device coords (GPS). If permission is already
 *      granted the prompt does not re-appear, so this is cheap.
 *   2. Round coords to the privacy precision (default 3 dp).
 *   3. If a cache exists AND its rounded coords match today's
 *      rounded coords AND it hasn't expired (24h) → use its
 *      country/state/city without hitting the network.
 *   4. Otherwise call the reverse-geocode provider chain. If a
 *      country comes back, write a fresh cache keyed by the new
 *      rounded coords (the cache stores coords + country pair, so
 *      a moved farmer automatically invalidates the old entry).
 *   5. Return ROUNDED coords + country/state/city to the caller.
 *      Raw precision is dropped before return — never persisted.
 *
 * opts:
 *   now?:         Date | number — injected time for tests
 *   ttlMs?:       number        — cache TTL (default 24h)
 *   precision?:   number        — coord rounding decimals (default 3)
 *   bypassCache?: bool           — skip cache read (e.g. "Detect again")
 *   coords?:      (opts?) → Promise<{latitude, longitude, accuracy}>
 *   geocode?:     (lat, lng) → Promise<reverseGeocodeResult|null>
 *   readCacheFn?: ({ ttlMs, now }) → cached | null
 *   writeCacheFn?: (payload) => written | null
 */
export async function productionDetectFn(opts = {}) {
  const now          = opts.now;
  const ttlMs        = Number.isFinite(opts.ttlMs) ? opts.ttlMs : ONE_DAY_MS;
  const precision    = Number.isFinite(opts.precision) ? opts.precision : DEFAULT_COORD_PRECISION;
  const bypassCache  = !!opts.bypassCache;
  const coords       = typeof opts.coords       === 'function' ? opts.coords       : getBrowserCoords;
  const geocode      = typeof opts.geocode      === 'function' ? opts.geocode      : reverseGeocode;
  const readCacheFn  = typeof opts.readCacheFn  === 'function' ? opts.readCacheFn  : readCache;
  const writeCacheFn = typeof opts.writeCacheFn === 'function' ? opts.writeCacheFn : writeCache;

  // 1) Device coords first — throws BrowserLocationError on any
  //    failure so the UI can render a classified message.
  const raw = await coords();

  // 2) Coarse-round immediately. The raw precise value stays only in
  //    local scope and is never returned or persisted.
  const rLat = roundCoord(raw.latitude,  precision);
  const rLng = roundCoord(raw.longitude, precision);

  // 3) Cache check — now keyed by rounded coords. A cached entry is
  //    reusable only if its rounded coords match today's rounded
  //    coords (farmer hasn't moved past the ~110 m rounding bucket)
  //    AND it's still within TTL.
  if (!bypassCache) {
    const cached = readCacheFn({ ttlMs, now });
    if (cached && cached.country
        && sameRoundedCoords({ latitude: rLat, longitude: rLng }, cached)) {
      return Object.freeze({
        country:   cached.country,
        stateCode: cached.stateCode || null,
        city:      cached.city || null,
        accuracyM: raw.accuracy,
        latitude:  cached.latitude,
        longitude: cached.longitude,
        source:    cached.source || 'cache',
        cached:    true,
      });
    }
  }

  // 4) Reverse geocode through the provider chain.
  const geo = await geocode(raw.latitude, raw.longitude);

  // 5) Persist a fresh cache entry when we have a country. The cache
  //    effectively acts as `(rounded coords) → (country/state/city)`;
  //    writing overwrites any stale entry from a previous location.
  if (geo && geo.country && rLat != null && rLng != null) {
    try {
      writeCacheFn({
        latitude:  rLat,
        longitude: rLng,
        country:   geo.country,
        stateCode: geo.stateCode || null,
        city:      geo.city || null,
        source:    geo.source || 'network',
        now,
      });
    } catch { /* cache write must never break onboarding */ }
  }

  return Object.freeze({
    country:   geo?.country   || null,
    stateCode: geo?.stateCode || null,
    city:      geo?.city      || null,
    accuracyM: raw.accuracy,
    latitude:  rLat,
    longitude: rLng,
    source:    geo?.source    || null,
    cached:    false,
  });
}

/**
 * detectAgain — convenience helper bound to the "Detect again" UI
 * CTA. Clears any cached entry and reruns the pipeline with
 * `bypassCache: true` so the farmer always gets a fresh read.
 */
export async function detectAgain(opts = {}) {
  try { clearCache(); } catch { /* ignore */ }
  return productionDetectFn({ ...opts, bypassCache: true });
}

export default productionDetectFn;
export const _internal = Object.freeze({ ONE_DAY_MS });
