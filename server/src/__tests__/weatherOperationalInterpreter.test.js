/**
 * weatherOperationalInterpreter.test.js — Operational Weather
 * Intelligence Refinement. Verifies the interpreter produces calm
 * operational insights, the right priority, mode-aware phrasing,
 * and a fully localizable message envelope.
 */

import { describe, it, expect } from 'vitest';
import {
  WEATHER_INSIGHT, SEVERITY,
  interpretWeather, pickPrimaryWeatherInsight, localizeWeatherMessage,
} from '../../../src/core/weather/weatherOperationalInterpreter.js';

// ─── Insight types ─────────────────────────────────────────

describe('interpretWeather — operational insights', () => {
  it('frost risk is the highest-severity insight', () => {
    const r = interpretWeather({ weather: { frostRiskTonight: true }, mode: 'gardener' });
    expect(r.primary.type).toBe(WEATHER_INSIGHT.FROST);
    expect(r.primary.severity).toBe(SEVERITY.HIGH);
  });

  it('high heat produces a HEAT_STRESS insight with water-early advice', () => {
    const r = interpretWeather({
      weather: { temperatureC: 35 }, crop: 'pepper', mode: 'gardener',
    });
    const heat = r.insights.find((i) => i.type === WEATHER_INSIGHT.HEAT_STRESS);
    expect(heat).toBeTruthy();
    expect(heat.localizedMessage.fallback).toMatch(/early|evening/i);
  });

  it('rain forecast >=70% suggests delaying watering', () => {
    const r = interpretWeather({
      weather: { rainProbability24hPct: 80 }, mode: 'gardener',
    });
    const w = r.insights.find((i) => i.type === WEATHER_INSIGHT.WATERING);
    expect(w).toBeTruthy();
    expect(w.localizedMessage.fallback).toMatch(/rain|delay/i);
  });

  it('already-rained today produces a "skip watering" insight', () => {
    const r = interpretWeather({ weather: { rainfallTodayMm: 12 } });
    const w = r.insights.find((i) => i.type === WEATHER_INSIGHT.WATERING);
    expect(w.localizedMessage.fallback).toMatch(/soaked|skip/i);
  });

  it('cool humid conditions produce a HUMIDITY_MOLD insight', () => {
    const r = interpretWeather({
      weather: { temperatureC: 22, humidityPct: 90 },
    });
    expect(r.insights.some((i) => i.type === WEATHER_INSIGHT.HUMIDITY_MOLD)).toBe(true);
  });

  it('a long dry spell produces a low-severity DROUGHT insight', () => {
    const r = interpretWeather({ weather: { daysSinceRain: 9 } });
    const d = r.insights.find((i) => i.type === WEATHER_INSIGHT.DROUGHT);
    expect(d).toBeTruthy();
    expect(d.severity).toBe(SEVERITY.LOW);
  });

  it('high wind without rain produces a SPRAY_TIMING insight', () => {
    const r = interpretWeather({ weather: { windKmh: 30 } });
    expect(r.insights.some((i) => i.type === WEATHER_INSIGHT.SPRAY_TIMING)).toBe(true);
  });

  it('harvest stage + dry window produces a HARVEST_TIMING insight', () => {
    const r = interpretWeather({
      cropStage: 'harvest', crop: 'maize',
      weather: { rainProbability24hPct: 10, windKmh: 8 },
      mode: 'farmer',
    });
    expect(r.insights.some((i) => i.type === WEATHER_INSIGHT.HARVEST_TIMING)).toBe(true);
  });

  it('no operational signals → calm CURRENT fallback only', () => {
    const r = interpretWeather({ weather: { temperatureC: 22 } });
    expect(r.insights.length).toBe(1);
    expect(r.insights[0].type).toBe(WEATHER_INSIGHT.CURRENT);
    expect(r.primary.type).toBe(WEATHER_INSIGHT.CURRENT);
  });
});

// ─── Mode-aware phrasing ───────────────────────────────────

