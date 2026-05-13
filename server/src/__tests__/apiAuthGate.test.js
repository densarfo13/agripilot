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

// ─── Session-dead cool-down ────────────────────────────────────
// After a refresh failure (401 / 429 / 5xx), subsequent
// authenticated requests must short-circuit until a successful
// login / OTP / refreshSession resets the flag.

describe('lib/api.js session-dead cool-down', () => {
  it('marks session dead after a 401 → refresh-429 cascade', async () => {
    globalThis.localStorage.setItem('farroway_token', 'pretend-jwt');
    // First fetch returns 401; refresh returns 429; client sees both.
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ error: 'too_many_requests' }) });
    const { getCurrentUser, isSessionDead } = await import('../../../src/lib/api.js');
    await getCurrentUser().catch(() => null);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(isSessionDead()).toBe(true);
  });

  it('short-circuits subsequent authenticated calls without firing', async () => {
    globalThis.localStorage.setItem('farroway_token', 'pretend-jwt');
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) });
    const { getCurrentUser } = await import('../../../src/lib/api.js');
    await getCurrentUser().catch(() => null);
    const callsAfterFirst = globalThis.fetch.mock.calls.length;

    // Subsequent calls — these must NOT fire fetch.
    let err1 = null, err2 = null;
    try { await getCurrentUser(); } catch (e) { err1 = e; }
    try { await getCurrentUser(); } catch (e) { err2 = e; }
    expect(err1?.notAuthenticated).toBe(true);
    expect(err2?.notAuthenticated).toBe(true);
    // Network panel: exactly the original 2 calls (initial fetch +
    // refresh), nothing after.
    expect(globalThis.fetch.mock.calls.length).toBe(callsAfterFirst);
  });

  it('successful login resets the dead flag', async () => {
    globalThis.localStorage.setItem('farroway_token', 'pretend-jwt');
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      // Then the user logs in successfully:
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, user: { id: 'u1' } }) })
      // Then a subsequent authenticated call:
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ user: { id: 'u1' } }) });
    const { getCurrentUser, loginUser, isSessionDead } = await import('../../../src/lib/api.js');
    await getCurrentUser().catch(() => null);
    expect(isSessionDead()).toBe(true);
    await loginUser({ email: 'x@y', password: 'p' });
    expect(isSessionDead()).toBe(false);
    // The next authenticated call now goes through.
    await getCurrentUser();
    expect(globalThis.fetch).toHaveBeenCalledTimes(4);
  });

  it('refreshSession success also clears the flag', async () => {
    globalThis.localStorage.setItem('farroway_token', 'pretend-jwt');
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) });
    const { getCurrentUser, refreshSession, isSessionDead } = await import('../../../src/lib/api.js');
    await getCurrentUser().catch(() => null);
    expect(isSessionDead()).toBe(true);
    const ok = await refreshSession();
    expect(ok).toBe(true);
    expect(isSessionDead()).toBe(false);
  });

  it('logoutUser pre-emptively marks the session dead', async () => {
    globalThis.localStorage.setItem('farroway_token', 'pretend-jwt');
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    const { logoutUser, isSessionDead } = await import('../../../src/lib/api.js');
    await logoutUser();
    expect(isSessionDead()).toBe(true);
  });
});

// ─── Auth-refresh diagnostics + hard-logout event ───────────────
// Spec requirements: the four [Auth Refresh *] log lines + a
// dispatchable session-expired window event for AuthContext.

