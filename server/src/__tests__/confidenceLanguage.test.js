/**
 * confidenceLanguage.test.js — pins the canonical phrase library.
 *
 *   1. The five spec phrases are the ONLY phrases that surface.
 *   2. Each orchestrator kind maps to a deterministic phrase.
 *   3. Forbidden wording (NDVI / percents / 'critical error' /
 *      'model confidence' / raw decimals) gets sanitised.
 *   4. Sanitisation preserves already-calm text unchanged.
 *   5. Falls back to 'Looks stable' (calmest default) on empty input.
 */

import { describe, it, expect } from 'vitest';
import {
  CALM_PHRASES,
  mapToCalmPhrase,
  sanitizeConfidenceWording,
  hasForbiddenWording,
  getCalmPhraseList,
} from '../../../src/lib/confidenceLanguage.js';

describe('CALM_PHRASES — the five spec phrases', () => {
  it('contains the exact five phrases the spec lists', () => {
    expect(CALM_PHRASES.MAY_NEED_ATTENTION).toBe('May need attention');
    expect(CALM_PHRASES.LOOKS_STABLE).toBe('Looks stable');
    expect(CALM_PHRASES.CHECK_AGAIN_TOMORROW).toBe('Check again tomorrow');
    expect(CALM_PHRASES.GOOD_TIME_TO_ACT).toBe('Good time to act');
    expect(CALM_PHRASES.CONDITIONS_CHANGED).toBe('Conditions changed');
  });

  it('is frozen', () => {
    expect(Object.isFrozen(CALM_PHRASES)).toBe(true);
  });

  it('getCalmPhraseList returns all five', () => {
    expect(getCalmPhraseList()).toHaveLength(5);
  });
});

describe('mapToCalmPhrase — orchestrator-kind mapping', () => {
  it('crop_health → May need attention', () => {
    expect(mapToCalmPhrase({ kind: 'crop_health' })).toBe(CALM_PHRASES.MAY_NEED_ATTENTION);
  });

  it('severe_weather → Conditions changed', () => {
    expect(mapToCalmPhrase({ kind: 'severe_weather' })).toBe(CALM_PHRASES.CONDITIONS_CHANGED);
  });

  it('urgent_task → Good time to act', () => {
    expect(mapToCalmPhrase({ kind: 'urgent_task' })).toBe(CALM_PHRASES.GOOD_TIME_TO_ACT);
  });

  it('scan_followup → Check again tomorrow', () => {
    expect(mapToCalmPhrase({ kind: 'scan_followup' })).toBe(CALM_PHRASES.CHECK_AGAIN_TOMORROW);
  });

  it('yield_risk → May need attention', () => {
    expect(mapToCalmPhrase({ kind: 'yield_risk' })).toBe(CALM_PHRASES.MAY_NEED_ATTENTION);
  });

  it('encouragement / fallback_walk → Looks stable', () => {
    expect(mapToCalmPhrase({ kind: 'encouragement' })).toBe(CALM_PHRASES.LOOKS_STABLE);
    expect(mapToCalmPhrase({ kind: 'fallback_walk' })).toBe(CALM_PHRASES.LOOKS_STABLE);
  });

  it('risk_high:fungal → May need attention (prefix match)', () => {
    expect(mapToCalmPhrase({ kind: 'risk_high:fungal' })).toBe(CALM_PHRASES.MAY_NEED_ATTENTION);
    expect(mapToCalmPhrase({ kind: 'risk_high:drought' })).toBe(CALM_PHRASES.MAY_NEED_ATTENTION);
  });

  it('risk_medium:* → Check again tomorrow (prefix match)', () => {
    expect(mapToCalmPhrase({ kind: 'risk_medium:drought' })).toBe(CALM_PHRASES.CHECK_AGAIN_TOMORROW);
  });
});

describe('mapToCalmPhrase — urgency fallback', () => {
  it('high urgency without known kind → May need attention', () => {
    expect(mapToCalmPhrase({ urgency: 'high' })).toBe(CALM_PHRASES.MAY_NEED_ATTENTION);
  });

  it('medium urgency + high confidence → Good time to act', () => {
    expect(mapToCalmPhrase({ urgency: 'medium', confidence: 'high' })).toBe(CALM_PHRASES.GOOD_TIME_TO_ACT);
  });

  it('medium urgency without high confidence → Check again tomorrow', () => {
    expect(mapToCalmPhrase({ urgency: 'medium', confidence: 'low' })).toBe(CALM_PHRASES.CHECK_AGAIN_TOMORROW);
  });

  it('low urgency → Looks stable', () => {
    expect(mapToCalmPhrase({ urgency: 'low' })).toBe(CALM_PHRASES.LOOKS_STABLE);
  });

  it('empty input → Looks stable (calmest default)', () => {
    expect(mapToCalmPhrase({})).toBe(CALM_PHRASES.LOOKS_STABLE);
    expect(mapToCalmPhrase(null)).toBe(CALM_PHRASES.LOOKS_STABLE);
  });
});