describe('interpretWeather — farmer vs gardener phrasing', () => {
  it('farmer heat message uses "irrigate"', () => {
    const r = interpretWeather({
      weather: { temperatureC: 35 }, crop: 'maize', mode: 'farmer',
    });
    const heat = r.insights.find((i) => i.type === WEATHER_INSIGHT.HEAT_STRESS);
    expect(heat.localizedMessage.fallback).toMatch(/irrigate/i);
  });

  it('gardener heat message uses "water"', () => {
    const r = interpretWeather({
      weather: { temperatureC: 35 }, crop: 'basil', mode: 'gardener',
    });
    const heat = r.insights.find((i) => i.type === WEATHER_INSIGHT.HEAT_STRESS);
    expect(heat.localizedMessage.fallback).toMatch(/^High heat.*Water/i);
  });
});

// ─── Priority + Home single-card pick ──────────────────────

describe('pickPrimaryWeatherInsight — priority', () => {
  it('frost beats heat beats watering', () => {
    const r = interpretWeather({
      weather: {
        frostRiskTonight: true, temperatureC: 35, rainProbability24hPct: 80,
      },
    });
    expect(r.primary.type).toBe(WEATHER_INSIGHT.FROST);
  });

  it('pickPrimaryWeatherInsight directly on a list agrees', () => {
    const list = [
      { type: WEATHER_INSIGHT.WATERING,   severity: SEVERITY.NORMAL },
      { type: WEATHER_INSIGHT.FROST,      severity: SEVERITY.HIGH },
      { type: WEATHER_INSIGHT.DROUGHT,    severity: SEVERITY.LOW },
    ];
    expect(pickPrimaryWeatherInsight(list).type).toBe(WEATHER_INSIGHT.FROST);
    expect(pickPrimaryWeatherInsight([])).toBe(null);
    expect(pickPrimaryWeatherInsight(null)).toBe(null);
  });
});

// ─── Localization seam ────────────────────────────────────

describe('localizeWeatherMessage — translator + {crop} substitution', () => {
  it('every insight ships a translation key and English fallback', () => {
    const r = interpretWeather({
      weather: { frostRiskTonight: true, temperatureC: 35, humidityPct: 90, daysSinceRain: 9, windKmh: 30, rainProbability24hPct: 80, rainfallTodayMm: 0 },
    });
    for (const i of r.insights) {
      expect(i.localizedMessage.key).toMatch(/^weather\.msg\./);
      expect(typeof i.localizedMessage.fallback).toBe('string');
    }
  });

  it('falls back to English when no translator is supplied', () => {
    const r = interpretWeather({
      crop: 'maize', mode: 'farmer', weather: { temperatureC: 35 },
    });
    const text = localizeWeatherMessage(r.primary.localizedMessage);
    expect(text).toMatch(/maize/i);
  });

  it('uses the translator and substitutes {crop}', () => {
    const r = interpretWeather({
      crop: 'tomato', mode: 'gardener', weather: { temperatureC: 35 },
    });
    const fakeT = (key, fallback) =>
      key === r.primary.localizedMessage.key
        ? 'Forte chaleur. Arrosez {crop} tôt.'
        : fallback;
    expect(localizeWeatherMessage(r.primary.localizedMessage, fakeT))
      .toBe('Forte chaleur. Arrosez tomato tôt.');
  });

  it('never throws on garbage input — falls back to a calm CURRENT card', () => {
    expect(() => interpretWeather(null)).not.toThrow();
    expect(() => localizeWeatherMessage(null)).not.toThrow();
    const r = interpretWeather(null);
    expect(Array.isArray(r.insights)).toBe(true);
    expect(r.primary.type).toBe(WEATHER_INSIGHT.CURRENT);
  });
});

// ─── Notification refinement — single signal, not duplicates ─

describe('interpretWeather — calm output, no duplicates', () => {
  it('does not emit drought when rain is already in the forecast', () => {
    const r = interpretWeather({
      weather: { daysSinceRain: 15, rainProbability24hPct: 85 },
    });
    expect(r.insights.some((i) => i.type === WEATHER_INSIGHT.DROUGHT)).toBe(false);
    expect(r.insights.some((i) => i.type === WEATHER_INSIGHT.WATERING)).toBe(true);
  });

  it('does not emit spray-timing when rain is expected anyway', () => {
    const r = interpretWeather({
      weather: { windKmh: 35, rainProbability24hPct: 80 },
    });
    expect(r.insights.some((i) => i.type === WEATHER_INSIGHT.SPRAY_TIMING)).toBe(false);
  });
});
