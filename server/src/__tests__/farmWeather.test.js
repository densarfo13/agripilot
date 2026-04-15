/**
 * Farm Weather Integration — comprehensive tests.
 *
 * Tests cover:
 *  1. Weather provider helpers (deriveWeatherContext, resolveFarmCoordinates, formatSnapshot)
 *  2. Risk flag derivation (rainExpected, heavyRainRisk, drySpellRisk)
 *  3. WMO condition mapping
 *  4. Farm weather route structure
 *  5. Task engine weather integration
 *  6. Prisma schema — WeatherSnapshot fields
 *  7. Frontend API function
 *  8. FarmWeatherCard component
 *  9. FarmTasksCard weather note rendering
 * 10. Dashboard wiring
 * 11. i18n keys
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  deriveWeatherContext,
  WMO_CONDITIONS,
  RAIN_EXPECTED_THRESHOLD,
  HEAVY_RAIN_THRESHOLD,
  DRY_SPELL_THRESHOLD,
  CACHE_TTL_MS,
  formatSnapshot,
} from '../../lib/weatherProvider.js';
import { generateTasksForFarm } from '../../lib/farmTaskEngine.js';

function readFile(relativePath) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
//  1. Weather provider — deriveWeatherContext
// ═══════════════════════════════════════════════════════════
describe('deriveWeatherContext', () => {
  it('extracts temperature, humidity, wind from current data', () => {
    const raw = {
      current: { temperature_2m: 28.5, relative_humidity_2m: 72, wind_speed_10m: 12 },
      daily: { precipitation_sum: [0, 0, 0], time: ['2026-04-13'] },
    };
    const ctx = deriveWeatherContext(raw);
    expect(ctx.temperatureC).toBe(28.5);
    expect(ctx.humidityPct).toBe(72);
    expect(ctx.windSpeedKmh).toBe(12);
  });

  it('derives rainExpected = true when 3-day rain > threshold', () => {
    const raw = {
      current: { temperature_2m: 25, weather_code: 61 },
      daily: { precipitation_sum: [5, 3, 2, 0, 0, 0, 0], time: ['2026-04-13'] },
    };
    const ctx = deriveWeatherContext(raw);
    expect(ctx.rainExpected).toBe(true);
    expect(ctx.rainForecastMm).toBe(10);
  });

  it('derives rainExpected = false when 3-day rain <= threshold', () => {
    const raw = {
      current: { temperature_2m: 30 },
      daily: { precipitation_sum: [0, 0.5, 0, 0, 0, 0, 0], time: ['2026-04-13'] },
    };
    const ctx = deriveWeatherContext(raw);
    expect(ctx.rainExpected).toBe(false);
  });

  it('derives heavyRainRisk = true when 3-day rain > heavy threshold', () => {
    const raw = {
      current: {},
      daily: { precipitation_sum: [15, 10, 10, 0, 0, 0, 0], time: ['2026-04-13'] },
    };
    const ctx = deriveWeatherContext(raw);
    expect(ctx.heavyRainRisk).toBe(true);
  });

  it('derives drySpellRisk = true when 7-day rain < dry threshold', () => {
    const raw = {
      current: {},
      daily: { precipitation_sum: [0, 0, 0, 0, 0.5, 0, 0], time: ['2026-04-13'] },
    };
    const ctx = deriveWeatherContext(raw);
    expect(ctx.drySpellRisk).toBe(true);
  });

  it('derives drySpellRisk = false when 7-day rain >= threshold', () => {
    const raw = {
      current: {},
      daily: { precipitation_sum: [1, 0, 1, 0, 0, 1, 0], time: ['2026-04-13'] },
    };
    const ctx = deriveWeatherContext(raw);
    expect(ctx.drySpellRisk).toBe(false);
  });

  it('maps WMO weather code to condition string', () => {
    const raw = {
      current: { weather_code: 63 },
      daily: { precipitation_sum: [5, 5, 5], time: ['2026-04-13'] },
    };
    const ctx = deriveWeatherContext(raw);
    expect(ctx.condition).toBe('Moderate rain');
  });

  it('handles missing daily data gracefully', () => {
    const raw = { current: { temperature_2m: 22 }, daily: {} };
    const ctx = deriveWeatherContext(raw);
    expect(ctx.rainForecastMm).toBe(0);
    expect(ctx.rainExpected).toBe(false);
    expect(ctx.drySpellRisk).toBe(true);
  });

  it('returns forecastDate from first daily time entry', () => {
    const raw = {
      current: {},
      daily: { precipitation_sum: [0], time: ['2026-04-13'] },
    };
    const ctx = deriveWeatherContext(raw);
    expect(ctx.forecastDate).toBe('2026-04-13');
  });

  it('returns forecastDays = 3', () => {
    const raw = { current: {}, daily: { precipitation_sum: [] } };
    const ctx = deriveWeatherContext(raw);
    expect(ctx.forecastDays).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════
//  2. WMO conditions mapping
// ═══════════════════════════════════════════════════════════
describe('WMO_CONDITIONS', () => {
  it('maps code 0 to Clear sky', () => {
    expect(WMO_CONDITIONS[0]).toBe('Clear sky');
  });

  it('maps code 65 to Heavy rain', () => {
    expect(WMO_CONDITIONS[65]).toBe('Heavy rain');
  });

  it('maps code 95 to Thunderstorm', () => {
    expect(WMO_CONDITIONS[95]).toBe('Thunderstorm');
  });

  it('covers major weather codes', () => {
    expect(Object.keys(WMO_CONDITIONS).length).toBeGreaterThan(20);
  });
});

// ═══════════════════════════════════════════════════════════
//  3. Constants
// ═══════════════════════════════════════════════════════════
describe('Weather constants', () => {
  it('exports CACHE_TTL_MS as 1 hour', () => {
    expect(CACHE_TTL_MS).toBe(3600000);
  });

  it('exports rain thresholds', () => {
    expect(RAIN_EXPECTED_THRESHOLD).toBe(1);
    expect(HEAVY_RAIN_THRESHOLD).toBe(30);
    expect(DRY_SPELL_THRESHOLD).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════
//  4. formatSnapshot
// ═══════════════════════════════════════════════════════════
describe('formatSnapshot', () => {
  it('maps Prisma row to standard weather shape', () => {
    const snapshot = {
      temperatureC: 28,
      humidityPct: 75,
      windSpeedKmh: 8,
      condition: 'Partly cloudy',
      rainForecastMm: 12.5,
      rainExpected: true,
      heavyRainRisk: false,
      drySpellRisk: false,
      forecastDate: new Date('2026-04-13'),
      forecastDays: 3,
      source: 'open-meteo',
      fetchedAt: new Date(),
    };
    const result = formatSnapshot(snapshot);
    expect(result.temperatureC).toBe(28);
    expect(result.rainExpected).toBe(true);
    expect(result.heavyRainRisk).toBe(false);
    expect(result.source).toBe('open-meteo');
  });
});

// ═══════════════════════════════════════════════════════════
//  5. Prisma schema — WeatherSnapshot fields
// ═══════════════════════════════════════════════════════════
describe('Prisma schema — WeatherSnapshot', () => {
  const schema = readFile('server/prisma/schema.prisma');

  it('has rainExpected field', () => {
    expect(schema).toContain('rainExpected');
    expect(schema).toContain('rain_expected');
  });

  it('has heavyRainRisk field', () => {
    expect(schema).toContain('heavyRainRisk');
    expect(schema).toContain('heavy_rain_risk');
  });

  it('has drySpellRisk field', () => {
    expect(schema).toContain('drySpellRisk');
    expect(schema).toContain('dry_spell_risk');
  });

  it('has forecastDate field', () => {
    expect(schema).toContain('forecastDate');
    expect(schema).toContain('forecast_date');
  });

  it('has farmProfileId relation', () => {
    expect(schema).toContain('farmProfileId');
  });

  it('has indexes on farmProfileId and fetchedAt', () => {
    expect(schema).toContain('idx_weather_farm');
    expect(schema).toContain('idx_weather_fetched');
  });
});

// ═══════════════════════════════════════════════════════════
//  6. Farm weather route
// ═══════════════════════════════════════════════════════════
describe('Farm weather route', () => {
  const route = readFile('server/routes/farmWeather.js');

  it('imports authenticate middleware', () => {
    expect(route).toContain('authenticate');
  });

  it('imports getWeatherForFarm', () => {
    expect(route).toContain('getWeatherForFarm');
  });

  it('has GET /:farmId endpoint', () => {
    expect(route).toContain("'/:farmId'");
  });

  it('checks farm ownership via userId', () => {
    expect(route).toContain('req.user.id');
  });

  it('returns 404 if farm not found', () => {
    expect(route).toContain('404');
    expect(route).toContain('Farm not found');
  });

  it('handles missing location gracefully', () => {
    expect(route).toContain('weather: null');
  });
});

// ═══════════════════════════════════════════════════════════
//  7. Weather provider module
// ═══════════════════════════════════════════════════════════
describe('Weather provider module', () => {
  const provider = readFile('server/lib/weatherProvider.js');

  it('exports getWeatherForFarm', () => {
    expect(provider).toContain('export async function getWeatherForFarm');
  });

  it('exports deriveWeatherContext', () => {
    expect(provider).toContain('export function deriveWeatherContext');
  });

  it('exports resolveFarmCoordinates', () => {
    expect(provider).toContain('export async function resolveFarmCoordinates');
  });

  it('exports geocodeLocation', () => {
    expect(provider).toContain('export async function geocodeLocation');
  });

  it('uses farm latitude/longitude first', () => {
    expect(provider).toContain('farm.latitude');
    expect(provider).toContain('farm.longitude');
  });

  it('falls back to country geocoding', () => {
    expect(provider).toContain('farm.country');
    expect(provider).toContain('farm.locationName');
  });

  it('implements cache with TTL', () => {
    expect(provider).toContain('CACHE_TTL_MS');
    expect(provider).toContain('getCachedSnapshot');
  });

  it('saves snapshot to database', () => {
    expect(provider).toContain('prisma.weatherSnapshot.create');
  });
});

// ═══════════════════════════════════════════════════════════
//  8. Task engine — weather integration
// ═══════════════════════════════════════════════════════════
describe('Task engine — weather context', () => {
  const engine = readFile('server/lib/farmTaskEngine.js');

  it('accepts weather in context', () => {
    expect(engine).toContain('weather');
    expect(engine).toContain('weather, risks, inputRecs, harvestRecs, hasRecentHarvestRecord, hasCostRecords, hasRevenueData, benchmarkInsights } = context');
  });

  it('checks weather.hasWeatherData', () => {
    expect(engine).toContain('weather.hasWeatherData');
  });

  it('checks weather.rainExpected', () => {
    expect(engine).toContain('weather.rainExpected');
  });

  it('checks weather.heavyRainRisk', () => {
    expect(engine).toContain('weather.heavyRainRisk');
  });

  it('checks weather.drySpellRisk', () => {
    expect(engine).toContain('weather.drySpellRisk');
  });

  it('checks weather.humidityPct for pest risk', () => {
    expect(engine).toContain('weather.humidityPct');
  });

  it('adds weatherNote to tasks', () => {
    expect(engine).toContain('weatherNote');
  });

  // Functional tests
  it('downgrades irrigation tasks when rain expected', () => {
    const tasks = generateTasksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'planting', farmerType: 'new',
      weather: { hasWeatherData: true, rainExpected: true, heavyRainRisk: false, drySpellRisk: false, humidityPct: 60 },
    });
    const waterTasks = tasks.filter(t => t.id.includes('water'));
    for (const t of waterTasks) {
      expect(t.weatherNote).toContain('Rain expected');
    }
  });

  it('downgrades fertilizer tasks when heavy rain risk', () => {
    const tasks = generateTasksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
      weather: { hasWeatherData: true, rainExpected: true, heavyRainRisk: true, drySpellRisk: false, humidityPct: 60 },
    });
    const fertTasks = tasks.filter(t => t.id.includes('fertil'));
    for (const t of fertTasks) {
      expect(t.weatherNote).toContain('Heavy rain');
    }
  });

  it('boosts irrigation tasks when dry spell risk', () => {
    const tasks = generateTasksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'flowering', farmerType: 'new',
      weather: { hasWeatherData: true, rainExpected: false, heavyRainRisk: false, drySpellRisk: true, humidityPct: 40 },
    });
    const waterTasks = tasks.filter(t => t.id.includes('water'));
    for (const t of waterTasks) {
      expect(t.priority).toBe('high');
      expect(t.weatherNote).toContain('Dry spell');
    }
  });

  it('boosts pest tasks when humidity is high during vegetative stage', () => {
    const tasks = generateTasksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
      weather: { hasWeatherData: true, rainExpected: false, heavyRainRisk: false, drySpellRisk: false, humidityPct: 90 },
    });
    const pestTasks = tasks.filter(t => t.id.includes('pest'));
    for (const t of pestTasks) {
      expect(t.priority).toBe('high');
      expect(t.weatherNote).toContain('humidity');
    }
  });

  it('does not add weather notes when no weather data', () => {
    const tasks = generateTasksForFarm({
      farmId: 'f1', crop: 'maize', stage: 'vegetative', farmerType: 'new',
    });
    for (const t of tasks) {
      expect(t.weatherNote).toBeUndefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════
//  9. Farm tasks route — weather integration
// ═══════════════════════════════════════════════════════════
describe('Farm tasks route — weather', () => {
  const route = readFile('server/routes/farmTasks.js');

  it('imports getWeatherForFarm', () => {
    expect(route).toContain('getWeatherForFarm');
  });

  it('fetches weather for the farm', () => {
    expect(route).toContain('getWeatherForFarm(farm)');
  });

  it('passes weather to generateTasksForFarm', () => {
    expect(route).toContain('weather: weatherCtx');
  });

  it('returns weather in response', () => {
    expect(route).toContain('weather: weatherCtx');
  });

  it('handles weather fetch failure gracefully', () => {
    expect(route).toContain('non-blocking');
  });

  it('selects farm location fields', () => {
    expect(route).toContain('latitude: true');
    expect(route).toContain('longitude: true');
    expect(route).toContain('country: true');
    expect(route).toContain('locationName: true');
  });
});

// ═══════════════════════════════════════════════════════════
// 10. Frontend API
// ═══════════════════════════════════════════════════════════
describe('Frontend API — farm weather', () => {
  const api = readFile('src/lib/api.js');

  it('exports getFarmWeather', () => {
    expect(api).toContain('export function getFarmWeather');
  });

  it('calls /api/v2/farm-weather/ endpoint', () => {
    expect(api).toContain('/api/v2/farm-weather/');
  });
});

// ═══════════════════════════════════════════════════════════
// 11. FarmWeatherCard component
// ═══════════════════════════════════════════════════════════
describe('FarmWeatherCard component', () => {
  const card = readFile('src/components/FarmWeatherCard.jsx');

  it('imports getFarmWeather', () => {
    expect(card).toContain('getFarmWeather');
  });

  it('uses currentFarmId from profile context', () => {
    expect(card).toContain('currentFarmId');
  });

  it('has data-testid farm-weather-card', () => {
    expect(card).toContain('farm-weather-card');
  });

  it('displays temperature metric', () => {
    expect(card).toContain('temperatureC');
    expect(card).toContain('°C');
  });

  it('displays humidity metric', () => {
    expect(card).toContain('humidityPct');
  });

  it('displays rain forecast', () => {
    expect(card).toContain('rainForecastMm');
  });

  it('shows rain expected badge', () => {
    expect(card).toContain('rain-expected-badge');
    expect(card).toContain('rainExpected');
  });

  it('shows heavy rain risk badge', () => {
    expect(card).toContain('heavy-rain-badge');
    expect(card).toContain('heavyRainRisk');
  });

  it('shows dry spell risk badge', () => {
    expect(card).toContain('dry-spell-badge');
    expect(card).toContain('drySpellRisk');
  });

  it('shows condition text', () => {
    expect(card).toContain('weather.condition');
  });

  it('shows forecast date', () => {
    expect(card).toContain('forecastDate');
  });

  it('handles no-location state', () => {
    expect(card).toContain('noLocation');
    expect(card).toContain('farmWeather.noLocation');
  });

  it('clears weather on farm switch', () => {
    expect(card).toContain('prevFarmIdRef');
  });
});

// ═══════════════════════════════════════════════════════════
// 12. FarmTasksCard — weatherNote rendering
// ═══════════════════════════════════════════════════════════
describe('FarmTasksCard — weather note', () => {
  const card = readFile('src/components/FarmTasksCard.jsx');

  it('renders weatherNote when present', () => {
    expect(card).toContain('task.weatherNote');
  });

  it('has weatherNote style', () => {
    expect(card).toContain('weatherNote');
  });
});

// ═══════════════════════════════════════════════════════════
// 13. Dashboard — FarmWeatherCard wiring
// ═══════════════════════════════════════════════════════════
describe('Dashboard — FarmWeatherCard', () => {
  const dash = readFile('src/pages/Dashboard.jsx');

  it('imports FarmWeatherCard', () => {
    expect(dash).toContain("import FarmWeatherCard from '../components/FarmWeatherCard.jsx'");
  });

  it('renders FarmWeatherCard', () => {
    expect(dash).toContain('<FarmWeatherCard');
  });
});

// ═══════════════════════════════════════════════════════════
// 14. App route registration
// ═══════════════════════════════════════════════════════════
describe('App route registration', () => {
  const app = readFile('server/src/app.js');

  it('imports farm weather routes', () => {
    expect(app).toContain('v2FarmWeatherRoutes');
  });

  it('mounts at /api/v2/farm-weather', () => {
    expect(app).toContain('/api/v2/farm-weather');
  });
});

// ═══════════════════════════════════════════════════════════
// 15. i18n — farm weather keys
// ═══════════════════════════════════════════════════════════
describe('i18n — farm weather keys', () => {
  const translations = readFile('src/i18n/translations.js');

  const requiredKeys = [
    'farmWeather.title',
    'farmWeather.loading',
    'farmWeather.noLocation',
    'farmWeather.temp',
    'farmWeather.humidity',
    'farmWeather.rain3d',
    'farmWeather.rainExpected',
    'farmWeather.heavyRainRisk',
    'farmWeather.drySpellRisk',
  ];

  for (const key of requiredKeys) {
    it(`has ${key}`, () => {
      expect(translations).toContain(`'${key}'`);
    });
  }

  it('has translations in all 5 languages for farmWeather.title', () => {
    const chunk = translations.slice(
      translations.indexOf("'farmWeather.title'"),
      translations.indexOf("'farmWeather.title'") + 300,
    );
    expect(chunk).toContain('en:');
    expect(chunk).toContain('fr:');
    expect(chunk).toContain('sw:');
    expect(chunk).toContain('ha:');
    expect(chunk).toContain('tw:');
  });
});
