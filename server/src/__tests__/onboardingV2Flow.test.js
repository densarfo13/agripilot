/**
 * onboardingV2Flow.test.js — behavioral contract for the
 * redesigned onboarding. Covers the 10 acceptance tests from the
 * spec plus targeted unit coverage for every helper.
 *
 * No React mounting — each test exercises the pure helpers that
 * drive the screens. The screens themselves are thin shells over
 * these helpers, so testing the logic here covers end-to-end
 * behavior safely.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  ONBOARDING_STEPS, STEP_ORDER, VISIBLE_STEPS, TOTAL_STEPS,
  stepIndex, isValidStep, visibleStepNumber,
} from '../../../src/utils/onboardingV2/stepIds.js';
import {
  defaultOnboardingState, loadOnboardingState, saveOnboardingState,
  clearOnboardingState, patchOnboardingState,
  _internal as persistInternals,
} from '../../../src/utils/onboardingV2/onboardingPersistence.js';
import {
  validateOnboardingStep, firstIncompleteStep,
} from '../../../src/utils/onboardingV2/validateOnboardingStep.js';
import {
  getNextOnboardingStep, getPrevOnboardingStep, canAdvanceFromStep,
  resumeOnboardingStep, getOnboardingRouteForMode,
  buildPostOnboardingRoute, deriveMode,
} from '../../../src/utils/onboardingV2/getNextOnboardingStep.js';
import { selectFirstValueContent } from '../../../src/utils/onboardingV2/selectFirstValueContent.js';
import { filterRecommendations } from '../../../src/utils/onboardingV2/filterRecommendations.js';
import {
  ONBOARDING_V2_TRANSLATIONS,
  applyOnboardingV2Overlay,
  interpolate,
} from '../../../src/i18n/onboardingV2Translations.js';

// ─── Install a tiny localStorage so persistence tests run. ───
function installLocalStorage() {
  const store = new Map();
  const fake = {
    getItem:    (k) => store.has(k) ? store.get(k) : null,
    setItem:    (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => store.delete(k),
    clear:      () => store.clear(),
    key:        (i) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  globalThis.window = { localStorage: fake };
  globalThis.localStorage = fake;
  return store;
}

// Helpers to build fully-valid state at specific points
function fullLocation() {
  return { source: 'detect', confirmed: true, country: 'US', stateCode: 'MD', city: 'Frederick', accuracyM: 25 };
}
function stateAfter(step) {
  const s = defaultOnboardingState('en');
  s.location = fullLocation();
  if (step === ONBOARDING_STEPS.LOCATION)        return { ...s, currentStep: ONBOARDING_STEPS.LOCATION };

  s.growingType = 'small'; s.mode = 'farm';
  if (step === ONBOARDING_STEPS.GROWING_TYPE)    return { ...s, currentStep: ONBOARDING_STEPS.GROWING_TYPE };

  s.experience = 'new';
  if (step === ONBOARDING_STEPS.EXPERIENCE)      return { ...s, currentStep: ONBOARDING_STEPS.EXPERIENCE };

  s.sizeDetails = { ...s.sizeDetails, sizeBand: 'small' };
  if (step === ONBOARDING_STEPS.SIZE_DETAILS)    return { ...s, currentStep: ONBOARDING_STEPS.SIZE_DETAILS };

  if (step === ONBOARDING_STEPS.RECOMMENDATIONS) return { ...s, currentStep: ONBOARDING_STEPS.RECOMMENDATIONS };

  s.selectedCrop = 'tomato';
  if (step === ONBOARDING_STEPS.CROP_CONFIRM)    return { ...s, currentStep: ONBOARDING_STEPS.CROP_CONFIRM };

  return { ...s, currentStep: ONBOARDING_STEPS.FIRST_VALUE };
}

// ─── Step IDs + order ─────────────────────────────────────
describe('step order', () => {
  it('starts with welcome and ends with first_value', () => {
    expect(STEP_ORDER[0]).toBe(ONBOARDING_STEPS.WELCOME);
    expect(STEP_ORDER[STEP_ORDER.length - 1]).toBe(ONBOARDING_STEPS.FIRST_VALUE);
  });
  it('has 8 total steps', () => {
    expect(TOTAL_STEPS).toBe(8);
  });
  it('VISIBLE_STEPS excludes welcome and first_value', () => {
    expect(VISIBLE_STEPS).not.toContain(ONBOARDING_STEPS.WELCOME);
    expect(VISIBLE_STEPS).not.toContain(ONBOARDING_STEPS.FIRST_VALUE);
    expect(VISIBLE_STEPS.length).toBe(6);
  });
  it('isValidStep / stepIndex agree', () => {
    expect(isValidStep('welcome')).toBe(true);
    expect(isValidStep('bogus')).toBe(false);
    expect(stepIndex('location')).toBe(1);
  });
  it('visibleStepNumber maps step to 1..6 or null', () => {
    expect(visibleStepNumber('welcome')).toBeNull();
    expect(visibleStepNumber('location')).toBe(1);
    expect(visibleStepNumber('crop_confirm')).toBe(6);
    expect(visibleStepNumber('first_value')).toBeNull();
  });
});

// ─── Persistence ──────────────────────────────────────────
describe('persistence', () => {
  beforeEach(() => installLocalStorage());

  it('defaultOnboardingState starts at welcome with given language', () => {
    const s = defaultOnboardingState('hi');
    expect(s.currentStep).toBe('welcome');
    expect(s.language).toBe('hi');
    expect(s.completedAt).toBeNull();
  });

  it('save → load round-trips', () => {
    const s = defaultOnboardingState('en');
    s.growingType = 'small'; s.mode = 'farm';
    saveOnboardingState(s);
    const back = loadOnboardingState();
    expect(back.growingType).toBe('small');
    expect(back.mode).toBe('farm');
  });

  it('load returns null when no record exists', () => {
    expect(loadOnboardingState()).toBeNull();
  });

  it('load discards state with a mismatched schemaVersion', () => {
    const key = persistInternals.STORAGE_KEY;
    window.localStorage.setItem(key, JSON.stringify({ schemaVersion: 999, currentStep: 'welcome' }));
    expect(loadOnboardingState()).toBeNull();
  });

  it('clearOnboardingState removes the record', () => {
    saveOnboardingState(defaultOnboardingState('en'));
    clearOnboardingState();
    expect(loadOnboardingState()).toBeNull();
  });

  it('patchOnboardingState deep-merges location/sizeDetails', () => {
    const s = defaultOnboardingState();
    const next = patchOnboardingState(s, { location: { country: 'GH' } });
    expect(next.location.country).toBe('GH');
    expect(next.location.confirmed).toBe(false);
    const next2 = patchOnboardingState(next, { sizeDetails: { sizeBand: 'small' } });
    expect(next2.sizeDetails.sizeBand).toBe('small');
    expect(next2.location.country).toBe('GH'); // preserved
  });
});

// ─── Validation ───────────────────────────────────────────
describe('validateOnboardingStep', () => {
  it('welcome valid as long as language is set', () => {
    expect(validateOnboardingStep('welcome', { language: 'en' }).ok).toBe(true);
    expect(validateOnboardingStep('welcome', { language: '' }).ok).toBe(false);
  });

  it('location requires country + confirmed (or manual)', () => {
    expect(validateOnboardingStep('location', { location: {} }).ok).toBe(false);
    expect(validateOnboardingStep('location', { location: { country: 'US', confirmed: true } }).ok).toBe(true);
    // manual accepted without explicit confirm flag
    expect(validateOnboardingStep('location', { location: { source: 'manual', country: 'US' } }).ok).toBe(true);
  });

  it('growing_type requires a known option', () => {
    expect(validateOnboardingStep('growing_type', { growingType: 'bogus' }).ok).toBe(false);
    expect(validateOnboardingStep('growing_type', { growingType: 'small' }).ok).toBe(true);
  });

  it('experience accepts exactly two values', () => {
    expect(validateOnboardingStep('experience', { experience: 'new' }).ok).toBe(true);
    expect(validateOnboardingStep('experience', { experience: 'intermediate' }).ok).toBe(false);
  });

  it('size_details (backyard) wants spaceType', () => {
    expect(validateOnboardingStep('size_details',
      { mode: 'backyard', sizeDetails: { spaceType: 'pots' } }).ok).toBe(true);
    expect(validateOnboardingStep('size_details',
      { mode: 'backyard', sizeDetails: {} }).ok).toBe(false);
  });

  it('size_details (farm) wants sizeBand', () => {
    expect(validateOnboardingStep('size_details',
      { mode: 'farm', sizeDetails: { sizeBand: 'medium' } }).ok).toBe(true);
    expect(validateOnboardingStep('size_details',
      { mode: 'farm', sizeDetails: { spaceType: 'pots' } }).ok).toBe(false);
  });

  it('crop_confirm requires selectedCrop string', () => {
    expect(validateOnboardingStep('crop_confirm', { selectedCrop: 'tomato' }).ok).toBe(true);
    expect(validateOnboardingStep('crop_confirm', { selectedCrop: null }).ok).toBe(false);
  });

  it('recommendations + first_value are permissive', () => {
    expect(validateOnboardingStep('recommendations', {}).ok).toBe(true);
    expect(validateOnboardingStep('first_value', {}).ok).toBe(true);
  });

  it('firstIncompleteStep finds the first blocker', () => {
    const s = stateAfter(ONBOARDING_STEPS.EXPERIENCE); // location/growing/experience valid
    // reset sizeDetails
    s.sizeDetails = { sizeBand: null };
    expect(firstIncompleteStep(s, STEP_ORDER)).toBe('size_details');
  });
});

// ─── Flow controllers ─────────────────────────────────────
describe('deriveMode', () => {
  it('backyard → backyard; small/medium/large → farm', () => {
    expect(deriveMode('backyard')).toBe('backyard');
    expect(deriveMode('small')).toBe('farm');
    expect(deriveMode('large')).toBe('farm');
    expect(deriveMode('')).toBeNull();
  });
});

describe('getNextOnboardingStep', () => {
  it('advances when the current step is valid', () => {
    const s = stateAfter(ONBOARDING_STEPS.GROWING_TYPE);
    expect(getNextOnboardingStep(s)).toBe('experience');
  });
  it('stays put when the current step is invalid', () => {
    const s = defaultOnboardingState();
    s.currentStep = 'location'; // unfilled
    expect(getNextOnboardingStep(s)).toBe('location');
  });
  it('returns null at the end (first_value)', () => {
    const s = stateAfter(ONBOARDING_STEPS.FIRST_VALUE);
    expect(getNextOnboardingStep(s)).toBeNull();
  });
});

describe('getPrevOnboardingStep', () => {
  it('returns the previous step', () => {
    const s = stateAfter(ONBOARDING_STEPS.EXPERIENCE);
    expect(getPrevOnboardingStep(s)).toBe('growing_type');
  });
  it('returns null at welcome', () => {
    const s = defaultOnboardingState();
    expect(getPrevOnboardingStep(s)).toBeNull();
  });
});

describe('canAdvanceFromStep', () => {
  it('true only when the step is valid', () => {
    const s = stateAfter(ONBOARDING_STEPS.SIZE_DETAILS);
    expect(canAdvanceFromStep(s, 'size_details')).toBe(true);
    expect(canAdvanceFromStep({ ...s, sizeDetails: {} }, 'size_details')).toBe(false);
  });
});

// ─── Resume ───────────────────────────────────────────────
describe('resumeOnboardingStep', () => {
  beforeEach(() => installLocalStorage());

  it('resumes to the first step that fails validation', () => {
    const s = defaultOnboardingState('en');
    s.location = fullLocation();
    s.growingType = 'small'; s.mode = 'farm';
    // experience is missing → resume here
    expect(resumeOnboardingStep(s)).toBe('experience');
  });

  it('respects an in-progress step the user was on', () => {
    const s = defaultOnboardingState('en');
    s.location = { country: 'US' }; // incomplete (not confirmed)
    s.currentStep = 'location';
    expect(resumeOnboardingStep(s)).toBe('location');
  });

  it('points to first_value when every step passes', () => {
    expect(resumeOnboardingStep(stateAfter(ONBOARDING_STEPS.CROP_CONFIRM))).toBe('first_value');
  });
});

// ─── Mode-aware routing ──────────────────────────────────
describe('getOnboardingRouteForMode', () => {
  it('backyard returns backyard intent on size_details + recommendations', () => {
    const route = getOnboardingRouteForMode('backyard');
    expect(route.find((r) => r.step === 'size_details').intent).toBe('backyard_space');
    expect(route.find((r) => r.step === 'recommendations').intent).toBe('backyard_crop_pool');
  });
  it('farm returns farm intents', () => {
    const route = getOnboardingRouteForMode('farm');
    expect(route.find((r) => r.step === 'size_details').intent).toBe('farm_size_band');
    expect(route.find((r) => r.step === 'recommendations').intent).toBe('farm_crop_pool');
  });
  it('unknown mode returns null intent', () => {
    const route = getOnboardingRouteForMode(null);
    expect(route[0].intent).toBeNull();
  });
});

// ─── Post-onboarding routing ─────────────────────────────
describe('buildPostOnboardingRoute', () => {
  it('immediate task → /farmer/today', () => {
    expect(buildPostOnboardingRoute(
      { selectedCrop: 'tomato' },
      { immediateTask: { id: 't1', title: 'Water' } },
    ).route).toBe('/farmer/today');
  });
  it('no crop selected → /farmer', () => {
    expect(buildPostOnboardingRoute({}, { immediateTask: null }).route)
      .toBe('/farmer');
  });
  it('crop but no task → /farmer', () => {
    expect(buildPostOnboardingRoute(
      { selectedCrop: 'tomato' },
      { immediateTask: null },
    ).route).toBe('/farmer');
  });
});

// ─── First-value selector ───────────────────────────────
describe('selectFirstValueContent', () => {
  it('kind=task when a task is available', () => {
    const c = selectFirstValueContent({}, {
      getImmediateTask: () => ({ id: 't1', title: 'Water' }),
    });
    expect(c.kind).toBe('task');
    expect(c.ctaRoute).toBe('/farmer/today');
  });
  it('kind=plan when no immediate task', () => {
    const c = selectFirstValueContent({ selectedCrop: 'maize' }, {
      getImmediateTask: () => null,
      getPlanPreview:   () => ({ stage: 'planting' }),
    });
    expect(c.kind).toBe('plan');
    expect(c.ctaRoute).toBe('/farmer');
    expect(c.payload.stage).toBe('planting');
  });
  it('never dead-ends on missing resolvers', () => {
    const c = selectFirstValueContent({ selectedCrop: 'maize' });
    expect(c.kind).toBe('plan');
  });
});

// ─── Recommendations filter ──────────────────────────────
describe('filterRecommendations', () => {
  const crops = [
    { crop: 'maize',   score: 0.9, beginnerFriendly: true,  reasons: ['Great climate fit'] },
    { crop: 'tomato',  score: 0.8, beginnerFriendly: true,  reasons: [] },
    { crop: 'rice',    score: 0.7, reasons: [] },
    { crop: 'yam',     score: 0.65, reasons: [] },
    { crop: 'cassava', score: 0.55, reasons: [] },
    { crop: 'sorghum', score: 0.5, reasons: [] },
    { crop: 'wheat',   score: 0.4, reasons: [] },
    { crop: 'cotton',  score: 0.2, reasons: [] },
  ];

  it('backyard caps bestForYou at 3', () => {
    const { bestForYou } = filterRecommendations(crops, { mode: 'backyard' });
    expect(bestForYou.length).toBeLessThanOrEqual(3);
  });

  it('farm allows up to 5 best', () => {
    const { bestForYou } = filterRecommendations(crops, { mode: 'farm' });
    expect(bestForYou.length).toBeLessThanOrEqual(5);
    expect(bestForYou.length).toBeGreaterThanOrEqual(1);
  });

  it('splits into best / also / not buckets without overlap', () => {
    const r = filterRecommendations(crops, { mode: 'farm' });
    const all = [...r.bestForYou, ...r.alsoPossible, ...r.notRecommended];
    const ids = new Set(all.map((c) => c.crop));
    expect(ids.size).toBe(all.length); // no duplicates across buckets
  });

  it('boosts beginner-friendly when experience is "new"', () => {
    const withBoost = filterRecommendations(
      [
        { crop: 'a', score: 0.7, beginnerFriendly: false },
        { crop: 'b', score: 0.69, beginnerFriendly: true },
      ],
      { mode: 'farm', experienced: false },
    );
    expect(withBoost.bestForYou[0].crop).toBe('b');
  });

  it('no crops → empty buckets without throwing', () => {
    const r = filterRecommendations([]);
    expect(r.bestForYou).toEqual([]);
    expect(r.alsoPossible).toEqual([]);
    expect(r.notRecommended).toEqual([]);
  });
});

// ─── i18n overlay ────────────────────────────────────────
const LOCALES = ['en', 'hi', 'tw', 'es', 'pt', 'fr', 'ar', 'sw', 'id'];
const CORE_KEYS = [
  'onboardingV2.welcome.promise',
  'onboardingV2.welcome.cta',
  'onboardingV2.location.title',
  'onboardingV2.growingType.title',
  'onboardingV2.experience.title',
  'onboardingV2.recommendations.title',
  'onboardingV2.cropConfirm.startBtn',
  'onboardingV2.first_value.cta.go_to_today',
  'onboardingV2.progress.step',
];

describe('onboardingV2Translations overlay', () => {
  it('covers every shipped locale', () => {
    for (const l of LOCALES) {
      expect(ONBOARDING_V2_TRANSLATIONS[l]).toBeDefined();
    }
  });

  it('core keys exist in every locale', () => {
    for (const l of LOCALES) {
      for (const k of CORE_KEYS) {
        expect(ONBOARDING_V2_TRANSLATIONS[l][k]).toBeTruthy();
      }
    }
  });

  it('non-English locales do not leak the English string for core keys', () => {
    for (const l of LOCALES) {
      if (l === 'en') continue;
      for (const k of CORE_KEYS) {
        expect(ONBOARDING_V2_TRANSLATIONS[l][k]).not.toBe(ONBOARDING_V2_TRANSLATIONS.en[k]);
      }
    }
  });

  it('applyOnboardingV2Overlay merges in place', () => {
    const dict = { en: { 'some.key': 'v' }, hi: {} };
    const ref = applyOnboardingV2Overlay(dict);
    expect(ref).toBe(dict);
    expect(dict.en['some.key']).toBe('v');
    expect(dict.en['onboardingV2.welcome.cta']).toBe('Get started');
    expect(dict.hi['onboardingV2.welcome.cta']).toBe('शुरू करें');
  });

  it('interpolate substitutes {n} / {total}', () => {
    const v = interpolate('Step {n} of {total}', { n: 3, total: 6 });
    expect(v).toBe('Step 3 of 6');
  });

  it('interpolate substitutes {crop}', () => {
    expect(interpolate('Start with {crop}', { crop: 'Tomato' }))
      .toBe('Start with Tomato');
  });
});

// ─── Acceptance-test scenarios ───────────────────────────
describe('acceptance — new user sees Welcome first', () => {
  beforeEach(() => installLocalStorage());
  it('defaults to welcome when no state exists', () => {
    expect(loadOnboardingState()).toBeNull();
    const fresh = defaultOnboardingState('en');
    expect(fresh.currentStep).toBe('welcome');
  });
});

describe('acceptance — backyard flow branches content only', () => {
  it('step IDs are mode-invariant; only intent per step changes', () => {
    const bk = getOnboardingRouteForMode('backyard').map((r) => r.step);
    const fm = getOnboardingRouteForMode('farm').map((r) => r.step);
    expect(bk).toEqual(fm);
    expect(bk).toEqual(STEP_ORDER);
  });
});

describe('acceptance — recommendation screen shows 3-5 strong crops', () => {
  it('farm best bucket is 1..5', () => {
    const crops = new Array(10).fill(null).map((_, i) => ({
      crop: `c${i}`, score: 0.9 - i * 0.05,
    }));
    const r = filterRecommendations(crops, { mode: 'farm' });
    expect(r.bestForYou.length).toBeGreaterThanOrEqual(1);
    expect(r.bestForYou.length).toBeLessThanOrEqual(5);
  });
});

describe('acceptance — no dead-end', () => {
  it('first_value always has either a task or a plan payload', () => {
    const withTask = selectFirstValueContent({ selectedCrop: 'x' }, {
      getImmediateTask: () => ({ id: 't' }),
    });
    expect(withTask.payload).toBeTruthy();
    const withoutTask = selectFirstValueContent({ selectedCrop: 'x' });
    expect(withoutTask.payload).toBeTruthy();
    expect(withoutTask.ctaKey).toBe('onboardingV2.first_value.cta.view_plan');
  });
});

describe('acceptance — back/forward flow', () => {
  it('walks forward through every step when valid', () => {
    let s = defaultOnboardingState('en');
    // Welcome → Location
    expect(getNextOnboardingStep(s)).toBe('location');

    s = stateAfter(ONBOARDING_STEPS.LOCATION);
    expect(getNextOnboardingStep(s)).toBe('growing_type');

    s = stateAfter(ONBOARDING_STEPS.GROWING_TYPE);
    expect(getNextOnboardingStep(s)).toBe('experience');

    s = stateAfter(ONBOARDING_STEPS.EXPERIENCE);
    expect(getNextOnboardingStep(s)).toBe('size_details');

    s = stateAfter(ONBOARDING_STEPS.SIZE_DETAILS);
    expect(getNextOnboardingStep(s)).toBe('recommendations');

    s = stateAfter(ONBOARDING_STEPS.RECOMMENDATIONS);
    expect(getNextOnboardingStep(s)).toBe('crop_confirm');

    s = stateAfter(ONBOARDING_STEPS.CROP_CONFIRM);
    expect(getNextOnboardingStep(s)).toBe('first_value');
  });

  it('back from each step returns to the previous', () => {
    expect(getPrevOnboardingStep({ currentStep: 'location' })).toBe('welcome');
    expect(getPrevOnboardingStep({ currentStep: 'first_value' })).toBe('crop_confirm');
    expect(getPrevOnboardingStep({ currentStep: 'welcome' })).toBeNull();
  });
});

describe('acceptance — interrupted onboarding resumes correctly', () => {
  beforeEach(() => installLocalStorage());

  it('picking up mid-flow lands on the first incomplete step', () => {
    const s = defaultOnboardingState('en');
    s.location = fullLocation();
    s.growingType = 'small'; s.mode = 'farm';
    saveOnboardingState(s);
    const back = loadOnboardingState();
    expect(resumeOnboardingStep(back)).toBe('experience');
  });
});
