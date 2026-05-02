/**
 * weatherService.js \u2014 fetch current weather for a Farroway
 * location object (Final Location Autofill + Weather Integration
 * \u00a75). The contract matches the spec shape so dailyPlanEngine
 * can consume it directly:
 *
 *   import { getWeatherForLocation, getDefaultWeather }
 *     from '../core/weatherService.js';
 *
 *   const w = await getWeatherForLocation({
 *     country: 'USA', region: 'Maryland',
 *     lat: 38.9072, lng: -77.0369,
 *   });
 *   // \u2192 {
 *   //     rainExpected: false,
 *   //     rainChance:   12,
 *   //     humidity:     65,
 *   //     temperature:  23,
 *   //     wind:         8,
 *   //     summary:      'normal',
 *   //   }
 *
 * Provider
 * ────────
 * Open-Meteo's `forecast` endpoint:
 *   https://api.open-meteo.com/v1/forecast
 *
 *   \u2022 No API key required
 *   \u2022 Free for client-side traffic
 *   \u2022 CORS open
 *   \u2022 Returns current + daily-precipitation-probability in
 *     a single round trip
 *
 * Why a new module instead of reusing src/services/weatherService.js
 * ──────────────────────────────────────────────────────────────────
 * The existing /services weather service goes through an internal
 * /api endpoint that may not be live for all pilots. This module
 * is a self-contained client-side shim that hits Open-Meteo
 * directly and returns the exact shape the spec calls for. Both
 * services coexist; downstream surfaces pick whichever fits.
 *
 * Strict-rule audit
 *   \u2022 Pure async function. Never throws. Returns the safe-default
 *     shape on every failure path (no network, CORS, malformed
 *     response, bad coords, timeout, missing fetch).
 *   \u2022 6-second timeout via AbortController so a slow network
 *     never blocks the UX.
 *   \u2022 Privacy: only sends the precise lat/lng the caller passed
 *     in. Drops every response field outside the spec shape.
 *   \u2022 Coords required for a real fetch \u2014 the spec says
 *     "if no lat/lng, use country/region fallback". We don't
 *     have a country-code geocoder here, so the fallback path
 *     returns the safe-default shape. A future extension can
 *     resolve country/region to a representative lat/lng.
 */

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const TIMEOUT_MS = 6000;

// Spec-aligned thresholds. Match the dailyPlanEngine's facet
// readers so the same numbers drive the same decisions.
const RAIN_EXPECTED_THRESHOLD = 60;   // %
const HIGH_HUMIDITY_THRESHOLD = 70;   // %
const HIGH_TEMP_THRESHOLD     = 30;   // \u00b0C
const STRONG_WIND_THRESHOLD   = 25;   // km/h
const DRY_HUMIDITY_THRESHOLD  = 30;   // %

function _validCoord(n, min, max) {
  return typeof n === 'number'
      && Number.isFinite(n)
      && n >= min
      && n <= max;
}

/**
 * Safe-default weather shape returned when a fetch can't run
 * or fails. Spec \u00a75 mandates this exact object so callers
 * never have to null-check the fields.
 */
export function getDefaultWeather() {
  return {
    rainExpected: false,
    rainChance:   0,
    humidity:     null,
    temperature:  null,
    wind:         null,
    summary:      'Weather unavailable',
  };
}

function _summarise(rainExpected, humidity, temp, wind) {
  if (rainExpected)                                    return 'rainy';
  if (humidity !== null && humidity > HIGH_HUMIDITY_THRESHOLD) return 'humid';
  if (temp     !== null && temp     > HIGH_TEMP_THRESHOLD)     return 'hot';
  if (wind     !== null && wind     > STRONG_WIND_THRESHOLD)   return 'windy';
  if (humidity !== null && humidity < DRY_HUMIDITY_THRESHOLD)  return 'dry';
  return 'normal';
}

function _round(n, digits) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/**
 * getWeatherForLocation(location) \u2192 Promise<weather shape>
 *
 * @param {object} location  the canonical
 *   { country, region, lat?, lng? } shape persisted by
 *   src/utils/locationStore.js. Lat/lng are required for a
 *   real fetch \u2014 the country-only fallback returns the
 *   safe-default shape (a future extension can resolve
 *   country/region to a representative lat/lng).
 * @returns {Promise<{
 *   rainExpected: boolean,
 *   rainChance:   number,
 *   humidity:     number | null,
 *   temperature:  number | null,
 *   wind:         number | null,
 *   summary:      string,
 * }>}
 */
export async function getWeatherForLocation(location) {
  const loc = (location && typeof location === 'object') ? location : {};
  const lat = loc.lat;
  const lng = loc.lng;

  if (!_validCoord(lat, -90, 90)) return getDefaultWeather();
  if (!_validCoord(lng, -180, 180)) return getDefaultWeather();
  if (typeof fetch !== 'function') return getDefaultWeather();

  const controller = (typeof AbortController === 'function')
    ? new AbortController()
    : null;
  const timer = controller
    ? setTimeout(() => { try { controller.abort(); } catch { /* ignore */ } }, TIMEOUT_MS)
    : null;

  try {
    const params = new URLSearchParams({
      latitude:  String(lat),
      longitude: String(lng),
      current:   'temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation',
      daily:     'precipitation_probability_max',
      timezone:  'auto',
      forecast_days: '1',
    });
    const url = `${ENDPOINT}?${params.toString()}`;
    const opts = controller ? { signal: controller.signal } : {};
    const res = await fetch(url, opts);
    if (!res || !res.ok) return getDefaultWeather();
    const data = await res.json();
    if (!data || typeof data !== 'object') return getDefaultWeather();

    const current = (data.current && typeof data.current === 'object') ? data.current : {};
    const daily   = (data.daily   && typeof data.daily   === 'object') ? data.daily   : {};

    const humidity   = _round(current.relative_humidity_2m, 0);
    const temperature = _round(current.temperature_2m, 1);
    const wind       = _round(current.wind_speed_10m, 1);
    const probArr    = Array.isArray(daily.precipitation_probability_max) ? daily.precipitation_probability_max : [];
    const rainChance = (typeof probArr[0] === 'number' && Number.isFinite(probArr[0])) ? probArr[0] : 0;

    const rainExpected = rainChance >= RAIN_EXPECTED_THRESHOLD;
    const summary = _summarise(rainExpected, humidity, temperature, wind);

    return {
      rainExpected,
      rainChance,
      humidity,
      temperature,
      wind,
      summary,
    };
  } catch {
    // Any failure path \u2014 network, abort, malformed JSON \u2014
    // collapses to the safe-default shape. The Home card
    // surfaces "Weather unavailable" copy in this branch.
    return getDefaultWeather();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export default getWeatherForLocation;
