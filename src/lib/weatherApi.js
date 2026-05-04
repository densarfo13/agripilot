/**
 * weatherApi.js — direct WeatherAPI.com integration.
 *
 *   import { fetchWeather } from './lib/weatherApi.js';
 *
 *   const wx = await fetchWeather({ lat: 5.6, lng: -0.2 });
 *   const wx = await fetchWeather({ region: 'Accra' });
 *
 * This is a SUPPLEMENTARY direct-fetch path. The existing
 * weather context (`useWeather()` / weatherProvider.js) is
 * still the canonical source for WeatherProvider-aware
 * components; this module is for Home v2 surfaces that want
 * a one-shot direct fetch with a tight, predictable envelope.
 *
 * Configuration
 *   • VITE_WEATHER_API_KEY in .env at build time. When absent,
 *     fetchWeather() returns the safe fallback shape — never
 *     a 401 / 403 leak.
 *
 * Output envelope (always returned — never throws):
 *   { temp, condition, rainChance, windSpeed, location }
 *
 * Strict-rule audit
 *   • Never throws — every failure path returns the fallback
 *     envelope and console.errors the message.
 *   • cache: 'no-store' so the request bypasses HTTP caches
 *     (matches the rest of the codebase's no-cache discipline).
 *   • Provider URL is parameterised so a future swap to
 *     OpenWeather / Open-Meteo only touches this module.
 */

const PROVIDER_URL = 'https://api.weatherapi.com/v1/forecast.json';
const DEFAULT_REGION = 'Accra';

const FALLBACK = Object.freeze({
  temp:       null,
  condition:  'Weather unavailable',
  rainChance: null,
  windSpeed:  null,
  location:   'Your area',
});

/**
 * fetchWeather({ lat, lng, region })
 *
 * Resolves with a normalized envelope. Never rejects.
 *   • Prefers lat,lng when both are finite numbers.
 *   • Falls back to `region` (free text) when coordinates absent.
 *   • Falls back to DEFAULT_REGION ('Accra') when both absent.
 */
export async function fetchWeather(input = {}) {
  const opts = (input && typeof input === 'object') ? input : {};
  const lat = Number(opts.lat);
  const lng = Number(opts.lng);
  const region = typeof opts.region === 'string' && opts.region.length > 0
    ? opts.region : null;

  let apiKey = null;
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      apiKey = import.meta.env.VITE_WEATHER_API_KEY || null;
    }
  } catch { apiKey = null; }
  if (!apiKey) {
    try { console.warn('[weatherApi] VITE_WEATHER_API_KEY missing — using fallback envelope.'); }
    catch { /* swallow */ }
    return { ...FALLBACK, location: region || FALLBACK.location };
  }

  const query = (Number.isFinite(lat) && Number.isFinite(lng))
    ? `${lat},${lng}`
    : (region || DEFAULT_REGION);

  const url = `${PROVIDER_URL}?key=${encodeURIComponent(apiKey)}`
    + `&q=${encodeURIComponent(query)}`
    + '&days=1&aqi=no&alerts=no';

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res || !res.ok) throw new Error('Weather request failed: ' + (res && res.status));
    const data = await res.json();
    return _normalize(data, region);
  } catch (err) {
    try { console.error('Weather fetch failed:', err && err.message ? err.message : err); }
    catch { /* swallow */ }
    return { ...FALLBACK, location: region || FALLBACK.location };
  }
}

function _normalize(data, regionFallback) {
  const cur = (data && data.current) || {};
  const day = data && data.forecast && data.forecast.forecastday
    && data.forecast.forecastday[0] && data.forecast.forecastday[0].day;
  const loc = data && data.location;

  const tempC = Number(cur.temp_c);
  const windKph = Number(cur.wind_kph);
  const condition = cur.condition && typeof cur.condition.text === 'string'
    ? cur.condition.text : 'Unknown';
  const rainChance = Number(day && day.daily_chance_of_rain);
  const locName = (loc && typeof loc.name === 'string' && loc.name.length > 0)
    ? loc.name
    : (regionFallback || FALLBACK.location);

  return {
    temp:       Number.isFinite(tempC)      ? Math.round(tempC) : null,
    condition,
    rainChance: Number.isFinite(rainChance) ? rainChance : 0,
    windSpeed:  Number.isFinite(windKph)    ? Math.round(windKph) : null,
    location:   locName,
  };
}

export const _internal = Object.freeze({
  PROVIDER_URL,
  DEFAULT_REGION,
  FALLBACK,
  _normalize,
});

export default fetchWeather;
