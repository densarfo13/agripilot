/**
 * worldClassGrowerGapClosure.test.js — verifies the three new
 * gap-closure modules: grow-setup guidance, experience-level
 * preference store, and the FEATURE_GROWER_COMMUNITY flag.
 */

// Minimal localStorage shim for the preference store.
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
  getGrowSetupGuidance, SUNLIGHT, SETTING, KNOWN_GROW_CROPS,
} from '../../../src/core/grow/growSetupGuidance.js';
import {
  getExperienceLevel, setExperienceLevel, clearExperiencePreference,
  isExperienced, EXPERIENCE_LEVEL,
} from '../../../src/core/experience/experiencePreferenceStore.js';
import { _internal as flagInternal } from '../../../src/utils/featureFlags.js';

// ─── §9 grow-setup guidance ──────────────────────────────

describe('growSetupGuidance — honest light + setting hints', () => {
  it('covers all the spec-listed crops', () => {
    for (const c of ['tomato','pepper','maize','rice','beans','cassava','okra','onion',
                     'lettuce','cabbage','cucumber','carrot','potato','banana','mango',
                     'avocado','citrus','herbs']) {
      expect(getGrowSetupGuidance(c)).toBeTruthy();
    }
    expect(KNOWN_GROW_CROPS.length).toBeGreaterThanOrEqual(15);
  });

  it('tomato → full sun + outdoor settings + honest note', () => {
    const g = getGrowSetupGuidance('tomato');
    expect(g.sunlight).toBe(SUNLIGHT.FULL_SUN);
    expect(g.settings).toContain(SETTING.OUTDOOR);
    expect(g.note.fallback).toMatch(/strong sunlight|bright outdoor/i);
    expect(g.isEstimate).toBe(true);
    expect(g.disclaimer).toMatch(/local microclimate|do not measure/i);
  });

  it('lettuce → part sun (a leafy crop, honest)', () => {
    expect(getGrowSetupGuidance('lettuce').sunlight).toBe(SUNLIGHT.PART_SUN);
  });

  it('honours common aliases', () => {
    expect(getGrowSetupGuidance('corn').cropKey).toBe('maize');
    expect(getGrowSetupGuidance('plantain').cropKey).toBe('banana');
    expect(getGrowSetupGuidance('mint').cropKey).toBe('herbs');
    expect(getGrowSetupGuidance('orange').cropKey).toBe('citrus');
  });

  it('returns null for unknown crops — no faked guidance', () => {
    expect(getGrowSetupGuidance('xyzfruit')).toBe(null);
    expect(getGrowSetupGuidance(null)).toBe(null);
  });

  it('every result carries a localizable note envelope', () => {
    const g = getGrowSetupGuidance('cassava');
    expect(g.note.key).toMatch(/^grow\.sun\./);
    expect(typeof g.note.fallback).toBe('string');
  });
});

// ─── §10 experience-level preference ─────────────────────

describe('experiencePreferenceStore — beginner vs experienced toggle', () => {
  beforeEach(() => { _s.clear(); clearExperiencePreference(); });

  it('defaults to "new" — beginner-friendlier landing', () => {
    expect(getExperienceLevel()).toBe(EXPERIENCE_LEVEL.NEW);
    expect(isExperienced()).toBe(false);
  });

  it('saves and reads "experienced"', () => {
    expect(setExperienceLevel('experienced')).toBe(true);
    expect(getExperienceLevel()).toBe(EXPERIENCE_LEVEL.EXPERIENCED);
    expect(isExperienced()).toBe(true);
  });

  it('coerces unknown values to "new" — typos never break the surface', () => {
    setExperienceLevel('on_fire');
    expect(getExperienceLevel()).toBe(EXPERIENCE_LEVEL.NEW);
  });

  it('clearExperiencePreference resets to the default', () => {
    setExperienceLevel('experienced');
    clearExperiencePreference();
    expect(getExperienceLevel()).toBe(EXPERIENCE_LEVEL.NEW);
  });

  it('never throws on garbage input', () => {
    expect(() => setExperienceLevel(null)).not.toThrow();
    expect(() => setExperienceLevel(42)).not.toThrow();
  });
});

// ─── §11 FEATURE_GROWER_COMMUNITY flag dark by default ───

describe('FEATURE_GROWER_COMMUNITY — prepared architecture only', () => {
  it('ships as false in the DEFAULTS map', () => {
    expect(flagInternal.DEFAULTS.FEATURE_GROWER_COMMUNITY).toBe(false);
  });
});
