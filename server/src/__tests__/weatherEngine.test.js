/**
 * weatherEngine.test.js — coverage for the three weather helpers
 * used by the Today engine:
 *
 *   getWeatherRisk(weather)           → risk bands + reasons
 *   adjustTasksForWeather(tasks, r)   → per-task priority bumps
 *   getWeatherAlerts(r)               → UI-ready short string list
 *   getWeatherBadge(r)                → level + i18n labelKey + color
 */
import { describe, it, expect } from 'vitest';
import {
  getWeatherRisk,
  WEATHER_CONFIG,
} from '../services/weather/weatherRiskEngine.js';
import { adjustTasksForWeather } from '../services/weather/adjustTasksForWeather.js';
import {
  getWeatherAlerts,
  getWeatherBadge,
} from '../services/weather/weatherAlerts.js';

// ─── getWeatherRisk ───────────────────────────────────────
describe('getWeatherRisk', () => {
  it('returns low everywhere for a calm forecast', () => {
    const r = getWeatherRisk({
      tempHighC: 24, tempLowC: 14,
      rainMmNext24h: 0, rainChancePct: 10,
      humidityPct: 50, windKph: 10,
    });
    expect(r.heatRisk).toBe('low');
    expect(r.rainRisk).toBe('low');
    expect(r.frostRisk).toBe('low');
    expect(r.humidityPestRisk).toBe('low');
    expect(r.windRisk).toBe('low');
    expect(r.overallWeatherRisk).toBe('low');
    expect(r.reasons).toEqual([]);
  });

  it('flags high heat when tempHighC ≥ config.heat.high', () => {
    const r = getWeatherRisk({ tempHighC: WEATHER_CONFIG.heat.high + 1 });
    expect(r.heatRisk).toBe('high');
    expect(r.overallWeatherRisk).toBe('high');
    expect(r.reasons.some((s) => /heat/i.test(s))).toBe(true);
  });

  it('flags high frost when tempLowC ≤ config.frost.high', () => {
    const r = getWeatherRisk({ tempLowC: WEATHER_CONFIG.frost.high - 1 });
    expect(r.frostRisk).toBe('high');
    expect(r.reasons.some((s) => /frost/i.test(s))).toBe(true);
  });

  it('flags high rain from either mm OR % — max wins', () => {
    const byMm = getWeatherRisk({ rainMmNext24h: WEATHER_CONFIG.rainMm.high });
    const byPct = getWeatherRisk({ rainChancePct: WEATHER_CONFIG.rainPct.high });
    expect(byMm.rainRisk).toBe('high');
    expect(byPct.rainRisk).toBe('high');
  });

  it('flags humidity and wind independently', () => {
    const r = getWeatherRisk({
      humidityPct: WEATHER_CONFIG.humidity.high,
      windKph: WEATHER_CONFIG.windKph.high,
    });
    expect(r.humidityPestRisk).toBe('high');
    expect(r.windRisk).toBe('high');
  });

  it('overallWeatherRisk is the max band across components', () => {
    const r = getWeatherRisk({
      tempHighC: WEATHER_CONFIG.heat.medium,      // medium
      rainMmNext24h: WEATHER_CONFIG.rainMm.high,  // high
    });
    expect(r.overallWeatherRisk).toBe('high');
  });

  it('tolerates missing/non-finite inputs gracefully', () => {
    const r = getWeatherRisk({});
    expect(r.overallWeatherRisk).toBe('low');
    expect(Array.isArray(r.reasons)).toBe(true);
  });
});

// ─── adjustTasksForWeather ────────────────────────────────
const mkTask = (o = {}) => ({
  id: 't' + Math.random().toString(36).slice(2, 8),
  title: 'Water the rows',
  priority: 'medium',
  priorityScore: 50,
  detail: null,
  ...o,
});

