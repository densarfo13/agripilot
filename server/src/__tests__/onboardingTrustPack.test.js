/**
 * onboardingTrustPack.test.js — covers the trust-sensitive
 * moments in the onboarding flow:
 *
 *   • auto-detect location: confirmation required before commit
 *   • detect failure / offline: manual fallback never blocks
 *   • returning user bypass: completed users skip onboarding
 *   • interrupted resume: language + location + progress persist
 *   • missing-critical-field recovery: no infinite loop
 *   • next-step bridges enforced for every strong state
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  validateOnboardingStep, firstIncompleteStep,
} from '../../../src/utils/onboardingV2/validateOnboardingStep.js';
import {
  resumeOnboardingStep, buildPostOnboardingRoute, deriveMode,
  getNextOnboardingStep,
} from '../../../src/utils/onboardingV2/getNextOnboardingStep.js';
import {
  defaultOnboardingState, saveOnboardingState, loadOnboardingState,
  clearOnboardingState,
} from '../../../src/utils/onboardingV2/onboardingPersistence.js';
import { ONBOARDING_STEPS, STEP_ORDER } from '../../../src/utils/onboardingV2/stepIds.js';

import {
  resolveFarmerState, STATE_TYPES,
} from '../../../src/utils/farmerState/index.js';

// ─── localStorage shim (tests run under Node) ────────────
function installLocalStorage() {
  const store = new Map();
  const fake = {
    getItem:    (k) => store.has(k) ? store.get(k) : null,
    setItem:    (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear:      () => store.clear(),
    key:        (i) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  globalThis.window = { localStorage: fake };
  globalThis.localStorage = fake;
  return store;
}

// ─── A. AUTO-DETECT TRUST PROTECTION ─────────────────────
describe('auto-detect location trust', () => {
  it('A. detection succeeded but user did NOT confirm → cannot advance', () => {
    const state = {
      language: 'en',
      location: {
        source: 'detect',
        confirmed: false,
        country: 'US',
        stateCode: 'MD',
        city: 'Frederick',
      },
    };
    const res = validateOnboardingStep('location', state);
    expect(res.ok).toBe(false);
    expect(res.reasons).toContain('location_not_confirmed');
  });

  it('B. detection succeeded + user confirmed → advances', () => {
    const state = {
      language: 'en',
      location: {
        source: 'detect',
        confirmed: true,
        country: 'US',
        stateCode: 'MD',
      },
    };
    const res = validateOnboardingStep('location', state);
    expect(res.ok).toBe(true);
  });

  it('C. detection denied → manual fallback still works, no blocked onboarding', () => {
    const state = {
      language: 'en',
      location: {
        source: 'manual',
        confirmed: false,
        country: 'GH',
        stateCode: 'AR',
      },
    };
    const res = validateOnboardingStep('location', state);
    expect(res.ok).toBe(true);  // manual source doesn't require confirmed flag
  });

  it('D. detection fails offline / reverse-geocode fails → manual still works', () => {
    // We simulate the "fallback to manual after failure" state —
    // no error strings leak, just missing country → validator
    // asks the user to pick one.
    const stillInProgress = {
      language: 'en',
      location: { source: 'manual', confirmed: false, country: null },
    };
    const r1 = validateOnboardingStep('location', stillInProgress);
    expect(r1.ok).toBe(false);
    expect(r1.reasons).toContain('missing_country');
    // Once the user fills the country, it validates.
    const complete = {
      language: 'en',
      location: { source: 'manual', confirmed: false, country: 'GH' },
    };
    expect(validateOnboardingStep('location', complete).ok).toBe(true);
  });

  it('detected values without confirmation never treat confirmed as true', () => {
    const state = {
      language: 'en',
      location: { source: 'detect', confirmed: false, country: 'US', stateCode: 'MD' },
    };
    expect(state.location.confirmed).toBe(false);
    // Engine reads `location.confirmed` directly — never infers.
    expect(validateOnboardingStep('location', state).ok).toBe(false);
  });
});

// ─── B. RETURNING USER BYPASS / RESUME ───────────────────
describe('returning user bypass', () => {
  beforeEach(() => installLocalStorage());

  it('A. completed setup user → buildPostOnboardingRoute points Home', () => {
    const finished = {
      language: 'en',
      location: { source: 'detect', confirmed: true, country: 'GH' },
      growingType: 'small', mode: 'farm',
      experience: 'new',
      sizeDetails: { sizeBand: 'small' },
      selectedCrop: 'maize',
    };
    const route = buildPostOnboardingRoute(finished, { immediateTask: null });
    expect(route.route).toBe('/farmer');
  });

  it('A2. completed user with immediate task → routes to Today', () => {
    const finished = { selectedCrop: 'maize' };
    const route = buildPostOnboardingRoute(finished, {
      immediateTask: { id: 't-1', title: 'Water your maize today' },
    });
    expect(route.route).toBe('/farmer/today');
  });

  it('B. interrupted onboarding resumes on the first missing step', () => {
    const partial = defaultOnboardingState('hi');
    partial.location = { source: 'detect', confirmed: true, country: 'IN', stateCode: 'AP' };
    partial.growingType = 'small'; partial.mode = 'farm';
    // experience / sizeDetails / crop still missing
    saveOnboardingState(partial);
    const back = loadOnboardingState();
    expect(back.language).toBe('hi');
    expect(back.location.country).toBe('IN');
    expect(resumeOnboardingStep(back)).toBe('experience');
  });

  it('C. completed user with a missing critical profile field → graceful recovery', () => {
    // User says they finished onboarding but somehow the
    // selected crop got wiped (e.g. db migration). Resume must
    // NOT infinite-loop — it routes to crop_confirm.
    const broken = defaultOnboardingState('en');
    broken.location = { source: 'detect', confirmed: true, country: 'US', stateCode: 'MD' };
    broken.growingType = 'small'; broken.mode = 'farm';
    broken.experience = 'new';
    broken.sizeDetails = { sizeBand: 'small' };
    broken.selectedCrop = null;
    expect(resumeOnboardingStep(broken)).toBe('crop_confirm');
  });

  it('D. engine never returns null or undefined from resume', () => {
    for (const fixture of [
      null, undefined, {}, { currentStep: 'bogus' },
      { currentStep: 'welcome', language: 'en' },
    ]) {
      expect(resumeOnboardingStep(fixture)).toBeTruthy();
    }
  });

  it('deriveMode handles the supported variants', () => {
    expect(deriveMode('backyard')).toBe('backyard');
    expect(deriveMode('small')).toBe('farm');
    expect(deriveMode('large')).toBe('farm');
    expect(deriveMode(null)).toBeNull();
  });
});

// ─── C. NEXT-STEP BRIDGE ENFORCEMENT ─────────────────────
describe('next-step bridge enforcement', () => {
  const strongStates = [
    { type: STATE_TYPES.HARVEST_COMPLETE,   expectedKey: /prepare_field_for_next_cycle/ },
    { type: STATE_TYPES.POST_HARVEST,       expectedKey: /review_next_crop/ },
    { type: STATE_TYPES.RETURNING_INACTIVE, expectedKey: /check_today_task/ },
    { type: STATE_TYPES.STALE_OFFLINE,      expectedKey: /reconnect/ },
    { type: STATE_TYPES.FIELD_RESET,        expectedKey: /finish_field_cleanup/ },
    { type: STATE_TYPES.FIRST_USE,          expectedKey: /start_setup/ },
  ];
  it.each(strongStates)('$type exposes a next-step bridge key', ({ type, expectedKey }) => {
    // Synthesize a minimal context that lands on each state. We
    // rely on resolveFarmerState to emit the bridge via
    // appendNextStepBridge.
    let ctx = {};
    switch (type) {
      case STATE_TYPES.HARVEST_COMPLETE:
        ctx = {
          hasJustCompletedHarvest: true,
          hasCompletedOnboarding: true, hasActiveCropCycle: true,
          cropProfile: { stage: 'harvest', name: 'maize' },
          landProfile: { cleared: true, moisture: 'dry' },
        };
        break;
      case STATE_TYPES.POST_HARVEST:
        ctx = {
          hasCompletedOnboarding: true, hasActiveCropCycle: true,
          cropProfile: { stage: 'post_harvest', name: 'maize' },
          landProfile: { cleared: true, moisture: 'dry' },
        };
        break;
      case STATE_TYPES.RETURNING_INACTIVE:
        ctx = {
          missedDays: 5,
          hasCompletedOnboarding: true, hasActiveCropCycle: true,
          cropProfile: { stage: 'growing', name: 'maize' },
          landProfile: { moisture: 'dry' },
        };
        break;
      case STATE_TYPES.STALE_OFFLINE:
        ctx = {
          offlineState: { isOffline: true },
          lastUpdatedAt: Date.now() - 24 * 60 * 60 * 1000,
          hasCompletedOnboarding: true, hasActiveCropCycle: true,
          cropProfile: { stage: 'growing', name: 'maize' },
          landProfile: { moisture: 'dry' },
        };
        break;
      case STATE_TYPES.FIELD_RESET:
        ctx = {
          hasCompletedOnboarding: true, hasActiveCropCycle: true,
          cropProfile: { stage: 'post_harvest', name: 'maize' },
          landProfile: { cleared: false, blocker: 'uncleared_land' },
        };
        break;
      case STATE_TYPES.FIRST_USE:
        ctx = { hasCompletedOnboarding: false };
        break;
    }
    const state = resolveFarmerState(ctx);
    expect(state.stateType).toBe(type);
    expect(state.nextKey).toBeTruthy();
    expect(state.nextKey).toMatch(expectedKey);
    expect(state.nextFallback).toBeTruthy();
  });

  it('active_cycle deliberately has NO bridge — task card IS the next step', () => {
    const state = resolveFarmerState({
      hasCompletedOnboarding: true, hasActiveCropCycle: true,
      cropProfile: { stage: 'growing', name: 'maize' },
      landProfile: { moisture: 'dry', cleared: true },
      weatherNow:  { rainRisk: 'low' },
    });
    expect(state.stateType).toBe(STATE_TYPES.ACTIVE_CYCLE);
    expect(state.nextKey).toBeNull();
  });
});

// ─── D. FORWARD-JUMP PROTECTION ──────────────────────────
describe('onboarding never skips a required step', () => {
  it('getNextOnboardingStep refuses to advance from an invalid step', () => {
    const state = defaultOnboardingState('en');
    state.currentStep = 'location'; // country missing
    expect(getNextOnboardingStep(state)).toBe('location');
  });

  it('firstIncompleteStep scans the canonical order', () => {
    const s = defaultOnboardingState('en');
    s.location = { source: 'detect', confirmed: true, country: 'GH' };
    s.growingType = 'small'; s.mode = 'farm';
    // experience missing
    expect(firstIncompleteStep(s, STEP_ORDER)).toBe('experience');
  });
});
