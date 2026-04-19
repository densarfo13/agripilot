/**
 * cropFitWarning.test.js — asserts the pure helper raises warnings
 * for the right reasons and stays quiet for good-fit crops.
 */
import { describe, it, expect } from 'vitest';
import { evaluateCropFit } from '../domain/us/cropFitWarning.js';
import { resolveLocationProfile } from '../domain/us/usStates.js';
import { recommendCropsForUSFarm } from '../domain/us/recommend.js';

const TX = resolveLocationProfile('TX');
const HI = resolveLocationProfile('HI');
const ND = resolveLocationProfile('ND');
const AZ = resolveLocationProfile('AZ');

describe('evaluateCropFit', () => {
  it('warns when cassava is shown in Texas', () => {
    const r = evaluateCropFit({ crop: { key: 'cassava' }, stateProfile: TX, score: 50 });
    expect(r.show).toBe(true);
    expect(r.reasons).toContain('climate_mismatch');
  });

  it('does NOT warn for cassava in Hawaii at a healthy score', () => {
    const r = evaluateCropFit({ crop: { key: 'cassava' }, stateProfile: HI, score: 80 });
    expect(r.show).toBe(false);
  });

  it('warns for a frost-sensitive crop in a high-frost state', () => {
    const r = evaluateCropFit({ crop: { key: 'tomato' }, stateProfile: ND, score: 65 });
    expect(r.show).toBe(true);
    expect(r.reasons).toContain('frost_sensitive_in_cold_zone');
  });

  it('warns for a high-water crop in a dry state', () => {
    const r = evaluateCropFit({ crop: { key: 'almonds' }, stateProfile: AZ, score: 70 });
    expect(r.show).toBe(true);
    expect(r.reasons).toContain('high_water_in_dry_zone');
  });

  it('warns when the score is on the border', () => {
    const r = evaluateCropFit({ crop: { key: 'lettuce' }, stateProfile: TX, score: 60 });
    expect(r.show).toBe(true);
    expect(r.reasons).toContain('low_suitability_score');
  });

  it('is silent when crop key is missing or unknown', () => {
    expect(evaluateCropFit({ crop: null, stateProfile: TX, score: 80 }).show).toBe(false);
    expect(evaluateCropFit({ crop: { key: 'unknown_crop' }, stateProfile: TX, score: 80 }).show).toBe(false);
  });

  it('recommendCropsForUSFarm emits warning={...} on borderline cards', () => {
    const out = recommendCropsForUSFarm({
      country: 'USA', state: 'TX', farmType: 'backyard',
      beginnerLevel: 'beginner', currentMonth: 7, growingStyle: 'container',
    });
    // bestMatch should never carry a warning (high score + good fit).
    for (const r of out.bestMatch) expect(r.warning).toBeNull();
    // notRecommendedNow should carry warnings (borderline scores).
    if (out.notRecommendedNow.length) {
      expect(out.notRecommendedNow.some((r) => r.warning)).toBe(true);
    }
  });
});