describe('adjustTasksForWeather', () => {
  it('returns the input untouched when risks is null', () => {
    const tasks = [mkTask()];
    const out = adjustTasksForWeather(tasks, null);
    expect(out).toBe(tasks);
  });

  it('never mutates the caller array', () => {
    const tasks = [mkTask({ title: 'Water rows' })];
    const before = JSON.stringify(tasks);
    adjustTasksForWeather(tasks, { rainRisk: 'high' });
    expect(JSON.stringify(tasks)).toBe(before);
  });

  it('dampens watering when heavy rain is expected', () => {
    const tasks = [mkTask({ title: 'Water the rows', priorityScore: 60, priority: 'high' })];
    const [out] = adjustTasksForWeather(tasks, { rainRisk: 'high' });
    expect(out.priorityScore).toBeLessThan(60);
    expect(out.weatherContext).toMatch(/rain/i);
  });

  it('boosts watering when heat is high', () => {
    const tasks = [mkTask({ title: 'Water the rows', priorityScore: 50 })];
    const [out] = adjustTasksForWeather(tasks, { heatRisk: 'high' });
    expect(out.priorityScore).toBeGreaterThan(50);
    expect(out.priority).toBe('high');
  });

  it('delays planting when rain is heavy', () => {
    const tasks = [mkTask({ title: 'Plant tomatoes', priorityScore: 70, priority: 'high' })];
    const [out] = adjustTasksForWeather(tasks, { rainRisk: 'high' });
    expect(out.priorityScore).toBeLessThan(70);
    expect(out.weatherContext).toMatch(/hold off|rain/i);
  });

  it('accelerates harvest before rain', () => {
    const tasks = [mkTask({ title: 'Harvest beans', priorityScore: 40 })];
    const [out] = adjustTasksForWeather(tasks, { rainRisk: 'high' });
    expect(out.priorityScore).toBeGreaterThan(40);
  });

  it('boosts pest scouting when humidity is high', () => {
    const tasks = [mkTask({ title: 'Scout for pests', priorityScore: 40 })];
    const [out] = adjustTasksForWeather(tasks, { humidityPestRisk: 'high' });
    expect(out.priorityScore).toBeGreaterThan(40);
  });

  it('skips spraying when wind is high', () => {
    const tasks = [mkTask({ title: 'Spray fungicide', priorityScore: 55 })];
    const [out] = adjustTasksForWeather(tasks, { windRisk: 'high' });
    expect(out.priorityScore).toBeLessThan(55);
    expect(out.weatherContext).toMatch(/windy|wind/i);
  });

  it('boosts staking when wind is high', () => {
    const tasks = [mkTask({ title: 'Stake tomatoes', priorityScore: 40 })];
    const [out] = adjustTasksForWeather(tasks, { windRisk: 'high' });
    expect(out.priorityScore).toBeGreaterThan(40);
  });

  it('leaves unrelated tasks alone', () => {
    const tasks = [mkTask({ title: 'Update records', priorityScore: 20 })];
    const [out] = adjustTasksForWeather(tasks, { rainRisk: 'high', heatRisk: 'high' });
    expect(out.priorityScore).toBe(20);
    expect(out.detail).toBeNull();
  });
});

// ─── getWeatherAlerts / getWeatherBadge ───────────────────
describe('getWeatherAlerts', () => {
  it('returns empty list for falsy input', () => {
    expect(getWeatherAlerts(null)).toEqual([]);
    expect(getWeatherAlerts({})).toEqual([]);
    expect(getWeatherAlerts({ reasons: null })).toEqual([]);
  });

  it('dedupes and caps at 3 reasons', () => {
    const r = { reasons: ['a', 'a', 'b', 'c', 'd', 'e'] };
    expect(getWeatherAlerts(r)).toEqual(['a', 'b', 'c']);
  });

  it('ignores empty/nullish entries', () => {
    const r = { reasons: ['', null, undefined, 'real alert'] };
    expect(getWeatherAlerts(r)).toEqual(['real alert']);
  });
});

describe('getWeatherBadge', () => {
  it('returns null for missing input', () => {
    expect(getWeatherBadge(null)).toBeNull();
  });

  it('maps levels to the right labelKey + color', () => {
    expect(getWeatherBadge({ overallWeatherRisk: 'high' })).toMatchObject({
      level: 'high', labelKey: 'weather.badge.high', color: '#EF4444',
    });
    expect(getWeatherBadge({ overallWeatherRisk: 'medium' })).toMatchObject({
      level: 'medium', labelKey: 'weather.badge.medium', color: '#F59E0B',
    });
    expect(getWeatherBadge({ overallWeatherRisk: 'low' })).toMatchObject({
      level: 'low', labelKey: 'weather.badge.low', color: '#22C55E',
    });
  });

  it('defaults missing level to low', () => {
    expect(getWeatherBadge({})).toMatchObject({ level: 'low' });
  });
});
