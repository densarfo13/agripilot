/**
 * dailyDecisionAssistant.test.js — Daily Decision Assistant.
 * Verifies the "what should I do today?" composition layer:
 * ranks candidates from lifecycle / weather / watering / scan,
 * picks ONE, and tailors wording to experience level.
 */

import { describe, it, expect } from 'vitest';
import {
  computeDailyDecision, EXPERIENCE_LEVEL, CONFIDENCE_TONE,
} from '../../../src/core/lifecycle/dailyDecisionAssistant.js';

const NOW = Date.UTC(2026, 4, 22);

// ─── Single primary action — Home one-card rule ─────────

describe('computeDailyDecision — exactly one primary action', () => {
  it('returns a single bestAction envelope with title + reason', () => {
    const d = computeDailyDecision({
      crop: 'tomato',
      weather: { temperatureC: 24, rainProbability24hPct: 10 },
      experienceLevel: 'new',
      nowMs: NOW,
    });
    expect(d).toBeTruthy();
    expect(d.bestAction).toBeTruthy();
    expect(typeof d.bestAction.type).toBe('string');
    expect(d.bestAction.title.key).toMatch(/^daily\.title\./);
    expect(typeof d.reason.fallback).toBe('string');
    expect(['gentle','firm','urgent']).toContain(d.confidenceTone);
  });
});

// ─── Priority — urgent scan beats everything ────────────

describe('computeDailyDecision — priority order', () => {
  it('urgent scan follow-up beats weather and watering', () => {
    const d = computeDailyDecision({
      crop: 'tomato',
      weather: { temperatureC: 34, daysSinceRain: 9 },
      scanHistory: [{ issueCategory: 'fungal_risk' }],
      experienceLevel: 'experienced',
      nowMs: NOW,
    });
    expect(d.bestAction.type).toBe('urgent_scan_followup');
    expect(d.urgency).toBe('high');
    expect(d.confidenceTone).toBe(CONFIDENCE_TONE.URGENT);
  });

  it('frost weather beats routine watering when no scan stress', () => {
    const d = computeDailyDecision({
      crop: 'tomato',
      weather: { frostRiskTonight: true, temperatureC: 4 },
      experienceLevel: 'new',
      nowMs: NOW,
    });
    expect(d.bestAction.type).toBe('weather_risk');
    expect(d.urgency).toBe('high');
  });

  it('long dry spell with no other signals → watering decision', () => {
    const d = computeDailyDecision({
      crop: 'maize', mode: 'farmer',
      weather: { temperatureC: 28, daysSinceRain: 9 },
      experienceLevel: 'experienced',
      nowMs: NOW,
    });
    expect(['watering', 'weather_risk', 'crop_stage_task']).toContain(d.bestAction.type);
  });

  it('no signals + no crop → calm planning / routine outcome', () => {
    const d = computeDailyDecision({ experienceLevel: 'new', nowMs: NOW });
    // With nothing else known the lifecycle engine surfaces a
    // PLANNING stage task — that's a calm answer, not a dead end.
    expect(['no_action', 'routine_check', 'crop_stage_task'])
      .toContain(d.bestAction.type);
    expect(['low', 'normal']).toContain(d.urgency);
    expect(['gentle', 'firm']).toContain(d.confidenceTone);
  });
});

// ─── Experience-level tailoring ─────────────────────────

describe('computeDailyDecision — beginner vs experienced wording', () => {
  it('NEW farmer receives a microHelp envelope', () => {
    const d = computeDailyDecision({
      crop: 'tomato',
      weather: { temperatureC: 24 },
      experienceLevel: 'new',
      nowMs: NOW,
    });
    expect(d.experienceLevel).toBe(EXPERIENCE_LEVEL.NEW);
    expect(d.microHelp).toBeTruthy();
    expect(d.microHelp.key).toMatch(/^daily\.help\./);
    expect(typeof d.microHelp.fallback).toBe('string');
  });

  it('EXPERIENCED farmer receives no microHelp — terser surface', () => {
    const d = computeDailyDecision({
      crop: 'tomato',
      weather: { temperatureC: 24 },
      experienceLevel: 'experienced',
      nowMs: NOW,
    });
    expect(d.experienceLevel).toBe(EXPERIENCE_LEVEL.EXPERIENCED);
    expect(d.microHelp).toBe(null);
  });

  it('both levels carry the same bestAction type and reason key', () => {
    const a = computeDailyDecision({
      crop: 'tomato',
      weather: { frostRiskTonight: true },
      experienceLevel: 'new',
      nowMs: NOW,
    });
    const b = computeDailyDecision({
      crop: 'tomato',
      weather: { frostRiskTonight: true },
      experienceLevel: 'experienced',
      nowMs: NOW,
    });
    expect(a.bestAction.type).toBe(b.bestAction.type);
    expect(a.reason.key).toBe(b.reason.key);
  });
});

// ─── Output contract ────────────────────────────────────

describe('computeDailyDecision — output contract', () => {
  it('every result carries urgency + bestTime + confidenceTone + disclaimer', () => {
    const d = computeDailyDecision({ crop: 'tomato', weather: { temperatureC: 24 }, nowMs: NOW });
    expect(['low','normal','high']).toContain(d.urgency);
    expect(typeof d.bestTime).toBe('string');
    expect(['gentle','firm','urgent']).toContain(d.confidenceTone);
    expect(d.disclaimer).toMatch(/local conditions/i);
  });

  it('localizable strings are translation-key envelopes', () => {
    const d = computeDailyDecision({
      crop: 'pepper', mode: 'gardener',
      weather: { temperatureC: 24 },
      experienceLevel: 'new',
      nowMs: NOW,
    });
    expect(d.bestAction.title.key).toMatch(/^daily\.title\./);
    expect(d.bestAction.title.params.crop).toBe('pepper');
    expect(d.reason.key).toMatch(/^daily\.reason\./);
  });

  it('never throws on garbage input', () => {
    expect(() => computeDailyDecision(null)).not.toThrow();
    const d = computeDailyDecision(null);
    expect(['low','normal','high']).toContain(d.urgency);
  });
});
