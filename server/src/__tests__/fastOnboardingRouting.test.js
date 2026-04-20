/**
 * fastOnboardingRouting.test.js — behavioral contract for the
 * first-time routing fix.
 *
 * Covers:
 *   • isFirstTimeFarmer — predicate across every source combination
 *   • fast-flow completion turns the predicate false
 *   • existing active farm turns the predicate false
 *   • completed legacy profile turns the predicate false
 *   • missing inputs degrade to "first-time"
 *   • warnFirstTimeRoutingRegression is silent in production
 *   • named warning reasons are stable strings
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  isFirstTimeFarmer,
  warnFirstTimeRoutingRegression,
  FIRST_TIME_WARN,
} from '../../../src/utils/fastOnboarding/firstTimeFarmerGuard.js';
import {
  saveFastState, clearFastState, patchFastState, defaultFastState,
} from '../../../src/utils/fastOnboarding/fastOnboardingPersistence.js';
import { createFarmFromCrop } from '../../../src/utils/fastOnboarding/createFarmFromCrop.js';

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

describe('isFirstTimeFarmer — core predicate', () => {
  beforeEach(() => { installLocalStorage(); clearFastState(); });

  it('returns true when no profile, no farms, no fast state', () => {
    expect(isFirstTimeFarmer({ profile: null, farms: [], fastState: null })).toBe(true);
  });

  it('returns true when every input is undefined', () => {
    expect(isFirstTimeFarmer({})).toBe(true);
  });

  it('returns true when profile has only a name but no crop or country', () => {
    const profile = { farmerName: 'Ama' };
    expect(isFirstTimeFarmer({ profile, farms: [], fastState: null })).toBe(true);
  });

  it('returns false when legacy profile has name + crop + country', () => {
    const profile = { farmerName: 'Ama', cropType: 'MAIZE', country: 'Ghana' };
    expect(isFirstTimeFarmer({ profile, farms: [], fastState: null })).toBe(false);
  });

  it('returns false when there is an active farm on the server', () => {
    const farms = [{ id: 'f1', status: 'active' }];
    expect(isFirstTimeFarmer({ profile: null, farms, fastState: null })).toBe(false);
  });

  it('ignores archived and inactive farms', () => {
    const farms = [
      { id: 'a', status: 'archived' },
      { id: 'b', status: 'inactive' },
    ];
    expect(isFirstTimeFarmer({ profile: null, farms, fastState: null })).toBe(true);
  });

  it('returns false once the fast flow is completed', () => {
    const farm = createFarmFromCrop('MAIZE', { userId: 'u1' });
    const done = patchFastState(defaultFastState(), {
      hasSeenIntro: true,
      farmerType: 'new',
      farm: { ...farm, created: true },
      completedAt: Date.now(),
    });
    expect(isFirstTimeFarmer({ profile: null, farms: [], fastState: done })).toBe(false);
  });

  it('still returns true mid-flow — intro seen but no farm yet', () => {
    const mid = patchFastState(defaultFastState(), {
      hasSeenIntro: true,
      farmerType: 'new',
    });
    expect(isFirstTimeFarmer({ profile: null, farms: [], fastState: mid })).toBe(true);
  });

  it('reads fastState from localStorage when not explicitly passed', () => {
    const farm = createFarmFromCrop('RICE', { userId: 'u9' });
    saveFastState(patchFastState(defaultFastState(), {
      hasSeenIntro: true,
      farmerType: 'new',
      farm: { ...farm, created: true },
      completedAt: Date.now(),
    }));
    // No fastState argument — predicate must self-serve.
    expect(isFirstTimeFarmer({ profile: null, farms: [] })).toBe(false);
  });

  it('prefers any "not first-time" signal over the default', () => {
    // Legacy profile present wins even when fastState is empty.
    expect(isFirstTimeFarmer({
      profile: { farmerName: 'X', cropType: 'MAIZE', country: 'G' },
      farms: [],
      fastState: null,
    })).toBe(false);
  });
});

describe('warnFirstTimeRoutingRegression — dev only', () => {
  it('does NOT emit in production', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    globalThis.window = globalThis.window || {};
    warnFirstTimeRoutingRegression('test', { a: 1 });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    process.env.NODE_ENV = origEnv;
  });

  it('emits in development with structured payload', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    globalThis.window = globalThis.window || {};
    warnFirstTimeRoutingRegression('test-reason', { key: 'value' });
    expect(spy).toHaveBeenCalledTimes(1);
    const [tag, reason, details] = spy.mock.calls[0];
    expect(tag).toBe('[farroway.firstTimeRouting]');
    expect(reason).toBe('test-reason');
    expect(details.key).toBe('value');
    expect(typeof details.at).toBe('string');
    spy.mockRestore();
    process.env.NODE_ENV = origEnv;
  });

  it('is a safe no-op when window is undefined', () => {
    const origWindow = globalThis.window;
    delete globalThis.window;
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => warnFirstTimeRoutingRegression('x')).not.toThrow();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    globalThis.window = origWindow;
  });
});

describe('FIRST_TIME_WARN — stable string constants', () => {
  it('exposes every named reason', () => {
    expect(FIRST_TIME_WARN.LEGACY_PAGE_REACHED).toMatch(/legacy/i);
    expect(FIRST_TIME_WARN.FARMER_TYPE_ON_LEGACY).toMatch(/farmer type/i);
    expect(FIRST_TIME_WARN.FARM_SIZE_BEFORE_FIRST_TASK).toMatch(/farm size/i);
    expect(FIRST_TIME_WARN.CROP_REC_BYPASSED).toMatch(/crop recommendation/i);
    expect(FIRST_TIME_WARN.FLOW_ENDED_ON_SAVE_PROFILE).toMatch(/save farm profile/i);
  });

  it('is frozen — cannot be mutated at runtime', () => {
    expect(Object.isFrozen(FIRST_TIME_WARN)).toBe(true);
  });
});
