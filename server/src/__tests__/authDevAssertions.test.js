/**
 * authDevAssertions.test.js — contract for the §15
 * development-only auth warnings.
 *
 * Every assertion:
 *   • is silent when its precondition does not hold
 *   • logs console.warn with a stable tag when it holds
 *   • is pure — no throws, no state leaks between tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  assertRequestHasToken,
  assertRefreshNotRacing,
  assertAdminPageGuarded,
  assertMfaRouted,
  assertSessionUpdatedAfterRefresh,
  assertBannerAfterRecovery,
} from '../../../src/core/auth/authDevAssertions.js';

const TAG = '[farroway.auth]';

let warnSpy;
beforeEach(() => {
  globalThis.window = globalThis.window || {};
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { warnSpy.mockRestore(); });

// ─── assertRequestHasToken ───────────────────────────────────
describe('assertRequestHasToken', () => {
  it('silent when request carries a token', () => {
    assertRequestHasToken('/api/admin/users', true);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('silent when url is not a protected endpoint', () => {
    assertRequestHasToken('/api/public/crops', false);
    assertRequestHasToken('/api/weather', false);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('warns on /api/admin without token', () => {
    assertRequestHasToken('/api/admin/users', false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toBe(TAG);
  });
  it('warns on /api/v2/admin without token', () => {
    assertRequestHasToken('/api/v2/admin/analytics', false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
  it('warns on /api/v2/auth/me without token', () => {
    assertRequestHasToken('/api/v2/auth/me', false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

// ─── assertRefreshNotRacing ──────────────────────────────────
describe('assertRefreshNotRacing', () => {
  it('silent with 0 or 1 in-flight refresh', () => {
    assertRefreshNotRacing(0);
    assertRefreshNotRacing(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('warns when 2+ refreshes race', () => {
    assertRefreshNotRacing(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

// ─── assertAdminPageGuarded ──────────────────────────────────
describe('assertAdminPageGuarded', () => {
  it('silent on non-admin routes', () => {
    assertAdminPageGuarded('/dashboard', false);
    assertAdminPageGuarded('/tasks', false);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('silent on admin route with guard', () => {
    assertAdminPageGuarded('/admin/users', true);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('warns on admin route without guard', () => {
    assertAdminPageGuarded('/admin/security', false);
    assertAdminPageGuarded('/admin/intelligence/alerts', false);
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});

// ─── assertMfaRouted ─────────────────────────────────────────
describe('assertMfaRouted', () => {
  it('silent when MFA not required', () => {
    assertMfaRouted(false, false);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('silent when MFA required AND routed', () => {
    assertMfaRouted(true, true);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('warns when MFA required but not routed', () => {
    assertMfaRouted(true, false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

// ─── assertSessionUpdatedAfterRefresh ────────────────────────
describe('assertSessionUpdatedAfterRefresh', () => {
  it('silent when refresh did not succeed', () => {
    assertSessionUpdatedAfterRefresh(false, false);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('silent when refresh succeeded AND store updated', () => {
    assertSessionUpdatedAfterRefresh(true, true);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('warns on refresh success without store update', () => {
    assertSessionUpdatedAfterRefresh(true, false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

// ─── assertBannerAfterRecovery ───────────────────────────────
describe('assertBannerAfterRecovery', () => {
  it('silent when no banner shown', () => {
    assertBannerAfterRecovery(false, false);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('silent when banner shown AND recovery was tried', () => {
    assertBannerAfterRecovery(true, true);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('warns when banner shown without recovery attempt', () => {
    assertBannerAfterRecovery(true, false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
