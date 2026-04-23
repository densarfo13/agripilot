/**
 * rainfallFitEngine.test.js — locks the rainfall-aware intelligence
 * spec: canonical weather states, per-crop water profiles, combined
 * season+rainfall scoring, language-safe messaging, and ranking
 * changes when weather changes.
 */

import { describe, it, expect } from 'vitest';

import {
  getWeatherState, isRainfallState,
  _internal as wsInternal,
} from '../../../src/lib/weather/weatherState.js';
import {
  getRainfallFit, _internal as rfInternal,
} from '../../../src/lib/recommendations/rainfallFitEngine.js';
import { evaluateSeasonalFit } from '../../../src/lib/recommendations/seasonalCropEngine.js';
import { recommendTopCrops } from '../../../src/lib/recommendations/topCropEngine.js';

// ─── getWeatherState — 5-state normaliser ──────────────────────
describe('getWeatherState', () => {
  it('returns unknown for null / missing data', () => {
    expect(getWeatherState(null)).toBe('unknown');
    expect(getWeatherState(undefined)).toBe('unknown');
    expect(getWeatherState({})).toBe('unknown');
  });

  it('passes through canonical states', () => {
    for (const s of ['dry', 'light_rain', 'moderate_rain', 'heavy_rain']) {
      expect(getWeatherState({ state: s })).toBe(s);
    }
  });

  it('maps legacy patterns to canonical states', () => {
    expect(getWeatherState({ pattern: 'dry_conditions' })).toBe('dry');
    expect(getWeatherState({ pattern: 'high_rain' })).toBe('heavy_rain');
    expect(getWeatherState({ pattern: 'moderate_rain' })).toBe('moderate_rain');
  });

  it('bands raw mm into the right bucket (3-day window)', () => {
    expect(getWeatherState({ rain3d: 0 })).toBe('dry');
    expect(getWeatherState({ rain3d: 4 })).toBe('light_rain');
    expect(getWeatherState({ rain3d: 20 })).toBe('moderate_rain');
    expect(getWeatherState({ rain3d: 60 })).toBe('heavy_rain');
  });

  it('sums a forecast array', () => {
    expect(getWeatherState({ forecast: [
      { rainMm: 20 }, { rainMm: 15 }, { rainMm: 1 },
    ] })).toBe('heavy_rain');
  });

  it('accepts bare strings', () => {
    expect(getWeatherState('dry_conditions')).toBe('dry');
    expect(getWeatherState('moderate_rain')).toBe('moderate_rain');
  });

  it('never throws on garbage input', () => {
    expect(() => getWeatherState({ rain3d: NaN })).not.toThrow();
    expect(getWeatherState({ rain3d: NaN })).toBe('unknown');
  });

  it('isRainfallState only matches the four real rainfall states', () => {
    expect(isRainfallState('dry')).toBe(true);
    expect(isRainfallState('heavy_rain')).toBe(true);
    expect(isRainfallState('unknown')).toBe(false);
    expect(isRainfallState('foo')).toBe(false);
  });
});