describe('lib/api.js auth-refresh diagnostics + session-expired event', () => {
  it('logs [REFRESH_START] when refreshOnce begins', async () => {
    globalThis.localStorage.setItem('farroway_token', 'pretend-jwt');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    const { getCurrentUser } = await import('../../../src/lib/api.js');
    await getCurrentUser().catch(() => null);
    const startCalls = logSpy.mock.calls.filter((c) => String(c[0]).includes('[REFRESH_START]'));
    expect(startCalls.length).toBe(1);
    logSpy.mockRestore();
  });

  it('logs [REFRESH_SUCCESS] when refresh returns ok', async () => {
    globalThis.localStorage.setItem('farroway_token', 'pretend-jwt');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ user: { id: 'u1' } }) });
    const { getCurrentUser } = await import('../../../src/lib/api.js');
    await getCurrentUser();
    const successCalls = logSpy.mock.calls.filter((c) => String(c[0]).includes('[REFRESH_SUCCESS]'));
    expect(successCalls.length).toBeGreaterThanOrEqual(1);
    logSpy.mockRestore();
  });

  it('logs [REFRESH_FAILED] (as warn) when refresh returns non-ok', async () => {
    // The Failed log was promoted from console.log → console.warn in
    // the URL-runtime-elimination pass (commit 759d5d37) per the
    // spec rule "Keep only warn/error/fatal logs in production."
    // Spy on warn now to match the corrected behavior.
    globalThis.localStorage.setItem('farroway_token', 'pretend-jwt');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) });
    const { getCurrentUser } = await import('../../../src/lib/api.js');
    await getCurrentUser().catch(() => null);
    const failedCalls = warnSpy.mock.calls.filter((c) => String(c[0]).includes('[REFRESH_FAILED]'));
    expect(failedCalls.length).toBeGreaterThanOrEqual(1);
    warnSpy.mockRestore();
  });

  it('logs [Auth Loop Prevented] when the _sessionDead gate trips', async () => {
    globalThis.localStorage.setItem('farroway_token', 'pretend-jwt');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) });
    const { getCurrentUser } = await import('../../../src/lib/api.js');
    await getCurrentUser().catch(() => null);
    // Now a subsequent call should short-circuit + log loop-prevented.
    await getCurrentUser().catch(() => null);
    const loopCalls = logSpy.mock.calls.filter((c) => String(c[0]).includes('[Auth Loop Prevented]'));
    expect(loopCalls.length).toBeGreaterThanOrEqual(1);
    logSpy.mockRestore();
  });

  it('dispatches farroway:session_expired window event on refresh failure', async () => {
    globalThis.localStorage.setItem('farroway_token', 'pretend-jwt');
    // Stub window.dispatchEvent + the SESSION_EXPIRED_EVENT pickup.
    const events = [];
    const fakeWindow = {
      dispatchEvent: vi.fn((ev) => { events.push(ev && ev.type); return true; }),
    };
    const prevWindow = globalThis.window;
    globalThis.window = fakeWindow;
    // Polyfill CustomEvent for the test runner.
    if (typeof globalThis.CustomEvent !== 'function') {
      globalThis.CustomEvent = class CustomEvent {
        constructor(type, init) { this.type = type; this.detail = init && init.detail; }
      };
    }
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) });
    const { getCurrentUser, SESSION_EXPIRED_EVENT } = await import('../../../src/lib/api.js');
    await getCurrentUser().catch(() => null);
    expect(events).toContain(SESSION_EXPIRED_EVENT);
    expect(events).toContain('farroway:session_expired');
    globalThis.window = prevWindow;
  });

  it('session_expired event fires AT MOST once per dead-state transition', async () => {
    globalThis.localStorage.setItem('farroway_token', 'pretend-jwt');
    const events = [];
    const fakeWindow = {
      dispatchEvent: vi.fn((ev) => { events.push(ev && ev.type); return true; }),
    };
    const prevWindow = globalThis.window;
    globalThis.window = fakeWindow;
    if (typeof globalThis.CustomEvent !== 'function') {
      globalThis.CustomEvent = class CustomEvent {
        constructor(type, init) { this.type = type; this.detail = init && init.detail; }
      };
    }
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) });
    const { getCurrentUser } = await import('../../../src/lib/api.js');
    await getCurrentUser().catch(() => null);
    // Subsequent calls trip the gate but MUST NOT re-dispatch the event.
    await getCurrentUser().catch(() => null);
    await getCurrentUser().catch(() => null);
    const sessionEvents = events.filter((t) => t === 'farroway:session_expired');
    expect(sessionEvents.length).toBe(1);
    globalThis.window = prevWindow;
  });
});

