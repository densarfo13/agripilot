/**
 * cropDisplayName.test.js — language-aware crop naming.
 *
 * Verifies the spec:
 *   - English UI  → English only
 *   - Hindi UI    → Hindi only by default, no parens
 *   - Hindi UI + bilingual:true  → "native (English)"
 *   - Hindi UI + bilingual:'auto' → bilingual ONLY for the curated
 *     BILINGUAL_HINTED set (cassava, sorghum, peanut…)
 *   - Core spec crop mapping is present:
 *       tomato→टमाटर, pepper→मिर्च, lettuce→लेट्यूस, beans→बीन्स,
 *       corn→मक्का, peanut→मूंगफली, sorghum→ज्वार, wheat→गेहूं,
 *       rice→चावल, onion→प्याज, potato→आलू, cassava→कसावा,
 *       banana→केला, cocoa→कोकोआ, coffee→कॉफी,
 *       sweet_potato→शकरकंद
 */
import { describe, it, expect } from 'vitest';
import { getCropDisplayName, BILINGUAL_HINTED } from '../../../src/utils/getCropDisplayName.js';

describe('getCropDisplayName — English', () => {
  it('returns canonical English names', () => {
    expect(getCropDisplayName('tomato', 'en')).toBe('Tomato');
    expect(getCropDisplayName('sweet_potato', 'en')).toBe('Sweet Potato');
    expect(getCropDisplayName('cocoa', 'en')).toBe('Cocoa');
  });

  it('humanizes unknown keys without leaking underscores', () => {
    // `dragon_fruit` isn't in EN_NAMES — the humanizer runs.
    expect(getCropDisplayName('dragon_fruit', 'en')).toBe('Dragon fruit');
  });

  it('returns empty string for empty input', () => {
    expect(getCropDisplayName('', 'en')).toBe('');
    expect(getCropDisplayName(null, 'en')).toBe('');
  });
});

describe('getCropDisplayName — Hindi default (no bilingual)', () => {
  const spec = [
    ['tomato',       'टमाटर'],
    ['pepper',       'मिर्च'],
    ['lettuce',      'लेट्यूस'],
    ['beans',        'बीन्स'],
    ['corn',         'मक्का'],
    ['maize',        'मक्का'],
    ['peanut',       'मूंगफली'],
    ['sorghum',      'ज्वार'],
    ['wheat',        'गेहूं'],
    ['rice',         'चावल'],
    ['onion',        'प्याज'],
    ['potato',       'आलू'],
    ['cassava',      'कसावा'],
    ['banana',       'केला'],
    ['cocoa',        'कोकोआ'],
    ['coffee',       'कॉफी'],
    ['sweet_potato', 'शकरकंद'],
  ];

  it.each(spec)('%s → %s (Hindi only, no English leak)', (key, expected) => {
    const out = getCropDisplayName(key, 'hi');
    expect(out).toBe(expected);
    // No Latin characters should appear in the default Hindi display.
    expect(/[A-Za-z]/.test(out)).toBe(false);
  });

  it('falls back to English when no Hindi entry exists', () => {
    // 'apricot' is not in LOCAL_NAMES.hi — should still render cleanly.
    const apricot = getCropDisplayName('apricot', 'hi');
    expect(apricot).toBe('Apricot'); // humanized English fallback
  });
});

describe('getCropDisplayName — Hindi with bilingual:true', () => {
  it('produces "native (English)" when explicitly requested', () => {
    expect(getCropDisplayName('tomato', 'hi', { bilingual: true })).toBe('टमाटर (Tomato)');
    expect(getCropDisplayName('cassava', 'hi', { bilingual: true })).toBe('कसावा (Cassava)');
  });
});

describe('getCropDisplayName — Hindi with bilingual:"auto"', () => {
  it('adds English only for BILINGUAL_HINTED crops', () => {
    expect(getCropDisplayName('cassava', 'hi', { bilingual: 'auto' })).toBe('कसावा (Cassava)');
    expect(getCropDisplayName('sorghum', 'hi', { bilingual: 'auto' })).toBe('ज्वार (Sorghum)');
    expect(getCropDisplayName('cocoa',   'hi', { bilingual: 'auto' })).toBe('कोकोआ (Cocoa)');
  });

  it('keeps familiar staples in Hindi only', () => {
    expect(getCropDisplayName('tomato', 'hi', { bilingual: 'auto' })).toBe('टमाटर');
    expect(getCropDisplayName('rice',   'hi', { bilingual: 'auto' })).toBe('चावल');
  });
});

