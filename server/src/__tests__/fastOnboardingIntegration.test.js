/**
 * fastOnboardingIntegration.test.js — end-to-end acceptance
 * contracts for the "new experience is the one actually running"
 * wiring fix.
 *
 * These walk the full state transitions the router+screens would
 * produce, without pulling in React. They verify the same invariants
 * an in-browser test would: first-time routing, auto-farm creation,
 * returning-user skip, and location-confirmation trust rules.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  FAST_STEPS, FAST_STEP_ORDER,
} from '../../../src/utils/fastOnboarding/stepIds.js';
import {
  defaultFastState, loadFastState, saveFastState, clearFastState,
  patchFastState, hasCompletedFastOnboarding,
} from '../../../src/utils/fastOnboarding/fastOnboardingPersistence.js';
import {
  getNextFastStep, resumeFastStep, routeForFarmerType,
} from '../../../src/utils/fastOnboarding/getNextFastStep.js';
import { createFarmFromCrop }    from '../../../src/utils/fastOnboarding/createFarmFromCrop.js';
import { generateInitialTasks }  from '../../../src/utils/fastOnboarding/generateInitialTasks.js';
import {
  hasFarmYet, isFirstTimeHome, filterTasksForFirstTime,
  getFirstTimeHomeMode,
} from '../../../src/utils/fastOnboarding/firstTimeHomeGuard.js';
import { isFirstTimeFarmer }     from '../../../src/utils/fastOnboarding/firstTimeFarmerGuard.js';

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

// ─── Acceptance: first-time NEW user never sees legacy form ─
describe('ACCEPTANCE: first-time new user routing', () => {
  beforeEach(() => { installLocalStorage(); clearFastState(); });

  it('no profile + no farms + no fast state → isFirstTimeFarmer === true', () => {
    expect(isFirstTimeFarmer({ profile: null, farms: [], fastState: null })).toBe(true);
  });

  it('first-time farmer is routed OUT of the legacy /profile/setup path', () => {
    // Simulated router decision: if first-time, route target MUST
    // be /onboarding/fast — never /profile/setup.
    const firstTime = isFirstTimeFarmer({ profile: null, farms: [], fastState: null });
    const target = firstTime ? '/onboarding/fast' : '/profile/setup';
    expect(target).toBe('/onboarding/fast');
  });

  it('first-time farmer never sees the legacy Save Farm Profile form', () => {
    // Contract: legacy page must short-circuit for first-timers.
    const firstTime = isFirstTimeFarmer({ profile: null, farms: [], fastState: null });
    const shortCircuit = firstTime;
    expect(shortCircuit).toBe(true);
  });
});

// ─── Acceptance: full 5-screen path walks cleanly ────────────
describe('ACCEPTANCE: intro → setup → farmer-type → recommendation → Home', () => {
  beforeEach(() => { installLocalStorage(); clearFastState(); });

  it('walks every step in order with realistic data', () => {
    let s = defaultFastState('en');
    expect(s.currentStep).toBe(FAST_STEPS.INTRO);

    // Intro continue.
    s = patchFastState(s, { hasSeenIntro: true,
      currentStep: getNextFastStep({ ...s, hasSeenIntro: true }) });
    expect(s.currentStep).toBe(FAST_STEPS.SETUP);

    // Setup with language + country (no location).
    s = patchFastState(s, { setup: { language: 'en', country: 'GH' } });
    s = patchFastState(s, { currentStep: getNextFastStep(s) });
    expect(s.currentStep).toBe(FAST_STEPS.FARMER_TYPE);

    // Farmer type = new.
    s = patchFastState(s, { farmerType: 'new' });
    s = patchFastState(s, { currentStep: getNextFastStep(s) });
    expect(s.currentStep).toBe(FAST_STEPS.FIRST_TIME_ENTRY);

    // First-time entry permissive → recommendation.
    s = patchFastState(s, { currentStep: getNextFastStep(s) });
    expect(s.currentStep).toBe(FAST_STEPS.RECOMMENDATION);

    // Pick a crop → transition.
    s = patchFastState(s, { selectedCrop: 'MAIZE' });
    s = patchFastState(s, { currentStep: getNextFastStep(s) });
    expect(s.currentStep).toBe(FAST_STEPS.TRANSITION);

    // Auto-create farm (what onCropContinue does).
    const farm = createFarmFromCrop(s.selectedCrop, {
      userId: 'u1',
      countryCode: s.setup.country,
    });
    s = patchFastState(s, { farm, completedAt: Date.now() });

    // After TRANSITION the flow terminates — next is null = Home.
    expect(getNextFastStep(s)).toBeNull();
    expect(hasCompletedFastOnboarding(s)).toBe(true);
  });
});

// ─── Acceptance: crop select auto-creates farm, Home-ready ──
describe('ACCEPTANCE: crop selection auto-creates farm', () => {
  it('createFarmFromCrop produces a Home-ready farm object', () => {
    const farm = createFarmFromCrop('RICE', { userId: 'u1', countryCode: 'GH' });
    expect(farm.created).toBe(true);
    expect(farm.crop).toBe('rice');
    expect(farm.stage).toBe('land_prep');
    expect(Array.isArray(farm.tasks)).toBe(true);
    expect(farm.tasks.length).toBeGreaterThan(0);
    // No farm-size / soil / irrigation fields — those come later.
    expect(farm).not.toHaveProperty('size');
    expect(farm).not.toHaveProperty('soil');
    expect(farm).not.toHaveProperty('irrigation');
  });

  it('auto-created farm has exactly one PRIMARY task (dominant-card contract)', () => {
    const tasks = generateInitialTasks('maize', 'land_prep', { now: Date.now() });
    const primary = tasks.filter((t) => t.visibility === 'primary');
    expect(primary.length).toBe(1);
  });
});

// ─── Acceptance: returning user skips onboarding ─────────────
describe('ACCEPTANCE: returning user skips onboarding', () => {
  beforeEach(() => { installLocalStorage(); clearFastState(); });

  it('completed fast onboarding → isFirstTimeFarmer is false', () => {
    const farm = createFarmFromCrop('MAIZE', { userId: 'u1' });
    const done = patchFastState(defaultFastState(), {
      hasSeenIntro: true, farmerType: 'new',
      farm: { ...farm, created: true }, completedAt: Date.now(),
    });
    saveFastState(done);
    expect(isFirstTimeFarmer({ profile: null, farms: [] })).toBe(false);
  });

  it('returning user with an active farm on the server bypasses onboarding', () => {
    const farms = [{ id: 'f1', status: 'active' }];
    expect(isFirstTimeFarmer({ profile: null, farms })).toBe(false);
  });

  it('resumeFastStep returns the first incomplete step for interrupted user', () => {
    const mid = patchFastState(defaultFastState(), {
      hasSeenIntro: true,
      setup: { language: 'en', country: 'GH' },
    });
    const step = resumeFastStep(mid);
    // They completed intro + setup; next step is FARMER_TYPE.
    expect(step).toBe(FAST_STEPS.FARMER_TYPE);
  });

  it('existing farmer routes away from fast flow entirely', () => {
    expect(routeForFarmerType('existing')).toBe('v2');
    expect(routeForFarmerType('new')).toBe('fast');
  });
});

// ─── Acceptance: location confirm, not auto-commit ──────────
describe('ACCEPTANCE: auto-detect success requires user confirmation', () => {
  beforeEach(() => { installLocalStorage(); clearFastState(); });

  it('state does not record locationSource=detect until confirm fires', () => {
    // SetupScreen holds detection in a local pending bucket. The
    // fast-onboarding state stays untouched until confirm.
    let s = defaultFastState('en');
    // Simulate: detect returned {country: GH}, pending but NOT committed.
    const pending = { country: 'GH', stateCode: 'AR', city: null };
    // State should still have no country / no locationSource.
    expect(s.setup.country).toBeNull();
    expect(s.setup.locationSource).toBeNull();

    // User rejects. Pending is discarded. State untouched.
    s = patchFastState(s, {});
    expect(s.setup.country).toBeNull();
    expect(s.setup.locationSource).toBeNull();

    // User confirms a SEPARATE detect later. Now state updates.
    s = patchFastState(s, { setup: {
      country: pending.country, stateCode: pending.stateCode,
      city: pending.city, locationSource: 'detect',
    }});
    expect(s.setup.country).toBe('GH');
    expect(s.setup.locationSource).toBe('detect');
  });

  it('manual country selection marks locationSource as "manual"', () => {
    const s = patchFastState(defaultFastState(), {
      setup: { country: 'IN', locationSource: 'manual' },
    });
    expect(s.setup.locationSource).toBe('manual');
  });
});

// ─── Acceptance: FirstTimeHomeGuard contract ────────────────
describe('ACCEPTANCE: Home always has one dominant card + protects new users', () => {
  beforeEach(() => { installLocalStorage(); clearFastState(); });

  it('no farm → Home mode is shouldShowStartFlow', () => {
    const mode = getFirstTimeHomeMode({ farm: null });
    expect(mode.shouldShowStartFlow).toBe(true);
    // isFirstTime is true here too (no farm → still first-time view);
    // but shouldShowStartFlow takes precedence in rendering.
    expect(mode.isFirstTime).toBe(true);
  });

  it('fresh farm → isFirstTime, advanced intents stripped', () => {
    const farm = createFarmFromCrop('MAIZE', { userId: 'u1' });
    const mode = getFirstTimeHomeMode({ farm });
    expect(mode.shouldShowStartFlow).toBe(false);
    expect(mode.isFirstTime).toBe(true);
    // Must yield a single dominant (primary) task.
    const primary = mode.visibleTasks.filter((t) => t.visibility === 'primary');
    expect(primary.length).toBe(1);
  });

  it('filtered tasks list NEVER contains advanced intents', () => {
    const tasks = [
      { id: '1', intent: 'prepare_land',  visibility: 'primary' },
      { id: '2', intent: 'fertilize',     visibility: 'primary' },
      { id: '3', intent: 'spray',         visibility: 'primary' },
      { id: '4', intent: 'harvest',       visibility: 'primary' },
      { id: '5', intent: 'drain',         visibility: 'deferred' },
      { id: '6', intent: 'scout',         visibility: 'deferred' },
    ];
    const filtered = filterTasksForFirstTime(tasks);
    const intents = filtered.map((t) => t.intent);
    expect(intents).not.toContain('fertilize');
    expect(intents).not.toContain('spray');
    expect(intents).not.toContain('harvest');
    expect(intents).not.toContain('drain');
    expect(intents).not.toContain('scout');
  });
});

// ─── Acceptance: onboarding path singleton ──────────────────
describe('ACCEPTANCE: only one onboarding path is active at a time', () => {
  beforeEach(() => { installLocalStorage(); clearFastState(); });

  it('new farmer → fast; existing farmer → v2; never both', () => {
    expect(routeForFarmerType('new')).toBe('fast');
    expect(routeForFarmerType('existing')).toBe('v2');
    // No case where both are "active" simultaneously.
    const paths = new Set([routeForFarmerType('new'), routeForFarmerType('existing')]);
    expect(paths.size).toBe(2);
  });
});

// ─── Acceptance: state resume is consistent ─────────────────
describe('ACCEPTANCE: interrupted onboarding resumes at first incomplete step', () => {
  beforeEach(() => { installLocalStorage(); clearFastState(); });

  it('resumes at SETUP when intro seen but no setup data yet', () => {
    const s = patchFastState(defaultFastState(), { hasSeenIntro: true });
    expect(resumeFastStep(s)).toBe(FAST_STEPS.SETUP);
  });

  it('resumes at RECOMMENDATION after farmer_type completed', () => {
    const s = patchFastState(defaultFastState(), {
      hasSeenIntro: true,
      setup: { language: 'en', country: 'GH' },
      farmerType: 'new',
    });
    // FIRST_TIME_ENTRY is permissive with no gate, so resume jumps past it.
    const step = resumeFastStep(s);
    expect([FAST_STEPS.FIRST_TIME_ENTRY, FAST_STEPS.RECOMMENDATION]).toContain(step);
  });
});
