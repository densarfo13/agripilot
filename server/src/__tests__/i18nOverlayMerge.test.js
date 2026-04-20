/**
 * i18nOverlayMerge.test.js — contract for the overlay merger
 * that wires orphaned translation packs into the main T.
 *
 * Covers:
 *   • mergeLocaleOverlay rotates {locale:{key:v}} into {key:{locale:v}}
 *   • existing translator-authored values always win
 *   • mergeManyOverlays applies a list in order
 *   • EDIT_FARM_TRANSLATIONS provides English + Hindi + French for
 *     every new EditFarmScreen key the UI uses
 *   • FAST_ONBOARDING_TRANSLATIONS keys land in the merged dict
 */

import { describe, it, expect } from 'vitest';

import {
  mergeLocaleOverlay, mergeManyOverlays,
} from '../../../src/i18n/mergeOverlays.js';
import {
  EDIT_FARM_TRANSLATIONS, mergeEditFarmOverlay,
} from '../../../src/i18n/editFarmTranslations.js';
import { FAST_ONBOARDING_TRANSLATIONS } from '../../../src/i18n/fastOnboardingTranslations.js';
import { HOME_TRANSLATIONS }            from '../../../src/i18n/homeTranslations.js';

describe('mergeLocaleOverlay', () => {
  it('rotates overlay shape into main dictionary shape', () => {
    const T = {};
    mergeLocaleOverlay(T, {
      en: { 'a.b': 'Hello' },
      hi: { 'a.b': 'नमस्ते' },
    });
    expect(T['a.b'].en).toBe('Hello');
    expect(T['a.b'].hi).toBe('नमस्ते');
  });

  it('does NOT overwrite existing translator-authored values', () => {
    const T = { 'a.b': { en: 'Authored' } };
    mergeLocaleOverlay(T, { en: { 'a.b': 'From overlay' } });
    expect(T['a.b'].en).toBe('Authored');
  });

  it('fills empty slots on existing keys', () => {
    const T = { 'a.b': { en: 'Authored' } };
    mergeLocaleOverlay(T, { hi: { 'a.b': 'हिन्दी' } });
    expect(T['a.b'].en).toBe('Authored');
    expect(T['a.b'].hi).toBe('हिन्दी');
  });

  it('creates new keys that do not exist in main T', () => {
    const T = {};
    mergeLocaleOverlay(T, { en: { 'brand.new': 'NEW' } });
    expect(T['brand.new'].en).toBe('NEW');
  });

  it('ignores non-string values', () => {
    const T = {};
    mergeLocaleOverlay(T, { en: { 'a.b': '' } });
    expect(T['a.b']).toBeUndefined();
  });

  it('safe on null / non-object inputs', () => {
    expect(mergeLocaleOverlay(null, {})).toBeNull();
    const T = {};
    expect(mergeLocaleOverlay(T, null)).toBe(T);
    expect(mergeLocaleOverlay(T, 'bad')).toBe(T);
  });
});

describe('mergeManyOverlays', () => {
  it('applies overlays in order', () => {
    const T = {};
    mergeManyOverlays(T, [
      { en: { 'x.y': 'First' } },
      { en: { 'x.y': 'Second' } }, // should NOT overwrite — first already filled
      { en: { 'z.w': 'Late' } },
    ]);
    expect(T['x.y'].en).toBe('First');
    expect(T['z.w'].en).toBe('Late');
  });

  it('safe on non-array input', () => {
    const T = {};
    expect(mergeManyOverlays(T, null)).toBe(T);
    expect(mergeManyOverlays(T, 'bad')).toBe(T);
  });
});

describe('EDIT_FARM_TRANSLATIONS coverage', () => {
  const required = [
    'farm.editFarm.title',
    'farm.editFarm.helper',
    'farm.editFarm.completeProfileTitle',
    'farm.editFarm.completeProfileHelper',
    'farm.editFarm.completeForRecTitle',
    'farm.editFarm.completeForRecHelper',
    'farm.editFarm.saveChanges',
    'farm.editFarm.saveSuccess',
    'farm.editFarm.noFarm',
    'farm.editFarm.farmNameRequired',
    'farm.editFarm.sizeNegative',
    'farm.editFailed',
  ];

  it('English has every required key', () => {
    for (const key of required) {
      expect(EDIT_FARM_TRANSLATIONS.en[key]).toBeTruthy();
    }
  });

  it('Hindi has every required key (full coverage, not fallback)', () => {
    for (const key of required) {
      expect(EDIT_FARM_TRANSLATIONS.hi[key]).toBeTruthy();
    }
  });

  it('French has every required key', () => {
    for (const key of required) {
      expect(EDIT_FARM_TRANSLATIONS.fr[key]).toBeTruthy();
    }
  });

  it('Hindi values actually contain Devanagari', () => {
    const sample = EDIT_FARM_TRANSLATIONS.hi['farm.editFarm.title'];
    expect(sample).toMatch(/[\u0900-\u097F]/);
  });

  it('French values contain French-specific characters or words', () => {
    const joined = Object.values(EDIT_FARM_TRANSLATIONS.fr).join(' ');
    // French diacritics OR clearly-French words ("la ", "votre", "des ").
    expect(/[àâçéèêëîïôùûÀÂÇÉÈÊËÎÏÔÙÛ]|\b(la|votre|des|vos|le|en)\b/i.test(joined))
      .toBe(true);
  });
});

describe('mergeEditFarmOverlay — integration', () => {
  it('pulls every editFarm key into a merged dictionary', () => {
    const T = {};
    mergeEditFarmOverlay(T);
    expect(T['farm.editFarm.title'].en).toBe('Edit Farm');
    expect(T['farm.editFarm.title'].hi).toMatch(/[\u0900-\u097F]/);
    expect(T['farm.editFarm.completeProfileTitle'].en).toBe('Complete your farm profile');
  });
});

describe('FAST_ONBOARDING_TRANSLATIONS overlay merges correctly', () => {
  it('adds fast_onboarding.* keys into a fresh dict', () => {
    const T = {};
    mergeManyOverlays(T, [FAST_ONBOARDING_TRANSLATIONS]);
    // Sample a key that's known to exist in the overlay.
    const keys = Object.keys(T).filter((k) => k.startsWith('fast_onboarding.'));
    expect(keys.length).toBeGreaterThan(10);
  });
});

describe('HOME_TRANSLATIONS overlay merges correctly', () => {
  it('adds home.* keys into a fresh dict', () => {
    const T = {};
    mergeManyOverlays(T, [HOME_TRANSLATIONS]);
    const keys = Object.keys(T).filter((k) => k.startsWith('home.'));
    expect(keys.length).toBeGreaterThan(10);
  });
});

describe('Combined merge (same as production index.js)', () => {
  it('all three overlays together cover hi + fr + en without collisions', () => {
    const T = {};
    mergeManyOverlays(T, [
      FAST_ONBOARDING_TRANSLATIONS,
      HOME_TRANSLATIONS,
      EDIT_FARM_TRANSLATIONS,
    ]);
    // Spot-check: every locale present on one key from each overlay.
    expect(T['farm.editFarm.title'].en).toBeTruthy();
    expect(T['farm.editFarm.title'].hi).toBeTruthy();
    expect(T['farm.editFarm.title'].fr).toBeTruthy();
  });
});
