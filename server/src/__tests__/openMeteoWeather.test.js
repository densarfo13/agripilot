/**
 * openMeteoWeather.test.js — Open-Meteo fetcher + cache + fallback +
 * weather-aware daily task adjustments.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  openMeteoFetcher,
  createWeatherService,
  clearWeatherCache,
  summarizeWeather,
  STATUS,
  _internal,
} from '../../../src/lib/weather/weatherService.js';

import {
  generateDailyTasks, _internal as dtInternals,
} from '../../../src/lib/tasks/dailyTaskEngine.js';

function installLocalStorage() {
  const map = new Map();
  globalThis.window = {
    localStorage: {
      getItem:    (k) => map.has(k) ? map.get(k) : null,
      setItem:    (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      key:        (i) => Array.from(map.keys())[i] || null,
      get length() { return map.size; },
    },
  };
  return map;
}

// Typical Open-Meteo response fragment.
function fakeOpenMeteoJson({ tempC = 24, pastMm = [1, 2, 3, 0, 1, 2, 1], futureMm = [0, 0, 1, 2, 1, 0, 0] } = {}) {
  return {
    current: { temperature_2m: tempC },
    daily:   { precipitation_sum: [...pastMm, ...futureMm] },
    timezone: 'Europe/London',
  };
}

// ─── Fetcher mapping ─────────────────────────────────────────────
describe('openMeteoFetcher', () => {
  it('maps the response shape summarizeWeather expects', async () => {
    const r = await openMeteoFetcher({
      lat: 51.5, lng: -0.12,
      fetchJson: async () => fakeOpenMeteoJson(),
    });
    expect(r).toBeTruthy();
    expect(r.source).toBe('open-meteo');
    expect(r.tempC).toBe(24);
    expect(r.precip7dMm).toBe(10);      // sum of pastMm
    expect(r.forecast7dMm).toBe(4);     // sum of futureMm
  });

  it('returns null on malformed coords', async () => {
    expect(await openMeteoFetcher({ lat: NaN, lng: 0 })).toBeNull();
    expect(await openMeteoFetcher({ lat: 1, lng: null })).toBeNull();
  });

  it('returns null when network returns nothing', async () => {
    expect(await openMeteoFetcher({
      lat: 1, lng: 1, fetchJson: async () => null,
    })).toBeNull();
  });

  it('returns null when daily block is missing', async () => {
    expect(await openMeteoFetcher({
      lat: 1, lng: 1,
      fetchJson: async () => ({ current: { temperature_2m: 30 } }),
    })).toBeNull();
  });
});

// ─── summarizeWeather integration (classifies correctly) ─────────
describe('summarizeWeather — real-shape rollups', () => {
  it('classifies a dry-ahead pattern', () => {
    const fetched = { tempC: 29, precip7dMm: 40, forecast7dMm: 2 };
    const s = summarizeWeather(fetched);
    expect(s.status).toBe(STATUS.DRY_AHEAD);
    expect(s.cautions).toContain('dry_ahead');
  });

  it('classifies excessive heat over rainfall shortage', () => {
    const fetched = { tempC: 41, precip7dMm: 1, forecast7dMm: 0 };
    const s = summarizeWeather(fetched);
    expect(s.status).toBe(STATUS.EXCESSIVE_HEAT);
  });
});

// ─── Service + cache ─────────────────────────────────────────────
describe('createWeatherService — cache + fallback', () => {
  beforeEach(() => { installLocalStorage(); });
  afterEach(()  => { delete globalThis.window; });

  it('caches the response under the coord bucket (2-decimal)', async () => {
    let calls = 0;
    // Fetchers passed to createWeatherService return the already-
    // mapped shape (as openMeteoFetcher would). Values picked to
    // classify as OK.
    const ws = createWeatherService({
      fetcher: async () => { calls += 1;
        return { tempC: 24, precip7dMm: 30, forecast7dMm: 25 }; },
    });
    const first = await ws.getSummary({ lat: 51.500, lng: -0.120 });
    const again = await ws.getSummary({ lat: 51.501, lng: -0.121 }); // same bucket "51.50,-0.12"
    expect(first.status).toBe('ok');
    expect(again.status).toBe('ok');
    expect(again.source).toBe('cache');
    expect(calls).toBe(1);
  });

  it('bypass cache with { cache: false }', async () => {
    let calls = 0;
    const ws = createWeatherService({
      cache: false,
      fetcher: async () => { calls += 1;
        return { tempC: 24, precip7dMm: 30, forecast7dMm: 25 }; },
    });
    await ws.getSummary({ lat: 10, lng: 10 });
    await ws.getSummary({ lat: 10, lng: 10 });
    expect(calls).toBe(2);
  });

  it('fetcher throw → unavailable summary (no crash)', async () => {
    const ws = createWeatherService({
      fetcher: async () => { throw new Error('rate-limit'); },
    });
    const r = await ws.getSummary({ lat: 1, lng: 1 });
    expect(r.status).toBe(STATUS.UNAVAILABLE);
  });

  it('fetcher returns null → unavailable', async () => {
    const ws = createWeatherService({ fetcher: async () => null });
    expect((await ws.getSummary({ lat: 1, lng: 1 })).status).toBe(STATUS.UNAVAILABLE);
  });

  it('default fetcher is openMeteoFetcher (inspected via internals)', () => {
    expect(_internal.OPEN_METEO_ENDPOINT).toMatch(/open-meteo/);
  });

  it('clearWeatherCache drops all cached entries', async () => {
    const mapped = { tempC: 24, precip7dMm: 30, forecast7dMm: 25 };
    const ws = createWeatherService({ fetcher: async () => mapped });
    await ws.getSummary({ lat: 1, lng: 1 });
    await ws.getSummary({ lat: 2, lng: 2 });
    clearWeatherCache();
    // Next call must re-fetch (cache miss on both buckets).
    let calls = 0;
    const ws2 = createWeatherService({
      fetcher: async () => { calls += 1; return mapped; },
    });
    await ws2.getSummary({ lat: 1, lng: 1 });
    await ws2.getSummary({ lat: 2, lng: 2 });
    expect(calls).toBe(2);
  });

  it('survives total absence of localStorage', async () => {
    delete globalThis.window;
    const ws = createWeatherService({
      fetcher: async () => ({ tempC: 24, precip7dMm: 30, forecast7dMm: 25 }),
    });
    const r = await ws.getSummary({ lat: 1, lng: 1 });
    expect(r.status).toBe('ok');
  });

  it('coord bucket rounds to 2 decimals', () => {
    expect(_internal.coordBucket(37.77492, -122.41913)).toBe('37.77,-122.42');
    expect(_internal.coordBucket(NaN, 0)).toBeNull();
  });
});

// ─── Weather-aware daily task adjustments ────────────────────────
describe('generateDailyTasks — weather overrides', () => {
  it('dry weather promotes monitor_moisture to today/high', () => {
    const r = generateDailyTasks({
      stage: 'mid_growth',
      weather: { status: 'low_rain', cautions: ['low_rain'] },
    });
    const monitor = [...r.today, ...r.thisWeek]
      .find((t) => t.id === 'mid.monitor_moisture');
    expect(monitor).toBeTruthy();
    expect(monitor.dueHint).toBe('today');
    expect(monitor.priority).toBe('high');
  });

  it('excessive heat promotes manage_water for rice mid_growth', () => {
    const r = generateDailyTasks({
      stage: 'mid_growth', crop: 'rice',
      weather: { status: 'excessive_heat', cautions: ['excessive_heat'] },
    });
    const water = [...r.today, ...r.thisWeek]
      .find((t) => t.id === 'mid.manage_water');
    expect(water.dueHint).toBe('today');
    expect(water.priority).toBe('high');
  });

  it('no weather signal → deterministic calendar behaviour', () => {
    const withW = generateDailyTasks({ stage: 'mid_growth' });
    const noW   = generateDailyTasks({ stage: 'mid_growth', weather: null });
    expect(noW.today.map((t) => t.id)).toEqual(withW.today.map((t) => t.id));
  });

  it('applyWeatherOverrides is pure + no-op on falsy weather', () => {
    const tasks = [{ id: 'mid.monitor_moisture', priority: 'medium', dueHint: 'this_week' }];
    expect(dtInternals.applyWeatherOverrides(tasks, null)).toEqual(tasks);
    expect(dtInternals.applyWeatherOverrides(tasks, undefined)).toEqual(tasks);
  });
});
