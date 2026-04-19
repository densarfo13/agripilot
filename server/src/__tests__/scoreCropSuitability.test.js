/**
 * scoreCropSuitability.test.js — covers the seven fit components,
 * the guardrails, and every example the spec called out.
 */
import { describe, it, expect } from 'vitest';
import {
  scoreCropSuitability,
  buildRecommendationBuckets,
  scoreClimateFit,
  scoreRegionFit,
  scoreSeasonFit,
  scoreFarmTypeFit,
  scoreBeginnerFit,
  scoreMarketFit,
  scoreGrowingStyleFit,
  applyGuardrails,
} from '../domain/us/scoreCropSuitability.js';
import { resolveLocationProfile } from '../domain/us/usStates.js';
import { CROP_PROFILES } from '../domain/us/cropProfiles.js';
import { PLANTING_STATUS, WEIGHTS } from '../domain/us/suitabilityConfig.js';

function score(input) {
  return scoreCropSuitability({
    country: 'USA', currentMonth: 4, beginnerLevel: 'beginner', ...input,
  });
}

describe('scoreCropSuitability — output shape', () => {
  it('returns the full spec shape for a valid input', () => {
    const r = score({ state: 'MD', farmType: 'backyard', growingStyle: 'raised_bed', purpose: 'home_food', crop: 'tomato' });
    expect(r).toMatchObject({
      crop: 'tomato',
      cropName: 'Tomato',
      suitabilityScore: expect.any(Number),
      fitLevel: expect.stringMatching(/^(high|medium|low)$/),
      plantingStatus: expect.any(String),
      reasons: expect.any(Array),
      riskNotes: expect.any(Array),
      regionLabel: 'East Coast',
      fitBadge: expect.any(String),
      lowFitWarning: expect.any(Boolean),
      plantingWindowExplanation: expect.any(String),
      explain: expect.any(Object),
    });
    expect(r.explain.weights).toMatchObject(WEIGHTS);
    expect(r.explain.components).toMatchObject({
      climateFit: expect.any(Number),
      regionFit: expect.any(Number),
      seasonFit: expect.any(Number),
      farmTypeFit: expect.any(Number),
      beginnerFit: expect.any(Number),
      marketFit: expect.any(Number),
      growingStyleFit: expect.any(Number),
    });
  });

  it('handles an unknown crop without throwing', () => {
    const r = score({ state: 'MD', farmType: 'backyard', crop: 'unobtanium' });
    expect(r.suitabilityScore).toBe(0);
    expect(r.fitLevel).toBe('low');
    expect(r.plantingStatus).toBe(PLANTING_STATUS.AVOID);
  });
});

