/**
 * weatherService.js — weather intelligence for smart task adaptation.
 *
 *   getCurrentWeather(location)  → Promise<WeatherSpec>
 *   getForecast(location)        → Promise<WeatherSpec>
 *   mapWeatherToSpec(rawWeather) → WeatherSpec | null   (pure)
 *
 * Returns the canonical "spec shape" the task adaptation engine
 * (src/logic/taskEngine.js) consumes:
 *
 *   {
 *     condition:     'rain' | 'dry' | 'storm' | 'hot' | 'cold',
 *     precipitation: number,    // mm in next 24h (or last 24h if forecast unknown)
 *     temperature:   number,    // °C
 *     nextDryWindow: Date|null, // first ISO day in the forecast with no rain
 *   }
 *
 * Why this lives separately from src/lib/weather/weatherService.js
 *   The /lib weather service produces a 6-status summary used by the
 *   existing 8-rule production task engine. This service produces the
 *   simpler 5-condition shape the spec calls for, plus the
 *   `nextDryWindow` field the new logic engine uses to schedule
 *   "Check again later" hints. Both services share Open-Meteo as the
 *   underlying data source.
 *
 * Caching
 *   In-memory cache keyed by `${lat},${lng}` rounded to 0.01° (~1 km)
 *   with a 30-minute TTL. Matches the spec's "Refresh every 30 mins"
 *   guidance. The WeatherContext at /context/WeatherContext.jsx runs a
 *   20-minute background refresh so most calls hit the cache; the TTL
 *   is the safety net for direct callers that bypass the context.
 *
 * Fallback
 *   Every public function returns null on failure (network down, bad
 *   response). The Home card treats null as "no weather adaptation"
 *   and falls back to the base task — never crashes.
 */

import { getCurrentWeather as apiGetCurrentWeather } from '../lib/api.js';

const CACHE_TTL_MS = 30 * 60 * 1000;        // 30 minutes (spec §6)
const COORD_BUCKET = 0.01;                  // ~1 km cell key
const HOT_C        = 32;                    // spec §2 rule
const COLD_C       = 10;                    // sub-this counts as 'cold'
const STORM_MM_24H = 25;                    // ≥ this in 24h → storm
const RAIN_MM_24H  = 2;                     // ≥ this in 24h → rain
const DRY_MM_24H   = 0.5;                   // < this → dry day

const _cache = new Map(); // key: "lat,lng" → { ts, value }

function _bucket(lat, lng) {
  if (lat == null || lng == null) return null;
  const r = (n) => Math.round(Number(n) / COORD_BUCKET) * COORD_BUCKET;
  return `${r(lat).toFixed(2)},${r(lng).toFixed(2)}`;
}

function _cacheGet(key) {
  if (!key) return null;
  const hit = _cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) {
    _cache.delete(key);
    return null;
  }
  return hit.value;
}

function _cacheSet(key, value) {
  if (!key || !value) return;
  _cache.set(key, { ts: Date.now(), value });
}

