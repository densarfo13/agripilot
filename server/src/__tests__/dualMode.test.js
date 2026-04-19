/**
 * dualMode.test.js — locks in the Farm / Backyard split.
 *
 *   1. getAppMode derivation + fallback
 *   2. featureGates hide marketplace + sell CTA in backyard
 *   3. modeAwareRecommendations demotes commercial crops to
 *      notRecommendedNow for backyard users and caps bestMatch
 *   4. modeAwareTasks.shapeTodayPayloadForMode collapses
 *      secondary tasks + alerts for backyard
 *   5. every new i18n key resolves in every locale with the
 *      standard no-English-leak guard
 */
import { describe, it, expect } from 'vitest';
import { getAppMode, isBackyardMode, isFarmMode, APP_MODE } from '../../../src/utils/getAppMode.js';
import {
  isMarketplaceEnabledForMode, shouldShowSellCta, shouldShowFarmAnalytics,
  shouldShowBuyerNav, getVisibleFeaturesForMode,
} from '../../../src/utils/featureGates.js';
import {
  BACKYARD_POOL, COMMERCIAL_ONLY,
  getBackyardCropPool, getFarmCropPool,
  isBackyardCrop, isCommercialOnlyCrop,
  getModeAwareRecommendations,
} from '../../../src/utils/modeAwareRecommendations.js';
import {
  simplifyBackyardTasks, shapeTodayPayloadForMode,
  generateBackyardTasks, generateFarmTasks,
  _internal as taskInternal,
} from '../../../src/utils/modeAwareTasks.js';
import { t } from '../../../src/i18n/index.js';

// ─── 1. getAppMode ───────────────────────────────────────
describe('getAppMode', () => {
  it('returns backyard when farmType is backyard', () => {
    expect(getAppMode({ farmType: 'backyard' })).toBe('backyard');
    expect(isBackyardMode({ farmType: 'backyard' })).toBe(true);
    expect(isFarmMode({ farmType: 'backyard' })).toBe(false);
  });

  it('returns farm for small_farm / commercial / medium_farm', () => {
    expect(getAppMode({ farmType: 'small_farm' })).toBe('farm');
    expect(getAppMode({ farmType: 'commercial' })).toBe('farm');
    expect(getAppMode({ farmType: 'medium_farm' })).toBe('farm');
  });

  it('defaults to farm when no data supplied', () => {
    expect(getAppMode(null)).toBe('farm');
    expect(getAppMode(undefined)).toBe('farm');
    expect(getAppMode({})).toBe('farm');
  });

  it('accepts a literal string', () => {
    expect(getAppMode('backyard')).toBe('backyard');
    expect(getAppMode('small_farm')).toBe('farm');
  });

  it('accepts legacy home / home_garden aliases for backyard', () => {
    expect(getAppMode({ farmType: 'home' })).toBe('backyard');
    expect(getAppMode({ farmType: 'home_garden' })).toBe('backyard');
  });

  it('APP_MODE constants are correct', () => {
    expect(APP_MODE.BACKYARD).toBe('backyard');
    expect(APP_MODE.FARM).toBe('farm');
  });
});

// ─── 2. featureGates ─────────────────────────────────────
describe('featureGates', () => {
  it('marketplace + sell CTA are disabled in backyard mode', () => {
    const source = { farmType: 'backyard' };
    expect(isMarketplaceEnabledForMode(source)).toBe(false);
    expect(shouldShowSellCta(source)).toBe(false);
    expect(shouldShowBuyerNav(source)).toBe(false);
    expect(shouldShowFarmAnalytics(source)).toBe(false);
  });

  it('marketplace is enabled in farm mode', () => {
    const source = { farmType: 'small_farm' };
    expect(isMarketplaceEnabledForMode(source)).toBe(true);
    expect(shouldShowSellCta(source)).toBe(true);
  });

  it('getVisibleFeaturesForMode returns the right flag set', () => {
    const backyard = getVisibleFeaturesForMode({ farmType: 'backyard' });
    expect(backyard).toEqual({
      mode: 'backyard',
      marketplace: false, buyerBrowse: false, sellCta: false,
      heavyAnalytics: false, deepHarvestForm: false, commercialCrops: false,
    });
    const farm = getVisibleFeaturesForMode({ farmType: 'commercial' });
    expect(farm.mode).toBe('farm');
    expect(farm.marketplace).toBe(true);
    expect(farm.heavyAnalytics).toBe(true);
  });
});

