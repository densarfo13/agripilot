/**
 * Weather Forecast Service — 7-day forecast from Open-Meteo.
 *
 * Free API, no key required. Uses GPS coordinates from the user's profile.
 * Falls back to country centroid when GPS is unavailable.
 *
 * Caching: 30-minute TTL per location key to avoid redundant fetches.
 * Dedup: concurrent requests for the same location collapse into one.
 *
 * Returns normalized forecast:
 *   { days: [{ date, rainMm, rainProbability, tempMin, tempMax, weatherCode }], fetchedAt }
 */

// ─── Country centroids (fallback when no GPS) ──────────────
const COUNTRY_CENTROIDS = {
  GH: { lat: 7.95,  lng: -1.02  },  // Ghana
  KE: { lat: 0.02,  lng: 37.91  },  // Kenya
  NG: { lat: 9.08,  lng: 7.49   },  // Nigeria
  TZ: { lat: -6.37, lng: 34.89  },  // Tanzania
  UG: { lat: 1.37,  lng: 32.29  },  // Uganda
  ET: { lat: 9.14,  lng: 40.49  },  // Ethiopia
  US: { lat: 39.05, lng: -76.64 },  // US (Maryland centroid)
  ZA: { lat: -30.56, lng: 22.94 },  // South Africa
  CM: { lat: 7.37,  lng: 12.35  },  // Cameroon
  CI: { lat: 7.54,  lng: -5.55  },  // Côte d'Ivoire
  SN: { lat: 14.50, lng: -14.45 },  // Senegal
  MW: { lat: -13.25, lng: 34.30 },  // Malawi
  ZM: { lat: -13.13, lng: 27.85 },  // Zambia
  MZ: { lat: -18.67, lng: 35.53 },  // Mozambique
  RW: { lat: -1.94, lng: 29.87  },  // Rwanda
};

// ─── Cache ──────────────────────────────────────────────────
const CACHE_TTL_MS = 30 * 60 * 1000;  // 30 minutes
const cache = new Map();

/** In-flight request dedup */
let inflight = null;
let inflightKey = null;

/**
 * Resolve GPS coordinates from profile or country code fallback.
 * @param {Object} opts
 * @param {number} [opts.lat]
 * @param {number} [opts.lng]
 * @param {string} [opts.countryCode]
 * @returns {{ lat: number, lng: number } | null}
 */
export function resolveCoordinates({ lat, lng, countryCode } = {}) {
  if (lat != null && lng != null && isFinite(lat) && isFinite(lng)) {
    return { lat, lng };
  }
  const cc = (countryCode || '').toUpperCase();
  if (COUNTRY_CENTROIDS[cc]) return COUNTRY_CENTROIDS[cc];
  return null;
}

/**
 * Fetch 7-day forecast from Open-Meteo.
 *
 * @param {Object} opts
 * @param {number} [opts.lat] — GPS latitude
 * @param {number} [opts.lng] — GPS longitude
 * @param {string} [opts.countryCode] — fallback for centroid lookup
 * @param {boolean} [opts.force] — bypass cache
 * @returns {Promise<{ days: Array, fetchedAt: number, coords: {lat, lng} } | null>}
 */
export async function fetchForecast({ lat, lng, countryCode, force = false } = {}) {
  const coords = resolveCoordinates({ lat, lng, countryCode });
  if (!coords) return null;

  // Defensive numeric coercion. Profile data round-trips
  // through JSON / form inputs so lat/lng can arrive as
  // strings ("5.55"); calling .toFixed() on a string throws
  // 'TypeError: lat.toFixed is not a function' which crashed
  // the forecast context on /dashboard. Coerce once here and
  // bail safely when the value isn't a finite number.
  const latNum = Number(coords.lat);
  const lngNum = Number(coords.lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    console.warn('Forecast skipped — non-numeric coords', { lat: coords.lat, lng: coords.lng });
    return null;
  }
  // Re-stamp the coords object with numbers so downstream
  // consumers (cache, URL builder, return shape) all see a
  // consistent shape.
  coords.lat = latNum;
  coords.lng = lngNum;

  const locKey = `${latNum.toFixed(2)},${lngNum.toFixed(2)}`;

  // Check cache (unless forced)
  if (!force) {
    const cached = cache.get(locKey);
    if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
      return cached;
    }
  }

  // Dedup concurrent requests for same location
  if (inflight && inflightKey === locKey) return inflight;

  const url = `https://api.open-meteo.com/v1/forecast`
    + `?latitude=${coords.lat}&longitude=${coords.lng}`
    + `&daily=precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min,weathercode`
    + `&timezone=auto`
    + `&forecast_days=7`;

  const promise = (async () => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
      const data = await res.json();

      const days = (data.daily?.time || []).map((date, i) => ({
        date,
        rainMm: data.daily.precipitation_sum?.[i] ?? 0,
        rainProbability: data.daily.precipitation_probability_max?.[i] ?? 0,
        tempMin: data.daily.temperature_2m_min?.[i] ?? null,
        tempMax: data.daily.temperature_2m_max?.[i] ?? null,
        weatherCode: data.daily.weathercode?.[i] ?? null,
      }));

      const result = { days, fetchedAt: Date.now(), coords };
      cache.set(locKey, result);
      return result;
    } catch (err) {
      console.warn('Forecast fetch failed:', err.message);
      // Return stale cache if available
      const stale = cache.get(locKey);
      if (stale) return stale;
      return null;
    } finally {
      inflight = null;
      inflightKey = null;
    }
  })();

  inflight = promise;
  inflightKey = locKey;
  return promise;
}

/**
 * Get cached forecast without triggering a fetch.
 * @param {number} lat
 * @param {number} lng
 * @returns {Object|null}
 */
export function getCachedForecast(lat, lng) {
  if (lat == null || lng == null) return null;
  // Same defensive coercion as fetchForecast — never call
  // .toFixed() on a value that might be a string from JSON.
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null;
  const locKey = `${latNum.toFixed(2)},${lngNum.toFixed(2)}`;
  return cache.get(locKey) || null;
}

/**
 * Clear all cached forecasts. Useful for testing.
 */
export function clearForecastCache() {
  cache.clear();
}
