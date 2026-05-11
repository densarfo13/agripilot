/**
 * weatherProvider.js — Open-Meteo agricultural forecast provider.
 *
 * Normalizes remote weather into the shape `getWeatherRisk` expects:
 * { tempHighC, tempLowC, rainMmNext24h, rainChancePct, humidityPct, windKph }
 *
 * Also adds Farroway agriculture intelligence fields:
 * soilMoisture01cm, soilMoisture13cm, soilTemp0cm, currentTempC,
 * weatherCode, cloudCoverPct, precipitationNowMm.
 */

// Open-Meteo has two tiers:
//   • Free / community  → https://api.open-meteo.com/v1/forecast (no key)
//   • Commercial         → https://customer-api.open-meteo.com/v1/forecast (apikey)
// The previous version hard-coded the commercial endpoint without
// passing the api key, which made every request 401 and fall back
// to the safe shape — the visible "Weather unavailable" / 0°
// symptom operators reported. Default to the free endpoint;
// upgrade automatically when OPEN_METEO_API_KEY is set.
const OPEN_METEO_FREE     = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_CUSTOMER = 'https://customer-api.open-meteo.com/v1/forecast';

function _resolveEndpoint() {
  const apiKey = (process.env.OPEN_METEO_API_KEY || '').trim();
  return {
    url:    apiKey ? OPEN_METEO_CUSTOMER : OPEN_METEO_FREE,
    apiKey,
  };
}

const CACHE_TTL_MS     = 30 * 60 * 1000;   // 30 minutes
const REQUEST_TIMEOUT_MS = 4_000;
const MAX_RETRIES      = 2;                // total attempts = MAX_RETRIES + 1
const RETRY_BACKOFF_MS = [200, 800];       // exponential-ish per attempt

function cacheKey(lat, lon) {
  return `${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}`;
}

// In-memory fallback cache — used when Redis isn't configured OR
// when the Redis call fails. Keyed by rounded lat/lon so flapping
// GPS coordinates don't bust the cache on every render.
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

// Redis cache layer — lazy-imported so the provider stays
// usable without Redis configured. Failure paths fall through
// silently to the in-memory cache; nothing ever throws.
async function _fromRedis(key) {
  try {
    const { getRedis } = await import('../../../config/redis.js');
    const client = await getRedis();
    if (!client) return null;
    const raw = await client.get('farroway:weather:' + key);
    if (typeof raw !== 'string' || !raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  } catch { return null; }
}

async function _toRedis(key, value) {
  try {
    const { getRedis } = await import('../../../config/redis.js');
    const client = await getRedis();
    if (!client) return;
    await client.set(
      'farroway:weather:' + key,
      JSON.stringify(value),
      { EX: Math.floor(CACHE_TTL_MS / 1000) },
    );
  } catch { /* swallow — in-memory cache is the floor */ }
}

// Retry helper with timeout. Open-Meteo is fast but occasional
// edge timeouts trip the abort signal on slow Railway egress;
// two attempts at 200ms + 800ms cover the common failure modes
// without making the user wait.
async function _fetchWithRetry(url, fetchImpl) {
  let lastErr = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetchImpl(url, { signal: controller.signal });
      clearTimeout(timer);
      // Don't retry 4xx — repeating won't help. Retry 5xx + network.
      if (res && res.ok) return res;
      if (res && res.status >= 400 && res.status < 500) return res;
      lastErr = new Error('weather_http_' + (res ? res.status : 'no_response'));
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
    }
    // Backoff before next attempt.
    if (attempt < MAX_RETRIES) {
      const wait = RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length - 1)];
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  if (lastErr && process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('[weather] retry exhausted:', lastErr.message || lastErr);
  }
  return null;
}

function isNum(v) {
  return Number.isFinite(Number(v));
}

function val(arr, idx = 0) {
  return Array.isArray(arr) && isNum(arr[idx]) ? Number(arr[idx]) : null;
}

function extractDailyToday(daily, idx = 0) {
  if (!daily) return {};
  return {
    tempHighC: val(daily.temperature_2m_max, idx),
    tempLowC: val(daily.temperature_2m_min, idx),
    rainMmToday: val(daily.precipitation_sum, idx),
    rainChancePct: val(daily.precipitation_probability_max, idx),
    windKph: val(daily.wind_speed_10m_max, idx),
    uvIndexMax: val(daily.uv_index_max, idx),
    precipitationHours: val(daily.precipitation_hours, idx),
  };
}

function firstHourlyValue(hourly, key) {
  return val(hourly?.[key], 0);
}

