/**
 * productionGapTranslations.test.js — verifies the May 2026
 * production-incident gap overlay covers every reported leak key
 * across all 6 launch locales.
 */

import { describe, it, expect } from 'vitest';

import {
  PRODUCTION_GAP_TRANSLATIONS,
} from '../../../src/i18n/productionGapTranslations.js';

const REQUIRED_LOCALES = ['en', 'fr', 'sw', 'ha', 'tw', 'hi'];

const REQUIRED_KEYS = [
  // Journal page (on-device screenshot showed all of these in English
  // even when the active locale was something else)
  'journal.eyebrow',
  'journal.title',
  'journal.subtitle',
  'journal.identity.tap',
  'journal.timeline.label',
  'journal.empty.title',
  'journal.empty.body',
  'journal.empty.cta',
  'journal.photos.label',
  'journal.stat.moments',
  'journal.stat.scanned',
  'journal.stat.flowered',
  'journal.stat.fruited',
  'plant.fallback.nickname',
  'plant.timeline.generic',
  // ImmersiveHomeHero (the "three languages on one screen" symptom)
  'hero.eyebrow',
  'hero.subtype.small_farm.title',
  'hero.subtype.small_farm.line',
  'hero.subtype.small_farm.cta',
  'hero.subtype.commercial.title',
  'hero.subtype.commercial.line',
  'hero.subtype.commercial.cta',
  'hero.subtype.mixed.title',
  'hero.subtype.mixed.line',
  'hero.subtype.mixed.cta',
  'hero.subtype.greenhouse.title',
  'hero.subtype.greenhouse.line',
  'hero.subtype.greenhouse.cta',
  // ScanFallback "Camera is taking a moment" surface (screenshot 2)
  'scan.camera.takingMoment.title',
  'scan.camera.takingMoment.body',
  'scan.camera.useSaved',
  'scan.camera.retry',
  'common.retry',
  'scan.gallery.upload',
  'scan.fallback.setup.title',
  'scan.fallback.setup.body',
  'scan.fallback.setup.cta',
  // Home page misc fallback
  'home.farm.newFallback',
  // MyFarmPage scan card (third on-device screenshot)
  'myFarm.scan.label',
  'myFarm.scan.sub',
  'myFarm.scan.aria',
  // Sell page empty state (fourth round of on-device screenshots)
  'sell.empty.title',
  'sell.empty.body',
  'sell.empty.cta',
  // Home page scan-row + task eyebrow + location button
  'home.scan',
  'home.checkHealth',
  'home.todayTask.label',
  'weather.useMyLocation',
  'hero.yourArea',
  'hero.defaultFarm',
  'hero.defaultGarden',
];

describe('productionGapTranslations — overlay coverage', () => {
  it('exports a non-empty object', () => {
    expect(typeof PRODUCTION_GAP_TRANSLATIONS).toBe('object');
    expect(Object.keys(PRODUCTION_GAP_TRANSLATIONS).length).toBeGreaterThan(20);
  });

  it.each(REQUIRED_KEYS)('ships %s in all 6 locales', (key) => {
    const row = PRODUCTION_GAP_TRANSLATIONS[key];
    expect(row).toBeTruthy();
    for (const locale of REQUIRED_LOCALES) {
      expect(typeof row[locale]).toBe('string');
      expect(row[locale].length).toBeGreaterThan(0);
    }
  });

  it('every entry has en + fr + sw + ha + tw + hi', () => {
    const incomplete = [];
    for (const key of Object.keys(PRODUCTION_GAP_TRANSLATIONS)) {
      const row = PRODUCTION_GAP_TRANSLATIONS[key];
      for (const locale of REQUIRED_LOCALES) {
        if (typeof row[locale] !== 'string' || !row[locale]) {
          incomplete.push(key + ':' + locale);
        }
      }
    }
    expect(incomplete).toEqual([]);
  });

  it('non-English values differ from the English value', () => {
    // Catches accidental "copy-en-everywhere" rows. A handful of
    // proper nouns / single-word translations are legitimately the
    // same across locales (e.g. "Journal" in French is also
    // "Journal", "Yes" in some locales) — only flag rows where ALL
    // five non-English translations equal the English one.
    const suspicious = [];
    for (const key of Object.keys(PRODUCTION_GAP_TRANSLATIONS)) {
      const row = PRODUCTION_GAP_TRANSLATIONS[key];
      const en = row.en;
      const allEqual = ['fr', 'sw', 'ha', 'tw', 'hi'].every((l) => row[l] === en);
      if (allEqual && en.length > 4) suspicious.push(key);
    }
    expect(suspicious).toEqual([]);
  });
});
