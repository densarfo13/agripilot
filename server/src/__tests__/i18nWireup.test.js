/**
 * i18nWireup.test.js — proves the keys each farmer-facing surface
 * depends on are wired into the i18n table for every supported
 * locale. Locks in the spec's goal: *no hardcoded English* leaks
 * through a trait / fit / confidence / support / status / crop-name
 * badge when the user is in Hindi, Twi, or any other shipped locale.
 *
 * Strategy: for each (component → key list), assert that t(key, lang)
 * returns a non-empty string and, for non-English locales, does NOT
 * equal the English fallback. That second check is what catches
 * "key exists but only in English" regressions.
 */
import { describe, it, expect } from 'vitest';
import { t } from '../../../src/i18n/index.js';

const NON_EN_LOCALES = ['hi', 'tw', 'es', 'pt', 'fr', 'ar', 'sw', 'id'];

// Keys each surface renders. Grouped so a failure localizes to the
// exact component that would break.
const SURFACES = {
  'onboarding crop cards (CropRecommendationStep)': [
    'fit.high', 'fit.medium', 'fit.low',
    'cropTraits.beginnerFriendly',
    'status.plantNow', 'status.plantSoon', 'status.wait', 'status.avoid',
    'confidence.high', 'confidence.medium', 'confidence.low',
    'support.full', 'support.partial', 'support.browse',
  ],
  'recommendation cards / buckets': [
    'recommendation.goodForRegion',
    'recommendation.goodForSmallFarms',
    'recommendation.goodForBackyard',
    'recommendation.plantingOpen',
    'recommendation.beginnerReason',
    'recommendation.lowFitWarning',
    'recommendation.limitedSupport',
    'recommendation.experimental',
  ],
  'crop plan page header chips': [
    'fit.high', 'fit.medium', 'fit.low',
    'confidence.high', 'confidence.medium', 'confidence.low',
    'status.plantNow', 'status.plantSoon', 'status.wait', 'status.avoid',
  ],
  'Today / task card trait chips': [
    'cropTraits.beginnerFriendly',
    'cropTraits.lowWater',
    'cropTraits.droughtTolerant',
    'cropTraits.fastGrowing',
    'cropTraits.heatTolerant',
    'cropTraits.coolSeason',
    'cropTraits.warmSeason',
  ],
  'fit / confidence / support badges': [
    'fit.high', 'fit.medium', 'fit.low',
    'confidence.high', 'confidence.medium', 'confidence.low',
    'support.full', 'support.partial', 'support.browse',
  ],
};

// Some locales legitimately share strings with English (e.g. Twi
// placeholder entries where no confident local translation exists).
// Allow these pairs so the "no English leak" guard doesn't fire
// spuriously.
const ALLOWED_EN_FALLBACK_PAIRS = new Set([
  // Twi placeholders — reviewer hasn't signed off on local wording.
  'tw:support.browse',
]);

describe('every wired surface resolves in English', () => {
  for (const [surface, keys] of Object.entries(SURFACES)) {
    describe(surface, () => {
      it.each(keys)('key %s has a non-empty English string', (key) => {
        const out = t(key, 'en');
        expect(out).toBeTruthy();
        expect(out.length).toBeGreaterThan(0);
      });
    });
  }
});

describe('no non-English surface silently falls back to English', () => {
  for (const [surface, keys] of Object.entries(SURFACES)) {
    describe(surface, () => {
      for (const lang of NON_EN_LOCALES) {
        it.each(keys)(`[${lang}] %s is localized (no English leak)`, (key) => {
          const en = t(key, 'en');
          const localized = t(key, lang);
          expect(localized).toBeTruthy();
          if (ALLOWED_EN_FALLBACK_PAIRS.has(`${lang}:${key}`)) return;
          expect(localized).not.toBe(en);
        });
      }
    });
  }
});

describe('unknown locales fall back cleanly to English', () => {
  it.each(['zz', '', null, undefined, 'klingon'])(
    'locale %p returns the English label without throwing',
    (lang) => {
      for (const key of ['fit.high', 'cropTraits.beginnerFriendly', 'status.plantNow']) {
        expect(t(key, lang)).toBe(t(key, 'en'));
      }
    },
  );
});

describe('helper constants point at the shared namespace', () => {
  it('CONFIDENCE_I18N_KEY maps to confidence.*', async () => {
    const { CONFIDENCE_I18N_KEY } = await import('../../../src/utils/getRecommendationConfidence.js');
    expect(CONFIDENCE_I18N_KEY.high).toBe('confidence.high');
    expect(CONFIDENCE_I18N_KEY.medium).toBe('confidence.medium');
    expect(CONFIDENCE_I18N_KEY.low).toBe('confidence.low');
  });

  it('DEPTH_I18N_KEY maps to support.*', async () => {
    const { DEPTH_I18N_KEY } = await import('../../../src/utils/cropSupport.js');
    expect(DEPTH_I18N_KEY.FULLY_GUIDED).toBe('support.full');
    expect(DEPTH_I18N_KEY.PARTIAL_GUIDANCE).toBe('support.partial');
    expect(DEPTH_I18N_KEY.BROWSE_ONLY).toBe('support.browse');
  });
});
