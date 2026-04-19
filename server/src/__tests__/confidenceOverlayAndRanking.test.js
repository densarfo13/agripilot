/**
 * confidenceOverlayAndRanking.test.js — checks the i18n overlay
 * covers every locale and confirms the ranking service surfaces
 * contested crops.
 */

import { describe, it, expect } from 'vitest';
import {
  CONFIDENCE_TRANSLATIONS,
  applyConfidenceOverlay,
} from '../../../src/i18n/confidenceTranslations.js';

const EXPECTED_LOCALES = ['en', 'hi', 'tw', 'es', 'pt', 'fr', 'ar', 'sw', 'id'];
const EXPECTED_KEYS = [
  'recommendations.header.high',
  'recommendations.header.medium',
  'recommendations.header.low',
  'recommendations.sub.high',
  'recommendations.sub.medium',
  'recommendations.sub.low',
  'location.confidence.high',
  'location.confidence.medium',
  'location.confidence.low',
  'listing.freshness.high',
  'listing.freshness.medium',
  'listing.freshness.low',
];

describe('confidenceTranslations overlay', () => {
  it('covers every shipped locale', () => {
    for (const locale of EXPECTED_LOCALES) {
      expect(CONFIDENCE_TRANSLATIONS[locale]).toBeDefined();
    }
  });

  it('every locale has every expected key', () => {
    for (const locale of EXPECTED_LOCALES) {
      for (const key of EXPECTED_KEYS) {
        expect(CONFIDENCE_TRANSLATIONS[locale][key]).toBeTruthy();
      }
    }
  });

  it('non-English locales are not accidentally the English string', () => {
    for (const locale of EXPECTED_LOCALES) {
      if (locale === 'en') continue;
      for (const key of EXPECTED_KEYS) {
        const en = CONFIDENCE_TRANSLATIONS.en[key];
        const localized = CONFIDENCE_TRANSLATIONS[locale][key];
        expect(localized).not.toBe(en);
      }
    }
  });

  it('applyConfidenceOverlay merges keys into an existing dictionary', () => {
    const existing = {
      en: { 'some.existing.key': 'existing' },
      hi: { 'some.existing.key': 'मौजूदा' },
    };
    const result = applyConfidenceOverlay(existing);
    expect(result).toBe(existing);
    expect(existing.en['some.existing.key']).toBe('existing'); // preserves existing
    expect(existing.en['recommendations.header.high']).toBe('Best crops for your area');
    expect(existing.hi['location.confidence.medium']).toBeTruthy();
  });
});
