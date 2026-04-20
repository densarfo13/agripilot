/**
 * profileCompletionRoute.test.js — contract for the single
 * routing helper that centralizes Complete Profile / Setup /
 * Add New Farm destinations.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  resolveProfileCompletionRoute, routeToUrl,
} from '../../../src/core/multiFarm/profileCompletionRoute.js';
import {
  clearFastState,
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

beforeEach(() => { installLocalStorage(); clearFastState(); });

describe('resolveProfileCompletionRoute', () => {
  it('first-time farmer → /onboarding/fast', () => {
    const dest = resolveProfileCompletionRoute({ profile: null, farms: [] });
    expect(dest.path).toBe('/onboarding/fast');
  });

  it('existing user with reason=new_farm → /profile/setup?newFarm=1 (intentional)', () => {
    const profile = { id: 'f1', farmerName: 'A', cropType: 'MAIZE', country: 'Ghana' };
    const farms = [{ id: 'f1', status: 'active' }];
    const dest = resolveProfileCompletionRoute({ profile, farms, reason: 'new_farm' });
    expect(dest.path).toBe('/profile/setup');
    expect(dest.query.newFarm).toBe('1');
  });

  it('existing user with incomplete profile → /edit-farm?mode=complete_profile', () => {
    const profile = { id: 'f1', farmerName: 'A', cropType: 'MAIZE', country: 'Ghana' };
    const farms = [{ id: 'f1', status: 'active' }];
    const dest = resolveProfileCompletionRoute({ profile, farms, reason: 'complete_profile' });
    expect(dest.path).toBe('/edit-farm');
    expect(dest.query.mode).toBe('complete_profile');
    expect(dest.query.farmId).toBe('f1');
  });

  it('setup reason with existing user routes to /edit-farm too', () => {
    const profile = { id: 'f2', farmerName: 'B', cropType: 'RICE', country: 'India' };
    const farms = [{ id: 'f2', status: 'active' }];
    const dest = resolveProfileCompletionRoute({ profile, farms, reason: 'setup' });
    expect(dest.path).toBe('/edit-farm');
  });

  it('returns frozen object', () => {
    const dest = resolveProfileCompletionRoute({ profile: null, farms: [] });
    expect(Object.isFrozen(dest)).toBe(true);
  });

  it('defaults reason to "setup" when omitted', () => {
    const profile = { id: 'f3', farmerName: 'C', cropType: 'MAIZE', country: 'Ghana' };
    const farms = [{ id: 'f3', status: 'active' }];
    const dest = resolveProfileCompletionRoute({ profile, farms });
    expect(dest.path).toBe('/edit-farm');
  });

  it('fallback path for edge case: existing-profile-like but no id', () => {
    // Not first-time because legacy fields present, but no editable id.
    const profile = { farmerName: 'D', cropType: 'MAIZE', country: 'Ghana' };
    const farms = [{ id: 'x', status: 'active' }];
    const dest = resolveProfileCompletionRoute({ profile, farms });
    expect(dest.path).toBe('/profile/setup');
  });
});

describe('routeToUrl', () => {
  it('builds plain path when no query', () => {
    expect(routeToUrl({ path: '/edit-farm' })).toBe('/edit-farm');
  });
  it('builds query string with URL-encoding', () => {
    expect(routeToUrl({ path: '/p', query: { farmId: 'a b', mode: 'complete_profile' } }))
      .toBe('/p?farmId=a%20b&mode=complete_profile');
  });
  it('skips null / empty query values', () => {
    expect(routeToUrl({ path: '/p', query: { farmId: 'x', missing: null, empty: '' } }))
      .toBe('/p?farmId=x');
  });
  it('returns "/" for bad input', () => {
    expect(routeToUrl(null)).toBe('/');
    expect(routeToUrl(undefined)).toBe('/');
  });
});
