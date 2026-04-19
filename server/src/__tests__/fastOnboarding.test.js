/**
 * fastOnboarding.test.js — behavioral contract for the
 * 60-second first-time flow.
 *
 * Covers the spec:
 *   • Screen 0 intro — one-time, no skip
 *   • Screen 1 setup — language + country + optional location,
 *     Continue works without location
 *   • Screen 2 farmer type — routing + persistence
 *   • Screen 3 first-time entry — always advances
 *   • Screen 4 recommendation — requires a crop selection
 *   • auto-create farm on crop select (no farm-size / soil /
 *     irrigation prompts)
 *   • transition completes to Home with a task
 *   • first-time Home protects against advanced intents
 *   • onboarding never repeats once complete
 *   • localization (no English leak)
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  FAST_STEPS, FAST_STEP_ORDER,
} from '../../../src/utils/fastOnboarding/stepIds.js';
import {
  defaultFastState, loadFastState, saveFastState,
  clearFastState, patchFastState, hasCompletedFastOnboarding,
} from '../../../src/utils/fastOnboarding/fastOnboardingPersistence.js';
import {
  validateFastStep, firstIncompleteFastStep,
} from '../../../src/utils/fastOnboarding/validateFastStep.js';
import {
  getNextFastStep, getPrevFastStep, canAdvanceFastStep,
  resumeFastStep, routeForFarmerType,
} from '../../../src/utils/fastOnboarding/getNextFastStep.js';
import {
  createFarmFromCrop,
} from '../../../src/utils/fastOnboarding/createFarmFromCrop.js';
import {
  generateInitialTasks,
} from '../../../src/utils/fastOnboarding/generateInitialTasks.js';
import {
  hasFarmYet, isFirstTimeHome,
  filterTasksForFirstTime, getFirstTimeHomeMode,
} from '../../../src/utils/fastOnboarding/firstTimeHomeGuard.js';
import {
  FAST_ONBOARDING_TRANSLATIONS,
  applyFastOnboardingOverlay, interpolate,
} from '../../../src/i18n/fastOnboardingTranslations.js';

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

const NOW = new Date('2026-04-19T00:00:00Z').getTime();

// ─── Step order ─────────────────────────────────────────
describe('step order — 6 screens total', () => {
  it('starts with intro, ends at transition', () => {
    expect(FAST_STEP_ORDER[0]).toBe(FAST_STEPS.INTRO);
    expect(FAST_STEP_ORDER.at(-1)).toBe(FAST_STEPS.TRANSITION);
  });
  it('has exactly 6 entries', () => {
    expect(FAST_STEP_ORDER.length).toBe(6);
  });
});

// ─── Persistence ───────────────────────────────────────
describe('persistence', () => {
  beforeEach(() => installLocalStorage());

  it('default state starts at intro with given language', () => {
    const s = defaultFastState('hi');
    expect(s.currentStep).toBe(FAST_STEPS.INTRO);
    expect(s.setup.language).toBe('hi');
    expect(s.hasSeenIntro).toBe(false);
    expect(s.farmerType).toBeNull();
    expect(s.farm).toBeNull();
  });

  it('save / load round-trips', () => {
    const s = patchFastState(defaultFastState(), {
      hasSeenIntro: true,
      setup: { country: 'GH', language: 'en' },
    });
    saveFastState(s);
    const back = loadFastState();
    expect(back.hasSeenIntro).toBe(true);
    expect(back.setup.country).toBe('GH');
  });

  it('clearFastState removes the record', () => {
    saveFastState(defaultFastState());
    clearFastState();
    expect(loadFastState()).toBeNull();
  });

  it('load drops state with mismatched schemaVersion', () => {
    window.localStorage.setItem('farroway.fastOnboarding.v1',
      JSON.stringify({ schemaVersion: 999, hasSeenIntro: true }));
    expect(loadFastState()).toBeNull();
  });

  it('patchFastState deep-merges setup', () => {
    const s = patchFastState(defaultFastState(), { setup: { country: 'GH' } });
    const s2 = patchFastState(s, { setup: { stateCode: 'AR' } });
    expect(s2.setup.country).toBe('GH');
    expect(s2.setup.stateCode).toBe('AR');
  });

  it('hasCompletedFastOnboarding requires intro + farmerType + farm.created + completedAt', () => {
    expect(hasCompletedFastOnboarding(null)).toBe(false);
    expect(hasCompletedFastOnboarding({ hasSeenIntro: true })).toBe(false);
    expect(hasCompletedFastOnboarding({
      hasSeenIntro: true, farmerType: 'new',
      farm: { created: true }, completedAt: NOW,
    })).toBe(true);
  });
});

// ─── Validation ────────────────────────────────────────
describe('per-step validation', () => {
  it('intro requires hasSeenIntro', () => {
    expect(validateFastStep(FAST_STEPS.INTRO, {}).ok).toBe(false);
    expect(validateFastStep(FAST_STEPS.INTRO, { hasSeenIntro: true }).ok).toBe(true);
  });

  it('setup requires language + country (location OPTIONAL)', () => {
    const noLoc = { setup: { language: 'en', country: 'GH' } };
    expect(validateFastStep(FAST_STEPS.SETUP, noLoc).ok).toBe(true);
    const missing = { setup: { language: 'en' } };
    expect(validateFastStep(FAST_STEPS.SETUP, missing).ok).toBe(false);
  });

  it('farmer_type accepts only "new" or "existing"', () => {
    expect(validateFastStep(FAST_STEPS.FARMER_TYPE, { farmerType: 'new' }).ok).toBe(true);
    expect(validateFastStep(FAST_STEPS.FARMER_TYPE, { farmerType: 'existing' }).ok).toBe(true);
    expect(validateFastStep(FAST_STEPS.FARMER_TYPE, { farmerType: 'maybe' }).ok).toBe(false);
  });

  it('first_time_entry is permissive (no fields)', () => {
    expect(validateFastStep(FAST_STEPS.FIRST_TIME_ENTRY, {}).ok).toBe(true);
  });

  it('recommendation requires selectedCrop', () => {
    expect(validateFastStep(FAST_STEPS.RECOMMENDATION, {}).ok).toBe(false);
    expect(validateFastStep(FAST_STEPS.RECOMMENDATION,
      { selectedCrop: 'maize' }).ok).toBe(true);
  });

  it('transition requires farm.created', () => {
    expect(validateFastStep(FAST_STEPS.TRANSITION, {}).ok).toBe(false);
    expect(validateFastStep(FAST_STEPS.TRANSITION,
      { farm: { created: true } }).ok).toBe(true);
  });

  it('firstIncompleteFastStep scans order', () => {
    const s = patchFastState(defaultFastState(), {
      hasSeenIntro: true,
      setup: { language: 'en', country: 'GH' },
    });
    expect(firstIncompleteFastStep(s, FAST_STEP_ORDER)).toBe(FAST_STEPS.FARMER_TYPE);
  });
});

// ─── Flow controller ──────────────────────────────────
describe('flow controller', () => {
  it('advances intro → setup when hasSeenIntro is true', () => {
    const s = patchFastState(defaultFastState(), { hasSeenIntro: true });
    expect(getNextFastStep(s)).toBe(FAST_STEPS.SETUP);
  });

  it('stays put when the current step fails validation', () => {
    const s = patchFastState(defaultFastState(), {
      hasSeenIntro: true, currentStep: FAST_STEPS.SETUP,
    });
    // country missing → stays on setup
    expect(getNextFastStep(s)).toBe(FAST_STEPS.SETUP);
  });

  it('getPrevFastStep never goes before intro', () => {
    expect(getPrevFastStep({ currentStep: FAST_STEPS.INTRO })).toBeNull();
  });

  it('routeForFarmerType: new → fast, existing → v2', () => {
    expect(routeForFarmerType('new')).toBe('fast');
    expect(routeForFarmerType('existing')).toBe('v2');
    expect(routeForFarmerType(null)).toBe('fast');
  });

  it('canAdvanceFastStep matches validation', () => {
    const s = { hasSeenIntro: true, currentStep: FAST_STEPS.INTRO };
    expect(canAdvanceFastStep(s)).toBe(true);
  });
});

// ─── Resume ───────────────────────────────────────────
describe('resume', () => {
  it('fully completed user → null (→ home)', () => {
    expect(resumeFastStep({
      hasSeenIntro: true, farmerType: 'new',
      farm: { created: true }, completedAt: NOW,
    })).toBeNull();
  });

  it('mid-flow user lands on the first incomplete step', () => {
    const s = patchFastState(defaultFastState(), {
      hasSeenIntro: true,
      setup: { language: 'en', country: 'GH' },
      farmerType: 'new',
    });
    // first-time entry is permissive; recommendation needs selectedCrop
    expect(resumeFastStep(s)).toBe(FAST_STEPS.RECOMMENDATION);
  });

  it('never returns undefined', () => {
    for (const input of [null, undefined, {}, { currentStep: 'bogus' }]) {
      const r = resumeFastStep(input);
      expect(r === null || typeof r === 'string').toBe(true);
    }
  });
});

// ─── Auto-create farm ─────────────────────────────────
describe('createFarmFromCrop', () => {
  it('produces a minimal farm with land_prep stage', () => {
    const farm = createFarmFromCrop('maize', {
      userId: 'u-1', countryCode: 'GH', now: NOW,
    });
    expect(farm.created).toBe(true);
    expect(farm.crop).toBe('maize');
    expect(farm.stage).toBe('land_prep');
    expect(farm.startDate).toBe(NOW);
    expect(farm.createdVia).toBe('fast_onboarding');
    expect(farm.tasks.length).toBeGreaterThan(0);
  });

  it('does NOT require farm size / soil / irrigation', () => {
    const farm = createFarmFromCrop('maize', { userId: 'u-1' });
    // None of these fields should appear on the farm object.
    expect(farm.size).toBeUndefined();
    expect(farm.soilType).toBeUndefined();
    expect(farm.irrigation).toBeUndefined();
  });

  it('throws only when crop id is missing', () => {
    expect(() => createFarmFromCrop(null)).toThrow();
    expect(() => createFarmFromCrop('maize')).not.toThrow();
  });

  it('farm is a frozen plain object (serializable)', () => {
    const farm = createFarmFromCrop('maize');
    expect(Object.isFrozen(farm)).toBe(true);
    expect(() => JSON.stringify(farm)).not.toThrow();
  });
});

describe('generateInitialTasks', () => {
  it('land_prep produces "Prepare your land" as primary', () => {
    const tasks = generateInitialTasks('maize', 'land_prep', { now: NOW });
    const primary = tasks.filter((t) => t.visibility === 'primary');
    expect(primary.length).toBeGreaterThanOrEqual(1);
    expect(primary[0].title).toBe('Prepare your land');
    expect(primary[0].stage).toBe('land_prep');
    expect(primary[0].intent).toBe('prep');
  });

  it('includes at least one deferred follow-up', () => {
    const tasks = generateInitialTasks('maize');
    const deferred = tasks.filter((t) => t.visibility === 'deferred');
    expect(deferred.length).toBeGreaterThan(0);
  });

  it('unknown stage returns an empty array (safe)', () => {
    expect(generateInitialTasks('maize', 'unknown_stage')).toEqual([]);
  });

  it('every task has stable id + confidence', () => {
    const tasks = generateInitialTasks('maize', 'land_prep', { now: NOW });
    for (const t of tasks) {
      expect(typeof t.id).toBe('string');
      expect(t.id.length).toBeGreaterThan(0);
      expect(t.confidence.level).toBe('medium');
    }
  });
});

// ─── First-time Home guard ───────────────────────────
describe('firstTimeHomeGuard', () => {
  it('hasFarmYet: false when farm missing or not created', () => {
    expect(hasFarmYet(null)).toBe(false);
    expect(hasFarmYet({})).toBe(false);
    expect(hasFarmYet({ farm: { created: false, tasks: [] } })).toBe(false);
    expect(hasFarmYet({ farm: { created: true, tasks: [{}] } })).toBe(true);
  });

  it('isFirstTimeHome: true when no farm or farm just created', () => {
    expect(isFirstTimeHome(null)).toBe(true);
    const fresh = {
      farm: createFarmFromCrop('maize',
        { userId: 'u-1', now: Date.now() - 60 * 1000 }), // 1 min old
    };
    expect(isFirstTimeHome(fresh)).toBe(true);
  });

  it('isFirstTimeHome: false after a completion', () => {
    const farm = createFarmFromCrop('maize', { userId: 'u-1' });
    const completed = {
      farm: { ...farm, tasks: farm.tasks.map((t) => ({ ...t, status: 'completed' })) },
    };
    expect(isFirstTimeHome(completed)).toBe(false);
  });

  it('filterTasksForFirstTime: strips advanced intents', () => {
    const farm = createFarmFromCrop('maize', { userId: 'u-1' });
    const stateWithExtras = {
      farm: {
        ...farm,
        tasks: [
          ...farm.tasks,
          { id: 'x', intent: 'fertilize', visibility: 'primary' },
          { id: 'y', intent: 'spray',     visibility: 'primary' },
          { id: 'z', intent: 'scout',     visibility: 'primary' },
        ],
      },
    };
    const visible = filterTasksForFirstTime(stateWithExtras.farm.tasks, stateWithExtras);
    const intents = new Set(visible.map((t) => t.intent));
    expect(intents.has('fertilize')).toBe(false);
    expect(intents.has('spray')).toBe(false);
    expect(intents.has('scout')).toBe(false);
  });

  it('getFirstTimeHomeMode: shouldShowStartFlow when no farm', () => {
    const mode = getFirstTimeHomeMode({ farm: null });
    expect(mode.shouldShowStartFlow).toBe(true);
    expect(mode.isFirstTime).toBe(true);
  });

  it('getFirstTimeHomeMode: hides advanced intents + counts them', () => {
    const farm = createFarmFromCrop('maize', { userId: 'u-1' });
    const state = {
      farm: {
        ...farm,
        tasks: [
          ...farm.tasks,
          { id: 'x', intent: 'fertilize', visibility: 'primary' },
        ],
      },
    };
    const mode = getFirstTimeHomeMode(state);
    expect(mode.hiddenIntents).toContain('fertilize');
    expect(mode.hiddenTaskCount).toBeGreaterThan(0);
  });
});

// ─── End-to-end flow through the controller ──────────
describe('E2E — flow walks to transition with auto-farm', () => {
  beforeEach(() => installLocalStorage());

  it('a fresh user gets from intro → transition', () => {
    let s = defaultFastState('en');

    // Screen 0 → Screen 1
    s = patchFastState(s, { hasSeenIntro: true });
    expect(getNextFastStep(s)).toBe(FAST_STEPS.SETUP);
    s = patchFastState(s, { currentStep: FAST_STEPS.SETUP });

    // Screen 1 → Screen 2 (with country, no location)
    s = patchFastState(s, { setup: { country: 'GH' } });
    expect(getNextFastStep(s)).toBe(FAST_STEPS.FARMER_TYPE);
    s = patchFastState(s, { currentStep: FAST_STEPS.FARMER_TYPE });

    // Screen 2 → Screen 3 (new)
    s = patchFastState(s, { farmerType: 'new' });
    expect(getNextFastStep(s)).toBe(FAST_STEPS.FIRST_TIME_ENTRY);
    s = patchFastState(s, { currentStep: FAST_STEPS.FIRST_TIME_ENTRY });

    // Screen 3 → Screen 4 (no fields, always advances)
    expect(getNextFastStep(s)).toBe(FAST_STEPS.RECOMMENDATION);
    s = patchFastState(s, { currentStep: FAST_STEPS.RECOMMENDATION });

    // Screen 4 → Screen 5 (crop selected; farm auto-created)
    s = patchFastState(s, { selectedCrop: 'maize' });
    const farm = createFarmFromCrop(s.selectedCrop, {
      userId: 'u-1', countryCode: s.setup.country, now: NOW,
    });
    s = patchFastState(s, { farm });
    expect(getNextFastStep(s)).toBe(FAST_STEPS.TRANSITION);

    // Transition valid → Home (next = null)
    s = patchFastState(s, {
      currentStep: FAST_STEPS.TRANSITION, completedAt: NOW,
    });
    expect(getNextFastStep(s)).toBeNull();
    expect(hasCompletedFastOnboarding(s)).toBe(true);
  });
});

// ─── Localization ────────────────────────────────────
describe('localization', () => {
  const KEYS = [
    'fast_onboarding.intro.title',
    'fast_onboarding.intro.cta',
    'fast_onboarding.farmer_type.new',
    'fast_onboarding.farmer_type.existing',
    'fast_onboarding.first_time.cta',
    'fast_onboarding.recommendation.title',
    'fast_onboarding.task.prepare_land.title',
    'fast_onboarding.home.mark_done',
  ];

  it('every supported locale is present', () => {
    for (const l of ['en', 'hi', 'tw', 'es', 'pt', 'fr', 'ar', 'sw', 'id']) {
      expect(FAST_ONBOARDING_TRANSLATIONS[l]).toBeDefined();
    }
  });

  it('Hindi ships every core key', () => {
    for (const k of KEYS) {
      expect(FAST_ONBOARDING_TRANSLATIONS.hi[k]).toBeTruthy();
    }
  });

  it.each(KEYS)('[hi] %s differs from English', (key) => {
    expect(FAST_ONBOARDING_TRANSLATIONS.hi[key])
      .not.toBe(FAST_ONBOARDING_TRANSLATIONS.en[key]);
  });

  it('applyFastOnboardingOverlay merges into an existing dictionary', () => {
    const dict = { en: { 'other.key': 'v' }, hi: {} };
    applyFastOnboardingOverlay(dict);
    expect(dict.en['other.key']).toBe('v');
    expect(dict.en['fast_onboarding.intro.title']).toBe('Welcome to Farroway');
    expect(dict.hi['fast_onboarding.intro.title']).toMatch(/स्वागत/);
  });

  it('interpolate substitutes {crop}', () => {
    expect(interpolate('Start with {crop}', { crop: 'Maize' }))
      .toBe('Start with Maize');
  });
});

// ─── Never repeats — once complete, onboarding is done ─
describe('no re-onboarding', () => {
  it('completed user resumes to null (→ Home direct)', () => {
    const s = {
      hasSeenIntro: true, farmerType: 'new',
      setup: { language: 'en', country: 'GH' },
      selectedCrop: 'maize',
      farm: { created: true, crop: 'maize', tasks: [{ id: 't-1' }] },
      completedAt: NOW,
    };
    expect(resumeFastStep(s)).toBeNull();
  });
});
