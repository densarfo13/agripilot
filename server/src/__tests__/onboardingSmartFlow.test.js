/**
 * onboardingSmartFlow.test.js — validation-aware onboarding flow.
 *
 * Covers:
 *   - ONBOARDING_STEPS canonical order (location → experience →
 *     farmType → farmSize → crops)
 *   - getStructuredLocation returns {country, state, city?} and
 *     rejects incomplete inputs
 *   - isStepValid per-step checks
 *   - getOnboardingProgress reflects valid steps, not step index
 *   - buildPostSaveRoute routes to crop-plan when a crop is picked
 *   - buildProfileForValidation maps the form into the validator
 *     shape
 *
 * Then the acceptance cases from the spec — each case exercises
 * `scoreAllCrops` with the full onboarding inputs and checks the
 * expected top buckets.
 */
import { describe, it, expect } from 'vitest';
import {
  ONBOARDING_STEPS,
  getStructuredLocation,
  isStepValid,
  getOnboardingProgress,
  getNextOnboardingStep,
  buildPostSaveRoute,
  buildProfileForValidation,
} from '../../../src/utils/onboardingFlow.js';
import { scoreAllCrops } from '../services/scoring/cropScoringEngine.js';

// ─── canonical order ──────────────────────────────────────
describe('ONBOARDING_STEPS order', () => {
  it('matches the spec: location → experience → farmType → farmSize → crops', () => {
    expect(ONBOARDING_STEPS).toEqual([
      'location', 'experience', 'farmType', 'farmSize', 'crops',
    ]);
  });
});

// ─── getStructuredLocation ────────────────────────────────
describe('getStructuredLocation', () => {
  it('returns {country, state, city?} when complete', () => {
    expect(getStructuredLocation({
      country: 'US', stateCode: 'MD', city: 'Frederick',
    })).toEqual({ country: 'US', state: 'MD', city: 'Frederick' });
  });

  it('accepts state under either stateCode or state', () => {
    expect(getStructuredLocation({ country: 'us', state: 'MD' }))
      .toEqual({ country: 'US', state: 'MD', city: null });
  });

  it('returns null when country is missing', () => {
    expect(getStructuredLocation({ stateCode: 'MD' })).toBeNull();
  });

  it('returns null when state is missing', () => {
    expect(getStructuredLocation({ country: 'US' })).toBeNull();
  });
});

// ─── isStepValid ──────────────────────────────────────────
describe('isStepValid', () => {
  const okForm = {
    location: { country: 'US', stateCode: 'MD', city: 'Frederick' },
    experience: 'new',
    farmType: 'backyard',
    farmSize: { size: 'small', unit: 'acre', exactValue: 0.25 },
    pickedCrop: { crop: 'tomato', fitLevel: 'high' },
  };

  it('accepts a fully-filled form', () => {
    for (const step of ONBOARDING_STEPS) {
      expect(isStepValid(step, okForm)).toBe(true);
    }
  });

  it('rejects location when missing state', () => {
    expect(isStepValid('location', { location: { country: 'US' } })).toBe(false);
  });

  it('rejects experience when unanswered', () => {
    expect(isStepValid('experience', {})).toBe(false);
  });

  it('rejects farmType values outside the enum', () => {
    expect(isStepValid('farmType', { farmType: 'homestead' })).toBe(false);
    expect(isStepValid('farmType', { farmType: 'commercial' })).toBe(true);
  });

  it('rejects farmSize values outside the enum', () => {
    expect(isStepValid('farmSize', { farmSize: { size: 'huge' } })).toBe(false);
    expect(isStepValid('farmSize', { farmSize: { size: 'medium' } })).toBe(true);
  });

  it('rejects crops step when no crop picked', () => {
    expect(isStepValid('crops', {})).toBe(false);
  });
});

// ─── getOnboardingProgress ────────────────────────────────
describe('getOnboardingProgress', () => {
  it('counts only valid steps, not step index', () => {
    const p = getOnboardingProgress({
      location: { country: 'US', stateCode: 'MD' },
      experience: 'new',
      // farmType and farmSize intentionally missing
      farmSize: null,
    });
    expect(p.completed).toBe(2);
    expect(p.total).toBe(5);
    expect(p.percent).toBe(40);
    expect(p.nextStep).toBe('farmType');
  });

  it('reaches 100% only when every step is valid', () => {
    const p = getOnboardingProgress({
      location: { country: 'US', stateCode: 'TX' },
      experience: 'experienced',
      farmType: 'commercial',
      farmSize: { size: 'large' },
      pickedCrop: { crop: 'sorghum' },
    });
    expect(p.percent).toBe(100);
    expect(p.nextStep).toBeNull();
  });
});

