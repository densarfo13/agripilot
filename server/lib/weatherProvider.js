/**
 * Weather Provider — fetches weather for a farm and derives risk flags.
 *
 * Uses Open-Meteo (free, no API key) for real data.
 * Falls back to farm country/region geocoding when coordinates are missing.
 * Caches snapshots in WeatherSnapshot table (1-hour TTL).
 * All risk flags (rainExpected, heavyRainRisk, drySpellRisk) are derived
 * from forecast data — never faked.
 *
 * PROVIDER NOTE: Open-Meteo is the real provider wired here.
 * To swap to a paid provider (e.g., OpenWeatherMap), replace
 * fetchFromOpenMeteo() without changing the public API.
 */

import prisma from './prisma.js';

// ─── Constants ────────────────────────────────────────────

/** Cache TTL in milliseconds (1 hour) */
const CACHE_TTL_MS = 60 * 60 * 1000;

/** Rainfall thresholds (mm) */
const RAIN_EXPECTED_THRESHOLD = 1;     // >1mm in 3-day forecast = rain expected
const HEAVY_RAIN_THRESHOLD = 30;       // >30mm in 3-day forecast = heavy rain risk

/** Dry spell: <2mm total over 7-day forecast */
const DRY_SPELL_THRESHOLD = 2;

/** WMO weather codes → human-readable condition */
const WMO_CONDITIONS = {
  0: 'Clear sky',
  1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  56: 'Light freezing drizzle', 57: 'Dense freezing drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  66: 'Light freezing rain', 67: 'Heavy freezing rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
  85: 'Slight snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail',
};

export { WMO_CONDITIONS, CACHE_TTL_MS, RAIN_EXPECTED_THRESHOLD, HEAVY_RAIN_THRESHOLD, DRY_SPELL_THRESHOLD };

// ─── Geocode fallback ─────────────────────────────────────

/**
 * Geocode a location string (country, region, or farm name) to coordinates.
 * Uses Open-Meteo geocoding API (free, no key).
 * @param {string} locationText
 * @returns {Promise<{lat: number, lng: number, name: string}|null>}
 */
export async function geocodeLocation(locationText) {
  if (!locationText || !locationText.trim()) return null;
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationText.trim())}&count=1&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.results?.[0];
    if (!result) return null;
    return { lat: result.latitude, lng: result.longitude, name: result.name };
  } catch {
    return null;
  }
}

// ─── Open-Meteo fetch ─────────────────────────────────────

/**
 * Fetch current + 7-day forecast from Open-Meteo.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<object>} Raw Open-Meteo response
 */
