/**
 * weatherService.js — small, mockable weather abstraction used by
 * the planting-decision layer.
 *
 * Two layers:
 *
 *   summarizeWeather(raw) — pure mapper from a simple raw sample
 *     ({ tempC, precip7dMm, forecast7dMm, humidity? }) to a
 *     farmer-friendly summary with caution flags.
 *
 *   createWeatherService({ fetcher? }) — returns an object with a
 *     single async method `getSummary({ lat, lng, country, state,
 *     crop? })` that returns either a summary or a fallback
 *     "unavailable" object (never throws).
 *
 * Design goals:
 *   • v1 works with NO live provider — getSummary returns
 *     `{ status: 'unavailable' }` when no fetcher is injected.
 *   • Easy to wire a real provider later: pass an async `fetcher`
 *     to createWeatherService and return whatever shape its API
 *     uses; this module normalizes that raw sample via
 *     summarizeWeather.
 *   • Pure mapper is fully testable with hand-crafted inputs.
 */

// ─── Thresholds (rule-based, v1) ──────────────────────────────────
// Chosen as safe defaults for tropical + subtropical farming; tune
// later when we have real data.
const TEMP_HOT_C          = 35;     // excessive_heat above this
const TEMP_EXTREME_HOT_C  = 40;     // stronger caution
const PRECIP_LOW_7D_MM    = 10;     // past 7 days below → "low_rain"
const FORECAST_LOW_7D_MM  = 10;     // next 7 days below → "dry_ahead"

const STATUS = Object.freeze({
  OK:              'ok',
  LOW_RAIN:        'low_rain',
  DRY_AHEAD:       'dry_ahead',
  EXCESSIVE_HEAT:  'excessive_heat',
  UNCERTAIN:       'uncertain',
  UNAVAILABLE:     'unavailable',
});

/**
 * summarizeWeather — pure mapper. Accepts whatever subset of fields
 * is available and classifies the overall status + a cautions list.
 *
 *   input:
 *     tempC?            number     current or typical temp (°C)
 *     precip7dMm?       number     precipitation past 7 days (mm)
 *     forecast7dMm?     number     forecast precipitation next 7 days (mm)
 *     humidity?         number     0..100
 *     note?             string     pass-through diagnostic line
 *
 *   output:
 *     {
 *       status:      'ok' | 'low_rain' | 'dry_ahead' | 'excessive_heat'
 *                    | 'uncertain' | 'unavailable',
 *       cautions:    string[]            // stable codes the UI can map
 *       headlineKey: i18n key
 *       tempC:       pass-through
 *       precip7dMm:  pass-through
 *       forecast7dMm:pass-through
 *     }
 *
 * Returns `{ status: 'unavailable' }` when the caller doesn't
 * supply any numeric signal.
 */
export function summarizeWeather(raw = {}) {
  const tempC         = numOr(raw.tempC,         null);
  const precip7dMm    = numOr(raw.precip7dMm,    null);
  const forecast7dMm  = numOr(raw.forecast7dMm,  null);
  const humidity      = numOr(raw.humidity,      null);

  if (tempC == null && precip7dMm == null && forecast7dMm == null) {
    return Object.freeze({
      status: STATUS.UNAVAILABLE,
      cautions: Object.freeze([]),
      headlineKey: 'weather.summary.unavailable',
      tempC, precip7dMm, forecast7dMm, humidity,
    });
  }

  const cautions = [];
  if (tempC != null && tempC >= TEMP_EXTREME_HOT_C)  cautions.push('extreme_heat');
  if (tempC != null && tempC >= TEMP_HOT_C
      && !cautions.includes('extreme_heat'))          cautions.push('excessive_heat');
  if (precip7dMm != null && precip7dMm < PRECIP_LOW_7D_MM)  cautions.push('low_rain');
  if (forecast7dMm != null && forecast7dMm < FORECAST_LOW_7D_MM) cautions.push('dry_ahead');

  let status = STATUS.OK;
  if (cautions.includes('extreme_heat') || cautions.includes('excessive_heat')) {
    status = STATUS.EXCESSIVE_HEAT;
  } else if (cautions.includes('low_rain')) {
    status = STATUS.LOW_RAIN;
  } else if (cautions.includes('dry_ahead')) {
    status = STATUS.DRY_AHEAD;
  } else if (tempC == null && precip7dMm == null) {
    // We had one signal (forecast) but nothing solid — be honest.
    status = STATUS.UNCERTAIN;
  }

  const headlineKey = {
    ok:              'weather.summary.ok',
    low_rain:        'weather.summary.low_rain',
    dry_ahead:       'weather.summary.dry_ahead',
    excessive_heat:  'weather.summary.excessive_heat',
    uncertain:       'weather.summary.uncertain',
    unavailable:     'weather.summary.unavailable',
  }[status];

  return Object.freeze({
    status,
    cautions:   Object.freeze(cautions),
    headlineKey,
    tempC, precip7dMm, forecast7dMm, humidity,
  });
}

// ─── Open-Meteo fetcher (v1 real provider) ────────────────────────
// No API key, no signup, generous rate limits. Endpoint:
//   https://api.open-meteo.com/v1/forecast
// We request current temperature + daily precipitation for the past
// 7 days and the next 7 days, then roll it up into the
// summarizeWeather() shape so every downstream consumer stays
// agnostic of the provider.
const OPEN_METEO_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_TIMEOUT_MS = 7000;