function _num(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Pick a single condition from a normalized raw weather object.
 * Priority order ensures the most actionable condition wins:
 *   storm  > rain > hot > cold > dry
 */
function _deriveCondition({ precipitation24h, temperature, isStorm, isCold }) {
  if (isStorm === true)               return 'storm';
  if (precipitation24h >= STORM_MM_24H) return 'storm';
  if (precipitation24h >= RAIN_MM_24H)  return 'rain';
  if (temperature != null && temperature > HOT_C) return 'hot';
  if (isCold === true)                  return 'cold';
  if (temperature != null && temperature < COLD_C) return 'cold';
  // Default: dry. The task engine treats this as "good conditions".
  return 'dry';
}

/**
 * mapWeatherToSpec(raw) — normalize ANY weather shape (backend
 * response, WeatherContext value, lib/weather summary) to the
 * canonical spec shape used by the task engine.
 *
 * Tolerates field aliases used across the codebase:
 *   - temperature: temperature | tempC | tempHighC | temp
 *   - precipitation 24h: precipitation | rainTodayMm | rainMm24h
 *   - storm flag: severe | storm | heavyRain
 *   - forecast: forecast (array of {date, precipitationMm}) or null
 *
 * Returns null when raw is missing the basics (no temp + no
 * precipitation signal). Never throws.
 */
export function mapWeatherToSpec(raw) {
  if (!raw || typeof raw !== 'object') return null;
  try {
    const temperature =
      _num(raw.temperature) ??
      _num(raw.tempC)        ??
      _num(raw.tempHighC)    ??
      _num(raw.temp);
    const precipitation24h =
      _num(raw.precipitation)   ??
      _num(raw.rainTodayMm)     ??
      _num(raw.rainMm24h)       ??
      0;
    const isStorm = !!(raw.severe || raw.storm || raw.heavyRain);
    const isCold  = !!raw.cold;

    if (temperature == null && precipitation24h === 0 && !isStorm && !isCold) {
      // Nothing to derive a condition from — degrade gracefully.
      return null;
    }

    const condition = _deriveCondition({
      precipitation24h, temperature, isStorm, isCold,
    });

    // Find the next dry window in the forecast array (when present).
    // Forecast row shape varies; we accept {date, precipitationMm} or
    // {date, rainMm} or {ts, precipitation}.
    let nextDryWindow = null;
    const forecast = Array.isArray(raw.forecast) ? raw.forecast : null;
    if (forecast && forecast.length > 0) {
      for (const row of forecast) {
        if (!row) continue;
        const mm = _num(row.precipitationMm)
                ?? _num(row.rainMm)
                ?? _num(row.precipitation);
        if (mm != null && mm < DRY_MM_24H) {
          const dateRaw = row.date || row.ts || row.timestamp;
          const d = dateRaw instanceof Date ? dateRaw : new Date(dateRaw);
          if (Number.isFinite(d.getTime())) { nextDryWindow = d; break; }
        }
      }
    }

    return Object.freeze({
      condition,
      precipitation: precipitation24h,
      temperature:   temperature == null ? 0 : temperature,
      nextDryWindow,
    });
  } catch {
    return null;
  }
}

/**
 * getCurrentWeather(location) — async fetch via the backend
 * weather endpoint, normalized to the spec shape. `location` is
 * either {lat, lng} or {location: 'City Name'}; falsy input
 * returns null.
 *
 * Cached for 30 minutes per coord bucket.
 */
export async function getCurrentWeather(location) {
  if (!location || typeof location !== 'object') return null;
  const lat = _num(location.lat ?? location.latitude);
  const lng = _num(location.lng ?? location.lon ?? location.longitude);
  const cacheKey = _bucket(lat, lng);

  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const params = (lat != null && lng != null)
      ? { lat, lng }
      : (location.location ? { location: location.location } : null);
    if (!params) return null;
    const res = await apiGetCurrentWeather(params);
    const raw = res && (res.weather || res);
    const spec = mapWeatherToSpec(raw);
    if (spec) _cacheSet(cacheKey, spec);
    return spec;
  } catch {
    // Spec §7: never crash. Caller falls back to base task.
    return null;
  }
}

/**
 * getForecast(location) — async fetch shaped like getCurrentWeather
 * but with `nextDryWindow` populated from the forecast array. Some
 * backends return the forecast in the same `/weather/current`
 * payload; this function asks for that and pulls the future-dry
 * day out. Falls back to today when the backend doesn't carry a
 * forecast array.
 */
export async function getForecast(location) {
  // Re-uses the same endpoint — the backend returns hourly /
  // daily forecast inside `weather.forecast`. If the field is
  // absent we still return a valid spec object (nextDryWindow is
  // null). Callers that want long-range planning can degrade
  // gracefully.
  return getCurrentWeather(location);
}

/**
 * _internal — exported for unit tests only. Not part of the
 * public API; treat as implementation detail.
 */
export const _internal = Object.freeze({
  HOT_C, COLD_C, STORM_MM_24H, RAIN_MM_24H, DRY_MM_24H,
  CACHE_TTL_MS,
  _deriveCondition,
});
