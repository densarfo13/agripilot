/**
 * weatherProvider.js — minimal, dependency-free forecast fetcher that
 * normalizes a remote response into the shape `getWeatherRisk` expects:
 *
 *   { tempHighC, tempLowC, rainMmNext24h, rainChancePct, humidityPct, windKph }
 *
 * Uses Open-Meteo (https://open-meteo.com), which needs no API key and
 * returns metric units. Any failure — offline, timeout, non-200 —
 * resolves to `null` so callers simply run the Today engine in
 * no-weather mode.
 *
 * A 30-minute in-memory cache keyed by rounded lat/lon keeps the Today
 * endpoint cheap when many farmers hit it at once.
 */
const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';
const CACHE_TTL_MS = 30 * 60 * 1000;   // 30 minutes
const REQUEST_TIMEOUT_MS = 4_000;

/** cacheKey(latitude, longitude) → rounded to 2dp to hit neighbor cells. */
function cacheKey(lat, lon) {
  return `${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}`;
}

const cache = new Map();

function fromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function toCache(key, value) {
  cache.set(key, { at: Date.now(), value });
}

/** Pick today's row from Open-Meteo's `daily` block. */
function extractDailyToday(daily, idx = 0) {
  if (!daily) return {};
  return {
    tempHighC: Number.isFinite(daily.temperature_2m_max?.[idx]) ? daily.temperature_2m_max[idx] : null,
    tempLowC:  Number.isFinite(daily.temperature_2m_min?.[idx]) ? daily.temperature_2m_min[idx] : null,
    rainMmToday: Number.isFinite(daily.precipitation_sum?.[idx]) ? daily.precipitation_sum[idx] : null,
    rainChancePct: Number.isFinite(daily.precipitation_probability_max?.[idx]) ? daily.precipitation_probability_max[idx] : null,
    windKph: Number.isFinite(daily.wind_speed_10m_max?.[idx]) ? daily.wind_speed_10m_max[idx] : null,
  };
}

/**
 * normalizeForecast(json) → weather shape the risk engine expects.
 *
 * Exported for tests so we can assert the shape without running a
 * real HTTP request.
 */
export function normalizeForecast(json) {
  if (!json) return null;
  const d0 = extractDailyToday(json.daily, 0);
  const d1 = extractDailyToday(json.daily, 1);
  const current = json.current || json.current_weather || {};
  return {
    tempHighC: d0.tempHighC,
    tempLowC: d0.tempLowC,
    rainMmToday: d0.rainMmToday,
    // 24h window = today + tomorrow's precipitation
    rainMmNext24h: (d0.rainMmToday ?? 0) + (d1.rainMmToday ?? 0),
    rainChancePct: d0.rainChancePct,
    humidityPct: Number.isFinite(current.relative_humidity_2m) ? current.relative_humidity_2m : null,
    windKph: d0.windKph,
    forecast: [
      { day: 0, tempHighC: d0.tempHighC, rainMmToday: d0.rainMmToday },
      { day: 1, tempHighC: d1.tempHighC, rainMmToday: d1.rainMmToday },
    ],
  };
}

/**
 * getWeatherForFarm(farm) — resolves a weather payload for the farm.
 * Returns null if the farm has no usable coordinates or the request
 * fails for any reason. Never throws.
 *
 * @param {Object} farm  { latitude, longitude }
 * @param {Object} [opts]
 * @param {typeof fetch} [opts.fetchImpl]  injected for tests
 * @param {boolean}      [opts.bypassCache]
 */
export async function getWeatherForFarm(farm, opts = {}) {
  const lat = Number(farm?.latitude);
  const lon = Number(farm?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const key = cacheKey(lat, lon);
  if (!opts.bypassCache) {
    const cached = fromCache(key);
    if (cached) return cached;
  }

  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') return null;

  const url = new URL(OPEN_METEO);
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('current', 'relative_humidity_2m,wind_speed_10m');
  url.searchParams.set('daily', [
    'temperature_2m_max',
    'temperature_2m_min',
    'precipitation_sum',
    'precipitation_probability_max',
    'wind_speed_10m_max',
  ].join(','));
  url.searchParams.set('wind_speed_unit', 'kmh');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '2');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetchImpl(url.toString(), { signal: controller.signal });
    clearTimeout(timer);
    if (!res || !res.ok) return null;
    const json = await res.json();
    const normalized = normalizeForecast(json);
    if (normalized) toCache(key, normalized);
    return normalized;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/** Test-only helpers. */
export const _internal = { cacheKey, extractDailyToday, CACHE_TTL_MS };
export function _clearCache() { cache.clear(); }
