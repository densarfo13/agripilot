/**
 * leaveGuard.test.js — the onboarding stuck-state watchdog condition (2026-07-05 fix).
 * If finishLocation's navigate() is bounced/blocked and we're still on an onboarding
 * path shortly after, the watchdog hard-redirects — this asserts the path detector.
 */
import { describe, it, expect } from 'vitest';
import { isOnboardingPath } from '../leaveGuard.js';

describe('isOnboardingPath — watchdog fires only while still on onboarding', () => {
  it('true for onboarding routes (navigation did NOT take → force redirect)', () => {
    expect(isOnboardingPath('/onboarding/last')).toBe(true);
    expect(isOnboardingPath('/fast-onboarding')).toBe(true);
    expect(isOnboardingPath('/onboarding')).toBe(true);
  });
  it('false once we have left to /home (navigation took → no redirect)', () => {
    expect(isOnboardingPath('/home')).toBe(false);
    expect(isOnboardingPath('/dashboard')).toBe(false);
    expect(isOnboardingPath('/farmers/7f45f6b9')).toBe(false);
  });
  it('null/empty is safely false', () => {
    expect(isOnboardingPath(null)).toBe(false);
    expect(isOnboardingPath('')).toBe(false);
    expect(isOnboardingPath(undefined)).toBe(false);
  });
});
