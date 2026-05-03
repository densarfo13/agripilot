/**
 * weatherService.ts — daily weather summary for the Calm-UI
 * Home header.
 *
 *   import { getWeatherToday } from '../services/weatherService';
 *   const w = await getWeatherToday();
 *   if (w == null) renderFallbackHeader();
 *
 * Endpoint: GET /api/weather/today
 *
 * Behaviour
 *   • Returns `null` on any failure (network / 4xx / 5xx /
 *     unauthenticated). The Home header then renders the
 *     spec's fallback line: "Here's today's guidance".
 *   • Returns a typed envelope on success — same shape the
 *     server sends from the serviceAliases module.
 *
 * Strict-rule audit
 *   • Never throws — wraps the fetch in a try/catch and falls
 *     back to null per spec rule §3 ("If API fails, return null").
 *   • Never logs the response body to console.
 */

import { apiClient } from './apiClient';

export type WeatherSummary = 'rainy' | 'humid' | 'hot' | 'cold' | 'dry' | 'normal';

export type WeatherToday = {
  summary:  WeatherSummary | null;
  tempC:    number | null;
  humidity: number | null;
  rainMm:   number | null;
  source:   'live' | 'cache' | 'unavailable';
};

/**
 * getWeatherToday(opts?) → typed envelope OR `null`.
 *
 * @param opts.lat / opts.lng - override coordinates. Defaults
 *   to the authenticated user's farm-profile coords resolved
 *   server-side.
 */
export async function getWeatherToday(
  opts: { lat?: number; lng?: number } = {},
): Promise<WeatherToday | null> {
  try {
    const params = new URLSearchParams();
    if (typeof opts.lat === 'number' && Number.isFinite(opts.lat)) {
      params.set('lat', String(opts.lat));
    }
    if (typeof opts.lng === 'number' && Number.isFinite(opts.lng)) {
      params.set('lng', String(opts.lng));
    }
    const qs = params.toString();
    const path = qs ? `/api/weather/today?${qs}` : '/api/weather/today';
    const res = await apiClient<WeatherToday>(path);
    if (!res || typeof res !== 'object') return null;
    // Defence-in-depth: the server always returns the envelope
    // even on failure (with `source: 'unavailable'`). Treat that
    // as "null" semantics for the caller.
    if (res.source === 'unavailable' && res.summary == null) return null;
    return res;
  } catch {
    return null;
  }
}

/**
 * resolveHeaderLine(weather, fallbacks) → string.
 *
 * Pure helper that maps a WeatherToday envelope onto the
 * Calm-UI dynamic header line. Exposed for tests + for the
 * caller that already has the envelope and just needs the line.
 *
 * Spec §3 — header wording:
 *   rainy  → "Rain expected — hold watering today"
 *   humid  → "Humidity is high — check leaves"
 *   hot    → "Hot today — check soil early"
 *   cold   → "Cold tonight — protect plants"
 *   dry    → "Dry spell — water deeply today"
 *   normal → "Good day for a quick check"
 *   null   → "Here's today's guidance"
 */
export function resolveHeaderLine(
  weather: WeatherToday | null,
  fallbacks: Partial<Record<WeatherSummary | 'fallback', string>> = {},
): string {
  if (!weather || !weather.summary) {
    return fallbacks.fallback || "Here\u2019s today\u2019s guidance";
  }
  const map: Record<WeatherSummary, string> = {
    rainy:  fallbacks.rainy  || 'Rain expected \u2014 hold watering today',
    humid:  fallbacks.humid  || 'Humidity is high \u2014 check leaves',
    hot:    fallbacks.hot    || 'Hot today \u2014 check soil early',
    cold:   fallbacks.cold   || 'Cold tonight \u2014 protect plants',
    dry:    fallbacks.dry    || 'Dry spell \u2014 water deeply today',
    normal: fallbacks.normal || 'Good day for a quick check',
  };
  return map[weather.summary] || map.normal;
}

export default getWeatherToday;
