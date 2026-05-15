/**
 * agricultureRegistry.test.js — Unified Agricultural Localization
 * Registry Upgrade.
 *
 * src/core/intelligence/agricultureRegistry.js is the single
 * normalized accessor for every agricultural label/message across
 * the six launch languages. It reads the EXISTING registries
 * (cropNames.js, translations.js, taskEngineTranslations.js) — it
 * does not introduce a parallel data store.
 *
 * Coverage:
 *   - the six launch languages are declared
 *   - every getter returns a non-empty single-language string
 *   - mixed-language protection: unknown language → English only
 *   - unknown ids fall back to calm humanized English (never a key)
 *   - getters never throw on garbage input
 *   - memoisation is consistent + the reset seam works
 *   - getAgricultureVocabulary binds the language once
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SUPPORTED_LANGUAGES,
  getCropLabel,
  getTaskLabel,
  getDiseaseLabel,
  getWeatherMessage,
  getScanExplanation,
  getCopilotPrompt,
  getAgricultureVocabulary,
  _resetAgricultureRegistry,
} from '../../../src/core/intelligence/agricultureRegistry.js';

beforeEach(() => {
  _resetAgricultureRegistry();
});

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

// ─── 1. Language standard ──────────────────────────────────

describe('agricultureRegistry — language standard', () => {
  it('declares exactly the six launch languages', () => {
    expect([...SUPPORTED_LANGUAGES].sort()).toEqual(['en', 'fr', 'ha', 'hi', 'sw', 'tw']);
  });
});

// ─── 2. Every getter resolves a single-language string ─────

describe('agricultureRegistry — getters resolve labels', () => {
  it('getCropLabel returns a localized crop name in every language', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(isNonEmptyString(getCropLabel('pepper', lang))).toBe(true);
    }
  });

  it('getTaskLabel resolves a real task-engine id', () => {
    expect(isNonEmptyString(getTaskLabel('task.remove_weeds', 'en'))).toBe(true);
    expect(isNonEmptyString(getTaskLabel('task.remove_weeds', 'fr'))).toBe(true);
  });

  it('weather / scan / disease / copilot getters all return strings', () => {
    expect(isNonEmptyString(getWeatherMessage('heavyRain', 'en'))).toBe(true);
    expect(isNonEmptyString(getScanExplanation('healthyPlant', 'en'))).toBe(true);
    expect(isNonEmptyString(getDiseaseLabel('leafSpot', 'en'))).toBe(true);
    expect(isNonEmptyString(getCopilotPrompt('todayRecommendation', 'en'))).toBe(true);
  });
});

// ─── 3. Mixed-language protection + fallback ───────────────

describe('agricultureRegistry — mixed-language protection', () => {
  it('an unknown language normalises to English (never mixed)', () => {
    expect(getCropLabel('pepper', 'zz')).toBe(getCropLabel('pepper', 'en'));
    expect(getCropLabel('pepper', null)).toBe(getCropLabel('pepper', 'en'));
    expect(getCropLabel('pepper', undefined)).toBe(getCropLabel('pepper', 'en'));
  });

  it('an unknown id falls back to calm humanized English, not a raw key', () => {
    const out = getScanExplanation('possibleLeafSpot', 'en');
    expect(isNonEmptyString(out)).toBe(true);
    // never returns the dotted key itself
    expect(out).not.toMatch(/^scan\./);
  });

  it('a missing translation never returns an empty string', () => {
    expect(isNonEmptyString(getCopilotPrompt('zzz_unknown_prompt', 'hi'))).toBe(true);
    expect(isNonEmptyString(getTaskLabel('zzz_unknown_task', 'tw'))).toBe(true);
  });
});

// ─── 4. Resilience ─────────────────────────────────────────

describe('agricultureRegistry — never throws', () => {
  it('handles garbage ids and languages', () => {
    expect(() => getCropLabel(null, null)).not.toThrow();
    expect(() => getTaskLabel(42, {})).not.toThrow();
    expect(() => getWeatherMessage(undefined, [])).not.toThrow();
    expect(() => getDiseaseLabel({}, 7)).not.toThrow();
  });
});

// ─── 5. Memoisation ────────────────────────────────────────

describe('agricultureRegistry — memoisation', () => {
  it('repeated lookups return a consistent value', () => {
    const a = getCropLabel('tomato', 'fr');
    const b = getCropLabel('tomato', 'fr');
    expect(a).toBe(b);
  });

  it('the reset seam clears the cache without breaking lookups', () => {
    const before = getCropLabel('maize', 'sw');
    _resetAgricultureRegistry();
    const after = getCropLabel('maize', 'sw');
    expect(after).toBe(before);
  });
});

// ─── 6. Bundled vocabulary ─────────────────────────────────

describe('agricultureRegistry — getAgricultureVocabulary', () => {
  it('returns language-bound resolvers', () => {
    const vocab = getAgricultureVocabulary('fr');
    expect(vocab.language).toBe('fr');
    expect(typeof vocab.cropLabel).toBe('function');
    expect(vocab.cropLabel('pepper')).toBe(getCropLabel('pepper', 'fr'));
    expect(vocab.taskLabel('task.remove_weeds')).toBe(getTaskLabel('task.remove_weeds', 'fr'));
  });
});
