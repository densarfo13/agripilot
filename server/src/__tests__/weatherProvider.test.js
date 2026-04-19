/**
 * weatherProvider.test.js — unit tests for the Open-Meteo wrapper.
 * Uses a mock `fetchImpl` so no real network request is ever made.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getWeatherForFarm,
  normalizeForecast,
  _clearCache,
} from '../services/weather/weatherProvider.js';

const SAMPLE_OPEN_METEO = {
  current: { relative_humidity_2m: 72 },
  daily: {
    temperature_2m_max: [38, 34],
    temperature_2m_min: [24, 22],
    precipitation_sum: [12, 8],
    precipitation_probability_max: [80, 40],
    wind_speed_10m_max: [22, 18],
  },
};

function mockFetchOk(body) {
  return async () => ({
    ok: true,
    status: 200,
    json: async () => body,
  });
}

function mockFetchFail(status = 500) {
  return async () => ({
    ok: false,
    status,
    json: async () => ({}),
  });
}

describe('normalizeForecast', () => {
  it('maps Open-Meteo daily + current into the risk-engine shape', () => {
    const n = normalizeForecast(SAMPLE_OPEN_METEO);
    expect(n.tempHighC).toBe(38);
    expect(n.tempLowC).toBe(24);
    expect(n.rainMmToday).toBe(12);
    expect(n.rainMmNext24h).toBe(20);  // 12 + 8
    expect(n.rainChancePct).toBe(80);
    expect(n.humidityPct).toBe(72);
    expect(n.windKph).toBe(22);
    expect(n.forecast.length).toBe(2);
  });

  it('returns null for nullish input', () => {
    expect(normalizeForecast(null)).toBeNull();
  });

  it('produces nulls for missing fields but still returns an object', () => {
    const n = normalizeForecast({ daily: {}, current: {} });
    expect(n).toBeTruthy();
    expect(n.tempHighC).toBeNull();
    expect(n.humidityPct).toBeNull();
  });
});

describe('getWeatherForFarm', () => {
  beforeEach(() => _clearCache());

  it('returns null when farm has no coordinates', async () => {
    const out = await getWeatherForFarm({});
    expect(out).toBeNull();
  });

  it('returns null when the fetch fails', async () => {
    const out = await getWeatherForFarm(
      { latitude: 10, longitude: 20 },
      { fetchImpl: mockFetchFail(503) },
    );
    expect(out).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    const out = await getWeatherForFarm(
      { latitude: 10, longitude: 20 },
      { fetchImpl: async () => { throw new Error('offline'); } },
    );
    expect(out).toBeNull();
  });

  it('returns a normalized payload on success', async () => {
    const out = await getWeatherForFarm(
      { latitude: 6.5, longitude: -0.2 },
      { fetchImpl: mockFetchOk(SAMPLE_OPEN_METEO) },
    );
    expect(out).toBeTruthy();
    expect(out.tempHighC).toBe(38);
    expect(out.rainMmNext24h).toBe(20);
  });

  it('caches results by rounded lat/lon', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return { ok: true, status: 200, json: async () => SAMPLE_OPEN_METEO };
    };
    await getWeatherForFarm({ latitude: 6.5, longitude: -0.2 }, { fetchImpl });
    await getWeatherForFarm({ latitude: 6.501, longitude: -0.199 }, { fetchImpl }); // same 2dp key
    expect(calls).toBe(1);
  });

  it('bypasses cache when asked', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return { ok: true, status: 200, json: async () => SAMPLE_OPEN_METEO };
    };
    await getWeatherForFarm({ latitude: 1, longitude: 1 }, { fetchImpl });
    await getWeatherForFarm({ latitude: 1, longitude: 1 }, { fetchImpl, bypassCache: true });
    expect(calls).toBe(2);
  });
});
