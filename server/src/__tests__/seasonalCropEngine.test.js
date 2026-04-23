/**
 * seasonalCropEngine.test.js — locks the month/weather-aware crop
 * suitability engine + its integration with topCropEngine.
 */

import { describe, it, expect } from 'vitest';

import {
  evaluateSeasonalFit, _internal as seasonalInternal,
} from '../../../src/lib/recommendations/seasonalCropEngine.js';
import { recommendTopCrops } from '../../../src/lib/recommendations/topCropEngine.js';

// ─── Month-only classification ─────────────────────────────────
describe('evaluateSeasonalFit — month only', () => {
  it('Ghana + cassava + April → high', () => {
    const r = evaluateSeasonalFit({ cropId: 'cassava', country: 'GH', month: 4 });
    expect(r.seasonFit).toBe('high');
    expect(r.plantingMessage).toBe('seasonal.msg.goodTimeToPlant');
    expect(r.scoreAdjustment).toBeGreaterThan(0);
    expect(r.source).toBe('registry');
  });

  it('Ghana + cassava + January → lower fit than April', () => {
    const jan = evaluateSeasonalFit({ cropId: 'cassava', country: 'GH', month: 1 });
    const apr = evaluateSeasonalFit({ cropId: 'cassava', country: 'GH', month: 4 });
    expect(apr.scoreAdjustment).toBeGreaterThan(jan.scoreAdjustment);
  });

  it('India + rice + July → high', () => {
    const r = evaluateSeasonalFit({ cropId: 'rice', country: 'IN', month: 7 });
    expect(r.seasonFit).toBe('high');
  });

  it('US + cassava + January → low', () => {
    const r = evaluateSeasonalFit({ cropId: 'cassava', country: 'US', month: 1 });
    expect(r.seasonFit).toBe('low');
    expect(r.scoreAdjustment).toBeLessThan(0);
    expect(['seasonal.msg.usuallyPlantedLater', 'seasonal.msg.betterAnotherSeason'])
      .toContain(r.plantingMessage);
  });

  it('tolerates month 0 or 13 (modulo-normalised)', () => {
    expect(evaluateSeasonalFit({ cropId: 'cassava', country: 'GH', month: 13 }).seasonFit)
      .toBe(evaluateSeasonalFit({ cropId: 'cassava', country: 'GH', month: 1 }).seasonFit);
  });
});

// ─── Weather adjustments (rainfall-aware layer) ────────────────
describe('evaluateSeasonalFit — rainfall-aware', () => {
  it('dry weather on a water-heavy crop (rice) demotes to low', () => {
    // Rice needs standing water; a dry reading flips it to low with
    // a water-stress risk chip regardless of seasonal month fit.
    const r = evaluateSeasonalFit({
      cropId: 'rice', country: 'IN', month: 7,
      weather: { pattern: 'dry_conditions' },
    });
    expect(r.seasonFit).toBe('low');
    expect(r.rainfallFit).toBe('low');
    expect(r.riskMessage).toBe('rainfall.risk.waterStress');
    expect(r.plantingMessage).toMatch(/^rainfall\./);
  });

  it('moderate rain on a rain-loving crop (cassava) stays supportive', () => {
    const r = evaluateSeasonalFit({
      cropId: 'cassava', country: 'GH', month: 4,
      weather: { pattern: 'moderate_rain' },
    });
    expect(r.seasonFit).toBe('high');
    expect(r.rainfallFit).toBe('high');
    expect(r.reasons).toContain('rainfall.reason.rainSupportsCrop');
  });

  it('heavy rain on a dry-lover (tomato) demotes fit to low', () => {
    const base = evaluateSeasonalFit({
      cropId: 'tomato', country: 'GH', month: 10,
    });
    expect(base.seasonFit).toBe('high');
    const wet = evaluateSeasonalFit({
      cropId: 'tomato', country: 'GH', month: 10,
      weather: { pattern: 'high_rain' },
    });
    expect(wet.seasonFit).toBe('low');
    expect(wet.rainfallFit).toBe('low');
    expect(wet.riskMessage).toBe('rainfall.risk.floodOrRootRot');
  });

  it('cassava tolerates dry — no rainfall demotion', () => {
    const r = evaluateSeasonalFit({
      cropId: 'cassava', country: 'GH', month: 4,
      weather: { pattern: 'dry_conditions' },
    });
    // Cassava is drought-tolerant: rainfall path returns medium, the
    // combined fit stays high since the month was already high.
    expect(r.seasonFit).toBe('high');
    expect(r.rainfallFit).toBe('medium');
  });

  it('no weather → no rainfall effect', () => {
    const a = evaluateSeasonalFit({ cropId: 'maize', country: 'GH', month: 4 });
    const b = evaluateSeasonalFit({ cropId: 'maize', country: 'GH', month: 4, weather: null });
    expect(a.scoreAdjustment).toBe(b.scoreAdjustment);
    expect(a.weatherAdjusted).toBe(false);
    expect(b.weatherAdjusted).toBe(false);
    expect(a.rainfallFit).toBe('unknown');
  });
});