describe('hasForbiddenWording — flag technical/scary input', () => {
  it('flags NDVI literal', () => {
    expect(hasForbiddenWording('NDVI 0.42 indicates stress')).toBe(true);
  });

  it('flags percentages', () => {
    expect(hasForbiddenWording('73% confidence')).toBe(true);
    expect(hasForbiddenWording('Disease risk 85%')).toBe(true);
  });

  it("flags 'confidence: <num>' jargon", () => {
    expect(hasForbiddenWording('confidence: 0.85')).toBe(true);
  });

  it('flags critical-error language', () => {
    expect(hasForbiddenWording('Critical error detected')).toBe(true);
    expect(hasForbiddenWording('Fatal alert in progress')).toBe(true);
    expect(hasForbiddenWording('Severe condition observed')).toBe(true);
  });

  it('flags model jargon', () => {
    expect(hasForbiddenWording('Model output: positive')).toBe(true);
    expect(hasForbiddenWording('model confidence is medium')).toBe(true);
  });

  it('flags scary intensifiers', () => {
    expect(hasForbiddenWording('Dangerous outbreak')).toBe(true);
    expect(hasForbiddenWording('Catastrophic spread')).toBe(true);
  });

  it('flags raw decimals like 0.42', () => {
    expect(hasForbiddenWording('vegetation index 0.42')).toBe(true);
  });

  it('does NOT flag the five canonical phrases', () => {
    expect(hasForbiddenWording('May need attention')).toBe(false);
    expect(hasForbiddenWording('Looks stable')).toBe(false);
    expect(hasForbiddenWording('Check again tomorrow')).toBe(false);
    expect(hasForbiddenWording('Good time to act')).toBe(false);
    expect(hasForbiddenWording('Conditions changed')).toBe(false);
  });

  it('does NOT flag calm explanatory text', () => {
    expect(hasForbiddenWording('Humidity is high, so fungal risk may increase.')).toBe(false);
    expect(hasForbiddenWording('Walk the field this morning.')).toBe(false);
  });
});

describe('sanitizeConfidenceWording — replace forbidden with calm', () => {
  it('passes calm text through unchanged', () => {
    expect(sanitizeConfidenceWording('May need attention')).toBe('May need attention');
    expect(sanitizeConfidenceWording('Walk the field today')).toBe('Walk the field today');
  });

  it('replaces NDVI jargon with the calmest default', () => {
    expect(sanitizeConfidenceWording('NDVI 0.42 indicates declining vegetation'))
      .toBe(CALM_PHRASES.LOOKS_STABLE);
  });

  it('uses the hint to pick a better replacement', () => {
    expect(sanitizeConfidenceWording(
      '73% confidence the model says critical error',
      { kind: 'crop_health' },
    )).toBe(CALM_PHRASES.MAY_NEED_ATTENTION);

    expect(sanitizeConfidenceWording(
      'Model confidence: 0.85',
      { kind: 'severe_weather' },
    )).toBe(CALM_PHRASES.CONDITIONS_CHANGED);
  });

  it('empty input returns empty string', () => {
    expect(sanitizeConfidenceWording('')).toBe('');
    expect(sanitizeConfidenceWording(null)).toBe('');
  });

  it('never throws on garbage', () => {
    expect(() => sanitizeConfidenceWording(42)).not.toThrow();
    expect(() => sanitizeConfidenceWording({ x: 1 })).not.toThrow();
  });
});

describe('sync with existing intelligence stack', () => {
  it('every kind the orchestrator emits maps cleanly', async () => {
    // The orchestrator's documented kinds, per its priority order.
    const knownKinds = [
      'crop_health',
      'severe_weather',
      'urgent_task',
      'scan_followup',
      'yield_risk',
      'market_opportunity',
      'buyer_opportunity',
      'funding_opportunity',
      'cooperative_opportunity',
      'encouragement',
      'fallback_walk',
      'health_urgent',
      'pattern_worsening',
      'risk_high:fungal',
      'risk_medium:drought',
    ];
    for (const k of knownKinds) {
      const phrase = mapToCalmPhrase({ kind: k });
      // Every kind resolves to one of the five canonical phrases.
      expect(Object.values(CALM_PHRASES)).toContain(phrase);
    }
  });
});