describe('BILINGUAL_HINTED config is curated, not global', () => {
  it('keeps the list short enough to stay useful', () => {
    expect(BILINGUAL_HINTED.hi.size).toBeLessThan(15);
  });
});

describe('Twi fallback', () => {
  it('shows Twi when available', () => {
    expect(getCropDisplayName('cassava', 'tw')).toBe('Bankye');
  });
  it('falls back to English when Twi is missing', () => {
    expect(getCropDisplayName('strawberry', 'tw')).toBe('Strawberry');
  });
});

// ─── Multi-language rollout ───────────────────────────────
describe('Spanish (es) staple coverage', () => {
  it.each([
    ['tomato', 'Tomate'],
    ['rice', 'Arroz'],
    ['maize', 'Maíz'],
    ['cassava', 'Yuca'],
    ['peanut', 'Cacahuete'],
  ])('%s → %s', (k, v) => {
    expect(getCropDisplayName(k, 'es')).toBe(v);
  });
  it('falls back to English for niche crops', () => {
    expect(getCropDisplayName('blueberry', 'es')).toBe('Blueberry');
  });
});

describe('Portuguese (pt) staple coverage', () => {
  it.each([
    ['tomato', 'Tomate'],
    ['maize', 'Milho'],
    ['cassava', 'Mandioca'],
    ['peanut', 'Amendoim'],
  ])('%s → %s', (k, v) => {
    expect(getCropDisplayName(k, 'pt')).toBe(v);
  });
});

describe('French (fr) staple coverage', () => {
  it.each([
    ['tomato', 'Tomate'],
    ['maize', 'Maïs'],
    ['cassava', 'Manioc'],
    ['peanut', 'Arachide'],
    ['wheat', 'Blé'],
  ])('%s → %s', (k, v) => {
    expect(getCropDisplayName(k, 'fr')).toBe(v);
  });
});

describe('Arabic (ar) staple coverage', () => {
  it.each([
    ['tomato', 'طماطم'],
    ['rice', 'أرز'],
    ['cassava', 'كسافا'],
  ])('%s → %s', (k, v) => {
    expect(getCropDisplayName(k, 'ar')).toBe(v);
  });
  it('falls back to English for unsupported Arabic crops', () => {
    expect(getCropDisplayName('blueberry', 'ar')).toBe('Blueberry');
  });
});

describe('Swahili (sw) staple coverage', () => {
  it.each([
    ['tomato', 'Nyanya'],
    ['maize', 'Mahindi'],
    ['cassava', 'Muhogo'],
    ['peanut', 'Karanga'],
  ])('%s → %s', (k, v) => {
    expect(getCropDisplayName(k, 'sw')).toBe(v);
  });
});

describe('Indonesian (id) staple coverage', () => {
  it.each([
    ['tomato', 'Tomat'],
    ['rice', 'Beras'],
    ['maize', 'Jagung'],
    ['cassava', 'Singkong'],
  ])('%s → %s', (k, v) => {
    expect(getCropDisplayName(k, 'id')).toBe(v);
  });
});

describe('Unknown language codes fall back to English', () => {
  it.each(['', 'zz', 'klingon'])('%p → English', (lang) => {
    expect(getCropDisplayName('tomato', lang)).toBe('Tomato');
    expect(getCropDisplayName('cassava', lang)).toBe('Cassava');
  });
});

describe('LANGUAGE_COVERAGE is honest', () => {
  it('declares Hindi as full coverage', async () => {
    const { LANGUAGE_COVERAGE } = await import('../../../src/utils/cropNames.js');
    expect(LANGUAGE_COVERAGE.hi.tier).toBe('full');
  });

  it('declares Twi + other rollout languages as partial', async () => {
    const { LANGUAGE_COVERAGE } = await import('../../../src/utils/cropNames.js');
    for (const lang of ['tw', 'es', 'pt', 'fr', 'ar', 'sw', 'id']) {
      expect(['partial', 'full']).toContain(LANGUAGE_COVERAGE[lang].tier);
    }
  });
});

describe('Switching language immediately changes names', () => {
  it('same crop key produces different labels per language', () => {
    const key = 'cassava';
    expect(getCropDisplayName(key, 'en')).toBe('Cassava');
    expect(getCropDisplayName(key, 'hi')).toBe('कसावा');
    expect(getCropDisplayName(key, 'tw')).toBe('Bankye');
    expect(getCropDisplayName(key, 'es')).toBe('Yuca');
    expect(getCropDisplayName(key, 'fr')).toBe('Manioc');
    expect(getCropDisplayName(key, 'sw')).toBe('Muhogo');
  });
});