// ─── getRainfallFit — per-crop water profile ───────────────────
describe('getRainfallFit', () => {
  it('cassava + moderate rain → high fit', () => {
    const r = getRainfallFit('cassava', 'moderate_rain');
    expect(r.rainfallFit).toBe('high');
    expect(r.scoreAdjustment).toBe(30);
    expect(r.plantingMessage).toBe('rainfall.msg.goodForCurrentRain');
  });

  it('cassava + heavy rain → low fit (sensitive)', () => {
    const r = getRainfallFit('cassava', 'heavy_rain');
    expect(r.rainfallFit).toBe('low');
    expect(r.scoreAdjustment).toBe(-25);
    expect(r.plantingMessage).toBe('rainfall.msg.heavyRainDamage');
    expect(r.riskMessage).toBe('rainfall.risk.floodOrRootRot');
    expect(r.taskHint).toBe('rainfall.task.checkDrainage');
  });

  it('cassava + dry → medium (drought tolerant)', () => {
    const r = getRainfallFit('cassava', 'dry');
    expect(r.rainfallFit).toBe('medium');
    expect(r.scoreAdjustment).toBe(10);
  });

  it('rice + heavy rain → high fit', () => {
    const r = getRainfallFit('rice', 'heavy_rain');
    expect(r.rainfallFit).toBe('high');
    expect(r.scoreAdjustment).toBe(30);
  });

  it('rice + dry → low fit with water stress risk', () => {
    const r = getRainfallFit('rice', 'dry');
    expect(r.rainfallFit).toBe('low');
    expect(r.riskMessage).toBe('rainfall.risk.waterStress');
    expect(r.taskHint).toBe('rainfall.task.planIrrigation');
  });

  it('tomato + heavy rain → low fit', () => {
    const r = getRainfallFit('tomato', 'heavy_rain');
    expect(r.rainfallFit).toBe('low');
    expect(r.scoreAdjustment).toBe(-25);
  });

  it('unknown state → unknown fit (no adjustment)', () => {
    const r = getRainfallFit('cassava', 'unknown');
    expect(r.rainfallFit).toBe('unknown');
    expect(r.scoreAdjustment).toBe(0);
  });

  it('unknown crop → fallback, zero adjustment', () => {
    const r = getRainfallFit('unobtainium', 'moderate_rain');
    expect(r.rainfallFit).toBe('unknown');
    expect(r.scoreAdjustment).toBe(0);
  });

  it('messages are always translation keys', () => {
    for (const state of ['dry', 'light_rain', 'moderate_rain', 'heavy_rain', 'unknown']) {
      const r = getRainfallFit('cassava', state);
      if (r.plantingMessage) expect(r.plantingMessage).toMatch(/^rainfall\./);
      if (r.riskMessage) expect(r.riskMessage).toMatch(/^rainfall\./);
      if (r.taskHint)   expect(r.taskHint).toMatch(/^rainfall\./);
    }
  });
});

// ─── Combined season + rainfall via evaluateSeasonalFit ────────
describe('evaluateSeasonalFit — rainfall dominates when present', () => {
  it('rainfall promotes cassava even when the month is acceptable-only', () => {
    const monthOnly = evaluateSeasonalFit({
      cropId: 'cassava', country: 'GH', month: 2,  // acceptable
    });
    const withRain = evaluateSeasonalFit({
      cropId: 'cassava', country: 'GH', month: 2,
      weather: { state: 'moderate_rain' },
    });
    expect(monthOnly.seasonFit).toBe('medium');
    expect(withRain.seasonFit).toBe('high');
    expect(withRain.scoreAdjustment).toBeGreaterThan(monthOnly.scoreAdjustment);
    expect(withRain.rainfallFit).toBe('high');
    expect(withRain.plantingMessage).toBe('rainfall.msg.goodForCurrentRain');
  });

  it('heavy rain demotes tomato from high month fit to low', () => {
    const dry = evaluateSeasonalFit({
      cropId: 'tomato', country: 'GH', month: 10,
    });
    const wet = evaluateSeasonalFit({
      cropId: 'tomato', country: 'GH', month: 10,
      weather: { state: 'heavy_rain' },
    });
    expect(dry.seasonFit).toBe('high');
    expect(wet.seasonFit).toBe('low');
    expect(wet.riskMessage).toBe('rainfall.risk.floodOrRootRot');
    expect(wet.taskHint).toBe('rainfall.task.checkDrainage');
  });

  it('no weather → rainfall layer is a no-op', () => {
    const r = evaluateSeasonalFit({ cropId: 'maize', country: 'GH', month: 4 });
    expect(r.rainfallFit).toBe('unknown');
    expect(r.weatherAdjusted).toBe(false);
  });

  it('unknown state (empty weather object) → no rainfall effect', () => {
    const r = evaluateSeasonalFit({
      cropId: 'maize', country: 'GH', month: 4,
      weather: {},
    });
    expect(r.rainfallFit).toBe('unknown');
  });

  it('rainfall messaging is always a translation key', () => {
    for (const state of ['dry', 'moderate_rain', 'heavy_rain']) {
      const r = evaluateSeasonalFit({
        cropId: 'rice', country: 'IN', month: 7,
        weather: { state },
      });
      expect(r.plantingMessage).toMatch(/^(rainfall|seasonal)\./);
    }
  });
});

