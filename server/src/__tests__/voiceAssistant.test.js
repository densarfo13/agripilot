/**
 * voiceAssistant.test.js — pins the §6 contract:
 *   1. routeIntent matches the 6 canonical farmer questions.
 *   2. Unknown questions → 'unknown' (caller can render fallback).
 *   3. answerForIntent composes from ctx fields, never invents.
 *   4. Lang code → BCP-47 mapping covers all 6 supported languages
 *      and falls through to English for unknown codes.
 *   5. answerForIntent never throws on missing context.
 *   6. routeIntent is punctuation- and case-insensitive.
 */

import { describe, it, expect } from 'vitest';
import {
  routeIntent,
  answerForIntent,
  INTENT_KEYWORDS,
} from '../../../src/lib/voiceAssistant.js';

describe('routeIntent — intent classification', () => {
  it('matches "what should I do today"', () => {
    expect(routeIntent('What should I do today?')).toBe('today');
    expect(routeIntent('whats today plan')).toBe('today');
  });

  it('matches "why are my leaves yellow"', () => {
    expect(routeIntent('Why are my leaves yellow?')).toBe('why_leaves');
    expect(routeIntent("what's wrong with my plants?")).toBe('why_leaves');
  });

  it('matches "when should I spray"', () => {
    expect(routeIntent('When should I spray?')).toBe('when_spray');
  });

  it('matches "when should I water"', () => {
    expect(routeIntent('When should I water?')).toBe('when_water');
    expect(routeIntent('any irrigation today?')).toBe('when_water');
  });

  it('matches weather risk questions', () => {
    expect(routeIntent('Is there any risk today?')).toBe('weather_risk');
    expect(routeIntent('weather today')).toBe('weather_risk');
  });

  it('matches farm health questions', () => {
    expect(routeIntent('How is my farm?')).toBe('farm_health');
    expect(routeIntent("how's my farm doing?")).toBe('farm_health');
  });

  it('returns "unknown" for off-topic questions', () => {
    expect(routeIntent('What is the meaning of life?')).toBe('unknown');
    expect(routeIntent('')).toBe('unknown');
    expect(routeIntent(null)).toBe('unknown');
  });

  it('is case- and punctuation-insensitive', () => {
    expect(routeIntent('WHAT SHOULD I DO TODAY??')).toBe('today');
    expect(routeIntent('when should i water...')).toBe('when_water');
  });

  it('exposes a frozen keyword map', () => {
    expect(Object.isFrozen(INTENT_KEYWORDS)).toBe(true);
  });
});

describe('answerForIntent — answer composition', () => {
  it('answers "today" from the briefing lines + top action', () => {
    const r = answerForIntent('today', {
      briefing: { lines: ['Watch for fungal pressure.', '2 tasks waiting.'] },
      topAction: { task: { title: 'Spray copper on lower leaves' } },
    });
    expect(r.text).toContain('Watch for fungal pressure');
    expect(r.text).toContain('2 tasks waiting');
    expect(r.text).toContain('Spray copper');
    expect(r.intent).toBe('today');
  });

  it('falls back when briefing has no lines', () => {
    const r = answerForIntent('today', {});
    expect(r.text).toMatch(/Nothing urgent/);
  });

  it('answers "why_leaves" from the most recent scan', () => {
    const r = answerForIntent('why_leaves', {
      latestScan: {
        noticed: 'leaf rust',
        severity: 'medium',
        recommendations: ['Remove the worst-affected leaves and dispose of them.'],
      },
    });
    expect(r.text).toContain('leaf rust');
    expect(r.text).toContain('medium severity');
    expect(r.text).toContain('Remove the worst');
  });

  it('answers "when_spray" with fungal-risk action when one fires', () => {
    const r = answerForIntent('when_spray', {
      risks: [{ kind: 'fungal', level: 'high', headline: 'High humidity raises fungal risk.', action: 'Spray copper in the evening.' }],
    });
    expect(r.text).toContain('Spray copper');
  });

  it('answers "when_water" with drought-risk action when one fires', () => {
    const r = answerForIntent('when_water', {
      risks: [{ kind: 'drought', level: 'medium', headline: '8 days without rain.', action: 'Water in the early morning.' }],
    });
    expect(r.text).toContain('Water in the early morning');
  });

  it('answers "weather_risk" with the top medium/high risk', () => {
    const r = answerForIntent('weather_risk', {
      risks: [
        { kind: 'fungal', level: 'low' },
        { kind: 'heat',   level: 'high', headline: 'Heatwave incoming.', action: 'Shade transplants.' },
      ],
    });
    expect(r.text).toContain('Heatwave incoming');
    expect(r.text).toContain('Shade transplants');
  });

  it('answers "farm_health" with the score + band sentence', () => {
    const r = answerForIntent('farm_health', {
      healthScore: { score: 72, band: 'good', factors: [] },
    });
    expect(r.text).toContain('72 out of 100');
    expect(r.text.toLowerCase()).toContain('mostly healthy');
  });

  it('answers "unknown" with the canonical try-asking fallback', () => {
    const r = answerForIntent('unknown', {});
    expect(r.text).toMatch(/I can answer/);
  });

  it('maps Twi → en-GH (honest fallback) and Hindi → hi-IN', () => {
    expect(answerForIntent('today', { lang: 'tw' }).lang).toBe('en-GH');
    expect(answerForIntent('today', { lang: 'hi' }).lang).toBe('hi-IN');
    expect(answerForIntent('today', { lang: 'fr' }).lang).toBe('fr-FR');
    expect(answerForIntent('today', { lang: 'xx' }).lang).toBe('en-US');
  });

  it('never throws on null / missing context', () => {
    expect(() => answerForIntent('today', null)).not.toThrow();
    expect(() => answerForIntent('why_leaves', undefined)).not.toThrow();
    expect(() => answerForIntent('unknown')).not.toThrow();
  });
});