describe('component scorers', () => {
  const MD = resolveLocationProfile('MD');
  const AZ = resolveLocationProfile('AZ');
  const ND = resolveLocationProfile('ND');
  const tomato = CROP_PROFILES.tomato;
  const lettuce = CROP_PROFILES.lettuce;

  it('scoreClimateFit rewards aligned heatTolerance/rainfall', () => {
    expect(scoreClimateFit({ profile: tomato, stateProfile: MD })).toBeGreaterThanOrEqual(70);
  });
  it('scoreClimateFit penalises cool-loving crop in hot state', () => {
    const r = scoreClimateFit({ profile: lettuce, stateProfile: AZ });
    expect(r).toBeLessThan(80);
  });
  it('scoreClimateFit penalises frost-sensitive crop in high-frost state', () => {
    const r = scoreClimateFit({ profile: tomato, stateProfile: ND });
    expect(r).toBeLessThan(70);
  });

  it('scoreRegionFit > 60 when a subregion rule exists', () => {
    const r = scoreRegionFit({ crop: 'tomato', climateSubregion: 'MID_ATLANTIC', farmType: 'backyard', stateCode: 'MD' });
    expect(r).toBeGreaterThan(60);
  });
  it('scoreRegionFit === 40 when no rule at all exists', () => {
    const r = scoreRegionFit({ crop: 'apple', climateSubregion: 'ALASKA_SHORT_SEASON', farmType: 'backyard', stateCode: 'AK' });
    expect(r).toBe(40);
  });

  it('scoreSeasonFit = 100 inside planting window', () => {
    const r = scoreSeasonFit({ crop: 'tomato', climateSubregion: 'MID_ATLANTIC', farmType: 'backyard', stateCode: 'MD', currentMonth: 5 });
    expect(r).toBe(100);
  });
  it('scoreSeasonFit is low in deep off season', () => {
    const r = scoreSeasonFit({ crop: 'tomato', climateSubregion: 'MID_ATLANTIC', farmType: 'backyard', stateCode: 'MD', currentMonth: 12 });
    expect(r).toBeLessThanOrEqual(35);
  });

  it('scoreFarmTypeFit 100 when rule exists for the requested farmType', () => {
    const r = scoreFarmTypeFit({ crop: 'tomato', farmType: 'backyard', climateSubregion: 'MID_ATLANTIC', stateCode: 'MD' });
    expect(r).toBe(100);
  });

  it('scoreBeginnerFit prioritises beginner-friendly crops for beginners', () => {
    const beginner = scoreBeginnerFit({ profile: tomato, rule: { beginnerFriendly: true }, beginnerLevel: 'beginner' });
    const hard = scoreBeginnerFit({ profile: { difficulty: 'advanced' }, rule: {}, beginnerLevel: 'beginner' });
    expect(beginner).toBeGreaterThan(hard);
  });

  it('scoreMarketFit for commercial follows marketStrength', () => {
    expect(scoreMarketFit({ rule: { marketStrength: 'high' }, farmType: 'commercial' })).toBe(95);
    expect(scoreMarketFit({ rule: { marketStrength: 'low' }, farmType: 'commercial' })).toBe(40);
  });

  it('scoreMarketFit for backyard home-food uses homeUseValue', () => {
    expect(scoreMarketFit({ rule: { marketStrength: 'medium', homeUseValue: 'high' }, farmType: 'backyard', purpose: 'home_food' })).toBe(90);
  });

  it('scoreGrowingStyleFit penalises container for corn', () => {
    const r = scoreGrowingStyleFit({ profile: CROP_PROFILES.corn, farmType: 'backyard', growingStyle: 'container' });
    expect(r).toBeLessThanOrEqual(30);
  });
  it('scoreGrowingStyleFit rewards raised_bed for tomato', () => {
    const r = scoreGrowingStyleFit({ profile: tomato, farmType: 'backyard', growingStyle: 'raised_bed' });
    expect(r).toBeGreaterThanOrEqual(90);
  });
});

describe('guardrails', () => {
  it('cassava is capped + AVOID outside Florida and Hawaii', () => {
    const mdResult = score({ state: 'MD', farmType: 'backyard', growingStyle: 'raised_bed', crop: 'cassava' });
    expect(mdResult.suitabilityScore).toBeLessThanOrEqual(35);
    expect(mdResult.plantingStatus).toBe(PLANTING_STATUS.AVOID);

    const txResult = score({ state: 'TX', farmType: 'commercial', crop: 'cassava' });
    expect(txResult.suitabilityScore).toBeLessThanOrEqual(35);

    const iaResult = score({ state: 'IA', farmType: 'commercial', crop: 'cassava' });
    expect(iaResult.fitLevel).toBe('low');
  });

  it('cassava can score normally in Hawaii', () => {
    const hi = score({ state: 'HI', farmType: 'backyard', growingStyle: 'in_ground', crop: 'cassava', currentMonth: 6 });
    expect(hi.suitabilityScore).toBeGreaterThan(35);
  });

  it('container backyard with corn is hard-capped', () => {
    const r = score({ state: 'IA', farmType: 'backyard', growingStyle: 'container', crop: 'corn' });
    expect(r.suitabilityScore).toBeLessThanOrEqual(30);
    expect(r.plantingStatus).toBe(PLANTING_STATUS.AVOID);
  });

  it('off-season planting flips plantingStatus and keeps fitLevel out of high', () => {
    const winter = score({ state: 'ND', farmType: 'backyard', growingStyle: 'raised_bed', crop: 'tomato', currentMonth: 1 });
    expect([PLANTING_STATUS.AVOID, PLANTING_STATUS.WAIT]).toContain(winter.plantingStatus);
    // Must not be "Best for you" — the weighted sum can still land in
    // the medium band thanks to strong regionFit + beginnerFit, but
    // the fit badge must never read 'high' in deep off-season.
    expect(winter.fitLevel).not.toBe('high');
  });
});

