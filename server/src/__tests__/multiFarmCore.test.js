/**
 * multiFarmCore.test.js — contract for the multi-farm +
 * Find-My-Best-Crop routing helpers.
 *
 * Covers:
 *   resolveFindBestCropRoute     §2
 *   hasMinimumFarmForRec         §7
 *   destinationToUrl
 *   buildRecommendationContext   §6
 *   normalizeRecommendationResult
 *   rankRecommendations
 *   §13 dev assertions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  resolveFindBestCropRoute, hasMinimumFarmForRec, destinationToUrl,
} from '../../../src/core/multiFarm/findBestCropRoute.js';
import {
  buildRecommendationContext,
  normalizeRecommendationResult,
  rankRecommendations,
} from '../../../src/core/multiFarm/recommendationContext.js';
import {
  assertFindBestCropNotOnboarding,
  assertNewFarmNotOverwrite,
  assertEditFarmNotOnboarding,
  assertRecommendationsHaveFarmId,
  assertCurrentFarmIdSwitched,
  assertDownstreamRecomputed,
  assertFarmsHaveDistinctIdentities,
} from '../../../src/core/multiFarm/multiFarmDevAssertions.js';

// ─── hasMinimumFarmForRec ────────────────────────────────────
describe('hasMinimumFarmForRec', () => {
  it('true when countryCode is set', () => {
    expect(hasMinimumFarmForRec({ countryCode: 'GH' })).toBe(true);
  });
  it('true when legacy country is set', () => {
    expect(hasMinimumFarmForRec({ country: 'Ghana' })).toBe(true);
  });
  it('false when neither set', () => {
    expect(hasMinimumFarmForRec({})).toBe(false);
    expect(hasMinimumFarmForRec(null)).toBe(false);
    expect(hasMinimumFarmForRec({ country: '   ' })).toBe(false);
  });
});

// ─── resolveFindBestCropRoute ────────────────────────────────
describe('resolveFindBestCropRoute', () => {
  it('first-time farmer → /onboarding/fast', () => {
    // no profile, no farms, no fast state → first-time.
    globalThis.window = { localStorage: new Map() };
    const dest = resolveFindBestCropRoute({ profile: null, farms: [] });
    expect(dest.path).toBe('/onboarding/fast');
  });

  it('existing user with no country → edit-farm completion mode', () => {
    // Have a legacy profile with farmerName but no country → not first-time
    // (hasLegacyProfile needs name+crop+country). We supply an active farm
    // via the `farms` signal so the first-time predicate turns false.
    const profile = { id: 'farm_1', farmerName: 'Ama' };
    const farms   = [{ id: 'farm_1', status: 'active' }];
    const dest = resolveFindBestCropRoute({ profile, farms });
    expect(dest.path).toBe('/edit-farm');
    expect(dest.query.mode).toBe('complete_for_recommendation');
    expect(dest.query.farmId).toBe('farm_1');
  });

  it('existing user with country → /crop-recommendations?farmId=X', () => {
    const profile = { id: 'farm_1', farmerName: 'A', cropType: 'MAIZE',
                      countryCode: 'GH', country: 'Ghana' };
    const farms   = [{ id: 'farm_1', status: 'active' }];
    const dest = resolveFindBestCropRoute({ profile, farms });
    expect(dest.path).toBe('/crop-recommendations');
    expect(dest.query.farmId).toBe('farm_1');
  });

  it('returns frozen object', () => {
    globalThis.window = { localStorage: new Map() };
    const dest = resolveFindBestCropRoute({ profile: null, farms: [] });
    expect(Object.isFrozen(dest)).toBe(true);
  });
});

// ─── destinationToUrl ────────────────────────────────────────
describe('destinationToUrl', () => {
  it('renders simple path', () => {
    expect(destinationToUrl({ path: '/x', query: {} })).toBe('/x');
  });
  it('renders query string with encoding', () => {
    const url = destinationToUrl({ path: '/r', query: { farmId: 'a b', other: 'c&d' } });
    expect(url).toBe('/r?farmId=a%20b&other=c%26d');
  });
  it('skips empty / null query values', () => {
    const url = destinationToUrl({ path: '/r', query: { farmId: '1', missing: null, empty: '' } });
    expect(url).toBe('/r?farmId=1');
  });
  it('handles missing query', () => {
    expect(destinationToUrl({ path: '/r' })).toBe('/r');
  });
  it('safe default on bad input', () => {
    expect(destinationToUrl(null)).toBe('/');
  });
});

// ─── buildRecommendationContext ──────────────────────────────
describe('buildRecommendationContext', () => {
  it('maps v2 profile shape', () => {
    const ctx = buildRecommendationContext({
      id: 'farm_1', countryCode: 'GH', stateCode: 'AR',
      cropType: 'MAIZE', cropStage: 'vegetative',
      size: 3.5, sizeUnit: 'ACRE',
    });
    expect(ctx.farmId).toBe('farm_1');
    expect(ctx.countryCode).toBe('GH');
    expect(ctx.stateCode).toBe('AR');
    expect(ctx.cropId).toBe('maize');
    expect(ctx.stage).toBe('vegetative');
    expect(ctx.farmSize).toBe(3.5);
    expect(ctx.farmSizeUnit).toBe('ACRE');
  });

  it('accepts legacy farm shape (country + crop + stage)', () => {
    const ctx = buildRecommendationContext({
      id: 'f1', country: 'Ghana', crop: 'rice', stage: 'planting',
    });
    expect(ctx.countryCode).toBe('Ghana');
    expect(ctx.cropId).toBe('rice');
    expect(ctx.stage).toBe('planting');
  });

  it('normalizes missing fields to null, not undefined', () => {
    const ctx = buildRecommendationContext({});
    expect(ctx.farmId).toBeNull();
    expect(ctx.countryCode).toBeNull();
    expect(ctx.cropId).toBeNull();
    expect(ctx.farmSize).toBeNull();
  });

  it('passes through regionBucket + weatherContext from extras', () => {
    const ctx = buildRecommendationContext(
      { countryCode: 'GH' },
      { regionBucket: 'tropical_mixed', weatherContext: { recentRainMm: 23 } },
    );
    expect(ctx.regionBucket).toBe('tropical_mixed');
    expect(ctx.weatherContext).toEqual({ recentRainMm: 23 });
  });

  it('returns frozen object', () => {
    expect(Object.isFrozen(buildRecommendationContext({}))).toBe(true);
  });

  it('drops non-numeric size values', () => {
    const ctx = buildRecommendationContext({ size: 'many' });
    expect(ctx.farmSize).toBeNull();
  });
});

// ─── normalizeRecommendationResult ───────────────────────────
describe('normalizeRecommendationResult', () => {
  it('normalizes full entries', () => {
    const items = normalizeRecommendationResult([
      { cropId: 'MAIZE', score: 92, reasonKey: 'recommendation.better_rainfall_fit', params: {} },
    ]);
    expect(items[0].cropId).toBe('maize');
    expect(items[0].score).toBe(92);
    expect(items[0].reasonKey).toBe('recommendation.better_rainfall_fit');
    expect(items[0].isCurrentCrop).toBe(false);
  });

  it('marks current crop', () => {
    const items = normalizeRecommendationResult(
      [{ cropId: 'cassava', score: 80, reasonKey: 'r.k' }],
      'CASSAVA',
    );
    expect(items[0].isCurrentCrop).toBe(true);
  });

  it('honors explicit isCurrentCrop flag even without a current', () => {
    const items = normalizeRecommendationResult(
      [{ cropId: 'rice', isCurrentCrop: true, reasonKey: 'r.k' }],
    );
    expect(items[0].isCurrentCrop).toBe(true);
  });

  it('drops entries without cropId', () => {
    const items = normalizeRecommendationResult([{}, { cropId: '   ' }]);
    expect(items.length).toBe(0);
  });

  it('defaults reasonKey when missing', () => {
    const items = normalizeRecommendationResult([{ cropId: 'maize' }]);
    expect(items[0].reasonKey).toBe('recommendation.no_reason');
  });

  it('non-finite score becomes null', () => {
    const items = normalizeRecommendationResult([{ cropId: 'maize', score: 'NaN' }]);
    expect(items[0].score).toBeNull();
  });

  it('returns [] for non-array input', () => {
    expect(normalizeRecommendationResult(null)).toEqual([]);
    expect(normalizeRecommendationResult('bad')).toEqual([]);
  });

  it('entries are frozen', () => {
    const items = normalizeRecommendationResult([{ cropId: 'maize', score: 1, reasonKey: 'r' }]);
    expect(Object.isFrozen(items[0])).toBe(true);
  });
});

// ─── rankRecommendations ─────────────────────────────────────
describe('rankRecommendations', () => {
  it('sorts by score descending', () => {
    const items = rankRecommendations([
      { cropId: 'a', score: 70, isCurrentCrop: false },
      { cropId: 'b', score: 90, isCurrentCrop: false },
      { cropId: 'c', score: 80, isCurrentCrop: false },
    ]);
    expect(items.map((x) => x.cropId)).toEqual(['b', 'c', 'a']);
  });

  it('pins non-current crop first on score tie', () => {
    const items = rankRecommendations([
      { cropId: 'curr', score: 85, isCurrentCrop: true },
      { cropId: 'alt',  score: 85, isCurrentCrop: false },
    ]);
    expect(items[0].cropId).toBe('alt');
    expect(items[1].cropId).toBe('curr');
  });

  it('null scores sink to the bottom', () => {
    const items = rankRecommendations([
      { cropId: 'a', score: null, isCurrentCrop: false },
      { cropId: 'b', score: 50,   isCurrentCrop: false },
    ]);
    expect(items[0].cropId).toBe('b');
  });

  it('safe on non-array input', () => {
    expect(rankRecommendations(null)).toEqual([]);
  });
});

// ─── §13 dev assertions ──────────────────────────────────────
describe('§13 dev assertions', () => {
  let warnSpy;
  beforeEach(() => {
    globalThis.window = globalThis.window || {};
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => { warnSpy.mockRestore(); });

  it('assertFindBestCropNotOnboarding silent on /crop-recommendations', () => {
    assertFindBestCropNotOnboarding(true, '/crop-recommendations?farmId=1');
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('assertFindBestCropNotOnboarding warns when existing user routed to onboarding', () => {
    assertFindBestCropNotOnboarding(true, '/onboarding/fast');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
  it('assertFindBestCropNotOnboarding silent for first-time (not existing)', () => {
    assertFindBestCropNotOnboarding(false, '/onboarding/fast');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('assertNewFarmNotOverwrite silent when farm count grew by one', () => {
    assertNewFarmNotOverwrite('f1', [{ id: 'f1' }], [{ id: 'f1' }, { id: 'f2' }]);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('assertNewFarmNotOverwrite warns when count did not grow', () => {
    assertNewFarmNotOverwrite('f1', [{ id: 'f1' }], [{ id: 'f2' }]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('assertEditFarmNotOnboarding warns on onboarding destinations', () => {
    assertEditFarmNotOnboarding('/onboarding/smart');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    assertEditFarmNotOnboarding('/edit-farm');
    expect(warnSpy).toHaveBeenCalledTimes(1); // unchanged — silent on edit-farm
  });

  it('assertRecommendationsHaveFarmId warns when missing for existing user', () => {
    assertRecommendationsHaveFarmId(true, null);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    assertRecommendationsHaveFarmId(true, 'f1');
    expect(warnSpy).toHaveBeenCalledTimes(1); // silent now
  });

  it('assertCurrentFarmIdSwitched warns on mismatch', () => {
    assertCurrentFarmIdSwitched('f2', 'f1');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
  it('assertCurrentFarmIdSwitched silent when expected matches actual', () => {
    assertCurrentFarmIdSwitched('f2', 'f2');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('assertDownstreamRecomputed warns when did not refresh', () => {
    assertDownstreamRecomputed('farm_switch', false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('assertFarmsHaveDistinctIdentities silent on unique references', () => {
    assertFarmsHaveDistinctIdentities([{ id: 'a' }, { id: 'b' }]);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('assertFarmsHaveDistinctIdentities warns on shared refs', () => {
    const shared = { id: 'oops' };
    assertFarmsHaveDistinctIdentities([shared, shared]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