// ─── 3. modeAwareRecommendations ────────────────────────
describe('modeAwareRecommendations', () => {
  it('BACKYARD_POOL contains the staples the spec called out', () => {
    for (const c of ['tomato', 'pepper', 'lettuce', 'onion', 'potato', 'okra', 'beans']) {
      expect(BACKYARD_POOL.has(c)).toBe(true);
    }
  });

  it('COMMERCIAL_ONLY contains cassava + broad-acre crops', () => {
    for (const c of ['cassava', 'cotton', 'sorghum', 'wheat', 'cocoa']) {
      expect(COMMERCIAL_ONLY.has(c)).toBe(true);
    }
  });

  it('isBackyardCrop / isCommercialOnlyCrop predicate helpers', () => {
    expect(isBackyardCrop('tomato')).toBe(true);
    expect(isBackyardCrop('cassava')).toBe(false);
    expect(isCommercialOnlyCrop('cassava')).toBe(true);
    expect(isCommercialOnlyCrop('tomato')).toBe(false);
  });

  it('getBackyardCropPool returns a copy so callers can mutate safely', () => {
    const pool = getBackyardCropPool();
    pool.delete('tomato');
    expect(BACKYARD_POOL.has('tomato')).toBe(true);
  });

  it('getFarmCropPool returns null (no subtraction in farm mode)', () => {
    expect(getFarmCropPool()).toBeNull();
  });

  it('farm mode passes buckets through unchanged', () => {
    const buckets = {
      bestMatch: [{ crop: 'tomato', fitLevel: 'high' }, { crop: 'cassava', fitLevel: 'low' }],
      alsoConsider: [{ crop: 'sorghum' }],
      notRecommendedNow: [],
    };
    const out = getModeAwareRecommendations(buckets, 'farm');
    expect(out.bestMatch).toHaveLength(2);
    expect(out.alsoConsider).toHaveLength(1);
  });

  it('backyard mode suppresses commercial-only crops from bestMatch', () => {
    const buckets = {
      bestMatch: [
        { crop: 'tomato', fitLevel: 'high' },
        { crop: 'cassava', fitLevel: 'high' },
        { crop: 'sorghum', fitLevel: 'high' },
        { crop: 'lettuce', fitLevel: 'high' },
      ],
      alsoConsider: [{ crop: 'pepper' }],
      notRecommendedNow: [],
    };
    const out = getModeAwareRecommendations(buckets, 'backyard');
    const bestCrops = out.bestMatch.map((c) => c.crop);
    expect(bestCrops).toContain('tomato');
    expect(bestCrops).toContain('lettuce');
    expect(bestCrops).not.toContain('cassava');
    expect(bestCrops).not.toContain('sorghum');
    const notCrops = out.notRecommendedNow.map((c) => c.crop);
    expect(notCrops).toContain('cassava');
    expect(notCrops).toContain('sorghum');
  });

  it('caps backyard bestMatch at 4', () => {
    const buckets = {
      bestMatch: Array.from({ length: 10 }, (_, i) => ({
        crop: ['tomato', 'lettuce', 'beans', 'pepper', 'okra', 'carrot', 'kale', 'radish', 'spinach', 'peas'][i],
        fitLevel: 'high',
      })),
      alsoConsider: [],
      notRecommendedNow: [],
    };
    const out = getModeAwareRecommendations(buckets, 'backyard');
    expect(out.bestMatch.length).toBeLessThanOrEqual(4);
  });

  it('keeps non-backyard non-commercial crops in alsoConsider for backyard', () => {
    const buckets = {
      bestMatch: [{ crop: 'blueberry', fitLevel: 'high' }],
      alsoConsider: [],
      notRecommendedNow: [],
    };
    const out = getModeAwareRecommendations(buckets, 'backyard');
    // blueberry is neither BACKYARD_POOL nor COMMERCIAL_ONLY, so
    // it falls out of bestMatch but stays visible.
    expect(out.bestMatch.map((c) => c.crop)).not.toContain('blueberry');
    expect(out.alsoConsider.map((c) => c.crop)).toContain('blueberry');
  });
});

