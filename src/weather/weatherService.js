/**
 * weatherService.js — Open-Meteo fetch + cached "weather for
 * this farm" composer.
 *
 * Open-Meteo (https://open-meteo.com/) is a free, no-API-key
 * weather provider with permissive usage. We pull a 7-day
 * daily forecast (max temperature + precipitation_sum) and
 * derive the same boolean signals the offline weatherEngine
 * defaults to. Network errors return null so callers can fall
 * back to the cache or to the deterministic defaults.
 *
 *   fetchWeather(lat, lng)        async; returns signals or null
 *   getWeatherForFarm(farm)       async; cache-first composer
 *   getWeatherSignalsForFarm(farm) sync; cache-only fast path
 *
 * Strict-rule audit:
 *   * never blocks the UI: fetch goes through the cache and
 *     async returns null on every failure path
 *   * cache-first: getWeatherForFarm() consults the cache
 *     before issuing a network call
 *   * fallbacks: cache miss + offline -> null, the caller can
 *     pipe that into computeFarmRisks() which falls back to
 *     getWeatherSignals() defaults
 *   * lightweight: zero deps; one fetch; one localStorage write
 */

import { saveWeather, getCachedWeather, getCachedWeatherWrapper } from './weatherCache.js';

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';
const HOT_TEMP_C       = 30;   // matches the spec's 30C cutoff
const RAINY_DAY_MM     = 1;    // a "rainy" day for the 3-day check
const FETCH_TIMEOUT_MS = 8000; // hard cap so a slow API never hangs

function _isLatLng(lat, lng) {
  const a = Number(lat), b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (a < -90 || a > 90)   return false;
  if (b < -180 || b > 180) return false;
  return true;
}

function _abortAfter(ms) {
  try {
    if (typeof AbortController === 'undefined') return null;
    const ctl = new AbortController();
    setTimeout(() => { try { ctl.abort(); } catch { /* swallow */ } }, ms);
    return ctl;
  } catch { return null; }
}

/**
 * Derive the spec's signal triplet from a parsed Open-Meteo
 * `daily` block.
 */
function _signalsFromDaily(daily) {
  if (!daily) return null;
  const precip = Array.isArray(daily.precipitation_sum)
    ? daily.precipitation_sum.slice(0, 3).map((v) => Number(v))
    : [];
  const temps = Array.isArray(daily.temperature_2m_max)
    ? daily.temperature_2m_max.map((v) => Number(v))
    : [];

  // "rain in last 3 days" - we use the next-3-day forecast as
  // the proxy for "is rain coming / has it just rained"; treats
  // any day with >= RAINY_DAY_MM as rainy.
  const rainLast3Days = precip.length > 0 && precip.some((v) =>
    Number.isFinite(v) && v >= RAINY_DAY_MM,
  );

  // "temperature high" keys on today's max.
  const todayMax = temps.length > 0 && Number.isFinite(temps[0]) ? temps[0] : null;
  const temperatureHigh = todayMax != null ? todayMax > HOT_TEMP_C : false;

  // Crude humidity proxy: a forecast day with rain + heat tends
  // to imply muggy conditions. Weather-API-true humidity comes in
  // a v2 wire-up (Open-Meteo's `relativehumidity_2m` hourly);
  // for v1.3 we keep the proxy aligned with the spec.
  const humidityHigh = !!(rainLast3Days && temperatureHigh);

  return {
    rainLast3Days,
    temperatureHigh,
    humidityHigh,
  };
}

/**
 * fetchWeather(lat, lng)
 *   -> Promise<signals | null>
 *
 * `signals` = { rainLast3Days, temperatureHigh, humidityHigh,
 *                raw }
 * The `raw` field carries the Open-Meteo response so consumers
 * that want to render extra UI bits (forecast row, sunrise, ...)
 * don't need a second fetch. Resolves null on network error,
 * non-2xx, parse failure, abort.
 */
export async function fetchWeather(lat, lng) {
  if (!_isLatLng(lat, lng))      return null;
  if (typeof fetch !== 'function') return null;

  const url = `${OPEN_METEO_BASE}`
    + `?latitude=${encodeURIComponent(lat)}`
    + `&longitude=${encodeURIComponent(lng)}`
    + '&daily=temperature_2m_max,precipitation_sum'
    + '&timezone=auto';

  const ctl = _abortAfter(FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, ctl ? { signal: ctl.signal } : undefined);
  } catch (err) {
    try { console.warn('[weather] fetch failed:', err && err.message); }
    catch { /* console missing */ }
    return null;
  }
  if (!res || !res.ok) return null;

  let json;
  try { json = await res.json(); }
  catch { return null; }

  const signals = _signalsFromDaily(json && json.daily);
  if (!signals) return null;

  return Object.freeze({ ...signals, raw: json });
}

/**
 * getWeatherForFarm(farm)
 *   -> Promise<signals | null>
 *
 * Cache-first composer:
 *   1. Read fresh cache for the farm's lat/lng (5km tolerance).
 *      If hit, return immediately - never blocks UI.
 *   2. Attempt a fresh fetch.
 *   3. On success, write the cache + return signals.
 *   4. On failure, fall back to whatever cache we DID have
 *      (even if expired we still try to surface a stale value
 *      under offline conditions). When even that's missing,
 *      return null - downstream computeFarmRisks() then falls
 *      back to deterministic getWeatherSignals() defaults.
 */
export async function getWeatherForFarm(farm) {
  const lat = farm && farm.location && farm.location.lat;
  const lng = farm && farm.location && farm.location.lng;
  if (!_isLatLng(lat, lng)) {
    // No coords -> rely on whatever cache exists, otherwise null.
    return getCachedWeather() || null;
  }

  // 1. Fresh, locale-matched cache hit.
  const fresh = getCachedWeather(lat, lng);
  if (fresh) return fresh;

  // 2. Attempt the network fetch.
  const data = await fetchWeather(lat, lng);
  if (data) {
    saveWeather(lat, lng, data);
    return data;
  }

  // 3. Fetch failed. Surface whatever cache we have - even
  //    expired - so the farmer sees a consistent value during
  //    a long offline window. The wrapper helper enforces a
  //    softer locale match.
  const wrap = getCachedWeatherWrapper(lat, lng);
  if (wrap && wrap.data) return wrap.data;

  return null;
}

/**
 * getWeatherSignalsForFarm(farm)
 *   -> signals | null      (synchronous)
 *
 * Sync fast path that any render component can use without
 * awaiting. Reads the cache only - never issues a network call.
 * Pair with a useEffect that calls getWeatherForFarm(farm) at
 * mount to refresh on the next paint.
 */
export function getWeatherSignalsForFarm(farm) {
  const lat = farm && farm.location && farm.location.lat;
  const lng = farm && farm.location && farm.location.lng;
  if (_isLatLng(lat, lng)) {
    const fresh = getCachedWeather(lat, lng);
    if (fresh) return fresh;
  }
  return getCachedWeather() || null;
}

export const _internal = Object.freeze({
  OPEN_METEO_BASE, HOT_TEMP_C, RAINY_DAY_MM, _signalsFromDaily, _isLatLng,
});
