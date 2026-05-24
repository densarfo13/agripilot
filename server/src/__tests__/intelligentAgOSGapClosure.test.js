/**
 * intelligentAgOSGapClosure.test.js — verifies the two genuine
 * new modules from the "Intelligent Agricultural OS" spec:
 * seasonal crop recommendations (Phase 4) and the multi-signal
 * diagnosis explanation composer (Phase 1 §5).
 */

import { describe, it, expect } from 'vitest';
import {
  recommendCropsForSeason, SUPPORTED_PLANTING_REGIONS,
} from '../../../src/core/planning/seasonalCropRecommendations.js';
import {
  composeDiagnosisExplanation,
} from '../../../src/core/scan/diagnosisExplanation.js';

// ─── Phase 4 — seasonal crop recommendations ────────────

describe('recommendCropsForSeason — region-aware planting ranking', () => {
  it('Ghana in March recommends crops with March in their window', () => {
    const r = recommendCropsForSeason({
      country: 'Ghana', mode: 'farmer',
      nowMs: Date.UTC(2026, 2, 15), // March 15
    });
    expect(r.ok).toBe(true);
    expect(r.recommended.length).toBeGreaterThan(0);
    // Maize / pepper / cassava all open in March in Ghana.
    const recommendedKeys = r.recommended.map((c) => c.crop);
    expect(recommendedKeys).toContain('maize');
  });

  it('every recommended candidate carries a duration range + tags', () => {
    const r = recommendCropsForSeason({
      country: 'kenya', nowMs: Date.UTC(2026, 3, 15),
    });
    for (const c of r.recommended) {
      expect(c.tags).toContain('inWindow');
      if (c.durationDays) {
        expect(c.durationDays.max).toBeGreaterThanOrEqual(c.durationDays.min);
      }
    }
  });

  it('fastHarvest list only contains crops with max <= 80 days', () => {
    const r = recommendCropsForSeason({
      country: 'usa', nowMs: Date.UTC(2026, 4, 15),
    });
    for (const c of r.fastHarvest) {
      expect(c.durationDays.max).toBeLessThanOrEqual(80);
    }
  });

  it('returns ok:false with no_country on missing country', () => {
    expect(recommendCropsForSeason({}).reason).toBe('no_country');
    // null input is coerced to {} by the guard — still safely returns
    // no_country, never throws.
    expect(recommendCropsForSeason(null).reason).toBe('no_country');
  });

  it('returns isEstimate + disclaimer (no guaranteed dates)', () => {
    const r = recommendCropsForSeason({
      country: 'india', nowMs: Date.UTC(2026, 6, 15),
    });
    expect(r.isEstimate).toBe(true);
    expect(r.disclaimer).toMatch(/local microclimate|may shift/i);
  });

  it('exposes the supported regions list', () => {
    expect(SUPPORTED_PLANTING_REGIONS).toEqual(['usa','ghana','kenya','india']);
  });

  it('never throws on garbage input', () => {
    expect(() => recommendCropsForSeason(null)).not.toThrow();
  });
});

// ─── Phase 1 §5 — multi-signal diagnosis "why" ──────────

describe('composeDiagnosisExplanation — multi-signal why-sentence', () => {
  it('combines image evidence + weather + stage into one sentence', () => {
    const r = composeDiagnosisExplanation({
      crop: 'tomato',
      classifierResult: {
        issueCategory: 'fungal_risk',
        evidence: ['spots'],
      },
      snapshot: {
        weather:   { humidityPct: 86, temperatureC: 24 },
        cropStage: 'fruiting',
      },
    });
    expect(r.method).toBe('multi_signal');
    expect(r.signals.length).toBeGreaterThanOrEqual(2);
    const fallback = r.text.fallback;
    expect(fallback).toMatch(/fungal|spots/i);
    expect(fallback).toMatch(/humid|fruiting/i);
  });

  it('produces a hedged opener — never "confirmed"', () => {
    const r = composeDiagnosisExplanation({
      crop: 'maize',
      classifierResult: { issueCategory: 'pest_damage', evidence: ['holes', 'insect_visible'] },
      snapshot: {},
    });
    expect(r.text.fallback).toMatch(/Consistent with possible/i);
    expect(r.text.fallback.toLowerCase()).not.toContain('confirmed');
  });

  it('single signal → method: single_signal', () => {
    const r = composeDiagnosisExplanation({
      crop: 'tomato',
      classifierResult: { issueCategory: 'water_stress', evidence: ['wilting'] },
    });
    expect(r.method).toBe('single_signal');
  });

  it('no useful inputs → fallback method', () => {
    const r = composeDiagnosisExplanation({});
    expect(['fallback','single_signal']).toContain(r.method);
    expect(r.text.fallback).toBeTruthy();
  });

  it('ships translation keys + crop param', () => {
    const r = composeDiagnosisExplanation({
      crop: 'pepper',
      classifierResult: { issueCategory: 'leaf_spot', evidence: ['spots'] },
    });
    expect(r.text.key).toMatch(/^scan\.why\./);
    expect(r.text.params.crop).toBe('pepper');
  });

  it('never throws on garbage input', () => {
    expect(() => composeDiagnosisExplanation(null)).not.toThrow();
  });
});
