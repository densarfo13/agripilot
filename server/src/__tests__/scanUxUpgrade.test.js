/**
 * scanUxUpgrade.test.js — Scan UX upgrade seams. Verifies the
 * pure modules the UI layer will adopt: confidence wording,
 * live framing hints, result colour tokens, and operational
 * enrichment lines.
 */

import { describe, it, expect } from 'vitest';
import {
  wordingForConfidence, retakeTipsFor,
} from '../../../src/core/scan/scanConfidenceWording.js';
import {
  framingHintFor, FRAMING_HINTS,
} from '../../../src/core/scan/liveFramingAssist.js';
import {
  resultTone, colorTokenFor, RESULT_TONE,
} from '../../../src/core/scan/scanResultColors.js';
import {
  enrichScanResult,
} from '../../../src/core/scan/scanResultEnrichment.js';

// ─── §6 — calm confidence wording ────────────────────────

describe('wordingForConfidence — calm, actionable copy', () => {
  it('never returns the bare phrase "low confidence"', () => {
    for (const tier of ['high', 'medium', 'low', 'needs_review']) {
      const ux = wordingForConfidence({ tier });
      expect(ux.headline.fallback.toLowerCase()).not.toContain('low confidence');
      expect(ux.subline.fallback.toLowerCase()).not.toContain('low confidence');
    }
  });

  it('low tier explains why and offers tips', () => {
    const ux = wordingForConfidence({ tier: 'low', reasons: ['blurry', 'too_dark'] });
    expect(ux.headline.fallback).toMatch(/clearer/i);
    expect(ux.retakeTips.length).toBeGreaterThanOrEqual(2);
    // Should include the blur-fix tip.
    const text = ux.retakeTips.map((t) => t.fallback).join(' ');
    expect(text).toMatch(/steady|closer/i);
  });

  it('high tier still gets at least one tip', () => {
    const ux = wordingForConfidence({ tier: 'high' });
    expect(ux.retakeTips.length).toBeGreaterThanOrEqual(1);
  });

  it('never throws on garbage input', () => {
    expect(() => wordingForConfidence(null)).not.toThrow();
    expect(wordingForConfidence(null).tier).toBe('low');
  });
});

// ─── §2 — live framing assist ─────────────────────────────

describe('framingHintFor — at most one calm hint', () => {
  it('returns null when signals are healthy', () => {
    expect(framingHintFor({ brightness: 0.6, sharpness: 0.7, subjectArea: 0.5, subjectOffset: 0.1 }))
      .toEqual({ message: { ...FRAMING_HINTS.GOOD_LIGHT }, tone: 'positive' });
  });

  it('blur trumps everything else', () => {
    const h = framingHintFor({ brightness: 0.5, sharpness: 0.2, subjectArea: 0.5 });
    expect(h.message.key).toBe('scan.framing.steady');
    expect(h.tone).toBe('caution');
  });

  it('low light fires when not blurred', () => {
    const h = framingHintFor({ brightness: 0.1, sharpness: 0.8 });
    expect(h.message.key).toBe('scan.framing.low_light');
  });

  it('bright glare fires at extremes', () => {
    const h = framingHintFor({ brightness: 0.99, sharpness: 0.8 });
    expect(h.message.key).toBe('scan.framing.bright');
  });

  it('move closer fires for small subject', () => {
    const h = framingHintFor({ brightness: 0.6, sharpness: 0.8, subjectArea: 0.10 });
    expect(h.message.key).toBe('scan.framing.closer');
  });

  it('returns null on null / empty signals', () => {
    expect(framingHintFor(null)).toBe(null);
    expect(framingHintFor({})).toBe(null);
  });
});

// ─── §5 — semantic colour tokens ─────────────────────────

describe('resultTone + colorTokenFor', () => {
  it('healthy issue → healthy tone', () => {
    expect(resultTone({ issueCategory: 'healthy' })).toBe(RESULT_TONE.HEALTHY);
  });

  it('fungal_risk → critical tone (chemical-risk class)', () => {
    expect(resultTone({ issueCategory: 'fungal_risk' })).toBe(RESULT_TONE.CRITICAL);
  });

  it('water_stress → caution tone even with high confidence', () => {
    expect(resultTone({ issueCategory: 'water_stress', confidenceLabel: 'high' }))
      .toBe(RESULT_TONE.CAUTION);
  });

  it('pest_damage at high confidence escalates to critical', () => {
    expect(resultTone({ issueCategory: 'pest_damage', confidenceLabel: 'high' }))
      .toBe(RESULT_TONE.CRITICAL);
  });

  it('colorTokenFor returns palette tokens', () => {
    const t = colorTokenFor(RESULT_TONE.CAUTION);
    expect(t.tone).toBe('caution');
    expect(typeof t.accent).toBe('string');
    expect(typeof t.surface).toBe('string');
  });

  it('never throws on garbage input', () => {
    expect(() => resultTone(null)).not.toThrow();
    expect(resultTone(null)).toBe(RESULT_TONE.CAUTION);
    expect(colorTokenFor('xyz').tone).toBe('caution');
  });
});

// ─── §7 — operational enrichment ─────────────────────────

describe('enrichScanResult — operational tie-in lines', () => {
  it('returns the four-key shape, never throws on bad input', () => {
    const r = enrichScanResult(null);
    expect(r).toHaveProperty('weather');
    expect(r).toHaveProperty('lifecycle');
    expect(r).toHaveProperty('watering');
    expect(r).toHaveProperty('harvest');
  });

  it('humid + fungal_risk → weather humid_fungal line', () => {
    const r = enrichScanResult({
      crop: 'tomato',
      classifierResult: { issueCategory: 'fungal_risk' },
      snapshot: { weather: { humidityPct: 88 } },
    });
    expect(r.weather.fallback).toMatch(/humidity|leaf stress/i);
    expect(r.watering.fallback).toMatch(/at the base/i);
  });

  it('hot + water_stress → "water early to ease stress"', () => {
    const r = enrichScanResult({
      crop: 'maize',
      classifierResult: { issueCategory: 'water_stress' },
      snapshot: { weather: { temperatureC: 34 } },
    });
    expect(r.weather.fallback).toMatch(/heat|water.*early/i);
    expect(r.watering.fallback).toMatch(/today/i);
  });

  it('rain forecast → skip watering tie-in', () => {
    const r = enrichScanResult({
      crop: 'pepper',
      classifierResult: { issueCategory: 'healthy' },
      snapshot: { weather: { rainProbability24hPct: 90 } },
    });
    expect(r.weather.fallback).toMatch(/rain/i);
  });

  it('lifecycle stage line maps from snapshot.cropStage', () => {
    const r = enrichScanResult({
      crop: 'tomato',
      snapshot: { cropStage: 'flowering' },
    });
    expect(r.lifecycle.fallback).toMatch(/flowering|steady/i);
  });

  it('harvest stage gets a harvest tie-in', () => {
    const r = enrichScanResult({
      crop: 'tomato',
      snapshot: { cropStage: 'harvest_ready' },
    });
    expect(r.harvest.fallback).toMatch(/harvest/i);
  });

  it('emits null lines when nothing applies — no fake context', () => {
    const r = enrichScanResult({
      crop: 'tomato',
      classifierResult: { issueCategory: 'healthy' },
      snapshot: { weather: { temperatureC: 22, humidityPct: 50 } },
    });
    expect(r.weather).toBe(null);
    expect(r.watering).toBe(null);
    expect(r.harvest).toBe(null);
  });
});
