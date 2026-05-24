/**
 * growGapClosureWiring.test.js — verifies the two wiring fixes:
 *
 *   • computeDailyDecisionForCurrentUser auto-reads the experience
 *     preference store when the caller hasn't passed one.
 *   • composeGrowGuidance folds the three guidance engines into
 *     one structured MyFarm envelope.
 */

// Minimal localStorage shim — the experience preference store
// needs window.localStorage to read.
const _s = new Map();
const _ls = {
  getItem:    (k) => (_s.has(k) ? _s.get(k) : null),
  setItem:    (k, v) => { _s.set(k, String(v)); },
  removeItem: (k) => { _s.delete(k); },
  clear:      () => { _s.clear(); },
};
if (typeof globalThis.window === 'undefined') globalThis.window = { localStorage: _ls };
else if (!globalThis.window.localStorage) globalThis.window.localStorage = _ls;

import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeDailyDecision, computeDailyDecisionForCurrentUser,
  EXPERIENCE_LEVEL,
} from '../../../src/core/lifecycle/dailyDecisionAssistant.js';
import {
  setExperienceLevel, clearExperiencePreference,
} from '../../../src/core/experience/experiencePreferenceStore.js';
import {
  composeGrowGuidance,
} from '../../../src/core/grow/growGuidanceComposer.js';

const NOW = Date.UTC(2026, 4, 24);

// ─── auto-read experience preference ─────────────────────

describe('computeDailyDecisionForCurrentUser — auto-reads preference', () => {
  beforeEach(() => { _s.clear(); clearExperiencePreference(); });

  it('defaults to NEW when no preference saved + no arg supplied', () => {
    const d = computeDailyDecisionForCurrentUser({
      crop: 'tomato', weather: { temperatureC: 24 }, nowMs: NOW,
    });
    expect(d.experienceLevel).toBe(EXPERIENCE_LEVEL.NEW);
    // NEW farmers receive a microHelp envelope.
    expect(d.microHelp).toBeTruthy();
  });

  it('reads "experienced" from the store when set', () => {
    setExperienceLevel('experienced');
    const d = computeDailyDecisionForCurrentUser({
      crop: 'tomato', weather: { temperatureC: 24 }, nowMs: NOW,
    });
    expect(d.experienceLevel).toBe(EXPERIENCE_LEVEL.EXPERIENCED);
    // EXPERIENCED farmers do NOT get the microHelp envelope.
    expect(d.microHelp).toBe(null);
  });

  it('explicit args still WIN over the persisted preference', () => {
    setExperienceLevel('experienced');
    const d = computeDailyDecisionForCurrentUser({
      crop: 'tomato', weather: { temperatureC: 24 },
      experienceLevel: 'new',
      nowMs: NOW,
    });
    expect(d.experienceLevel).toBe(EXPERIENCE_LEVEL.NEW);
  });

  it('never throws on garbage input', () => {
    expect(() => computeDailyDecisionForCurrentUser(null)).not.toThrow();
  });

  it('original computeDailyDecision still takes the level argument literally', () => {
    setExperienceLevel('experienced');
    const d = computeDailyDecision({
      crop: 'tomato', weather: { temperatureC: 24 },
      experienceLevel: 'new', nowMs: NOW,
    });
    expect(d.experienceLevel).toBe(EXPERIENCE_LEVEL.NEW);
  });
});

// ─── composeGrowGuidance — single MyFarm view ────────────

describe('composeGrowGuidance — MyFarm composition seam', () => {
  it('returns ok:false on missing crop — never guesses', () => {
    const v = composeGrowGuidance({});
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('no_crop');
  });

  it('combines setup + planting window + lifecycle for a known crop + region', () => {
    const v = composeGrowGuidance({
      crop: 'tomato', country: 'Ghana',
      plantingDate: new Date(Date.UTC(2026, 3, 1)).toISOString(),
      setting: 'raised_bed', mode: 'gardener', nowMs: NOW,
    });
    expect(v.ok).toBe(true);
    expect(v.setup).toBeTruthy();
    expect(v.setup.sunlight).toBe('full_sun');
    expect(v.plantingWindow).toBeTruthy();
    expect(v.plantingWindow.cropKey).toBe('tomato');
    expect(v.lifecycle).toBeTruthy();
    expect(v.lifecycle.currentStage).toBeTruthy();
    expect(v.primaryHint).toBeTruthy();
    expect(v.disclaimer).toMatch(/local conditions/i);
  });

  it('omits plantingWindow when country is missing — no faked data', () => {
    const v = composeGrowGuidance({ crop: 'tomato', mode: 'gardener', nowMs: NOW });
    expect(v.ok).toBe(true);
    expect(v.plantingWindow).toBe(null);
  });

  it('never throws on garbage input', () => {
    expect(() => composeGrowGuidance(null)).not.toThrow();
    expect(composeGrowGuidance(null).ok).toBe(false);
  });
});