// ─── 4. modeAwareTasks ───────────────────────────────────
describe('modeAwareTasks', () => {
  const farmTasks = [
    { title: 'Side-dress corn with nitrogen', detail: 'Stage 3. Week 6.', priority: 'high' },
    { title: 'Scout the rows for pests', detail: 'Look for eggs.', priority: 'medium' },
    { title: 'Harvest ripe tomatoes', detail: 'Pick firm fruit.', priority: 'high' },
  ];

  it('simplifyBackyardTasks caps to 1 task', () => {
    const out = simplifyBackyardTasks(farmTasks);
    expect(out).toHaveLength(1);
  });

  it('stripStageJargon removes "Stage X" / "Week Y" noise', () => {
    const out = taskInternal.stripStageJargon('Stage 3. Week 6. Apply feed.');
    expect(out).toBe('Apply feed.');
    expect(out).not.toMatch(/stage/i);
    expect(out).not.toMatch(/week/i);
  });

  it('rewriteTitle maps heavy titles to backyard keys when t() is available', () => {
    const fakeT = (key) => ({
      'backyardTask.feed': 'Feed your plants',
      'backyardTask.checkLeaves': 'Check your leaves',
      'backyardTask.pickRipe': 'Pick what is ripe',
    }[key] || key);
    expect(taskInternal.rewriteTitle('Side-dress with nitrogen', fakeT)).toBe('Feed your plants');
    expect(taskInternal.rewriteTitle('Scout the rows for pests', fakeT)).toBe('Check your leaves');
    expect(taskInternal.rewriteTitle('Harvest ripe tomatoes', fakeT)).toBe('Pick what is ripe');
    // Unmatched title stays as-is.
    expect(taskInternal.rewriteTitle('Water the plants', fakeT)).toBe('Water the plants');
  });

  it('shapeTodayPayloadForMode passes through in farm mode', () => {
    const payload = { primaryTask: { title: 'x' }, secondaryTasks: [1, 2, 3] };
    const out = shapeTodayPayloadForMode(payload, 'farm');
    expect(out).toBe(payload);
  });

  it('shapeTodayPayloadForMode collapses secondary tasks + alerts in backyard', () => {
    const payload = {
      primaryTask: { title: 'Scout the rows for pests', detail: 'Stage 3. Check.' },
      secondaryTasks: [{ title: 'a' }, { title: 'b' }, { title: 'c' }],
      weatherAlerts: ['w1', 'w2', 'w3'],
      riskAlerts: ['r1', 'r2', 'r3', 'r4'],
      optionalChecks: [{ code: '1' }, { code: '2' }, { code: '3' }],
      behaviorSummary: { streak: 4 },
      debug: { scored: [] },
    };
    const out = shapeTodayPayloadForMode(payload, 'backyard');
    expect(out.secondaryTasks).toHaveLength(1);
    expect(out.weatherAlerts).toHaveLength(1);
    expect(out.riskAlerts.length).toBeLessThanOrEqual(2);
    expect(out.optionalChecks).toHaveLength(1);
    expect(out.behaviorSummary).toBeNull();
    expect(out.debug).toBeUndefined();
    expect(out.primaryTask.detail).not.toMatch(/stage/i);
  });

  it('generateBackyardTasks / generateFarmTasks aliases work', () => {
    expect(generateBackyardTasks(farmTasks)).toHaveLength(1);
    expect(generateFarmTasks(farmTasks)).toHaveLength(3);
  });
});

// ─── 5. i18n wire-up ─────────────────────────────────────
const NON_EN_LOCALES = ['hi', 'tw', 'es', 'pt', 'fr', 'ar', 'sw', 'id'];
const NEW_KEYS = [
  'mode.backyard', 'mode.farm',
  'backyardTask.feed', 'backyardTask.checkLeaves', 'backyardTask.waterDeeply',
  'backyardTask.thinSeedlings', 'backyardTask.supportPlants', 'backyardTask.pickRipe',
  'recommendation.warning.notBackyardFriendly',
  'recommendation.warning.heavyRainSoon',
  'recommendation.warning.tropicalOutsideClimate',
  'recommendation.warning.offSeason',
  'recommendation.warning.farmTypeMismatch',
];

describe('dual-mode i18n: every new key resolves', () => {
  it.each(NEW_KEYS)('%s has a non-empty English string', (key) => {
    expect(t(key, 'en')).toBeTruthy();
  });
  it.each(
    NON_EN_LOCALES.flatMap((lang) => NEW_KEYS.map((key) => [lang, key])),
  )('[%s] %s is localized', (lang, key) => {
    const en = t(key, 'en');
    const localized = t(key, lang);
    expect(localized).toBeTruthy();
    expect(localized).not.toBe(en);
  });
});
