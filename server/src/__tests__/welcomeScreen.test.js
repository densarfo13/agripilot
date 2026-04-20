/**
 * welcomeScreen.test.js — contract for the pure helpers powering
 * the minimal first-impression screen:
 *   src/core/welcome/onboardingState.js
 *   src/core/welcome/resolveWelcomeRoute.js
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  saveOnboardingState, readOnboardingState, clearOnboardingState,
} from '../../../src/core/welcome/onboardingState.js';
import {
  resolveWelcomeEntry,
  resolvePrimaryCtaDestination,
  resolveSecondaryCtaDestination,
} from '../../../src/core/welcome/resolveWelcomeRoute.js';
import {
  clearFastState, saveFastState, patchFastState, defaultFastState,
} from '../../../src/utils/fastOnboarding/fastOnboardingPersistence.js';

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
  return store;
}

// ─── onboardingState ────────────────────────────────────────
describe('saveOnboardingState / readOnboardingState', () => {
  beforeEach(() => { installLocalStorage(); clearFastState(); });
  afterEach(()  => { delete globalThis.window; });

  it('round-trips { isNewFarmer, location }', () => {
    expect(saveOnboardingState({
      isNewFarmer: true,
      location: { lat: 5.6, lng: -0.2 },
    })).toBe(true);
    const out = readOnboardingState();
    expect(out.isNewFarmer).toBe(true);
    expect(out.location.lat).toBe(5.6);
    expect(out.location.lng).toBeCloseTo(-0.2);
  });

  it('returns frozen result', () => {
    saveOnboardingState({ isNewFarmer: false });
    expect(Object.isFrozen(readOnboardingState())).toBe(true);
  });

  it('drops non-boolean isNewFarmer', () => {
    saveOnboardingState({ isNewFarmer: 'yes' });
    expect(readOnboardingState().isNewFarmer).toBeNull();
  });

  it('drops location when lat/lng are non-finite', () => {
    saveOnboardingState({ location: { lat: 'bad', lng: 0 } });
    expect(readOnboardingState().location).toBeNull();
  });

  it('read returns null on missing / corrupt entry', () => {
    expect(readOnboardingState()).toBeNull();
    globalThis.window.localStorage.setItem('farroway_onboarding', '{not json');
    expect(readOnboardingState()).toBeNull();
  });

  it('clearOnboardingState removes the record', () => {
    saveOnboardingState({ isNewFarmer: true });
    clearOnboardingState();
    expect(readOnboardingState()).toBeNull();
  });

  it('degrades safely when no localStorage', () => {
    delete globalThis.window;
    expect(saveOnboardingState({ isNewFarmer: true })).toBe(false);
    expect(readOnboardingState()).toBeNull();
    expect(() => clearOnboardingState()).not.toThrow();
  });
});

// ─── resolveWelcomeEntry ────────────────────────────────────
describe('resolveWelcomeEntry', () => {
  beforeEach(() => { installLocalStorage(); clearFastState(); });
  afterEach(()  => { delete globalThis.window; });

  it('user with active farm → dashboard', () => {
    const entry = resolveWelcomeEntry({
      farms: [{ id: 'f1', status: 'active' }],
    });
    expect(entry.action).toBe('dashboard');
  });

  it('completed legacy profile → dashboard', () => {
    const entry = resolveWelcomeEntry({
      profile: { id: 'f1', cropType: 'MAIZE', country: 'Ghana' },
    });
    expect(entry.action).toBe('dashboard');
  });

  it('mid-onboarding fast state → onboarding (resume)', () => {
    saveFastState(patchFastState(defaultFastState(), {
      hasSeenIntro: true,
      setup: { language: 'en', country: 'GH' },
    }));
    const entry = resolveWelcomeEntry({ profile: null, farms: [] });
    expect(entry.action).toBe('onboarding');
  });

  it('first-time (no profile, no farms) → welcome', () => {
    const entry = resolveWelcomeEntry({ profile: null, farms: [] });
    expect(entry.action).toBe('welcome');
  });

  it('result is frozen', () => {
    expect(Object.isFrozen(resolveWelcomeEntry({}))).toBe(true);
  });
});

// ─── resolvePrimaryCtaDestination ───────────────────────────
describe('resolvePrimaryCtaDestination ("Find My Best Crop")', () => {
  it('existing user with country → /crop-recommendations?farmId', () => {
    const dest = resolvePrimaryCtaDestination({
      profile: { id: 'F1', countryCode: 'GH' },
    });
    expect(dest).toBe('/crop-recommendations?farmId=F1');
  });

  it('existing user with legacy country field', () => {
    const dest = resolvePrimaryCtaDestination({
      profile: { id: 'F1', country: 'Ghana' },
    });
    expect(dest).toBe('/crop-recommendations?farmId=F1');
  });

  it('URL-encodes farmId with special chars', () => {
    const dest = resolvePrimaryCtaDestination({
      profile: { id: 'a&b c', countryCode: 'GH' },
    });
    expect(dest).toBe('/crop-recommendations?farmId=a%26b%20c');
  });

  it('profile without country → /crop-fit intake', () => {
    const dest = resolvePrimaryCtaDestination({
      profile: { id: 'F1' },
    });
    expect(dest).toBe('/crop-fit');
  });

  it('no profile at all → /crop-fit', () => {
    expect(resolvePrimaryCtaDestination({})).toBe('/crop-fit');
    expect(resolvePrimaryCtaDestination(undefined)).toBe('/crop-fit');
  });
});

// ─── resolveSecondaryCtaDestination ─────────────────────────
describe('resolveSecondaryCtaDestination ("Continue Setup")', () => {
  beforeEach(() => { installLocalStorage(); clearFastState(); });
  afterEach(()  => { delete globalThis.window; });

  it('first-time farmer → /onboarding/fast', () => {
    expect(resolveSecondaryCtaDestination({
      profile: null, farms: [],
    })).toBe('/onboarding/fast');
  });

  it('existing user → /farm/new', () => {
    expect(resolveSecondaryCtaDestination({
      profile: { id: 'F1', farmerName: 'A', cropType: 'M', country: 'Ghana' },
      farms:   [{ id: 'F1', status: 'active' }],
    })).toBe('/farm/new');
  });
});