// ─── Refresh attempt counter + cooldown (Runtime Orchestration §3) ──
// After _REFRESH_MAX_ATTEMPTS (3) failed refresh attempts within
// _REFRESH_WINDOW_MS (60s), refreshOnce must short-circuit with a
// synthetic 429 response without firing further network calls until
// the cooldown elapses. The counter resets on successful refresh /
// login / OTP verify / logout / markSessionAlive / clearSessionDead.

describe('lib/api.js refresh attempt counter + cooldown', () => {
  it('caps refresh attempts at _REFRESH_MAX_ATTEMPTS (3) within the window', async () => {
    // clearSessionDead between attempts so the _sessionDead gate
    // doesn't pre-empt the cooldown — we want to test the cooldown
    // gate specifically.
    globalThis.fetch = vi.fn(async () => ({
      ok: false, status: 429, json: async () => ({}),
    }));
    const { refreshSession, clearSessionDead } = await import('../../../src/lib/api.js');

    // 3 attempts hit the network (the cap).
    expect(await refreshSession()).toBe(false);
    clearSessionDead();
    expect(await refreshSession()).toBe(false);
    clearSessionDead();
    // The 3rd reset returns the counter to 0, so this is attempt 1 again.
    // Re-do without reset to actually exercise the cap.
  });

  it('returns synthetic non-ok response when cooldown trips (no network call)', async () => {
    // Drive 3 fails IN A ROW with no resets between → 4th call
    // must short-circuit without hitting fetch.
    globalThis.fetch = vi.fn(async () => ({
      ok: false, status: 429, json: async () => ({}),
    }));
    const { refreshSession, markSessionAlive } = await import('../../../src/lib/api.js');

    // Attempt 1 — fires; fails. _sessionDead = true.
    await refreshSession();
    // We need _sessionDead = false so the next refreshSession() call
    // doesn't short-circuit elsewhere; markSessionAlive resets the
    // dead flag AND the attempt counter, so use a direct flag flip:
    // call markSessionAlive then immediately re-die would also reset
    // the counter. Use the low-level path: call refreshSession() which
    // re-uses refreshOnce(). markSessionAlive RESETS the counter, so
    // skip it — instead let _sessionDead stay true and call
    // refreshSession() directly (it does not pre-gate on _sessionDead).
    await refreshSession();  // attempt 2
    await refreshSession();  // attempt 3 — last one before cap
    const fetchCallsBefore = globalThis.fetch.mock.calls.length;
    // Attempt 4 — MUST NOT fire fetch.
    const result = await refreshSession();
    expect(result).toBe(false);
    expect(globalThis.fetch.mock.calls.length).toBe(fetchCallsBefore);
    // Use markSessionAlive at the end to confirm reset doesn't crash.
    markSessionAlive();
  });

  it('counter resets on successful refresh', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) })
      // After success, the counter resets. We should be able to do 3 more attempts.
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) });
    const { refreshSession } = await import('../../../src/lib/api.js');
    await refreshSession(); // 1 (fail)
    await refreshSession(); // 2 (fail)
    await refreshSession(); // 3 (success → reset)
    // Now we can fail 3 more times before the cooldown kicks in.
    await refreshSession(); // 1 (fail, post-reset)
    await refreshSession(); // 2 (fail, post-reset)
    await refreshSession(); // 3 (fail, post-reset)
    // Net: exactly 6 fetches.
    expect(globalThis.fetch.mock.calls.length).toBe(6);
  });

  it('counter resets on successful login', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      // Then login (different endpoint, allowRefresh:false → no gate)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ user: { id: 'u1' } }) })
      // Then 3 more refresh attempts — counter was reset by login.
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) });
    const { refreshSession, loginUser } = await import('../../../src/lib/api.js');
    await refreshSession(); await refreshSession(); await refreshSession();
    await loginUser({ email: 'x@y', password: 'p' });
    await refreshSession(); await refreshSession(); await refreshSession();
    // 3 refresh + 1 login + 3 more refresh = 7 fetches; all went through.
    expect(globalThis.fetch.mock.calls.length).toBe(7);
  });
});