// ─── Top Crops ranking responds to rainfall ────────────────────
describe('Top Crops — rainfall-aware ranking', () => {
  it('ranking changes when weather changes (GH, April)', () => {
    const moderate = recommendTopCrops({
      country: 'GH', farmType: 'small_farm', farmerExperienceLevel: 'beginner',
      month: 4, weather: { state: 'moderate_rain' },
    });
    const heavy = recommendTopCrops({
      country: 'GH', farmType: 'small_farm', farmerExperienceLevel: 'beginner',
      month: 4, weather: { state: 'heavy_rain' },
    });
    const cassavaModerate = moderate.all.find((c) => c.cropId === 'cassava');
    const cassavaHeavy    = heavy.all.find((c) => c.cropId === 'cassava');
    // Cassava scores MUCH higher with moderate rain than heavy rain.
    expect(cassavaModerate.score).toBeGreaterThan(cassavaHeavy.score + 25);
  });

  it('heavy rain context boosts rice over cassava', () => {
    const out = recommendTopCrops({
      country: 'GH', farmType: 'small_farm', farmerExperienceLevel: 'beginner',
      month: 6, weather: { state: 'heavy_rain' },
    });
    const rice    = out.all.find((c) => c.cropId === 'rice');
    const cassava = out.all.find((c) => c.cropId === 'cassava');
    expect(rice.score).toBeGreaterThan(cassava.score);
    expect(rice.rainfallFit).toBe('high');
    expect(cassava.rainfallFit).toBe('low');
  });

  it('dry context boosts drought-tolerant crops', () => {
    const out = recommendTopCrops({
      country: 'GH', farmType: 'small_farm', farmerExperienceLevel: 'beginner',
      month: 4, weather: { state: 'dry' },
    });
    // sorghum / millet / cassava tolerate dry — at least one surfaces.
    const droughtOk = out.all.filter(
      (c) => c.rainfallFit === 'medium'
          && ['cassava', 'sorghum', 'millet', 'groundnut'].includes(c.cropId));
    expect(droughtOk.length).toBeGreaterThan(0);
  });

  it('low rainfall fit produces a rainfall risk warning chip', () => {
    const out = recommendTopCrops({
      country: 'GH', farmType: 'small_farm', farmerExperienceLevel: 'beginner',
      month: 6, weather: { state: 'heavy_rain' },
    });
    const cassava = out.all.find((c) => c.cropId === 'cassava');
    expect(cassava.warnings).toContain('rainfall.risk.floodOrRootRot');
  });

  it('rec cards carry rainfallFit + weatherState + plantingMessage', () => {
    const out = recommendTopCrops({
      country: 'GH', month: 4, weather: { state: 'moderate_rain' },
      farmType: 'small_farm', farmerExperienceLevel: 'beginner',
    });
    expect(out.best.weatherState).toBe('moderate_rain');
    expect(['high', 'medium', 'low', 'unknown']).toContain(out.best.rainfallFit);
    expect(out.best.plantingMessage).toMatch(/^(rainfall|seasonal)\./);
  });
});

// ─── Safety nets ───────────────────────────────────────────────
describe('safety', () => {
  it('no weather falls back safely', () => {
    const out = recommendTopCrops({
      country: 'GH', month: 4,
    });
    expect(out.best.plantingMessage).toMatch(/^seasonal\./);
    expect(out.best.rainfallFit).toBe('unknown');
  });

  it('no country + no weather still works', () => {
    const out = recommendTopCrops({ month: 4 });
    expect(out).toBeTruthy();
    expect(out.best.cropId).toBeTruthy();
  });

  it('garbage weather input never crashes', () => {
    expect(() => recommendTopCrops({
      country: 'GH', month: 4, weather: { rain3d: NaN, tempC: 'hot' },
    })).not.toThrow();
  });
});

// ─── Internal invariants ───────────────────────────────────────
describe('internal invariants', () => {
  it('rainfall score weights follow spec §5 (+30 / +10 / -25)', () => {
    expect(rfInternal.ADJ.high).toBe(30);
    expect(rfInternal.ADJ.medium).toBe(10);
    expect(rfInternal.ADJ.low).toBe(-25);
    expect(rfInternal.ADJ.unknown).toBe(0);
  });

  it('weather aliases cover legacy patterns', () => {
    expect(wsInternal.PATTERN_ALIASES.dry_conditions).toBe('dry');
    expect(wsInternal.PATTERN_ALIASES.high_rain).toBe('heavy_rain');
  });
});
