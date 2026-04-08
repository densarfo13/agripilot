/**
 * Weather Provider Abstraction
 *
 * Default: Open-Meteo (free, no API key required, good global coverage).
 * The provider interface returns a normalized WeatherData shape.
 * To swap providers, implement the same interface and update the factory.
 */

import { config } from '../../config/index.js';

// ─── Normalized weather shape ──────────────────────────

/**
 * @typedef {Object} WeatherData
 * @property {number} temperatureC - Current temperature in Celsius
 * @property {number} rainForecastMm - Total precipitation forecast (mm) over forecast window
 * @property {number|null} humidityPct - Relative humidity (%)
 * @property {number|null} windSpeedKmh - Wind speed (km/h)
 * @property {string|null} condition - Human-readable condition (e.g. "Partly cloudy")
 * @property {number} forecastDays - Number of forecast days included
 * @property {string} source - Provider name
 * @property {string} fetchedAt - ISO timestamp
 */

// ─── Open-Meteo provider (free, no key) ────────────────

async function fetchOpenMeteo(lat, lng) {
  const baseUrl = config.weather.baseUrl || 'https://api.open-meteo.com/v1';
  const url = `${baseUrl}/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
    `&daily=precipitation_sum&timezone=auto&forecast_days=3`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.weather.timeoutMs || 5000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Open-Meteo API returned ${res.status}`);
    }
    const data = await res.json();

    const current = data.current || {};
    const daily = data.daily || {};
    const precipDays = daily.precipitation_sum || [];
    const totalRain = precipDays.reduce((sum, v) => sum + (v || 0), 0);

    return {
      temperatureC: current.temperature_2m ?? null,
      rainForecastMm: Math.round(totalRain * 10) / 10,
      humidityPct: current.relative_humidity_2m ?? null,
      windSpeedKmh: current.wind_speed_10m ?? null,
      condition: weatherCodeToCondition(current.weather_code),
      forecastDays: precipDays.length || 3,
      source: 'open-meteo',
      fetchedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

// WMO weather code to readable condition
function weatherCodeToCondition(code) {
  if (code == null) return null;
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 49) return 'Foggy';
  if (code <= 59) return 'Drizzle';
  if (code <= 69) return 'Rain';
  if (code <= 79) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Unknown';
}

// ─── Provider factory ──────────────────────────────────

const providers = {
  'open-meteo': fetchOpenMeteo,
};

/**
 * Fetch weather data for given coordinates.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<WeatherData>}
 */
export async function fetchWeather(lat, lng) {
  // Could be extended to select provider based on config
  const providerFn = providers['open-meteo'];
  return providerFn(lat, lng);
}

// ─── Fallback defaults ─────────────────────────────────

export const FALLBACK_WEATHER = {
  temperatureC: 25,
  rainForecastMm: 0,
  humidityPct: null,
  windSpeedKmh: null,
  condition: null,
  forecastDays: 0,
  source: 'fallback',
  fetchedAt: new Date().toISOString(),
};
