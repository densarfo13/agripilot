/**
 * contextEngineTranslations.test.js — verifies the Context Engine
 * translation overlay covers every branch the engine emits, in all
 * 6 launch locales.
 */

import { describe, it, expect } from 'vitest';

import {
  CONTEXT_ENGINE_TRANSLATIONS,
} from '../../../src/i18n/contextEngineTranslations.js';

const REQUIRED_LOCALES = ['en', 'fr', 'sw', 'ha', 'tw', 'hi'];

const REQUIRED_KEYS = [
  // Shared CTAs (14)
  'contextEngine.cta.inspect',
  'contextEngine.cta.inspectNow',
  'contextEngine.cta.inspectLeaves',
  'contextEngine.cta.waterNow',
  'contextEngine.cta.checkRoot',
  'contextEngine.cta.checkPlant',
  'contextEngine.cta.checkStalks',
  'contextEngine.cta.checkSoil',
  'contextEngine.cta.checkField',
  'contextEngine.cta.checkWater',
  'contextEngine.cta.checkDrainage',
  'contextEngine.cta.checkMoisture',
  'contextEngine.cta.checkLight',
  'contextEngine.cta.checkCrop',
  // Scan-followup (7 branches × 2 keys)
  'intel.scanFollowup.yellow.title',
  'intel.scanFollowup.yellow.reason',
  'intel.scanFollowup.pest.title',
  'intel.scanFollowup.pest.reason',
  'intel.scanFollowup.disease.title',
  'intel.scanFollowup.disease.reason',
  'intel.scanFollowup.wilt.title',
  'intel.scanFollowup.wilt.reason',
  'intel.scanFollowup.nutrient.title',
  'intel.scanFollowup.nutrient.reason',
  'intel.scanFollowup.healthy.title',
  'intel.scanFollowup.healthy.reason',
  'intel.scanFollowup.needsReview.title',
  'intel.scanFollowup.needsReview.reason',
  // Farm task (8 × 2)
  'intel.farmTask.harvest.title',
  'intel.farmTask.harvest.reason',
  'intel.farmTask.rain.title',
  'intel.farmTask.rain.reason',
  'intel.farmTask.dry.title',
  'intel.farmTask.dry.reason',
  'intel.farmTask.wind.title',
  'intel.farmTask.wind.reason',
  'intel.farmTask.cloudy.title',
  'intel.farmTask.cloudy.reason',
  'intel.farmTask.flower.title',
  'intel.farmTask.flower.reason',
  'intel.farmTask.veg.title',
  'intel.farmTask.veg.reason',
  'intel.farmTask.seed.title',
  'intel.farmTask.seed.reason',
  // Garden task (9 × 2)
  'intel.gardenTask.indoorLowLight.title',
  'intel.gardenTask.indoorLowLight.reason',
  'intel.gardenTask.hotSmall.title',
  'intel.gardenTask.hotSmall.reason',
  'intel.gardenTask.rain.title',
  'intel.gardenTask.rain.reason',
  'intel.gardenTask.heat.title',
  'intel.gardenTask.heat.reason',
  'intel.gardenTask.wind.title',
  'intel.gardenTask.wind.reason',
  'intel.gardenTask.sunny.title',
  'intel.gardenTask.sunny.reason',
  'intel.gardenTask.harvest.title',
  'intel.gardenTask.harvest.reason',
  'intel.gardenTask.flower.title',
  'intel.gardenTask.flower.reason',
  'intel.gardenTask.seed.title',
  'intel.gardenTask.seed.reason',
  // Alerts (3 × 2-3)
  'intel.alert.heat.title',
  'intel.alert.heat.message.farm',
  'intel.alert.heat.message.garden',
  'intel.alert.rain.title',
  'intel.alert.rain.message',
  'intel.alert.wind.title',
  'intel.alert.wind.message',
];

describe('contextEngineTranslations — overlay coverage', () => {
  it('exports a non-empty object', () => {
    expect(typeof CONTEXT_ENGINE_TRANSLATIONS).toBe('object');
    expect(Object.keys(CONTEXT_ENGINE_TRANSLATIONS).length).toBeGreaterThan(50);
  });

  it.each(REQUIRED_KEYS)('ships %s in all 6 locales', (key) => {
    const row = CONTEXT_ENGINE_TRANSLATIONS[key];
    expect(row).toBeTruthy();
    for (const locale of REQUIRED_LOCALES) {
      expect(typeof row[locale]).toBe('string');
      expect(row[locale].length).toBeGreaterThan(0);
    }
  });

  it('every overlay entry has all 6 locales populated', () => {
    const gaps = [];
    for (const key of Object.keys(CONTEXT_ENGINE_TRANSLATIONS)) {
      const row = CONTEXT_ENGINE_TRANSLATIONS[key];
      for (const locale of REQUIRED_LOCALES) {
        if (typeof row[locale] !== 'string' || !row[locale]) {
          gaps.push(key + ':' + locale);
        }
      }
    }
    expect(gaps).toEqual([]);
  });

  it('non-English entries differ from English (no copy-paste bugs)', () => {
    const suspicious = [];
    for (const key of Object.keys(CONTEXT_ENGINE_TRANSLATIONS)) {
      const row = CONTEXT_ENGINE_TRANSLATIONS[key];
      const en = row.en;
      // Allow short identical strings (single words like "Inspecter" === "Inspect"
      // sometimes coincide); flag only when ALL five non-English locales equal
      // en AND the string is long enough to be a sentence.
      const allEqual = ['fr', 'sw', 'ha', 'tw', 'hi'].every((l) => row[l] === en);
      if (allEqual && en.length > 8) suspicious.push(key);
    }
    expect(suspicious).toEqual([]);
  });

  it('{crop} placeholder appears in both English and every translation when present', () => {
    const broken = [];
    for (const key of Object.keys(CONTEXT_ENGINE_TRANSLATIONS)) {
      const row = CONTEXT_ENGINE_TRANSLATIONS[key];
      const enHasCrop = /\{crop\}/.test(row.en);
      if (!enHasCrop) continue;
      for (const locale of REQUIRED_LOCALES) {
        if (!/\{crop\}/.test(row[locale])) broken.push(key + ':' + locale);
      }
    }
    expect(broken).toEqual([]);
  });
});

describe('contextEngine.js — every task branch emits keys', () => {
  it('contextEngine returns task objects with titleKey/reasonKey/ctaKey', async () => {
    const mod = await import('../../../src/lib/intelligence/contextEngine.js');
    expect(typeof mod.computeContextIntelligence).toBe('function');
    // Generic fallback path
    const ctx = mod.computeContextIntelligence({
      weatherType: 'unknown',
      crop:        'pepper',
      cropStage:   '',
      temp:        25,
      rainChance:  null,
      mode:        'farm',
    });
    const t = ctx && ctx.todayTask;
    expect(t).toBeTruthy();
    expect(typeof t.titleKey).toBe('string');
    expect(typeof t.reasonKey).toBe('string');
    expect(typeof t.ctaKey).toBe('string');
  });

  it('scan-followup branch carries the {crop} param so localised string renders the crop name', async () => {
    const mod = await import('../../../src/lib/intelligence/contextEngine.js');
    const ctx = mod.computeContextIntelligence({
      weatherType: 'unknown',
      crop:        'tomato',
      cropStage:   '',
      temp:        25,
      rainChance:  null,
      mode:        'farm',
      recentScanCategory: 'yellow',
    });
    const t = ctx.todayTask;
    expect(t.titleKey).toBe('intel.scanFollowup.yellow.title');
    expect(t.titleParams).toEqual({ crop: 'tomato' });
  });
});
