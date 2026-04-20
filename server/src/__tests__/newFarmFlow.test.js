/**
 * newFarmFlow.test.js — contract for the Find-My-Best-Crop
 * fix + Add-New-Farm flow:
 *   buildCropFitAnswersFromFarm  (pure)
 *   hasEnoughForRecommendations  (pure)
 *   NEW_FARM_TRANSLATIONS coverage
 *   merge into the active dictionary
 */

import { describe, it, expect } from 'vitest';

import {
  buildCropFitAnswersFromFarm, hasEnoughForRecommendations,
} from '../../../src/core/multiFarm/farmToCropFitAnswers.js';
import { NEW_FARM_TRANSLATIONS } from '../../../src/i18n/newFarmTranslations.js';
import { mergeManyOverlays } from '../../../src/i18n/mergeOverlays.js';

// ─── buildCropFitAnswersFromFarm ─────────────────────────────
describe('buildCropFitAnswersFromFarm', () => {
  it('projects a v2 profile into the cropFit answers shape', () => {
    const a = buildCropFitAnswersFromFarm({
      id: 'f1', countryCode: 'gh', stateCode: 'AR',
      cropType: 'MAIZE', size: 5, sizeUnit: 'ACRE',
    });
    expect(a.farmId).toBe('f1');
    expect(a.country).toBe('GH');
    expect(a.location).toBe('AR, gh');
    expect(a.landSize).toBe('medium');      // 5 acres → medium
    expect(a.preferredCrop).toBe('maize');
    expect(a._currentCrop).toBe('maize');
  });

  it('bucket mapping for land size — small/medium/large', () => {
    expect(buildCropFitAnswersFromFarm({ size: 1, sizeUnit: 'ACRE' }).landSize).toBe('small');
    expect(buildCropFitAnswersFromFarm({ size: 5, sizeUnit: 'ACRE' }).landSize).toBe('medium');
    expect(buildCropFitAnswersFromFarm({ size: 50, sizeUnit: 'ACRE' }).landSize).toBe('large');
  });

  it('converts hectares to acres before bucketing', () => {
    // 5 hectares ≈ 12.35 acres → large
    expect(buildCropFitAnswersFromFarm({ size: 5, sizeUnit: 'HECTARE' }).landSize).toBe('large');
    // 0.5 hectare ≈ 1.24 acres → small
    expect(buildCropFitAnswersFromFarm({ size: 0.5, sizeUnit: 'HECTARE' }).landSize).toBe('small');
  });

  it('defaults to sensible values when fields missing', () => {
    const a = buildCropFitAnswersFromFarm({});
    expect(a.waterAccess).toBe('rain_only');
    expect(a.budget).toBe('low');
    expect(a.experience).toBe('some');
    expect(a.goal).toBe('home_food');
  });

  it('accepts legacy shape (country + crop)', () => {
    const a = buildCropFitAnswersFromFarm({ country: 'Ghana', crop: 'rice' });
    expect(a.country).toBe('GHANA');
    expect(a.preferredCrop).toBe('rice');
  });

  it('returns frozen object', () => {
    expect(Object.isFrozen(buildCropFitAnswersFromFarm({}))).toBe(true);
  });

  it('null / non-object input → frozen safe defaults', () => {
    const a = buildCropFitAnswersFromFarm(null);
    expect(a.farmId).toBeNull();
    expect(a.landSize).toBe('small');
    expect(a.country).toBeNull();
  });
});

// ─── hasEnoughForRecommendations ─────────────────────────────
describe('hasEnoughForRecommendations', () => {
  it('true when country is present', () => {
    expect(hasEnoughForRecommendations({ countryCode: 'GH' })).toBe(true);
    expect(hasEnoughForRecommendations({ country: 'Ghana' })).toBe(true);
  });
  it('false when no country', () => {
    expect(hasEnoughForRecommendations({})).toBe(false);
    expect(hasEnoughForRecommendations(null)).toBe(false);
    expect(hasEnoughForRecommendations({ country: '   ' })).toBe(false);
  });
});

// ─── NEW_FARM_TRANSLATIONS ───────────────────────────────────
describe('NEW_FARM_TRANSLATIONS coverage', () => {
  const required = [
    'myFarm.addNewFarm',
    'farm.newFarm.title',
    'farm.newFarm.helper',
    'farm.newFarm.saveNewFarm',
    'farm.newFarm.countryRequired',
    'farm.newFarm.saveFailed',
    'farm.newFarm.successTitle',
    'farm.newFarm.successHelper',
    'farm.newFarm.switchToThis',
    'farm.newFarm.stayOnCurrent',
  ];

  it('English has every required key', () => {
    for (const k of required) expect(NEW_FARM_TRANSLATIONS.en[k]).toBeTruthy();
  });

  it('Hindi has every required key', () => {
    for (const k of required) expect(NEW_FARM_TRANSLATIONS.hi[k]).toBeTruthy();
  });

  it('French has every required key', () => {
    for (const k of required) expect(NEW_FARM_TRANSLATIONS.fr[k]).toBeTruthy();
  });

  it('Hindi values use Devanagari', () => {
    const s = NEW_FARM_TRANSLATIONS.hi['farm.newFarm.title'];
    expect(s).toMatch(/[\u0900-\u097F]/);
  });
});

describe('merged dictionary includes new-farm keys', () => {
  it('merges into a fresh dict without losing keys', () => {
    const T = {};
    mergeManyOverlays(T, [NEW_FARM_TRANSLATIONS]);
    expect(T['myFarm.addNewFarm'].en).toBe('Add New Farm');
    expect(T['myFarm.addNewFarm'].hi).toMatch(/[\u0900-\u097F]/);
    expect(T['myFarm.addNewFarm'].fr).toMatch(/[Aa]jouter/);
  });
});