export function normalizeForecast(json) {
  if (!json) return null;

  const d0 = extractDailyToday(json.daily, 0);
  const d1 = extractDailyToday(json.daily, 1);
  const current = json.current || {};

  return {
    source: 'open-meteo',

    // Existing risk-engine contract
    tempHighC: d0.tempHighC,
    tempLowC: d0.tempLowC,
    rainMmToday: d0.rainMmToday,
    rainMmNext24h: (d0.rainMmToday ?? 0) + (d1.rainMmToday ?? 0),
    rainChancePct: d0.rainChancePct,
    humidityPct: isNum(current.relative_humidity_2m) ? Number(current.relative_humidity_2m) : null,
    windKph: d0.windKph,

    // Current weather card
    currentTempC: isNum(current.temperature_2m) ? Number(current.temperature_2m) : null,
    apparentTempC: isNum(current.apparent_temperature) ? Number(current.apparent_temperature) : null,
    weatherCode: isNum(current.weather_code) ? Number(current.weather_code) : null,
    cloudCoverPct: isNum(current.cloud_cover) ? Number(current.cloud_cover) : null,
    precipitationNowMm: isNum(current.precipitation) ? Number(current.precipitation) : null,
    isDay: isNum(current.is_day) ? Number(current.is_day) === 1 : null,

    // Soil / agriculture intelligence
    soilTemp0cm: firstHourlyValue(json.hourly, 'soil_temperature_0cm'),
    soilMoisture01cm: firstHourlyValue(json.hourly, 'soil_moisture_0_to_1cm'),
    soilMoisture13cm: firstHourlyValue(json.hourly, 'soil_moisture_1_to_3cm'),
    evapotranspiration: firstHourlyValue(json.hourly, 'evapotranspiration'),
    et0FaoEvapotranspiration: firstHourlyValue(json.hourly, 'et0_fao_evapotranspiration'),

    // Daily intelligence
    uvIndexMax: d0.uvIndexMax,
    precipitationHours: d0.precipitationHours,

    forecast: [
      { day: 0, tempHighC: d0.tempHighC, rainMmToday: d0.rainMmToday, rainChancePct: d0.rainChancePct },
      { day: 1, tempHighC: d1.tempHighC, rainMmToday: d1.rainMmToday, rainChancePct: d1.rainChancePct },
    ],
  };
}

export async function getWeatherForFarm(farm, opts = {}) {
  const lat = Number(farm?.latitude);
  const lon = Number(farm?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const key = cacheKey(lat, lon);
  if (!opts.bypassCache) {
    // 1. Try Redis first when configured (shared across replicas).
    const cachedRedis = await _fromRedis(key);
    if (cachedRedis) return cachedRedis;
    // 2. Fall through to the in-memory cache (single-replica floor).
    const cached = fromCache(key);
    if (cached) return cached;
  }

  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') return null;

  const endpoint = _resolveEndpoint();
  const url = new URL(endpoint.url);
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  if (endpoint.apiKey) url.searchParams.set('apikey', endpoint.apiKey);

  url.searchParams.set('current', [
    'temperature_2m',
    'relative_humidity_2m',
    'apparent_temperature',
    'is_day',
    'precipitation',
    'weather_code',
    'cloud_cover',
    'wind_speed_10m',
  ].join(','));

  url.searchParams.set('hourly', [
    'temperature_2m',
    'relative_humidity_2m',
    'precipitation_probability',
    'precipitation',
    'cloud_cover',
    'wind_speed_10m',
    'soil_temperature_0cm',
    'soil_moisture_0_to_1cm',
    'soil_moisture_1_to_3cm',
    'evapotranspiration',
    'et0_fao_evapotranspiration',
  ].join(','));

  url.searchParams.set('daily', [
    'temperature_2m_max',
    'temperature_2m_min',
    'precipitation_sum',
    'precipitation_probability_max',
    'precipitation_hours',
    'rain_sum',
    'wind_speed_10m_max',
    'uv_index_max',
  ].join(','));

  url.searchParams.set('temperature_unit', 'celsius');
  url.searchParams.set('wind_speed_unit', 'kmh');
  url.searchParams.set('precipitation_unit', 'mm');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '2');

  // Retry-aware fetch — 2 attempts at 200ms / 800ms backoff,
  // 4s timeout per attempt. Returns null on total failure so the
  // caller falls back to the safe shape.
  const res = await _fetchWithRetry(url.toString(), fetchImpl);
  if (!res || !res.ok) return null;

  let json;
  try { json = await res.json(); }
  catch { return null; }

  const normalized = normalizeForecast(json);
  if (!normalized) return null;

  // Write to BOTH cache layers — Redis is the source of truth
  // across replicas; the in-memory cache is a same-process
  // speedup so a hot path doesn't re-await Redis on every render.
  toCache(key, normalized);
  // Fire-and-forget — Redis write doesn't block the response.
  _toRedis(key, normalized).catch(() => { /* swallow */ });

  return normalized;
}

export const _internal = { cacheKey, extractDailyToday, CACHE_TTL_MS };
export function _clearCache() {
  cache.clear();
}