// Coord bucket for cache keys — ~1.1 km at the equator. Keeps
// cache hits warm across small movements without leaking precise
// position to the cache layer.
function coordBucket(lat, lng) {
  const la = Number(lat), lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  return `${la.toFixed(2)},${lo.toFixed(2)}`;
}

async function defaultFetchJson(url, { timeoutMs } = {}) {
  if (typeof fetch !== 'function') return null;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const signal = controller ? controller.signal : undefined;
  const timer  = controller
    ? setTimeout(() => controller.abort(), timeoutMs || OPEN_METEO_TIMEOUT_MS)
    : null;
  try {
    const res = await fetch(url, { signal });
    if (!res || !res.ok) return null;
    return await res.json();
  } catch { return null; }
  finally { if (timer) clearTimeout(timer); }
}

/**
 * openMeteoFetcher — maps the Open-Meteo response to the raw shape
 * summarizeWeather() expects:
 *
 *   { tempC, precip7dMm, forecast7dMm, source: 'open-meteo' }
 *
 *   opts.fetchJson — test shim to swap the network call
 */
export async function openMeteoFetcher({ lat, lng, fetchJson } = {}) {
  // Explicit null/undefined guard — Number(null) === 0 would
  // otherwise pass Number.isFinite and trigger a real network call
  // with coords (0, 0) in the Atlantic.
  if (lat == null || lng == null) return null;
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
  const url =
    `${OPEN_METEO_ENDPOINT}?latitude=${Number(lat)}&longitude=${Number(lng)}`
    + '&current=temperature_2m'
    + '&daily=precipitation_sum'
    + '&past_days=7&forecast_days=7&timezone=auto';
  const fj = typeof fetchJson === 'function' ? fetchJson : defaultFetchJson;
  const data = await fj(url);
  if (!data || typeof data !== 'object') return null;

  const tempC = Number(data.current && data.current.temperature_2m);
  const daily = data.daily && Array.isArray(data.daily.precipitation_sum)
    ? data.daily.precipitation_sum.map((n) => Number(n) || 0)
    : null;
  if (!daily) return null;

  // past_days=7 then forecast_days=7 → 14 entries, indexed oldest → newest.
  // Past 7 are indices 0..6, forecast 7..13.
  const past    = daily.slice(0, 7);
  const future  = daily.slice(7, 14);
  const sum = (arr) => arr.reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0);

  return {
    tempC:        Number.isFinite(tempC) ? tempC : null,
    precip7dMm:   past.length ? sum(past)   : null,
    forecast7dMm: future.length ? sum(future) : null,
    source:       'open-meteo',
    raw:          data,
  };
}

// ─── Local cache (1 h TTL, coord-bucket keyed) ───────────────────
const CACHE_KEY_PREFIX = 'farroway.weatherCache.';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 h — weather changes fast

function hasLocalStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}
function readCache(bucket) {
  if (!bucket || !hasLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY_PREFIX + bucket);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Number.isFinite(parsed.ts)) return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.raw || null;
  } catch { return null; }
}
function writeCache(bucket, raw) {
  if (!bucket || !hasLocalStorage()) return false;
  try {
    window.localStorage.setItem(
      CACHE_KEY_PREFIX + bucket,
      JSON.stringify({ ts: Date.now(), raw }),
    );
    return true;
  } catch { return false; }
}

/**
 * createWeatherService — factory that returns a service with:
 *
 *   getSummary({ lat, lng, country?, state?, crop? })
 *     → Promise<summarizeWeather shape>
 *
 * By default the service uses `openMeteoFetcher`. Callers can
 * override via `{ fetcher }` (for tests or alternate providers)
 * and disable caching via `{ cache: false }`.
 *
 * The service NEVER throws:
 *   • unknown lat/lng           → summarizeWeather({}) (unavailable)
 *   • network fail              → summarizeWeather({}) (unavailable)
 *   • cached hit                → same summary, marked with source='cache'
 */
export function createWeatherService({ fetcher, cache = true } = {}) {
  const fetchFn = typeof fetcher === 'function' ? fetcher : openMeteoFetcher;

  async function getSummary(ctx = {}) {
    const bucket = cache ? coordBucket(ctx.lat, ctx.lng) : null;

    if (bucket) {
      const cached = readCache(bucket);
      if (cached) {
        // Tag the summary so callers can tell a cache hit apart from
        // a fresh network response (useful for debugging + analytics).
        return Object.freeze({ ...summarizeWeather(cached), source: 'cache' });
      }
    }

    let raw;
    try {
      raw = await fetchFn(ctx);
    } catch { raw = null; }

    if (!raw || typeof raw !== 'object') return summarizeWeather({});
    if (bucket) writeCache(bucket, raw);
    return summarizeWeather(raw);
  }

  return Object.freeze({ getSummary });
}

/** Clears every cached weather entry — used on sign-out and tests. */
export function clearWeatherCache() {
  if (!hasLocalStorage()) return false;
  try {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(CACHE_KEY_PREFIX)) keys.push(k);
    }
    for (const k of keys) window.localStorage.removeItem(k);
    return true;
  } catch { return false; }
}

function numOr(v, fallback) {
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export { STATUS };
export const _internal = Object.freeze({
  TEMP_HOT_C, TEMP_EXTREME_HOT_C, PRECIP_LOW_7D_MM, FORECAST_LOW_7D_MM,
  OPEN_METEO_ENDPOINT, OPEN_METEO_TIMEOUT_MS,
  CACHE_KEY_PREFIX, CACHE_TTL_MS, coordBucket,
});
