/**
 * weatherCache.js — single-slot localStorage cache for the
 * Open-Meteo weather payload.
 *
 *   saveWeather(lat, lng, data)      persist the latest fetch
 *   getCachedWeather(lat?, lng?)     return cached data when fresh
 *
 * Cache TTL: 6 hours (matches typical forecast refresh cadence).
 * Cache key: a single `farroway_weather` slot per the spec. The
 * stored record carries the lat/lng of the farm it was fetched
 * for, so when a caller passes their own lat/lng we can verify
 * the cache is for "their" locale (within ~5km) before returning
 * it - prevents a Ghana farmer from seeing Nairobi weather
 * after switching active farm.
 *
 * Strict-rule audit:
 *   * works offline (localStorage only)
 *   * never throws (every storage call try/catch wrapped)
 *   * lightweight (single slot, no list, no LRU)
 */

import { distanceKm } from '../utils/geo.js';

export const CACHE_KEY = 'farroway_weather';
export const TTL_MS    = 6 * 60 * 60 * 1000; // 6 hours
export const SAME_LOCALE_KM = 5;             // tolerance for "same farm"

function _safeGet(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _safeSet(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch { /* swallow - quota / private mode */ }
}

function _safeRemove(key) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch { /* swallow */ }
}

/**
 * saveWeather(lat, lng, data)
 *
 * Per spec - single-slot cache. The wrapper carries the lat/lng
 * of the farm the data was fetched for + a timestamp.
 */
export function saveWeather(lat, lng, data) {
  if (data == null) return;
  const wrapper = {
    lat:        Number.isFinite(Number(lat)) ? Number(lat) : null,
    lng:        Number.isFinite(Number(lng)) ? Number(lng) : null,
    data,
    timestamp:  Date.now(),
  };
  try { _safeSet(CACHE_KEY, JSON.stringify(wrapper)); }
  catch { /* swallow */ }
}

/**
 * getCachedWeather(lat?, lng?)
 *
 * Spec contract: 0-arg returns the cached `data` payload when not
 * expired, null otherwise. Optional lat/lng args add the
 * "same locale" guard: if the cache is from a different farm
 * (>5km away) we treat it as a miss so the caller falls back
 * to defaults / a fresh fetch.
 */
export function getCachedWeather(lat = null, lng = null) {
  const raw = _safeGet(CACHE_KEY);
  if (!raw) return null;

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { _safeRemove(CACHE_KEY); return null; }

  if (!parsed || typeof parsed !== 'object') return null;
  if (!parsed.timestamp || (Date.now() - parsed.timestamp) > TTL_MS) {
    _safeRemove(CACHE_KEY);
    return null;
  }

  // Optional locale guard.
  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    if (!Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lng)) {
      // Old-shape entry without lat/lng - accept it once; future
      // saves will populate the fields.
    } else {
      const d = distanceKm(
        { lat: Number(lat), lng: Number(lng) },
        { lat: parsed.lat,  lng: parsed.lng  },
      );
      if (Number.isFinite(d) && d > SAME_LOCALE_KM) return null;
    }
  }

  return parsed.data || null;
}

/** Get the wrapper instead of just `data`; useful for "stale at
 *  X" UI affordances. Returns null when expired or missing. */
export function getCachedWeatherWrapper(lat = null, lng = null) {
  const raw = _safeGet(CACHE_KEY);
  if (!raw) return null;
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { return null; }
  if (!parsed || !parsed.timestamp) return null;
  if (Date.now() - parsed.timestamp > TTL_MS) return null;
  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
      && Number.isFinite(parsed.lat) && Number.isFinite(parsed.lng)) {
    const d = distanceKm(
      { lat: Number(lat), lng: Number(lng) },
      { lat: parsed.lat,  lng: parsed.lng  },
    );
    if (Number.isFinite(d) && d > SAME_LOCALE_KM) return null;
  }
  return parsed;
}

/** Test / admin helper. */
export function clearCachedWeather() {
  _safeRemove(CACHE_KEY);
}
