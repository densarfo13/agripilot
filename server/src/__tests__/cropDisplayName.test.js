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
import { getCropDisplayName, _internal } from '../../../src/utils/getCropDisplayName.js';

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
    expect(_internal.BILINGUAL_HINTED.hi.size).toBeLessThan(15);
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
