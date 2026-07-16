/**
 * onboardingGuardLoop.test.js — the "Continuing…" freeze root cause.
 *
 * A user whose GPS SUCCEEDED (location detected ✓, weather ready ✓) completed
 * fast-onboarding, but isOnboardingValid() rejected them because the success
 * path never wrote farroway_country and the guard's minimum-profile check
 * accepted ONLY farroway_country or the skipped flag. ProfileGuard then
 * bounced /home → /onboarding/fast, geo auto-advance re-fired, and the button
 * showed "Continuing…" forever. Users whose GPS FAILED passed (skipped flag) —
 * success was punished, failure rewarded.
 *
 * Fix under test (reader side): a SAVED real location row
 * (farroway_location, hasLocation:true — written by locationSafe.saveLocation
 * on every successful fix) now satisfies the minimum-profile check.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { isOnboardingValid } from '../../../src/runtime/launchBlockers/OnboardingGuardRuntime';

function _mockStorage() {
  const store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
}

describe('isOnboardingValid — continuation-freeze guard loop', () => {
  beforeEach(() => {
    globalThis.window = globalThis.window || {};
    globalThis.localStorage = _mockStorage();
    // Baseline: completion flag + mode present (the fast-onboarding user
    // picked an experience before reaching the location step).
    localStorage.setItem('farroway_onboarding_complete', 'true');
    localStorage.setItem('farroway_mode', 'farm');
  });

  it('THE BUG: completed + working GPS (saved location row) must be VALID', () => {
    // What locationSafe.saveLocation persists on a successful fix — note:
    // NO farroway_country (the old guard’s only accepted key).
    localStorage.setItem('farroway_location', JSON.stringify({
      hasLocation: true, lat: 39.04, lng: -76.88, country: 'United States',
      region: 'Maryland', source: 'gps', savedAt: 1,
    }));
    expect(isOnboardingValid()).toBe(true);   // was false → the /home bounce loop
  });

  it('completed + farroway_country set (writer-side fix path) is valid', () => {
    localStorage.setItem('farroway_country', 'United States');
    expect(isOnboardingValid()).toBe(true);
  });

  it('completed + location explicitly skipped stays valid (failed-GPS path, unchanged)', () => {
    localStorage.setItem('farroway_location_skipped', 'true');
    expect(isOnboardingValid()).toBe(true);
  });

  it('completed but NO profile signal at all stays invalid (guard still guards)', () => {
    expect(isOnboardingValid()).toBe(false);
  });

  it('a saved row with hasLocation:false does NOT count as a profile', () => {
    localStorage.setItem('farroway_location', JSON.stringify({ hasLocation: false, source: 'fallback' }));
    expect(isOnboardingValid()).toBe(false);
  });

  it('malformed farroway_location JSON never throws and never validates', () => {
    localStorage.setItem('farroway_location', '{not json');
    expect(isOnboardingValid()).toBe(false);
  });
});