// ─── Fallbacks ─────────────────────────────────────────────────
describe('evaluateSeasonalFit — fallbacks', () => {
  it('missing country → global default is used', () => {
    const r = evaluateSeasonalFit({ cropId: 'maize', month: 4 });
    expect(['high', 'medium', 'low']).toContain(r.seasonFit);
    expect(r.source).toBe('registry');
  });

  it('missing crop id → unknown + safe message', () => {
    const r = evaluateSeasonalFit({ country: 'GH', month: 4 });
    expect(r.seasonFit).toBe('unknown');
    expect(r.plantingMessage).toBe('seasonal.msg.suitableManyRegions');
    expect(r.scoreAdjustment).toBe(0);
  });

  it('unknown crop id → fallback message + zero adjustment', () => {
    const r = evaluateSeasonalFit({ cropId: 'unobtainium', country: 'GH', month: 4 });
    expect(r.seasonFit).toBe('unknown');
    // Either generic fallback is acceptable — both are safe,
    // language-neutral strings pointing the UI at "no data".
    expect(['seasonal.msg.checkLocalConditions', 'seasonal.msg.suitableManyRegions'])
      .toContain(r.plantingMessage);
    expect(r.scoreAdjustment).toBe(0);
  });

  it('crop with no seasonality data → unknown, never throws', () => {
    // Pineapple has a registry entry but no cropSeasonality data in v1.
    expect(() =>
      evaluateSeasonalFit({ cropId: 'pineapple', country: 'GH', month: 4 })
    ).not.toThrow();
    const r = evaluateSeasonalFit({ cropId: 'pineapple', country: 'GH', month: 4 });
    expect(r.seasonFit).toBe('unknown');
  });

  it('plantingMessage is always a translation key (no hardcoded English)', () => {
    for (const m of [1, 4, 7, 10]) {
      const r = evaluateSeasonalFit({ cropId: 'cassava', country: 'GH', month: m });
      expect(r.plantingMessage).toMatch(/^seasonal\./);
    }
  });
});

// ─── Integration with topCropEngine ────────────────────────────
describe('topCropEngine integration', () => {
  it('ranking changes when month changes (GH)', () => {
    const april = recommendTopCrops({
      country: 'GH', farmType: 'small_farm', farmerExperienceLevel: 'beginner',
      month: 4,
    });
    const december = recommendTopCrops({
      country: 'GH', farmType: 'small_farm', farmerExperienceLevel: 'beginner',
      month: 12,
    });
    // Scores for the same crop should differ between months when the
    // crop has seasonality data.
    const cassavaApr = april.all.find((c) => c.cropId === 'cassava');
    const cassavaDec = december.all.find((c) => c.cropId === 'cassava');
    expect(cassavaApr.score).toBeGreaterThan(cassavaDec.score);
  });

  it('rec cards carry plantingMessage + seasonFit', () => {
    const out = recommendTopCrops({
      country: 'GH', farmType: 'small_farm', farmerExperienceLevel: 'beginner',
      month: 4,
    });
    expect(out.best.plantingMessage).toBeTruthy();
    expect(out.best.plantingMessage).toMatch(/^seasonal\./);
    expect(['high', 'medium', 'low', 'unknown']).toContain(out.best.seasonFit);
  });

  it('seasonFit=low adds a warning chip', () => {
    // Cassava in Ghana in November — out of both preferred and
    // acceptable planting windows, so the seasonal engine flags low.
    const out = recommendTopCrops({
      country: 'GH', farmType: 'small_farm', farmerExperienceLevel: 'beginner',
      month: 11,
    });
    const cassava = out.all.find((c) => c.cropId === 'cassava');
    expect(cassava).toBeTruthy();
    expect(cassava.warnings).toContain('topCrops.warning.outOfSeason');
    expect(cassava.seasonFit).toBe('low');
  });

  it('weather context feeds through the full pipeline', () => {
    const dry = recommendTopCrops({
      country: 'GH', farmType: 'small_farm', farmerExperienceLevel: 'beginner',
      month: 4, weather: { pattern: 'dry_conditions' },
    });
    const wet = recommendTopCrops({
      country: 'GH', farmType: 'small_farm', farmerExperienceLevel: 'beginner',
      month: 4, weather: { pattern: 'moderate_rain' },
    });
    const cassavaDry = dry.all.find((c) => c.cropId === 'cassava');
    const cassavaWet = wet.all.find((c) => c.cropId === 'cassava');
    expect(cassavaWet.score).toBeGreaterThanOrEqual(cassavaDry.score);
  });

  it('missing country still produces a full ranked list', () => {
    const out = recommendTopCrops({
      farmType: 'small_farm', farmerExperienceLevel: 'beginner', month: 4,
    });
    expect(out).toBeTruthy();
    expect(out.best.cropId).toBeTruthy();
  });
});

// ─── Internal invariants ───────────────────────────────────────
describe('internal invariants', () => {
  it('score adjustments follow the spec pattern (high > medium > 0 > low)', () => {
    const { ADJ } = seasonalInternal;
    expect(ADJ.high).toBeGreaterThan(ADJ.medium);
    expect(ADJ.medium).toBeGreaterThan(0);
    expect(ADJ.unknown).toBe(0);
    expect(ADJ.low).toBeLessThan(0);
  });
});