describe('spec examples', () => {
  it('USA + Maryland + backyard + raised_bed + home_food + April', () => {
    const buckets = buildRecommendationBuckets({
      country: 'USA', state: 'MD', farmType: 'backyard',
      growingStyle: 'raised_bed', purpose: 'home_food',
      beginnerLevel: 'beginner', currentMonth: 4,
      crops: ['tomato', 'lettuce', 'beans', 'pepper', 'peanut', 'cassava'],
    });
    const byKey = (key) => [...buckets.bestMatch, ...buckets.alsoConsider, ...buckets.notRecommendedNow]
      .find((r) => r.crop === key);
    expect(byKey('tomato').fitLevel).toBe('high');
    expect(byKey('lettuce').fitLevel).toBe('high');
    expect(byKey('beans').fitLevel).toBe('high');
    expect(['high', 'medium']).toContain(byKey('pepper').fitLevel);
    expect(['medium', 'low']).toContain(byKey('peanut').fitLevel);
    expect(byKey('cassava').fitLevel).toBe('low');
    expect(byKey('cassava').plantingStatus).toBe(PLANTING_STATUS.AVOID);
  });

  it('USA + Texas + commercial', () => {
    const buckets = buildRecommendationBuckets({
      country: 'USA', state: 'TX', farmType: 'commercial', currentMonth: 5,
      crops: ['sorghum', 'cotton', 'peanut', 'cassava'],
    });
    const byKey = (key) => [...buckets.bestMatch, ...buckets.alsoConsider, ...buckets.notRecommendedNow]
      .find((r) => r.crop === key);
    expect(byKey('sorghum').fitLevel).toBe('high');
    expect(byKey('cotton').fitLevel).toBe('high');
    expect(['high', 'medium']).toContain(byKey('peanut').fitLevel);
    expect(byKey('cassava').fitLevel).toBe('low');
  });

  it('USA + Florida + commercial surfaces peanut + vegetables', () => {
    const buckets = buildRecommendationBuckets({
      country: 'USA', state: 'FL', farmType: 'commercial', currentMonth: 4,
      crops: ['peanut', 'tomato', 'pepper', 'citrus', 'cassava'],
    });
    const byKey = (key) => [...buckets.bestMatch, ...buckets.alsoConsider, ...buckets.notRecommendedNow]
      .find((r) => r.crop === key);
    expect(['high', 'medium']).toContain(byKey('peanut').fitLevel);
    // Cassava is allowed in Florida; the engine shouldn't hard-cap it.
    expect(byKey('cassava').suitabilityScore).toBeGreaterThan(35);
  });

  it('USA + Georgia + commercial → peanut high', () => {
    const r = score({ state: 'GA', farmType: 'commercial', crop: 'peanut', currentMonth: 5 });
    expect(r.fitLevel).toBe('high');
  });

  it('USA + Iowa + commercial → corn + soybean high, cassava low', () => {
    const buckets = buildRecommendationBuckets({
      country: 'USA', state: 'IA', farmType: 'commercial', currentMonth: 5,
      crops: ['corn', 'soybean', 'cassava'],
    });
    const byKey = (key) => [...buckets.bestMatch, ...buckets.alsoConsider, ...buckets.notRecommendedNow]
      .find((r) => r.crop === key);
    expect(byKey('corn').fitLevel).toBe('high');
    expect(byKey('soybean').fitLevel).toBe('high');
    expect(byKey('cassava').fitLevel).toBe('low');
  });
});

describe('applyGuardrails', () => {
  it('is a no-op when no predicate fires', () => {
    const r = applyGuardrails({
      score: 85, status: PLANTING_STATUS.PLANT_NOW,
      reasons: [], riskNotes: [],
      ctx: { crop: 'tomato', stateCode: 'MD', country: 'US' },
      info: { climateFit: 80, seasonFit: 100 },
    });
    expect(r.score).toBe(85);
    expect(r.status).toBe(PLANTING_STATUS.PLANT_NOW);
  });
});
