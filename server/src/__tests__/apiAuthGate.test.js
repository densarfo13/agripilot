/**
 * apiAuthGate.test.js — verifies the May 2026 noise-reduction:
 * authenticated endpoints in src/lib/api.js SKIP the fetch entirely
 * when isLoggedIn() returns false, instead of firing → 401 → trying
 * /auth/refresh → 401 again. That cascade produced 4 red errors in
 * DevTools on every guest / expired-session boot.
 *
 * Contract:
 *   • Authenticated endpoints (allowRefresh: true by default) throw
 *     a synthetic 401 Error with `notAuthenticated: true` BEFORE any
 *     network call when no session is present.
 *   • Unauthenticated endpoints (login, OTP request, recovery
 *     probes — all pass allowRefresh: false) STILL fire even when
 *     no session is present.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.setConfig({ testTimeout: 10000 });

function makeStorage() {
  const store = new Map();
  return {
    getItem:    (k) => (store.has(k) ? store.get(k) : null),
    setItem:    (k, v) => { store.set(String(k), String(v)); },
    removeItem: (k) => { store.delete(String(k)); },
    clear:      () => { store.clear(); },
  };
}

// Stable test base URL so the resolver doesn't crash at module load.
// Set this BEFORE importing the api module — module load reads it.
beforeEach(() => {
  globalThis.localStorage = makeStorage();
  // import.meta.env shim: the resolver reads VITE_API_URL or falls
  // back to the same-origin guard. We pin a value via process.env
  // so the module load doesn't throw in node.
  process.env.VITE_API_URL = 'https://api.example.test';
  // Spy on fetch — every test starts with a clean spy.
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ok: true }),
  }));
});

afterEach(() => {
  vi.resetModules();
});

describe('lib/api.js auth-gate (May 2026 console-noise fix)', () => {
  it('throws notAuthenticated WITHOUT firing fetch on authenticated endpoints when no session', async () => {
    // No farroway_token + no farroway:session_cache → not authenticated.
    const { getCurrentUser } = await import('../../../src/lib/api.js');
    let err = null;
    try { await getCurrentUser(); }
    catch (e) { err = e; }
    expect(err).not.toBeNull();
    expect(err.status).toBe(401);
    expect(err.notAuthenticated).toBe(true);
    // The critical assertion — no network call was made.
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('STILL fires fetch on unauthenticated endpoints (allowRefresh: false)', async () => {
    const { loginUser } = await import('../../../src/lib/api.js');
    await loginUser({ email: 'x@y', password: 'p' }).catch(() => null);
    // Login must hit the network even with no session — that IS how
    // sessions start.
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const callUrl = globalThis.fetch.mock.calls[0][0];
    expect(callUrl).toMatch(/\/api\/v2\/auth\/login$/);
  });

  it('fires fetch on authenticated endpoints when a token IS present', async () => {
    globalThis.localStorage.setItem('farroway_token', 'pretend-jwt');
    const { getCurrentUser } = await import('../../../src/lib/api.js');
    await getCurrentUser().catch(() => null);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const callUrl = globalThis.fetch.mock.calls[0][0];
    expect(callUrl).toMatch(/\/api\/v2\/auth\/me$/);
  });

  it('fires fetch on authenticated endpoints when V2 session-cache mirror is present', async () => {
    globalThis.localStorage.setItem(
      'farroway:session_cache',
      JSON.stringify({ user: { id: 'u1', email: 'x@y' } }),
    );
    const { getCurrentUser } = await import('../../../src/lib/api.js');
    await getCurrentUser().catch(() => null);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('does NOT call /api/v2/auth/refresh on a guest boot', async () => {
    // The whole point of the gate: when there's no session, the
    // refresh dance must not run either. (refreshOnce is a separate
    // codepath but it's only triggered from request() on a 401 — if
    // we never get to fetch, we never see the 401, we never refresh.)
    const { getCurrentUser } = await import('../../../src/lib/api.js');
    await getCurrentUser().catch(() => null);
    // Scan every recorded fetch call's URL.
    const calls = globalThis.fetch.mock.calls;
    for (const c of calls) {
      expect(String(c[0])).not.toMatch(/\/auth\/refresh$/);
    }
    // And we expect zero calls anyway.
    expect(calls.length).toBe(0);
  });
});