async function fetchFromOpenMeteo(lat, lng) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m` +
    `&daily=precipitation_sum,rain_sum,weather_code` +
    `&forecast_days=7&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`);
  return res.json();
}

// ─── Derive risk flags ────────────────────────────────────

/**
 * Derive weather context from Open-Meteo response.
 * @param {object} raw — Open-Meteo JSON response
 * @returns {object} Normalized weather context
 */
/** WMO codes that indicate active rain/precipitation */
const RAIN_WEATHER_CODES = new Set([
  51, 53, 55,  // drizzle
  56, 57,      // freezing drizzle
  61, 63, 65,  // rain
  66, 67,      // freezing rain
  80, 81, 82,  // rain showers
  95, 96, 99,  // thunderstorm
]);

export function deriveWeatherContext(raw) {
  const current = raw.current || {};
  const daily = raw.daily || {};

  const temperatureC = current.temperature_2m ?? null;
  const humidityPct = current.relative_humidity_2m ?? null;
  const windSpeedKmh = current.wind_speed_10m ?? null;
  const weatherCode = current.weather_code ?? null;
  const condition = WMO_CONDITIONS[weatherCode] || null;

  // Current precipitation right now (mm)
  const currentPrecipMm = (current.precipitation ?? 0) + (current.rain ?? 0) + (current.showers ?? 0);

  // Is it raining RIGHT NOW based on weather code or measurable precipitation
  const rainingNow = RAIN_WEATHER_CODES.has(weatherCode) || currentPrecipMm >= 0.5;

  // Daily rainfall: separate today from multi-day forecast
  const dailyRain = daily.precipitation_sum || [];
  const rainTodayMm = dailyRain[0] || 0;                                         // today only
  const rain3d = dailyRain.slice(0, 3).reduce((s, v) => s + (v || 0), 0);       // 3-day total
  const rain7d = dailyRain.slice(0, 7).reduce((s, v) => s + (v || 0), 0);       // 7-day total

  // Today's weather code from daily forecast (may differ from current)
  const todayWeatherCode = (daily.weather_code || [])[0] ?? null;
  const todayIsRainCode = RAIN_WEATHER_CODES.has(todayWeatherCode);

  // ─── Rain classification ─────────────────────────────
  // rainNow:        currently raining (measured)
  // rainTodayLikely: today's forecast shows meaningful rain (>= 2mm) but not raining now
  // rainExpected:   3-day forecast exceeds threshold — used for multi-day risk, NOT hard warnings
  const rainTodayLikely = !rainingNow && (rainTodayMm >= 2 || todayIsRainCode);
  const rainExpected = rain3d > RAIN_EXPECTED_THRESHOLD;       // 3-day, softer signal
  const heavyRainRisk = rain3d > HEAVY_RAIN_THRESHOLD;
  const drySpellRisk = rain7d < DRY_SPELL_THRESHOLD;

  // Forecast date = first daily date
  const forecastDate = daily.time?.[0] || null;

  return {
    temperatureC,
    humidityPct,
    windSpeedKmh,
    condition,
    weatherCode,
    // Current precipitation
    currentPrecipMm: Math.round(currentPrecipMm * 10) / 10,
    rainingNow,
    // Today's forecast
    rainTodayMm: Math.round(rainTodayMm * 10) / 10,
    rainTodayLikely,
    // Multi-day forecast
    rainForecastMm: Math.round(rain3d * 10) / 10,
    rainExpected,
    heavyRainRisk,
    drySpellRisk,
    forecastDate,
    forecastDays: 3,
  };
}

// ─── Resolve farm coordinates ─────────────────────────────

/**
 * Get lat/lng for a farm, using coordinates or falling back to country/region geocoding.
 * @param {object} farm — { latitude, longitude, country, locationName }
 * @returns {Promise<{lat: number, lng: number, geocoded: boolean}|null>}
 */
export async function resolveFarmCoordinates(farm) {
  // 1. Direct coordinates
  if (farm.latitude != null && farm.longitude != null) {
    return { lat: farm.latitude, lng: farm.longitude, geocoded: false };
  }

  // 2. Geocode from location name + country
  const locationText = [farm.locationName, farm.country].filter(Boolean).join(', ');
  if (locationText) {
    const geo = await geocodeLocation(locationText);
    if (geo) return { lat: geo.lat, lng: geo.lng, geocoded: true };
  }

  // 3. Geocode from country alone
  if (farm.country) {
    const geo = await geocodeLocation(farm.country);
    if (geo) return { lat: geo.lat, lng: geo.lng, geocoded: true };
  }

  return null;
}

// ─── Cache layer ──────────────────────────────────────────

/**
 * Get cached weather snapshot if still fresh.
 * @param {string} farmId
 * @returns {Promise<object|null>}
 */
async function getCachedSnapshot(farmId) {
  const cutoff = new Date(Date.now() - CACHE_TTL_MS);
  const snapshot = await prisma.weatherSnapshot.findFirst({
    where: { farmProfileId: farmId, fetchedAt: { gte: cutoff } },
    orderBy: { fetchedAt: 'desc' },
  });
  return snapshot || null;
}

/**
 * Save weather snapshot to cache.
 * @param {string} farmId
 * @param {number} lat
 * @param {number} lng
 * @param {object} weather — derived weather context
 * @returns {Promise<object>}
 */
async function saveSnapshot(farmId, lat, lng, weather) {
  return prisma.weatherSnapshot.create({
    data: {
      farmProfileId: farmId,
      latitude: lat,
      longitude: lng,
      temperatureC: weather.temperatureC ?? 0,
      rainForecastMm: weather.rainForecastMm ?? 0,
      humidityPct: weather.humidityPct,
      windSpeedKmh: weather.windSpeedKmh,
      condition: weather.condition,
      forecastDays: weather.forecastDays || 3,
      rainExpected: weather.rainExpected ?? null,
      heavyRainRisk: weather.heavyRainRisk ?? null,
      drySpellRisk: weather.drySpellRisk ?? null,
      forecastDate: weather.forecastDate ? new Date(weather.forecastDate) : null,
      source: 'open-meteo',
    },
  });
}

// ─── Public API ───────────────────────────────────────────

/**
 * Format a cached snapshot to the standard weather response shape.
 * @param {object} snapshot — Prisma WeatherSnapshot row
 * @returns {object}
 */
export function formatSnapshot(snapshot) {
  return {
    temperatureC: snapshot.temperatureC,
    humidityPct: snapshot.humidityPct,
    windSpeedKmh: snapshot.windSpeedKmh,
    condition: snapshot.condition,
    rainForecastMm: snapshot.rainForecastMm,
    rainExpected: snapshot.rainExpected,
    heavyRainRisk: snapshot.heavyRainRisk,
    drySpellRisk: snapshot.drySpellRisk,
    forecastDate: snapshot.forecastDate,
    forecastDays: snapshot.forecastDays,
    source: snapshot.source,
    fetchedAt: snapshot.fetchedAt,
  };
}

/**
 * Get weather for a farm — cached or fresh.
 *
 * @param {object} farm — must have id, latitude, longitude, country, locationName
 * @returns {Promise<{weather: object, coordinates: {lat, lng}, geocoded: boolean, cached: boolean}|null>}
 */
export async function getWeatherForFarm(farm) {
  // Check cache first
  const cached = await getCachedSnapshot(farm.id);
  if (cached) {
    return {
      weather: formatSnapshot(cached),
      coordinates: { lat: cached.latitude, lng: cached.longitude },
      geocoded: false,
      cached: true,
    };
  }

  // Resolve coordinates
  const coords = await resolveFarmCoordinates(farm);
  if (!coords) return null;

  // Fetch fresh weather
  const raw = await fetchFromOpenMeteo(coords.lat, coords.lng);
  const weather = deriveWeatherContext(raw);

  // Cache the result
  await saveSnapshot(farm.id, coords.lat, coords.lng, weather);

  return {
    weather,
    coordinates: { lat: coords.lat, lng: coords.lng },
    geocoded: coords.geocoded,
    cached: false,
  };
}