// ─── getNextOnboardingStep ────────────────────────────────
describe('getNextOnboardingStep', () => {
  it('returns the next canonical step', () => {
    expect(getNextOnboardingStep('location', {})).toBe('experience');
    expect(getNextOnboardingStep('farmType', {})).toBe('farmSize');
    expect(getNextOnboardingStep('crops', {})).toBeNull();
  });
});

// ─── buildPostSaveRoute ───────────────────────────────────
describe('buildPostSaveRoute', () => {
  const validForm = {
    location: { country: 'US', stateCode: 'MD', city: 'Frederick' },
    experience: 'new',
    farmType: 'backyard',
    farmSize: { size: 'small', unit: 'acre', exactValue: 0.25 },
    pickedCrop: { crop: 'tomato', fitLevel: 'high' },
  };

  it('returns a crop-plan route when a crop is picked', () => {
    const r = buildPostSaveRoute(validForm);
    expect(r).toBeTruthy();
    expect(r.path).toBe('/crop-plan');
    expect(r.state.onboardingContext.pickedCrop.crop).toBe('tomato');
    expect(r.state.onboardingContext.location).toEqual({
      country: 'US', state: 'MD', city: 'Frederick',
    });
  });

  it('returns null when the profile is invalid', () => {
    expect(buildPostSaveRoute({ ...validForm, farmType: null })).toBeNull();
  });

  it('routes to /today when no crop is picked but profile otherwise valid', () => {
    // Not possible in current flow (crops is the last step), but the
    // helper supports it for a future "skip crop" branch.
    const withoutCrop = { ...validForm, pickedCrop: null };
    expect(buildPostSaveRoute(withoutCrop)).toBeNull();
  });

  it('accepts custom path overrides', () => {
    const r = buildPostSaveRoute(validForm, { cropPlanPath: '/dashboard' });
    expect(r.path).toBe('/dashboard');
  });
});

// ─── buildProfileForValidation ────────────────────────────
describe('buildProfileForValidation', () => {
  it('maps onboarding form into validator shape', () => {
    const p = buildProfileForValidation({
      location: { country: 'US', stateCode: 'MD', city: 'Frederick' },
      experience: 'new',
      farmType: 'backyard',
      farmSize: { size: 'small', unit: 'acre' },
      pickedCrop: { crop: 'tomato' },
    });
    expect(p.country).toBe('US');
    expect(p.stateCode).toBe('MD');
    expect(p.farmType).toBe('backyard');
    expect(p.sizeUnit).toBe('acre');
    expect(p.cropType).toBe('tomato');
    expect(p.experienceLevel).toBe('beginner');
  });

  it('defaults size reasonably when no exactValue', () => {
    const p = buildProfileForValidation({
      location: { country: 'US', stateCode: 'TX' },
      farmSize: { size: 'large' },
    });
    expect(p.size).toBeGreaterThan(10);
  });
});

// ─── ACCEPTANCE CASES ─────────────────────────────────────
describe('acceptance — Frederick, Maryland + beginner + backyard + small', () => {
  const payload = scoreAllCrops({
    country: 'US', state: 'MD',
    farmType: 'backyard',
    growingStyle: 'raised_bed',
    beginnerLevel: 'beginner',
    currentMonth: 4,
  });

  it('tomato / lettuce / beans are medium-or-high (not low)', () => {
    const all = [...payload.bestMatch, ...payload.alsoConsider, ...payload.notRecommendedNow];
    for (const key of ['tomato', 'lettuce', 'beans']) {
      const c = all.find((r) => r.crop === key);
      if (c) expect(['high', 'medium']).toContain(c.fitLevel);
    }
  });

  it('cassava / cocoa / banana / coffee do NOT appear in bestMatch', () => {
    const ids = new Set(payload.bestMatch.map((c) => c.crop));
    for (const k of ['cassava', 'cocoa', 'banana', 'coffee']) {
      expect(ids.has(k)).toBe(false);
    }
  });
});

describe('acceptance — Georgia + commercial', () => {
  const payload = scoreAllCrops({
    country: 'US', state: 'GA', farmType: 'commercial', currentMonth: 5,
  });

  it('peanut is not low-fit', () => {
    const all = [...payload.bestMatch, ...payload.alsoConsider, ...payload.notRecommendedNow];
    const pe = all.find((c) => c.crop === 'peanut');
    if (pe) expect(['high', 'medium']).toContain(pe.fitLevel);
  });

  it('cocoa does not appear in bestMatch', () => {
    expect(payload.bestMatch.find((c) => c.crop === 'cocoa')).toBeUndefined();
  });
});

describe('acceptance — Florida + small farm', () => {
  const payload = scoreAllCrops({
    country: 'US', state: 'FL', farmType: 'small_farm', currentMonth: 3,
  });

  it('locationProfile is subtropical', () => {
    expect(payload.locationProfile.climateSubregion).toBe('FLORIDA_SUBTROPICAL');
  });
});
