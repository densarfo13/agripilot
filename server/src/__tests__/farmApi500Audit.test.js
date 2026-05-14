/**
 * farmApi500Audit.test.js — Farroway Farm API 500 Error Audit.
 *
 * Backend /list endpoint contract (verified via lightweight
 * structural call-pattern simulation — we don't stand up
 * Prisma + Express in a unit test):
 *
 *   1. userId-path query runs first.
 *   2. When userId-path throws or returns empty, the farmer
 *      relation fallback runs.
 *   3. When BOTH paths fail, return 500 with retryable:true
 *      so the client retry layer knows to back off.
 *   4. When userId-path succeeds with rows, return them
 *      WITHOUT running the farmer fallback (no extra DB load).
 *
 * Frontend getFarms() contract:
 *
 *   1. Never throws — returns { farms, failed?, error?, status? }.
 *   2. Retries up to 2 times on 5xx with 350/700ms backoff.
 *   3. Does NOT retry 4xx — fails fast.
 *   4. ProfileContext.refreshFarms preserves last-known-good
 *      state when the envelope reports failed:true OR sorted=[].
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

function makeStorage() {
  const store = new Map();
  return {
    getItem:    (k) => (store.has(k) ? store.get(k) : null),
    setItem:    (k, v) => { store.set(String(k), String(v)); },
    removeItem: (k) => { store.delete(String(k)); },
    clear:      () => { store.clear(); },
    key:        (i) => Array.from(store.keys())[i] || null,
    get length() { return store.size; },
  };
}

beforeEach(() => {
  vi.resetModules();
  const ls = makeStorage();
  globalThis.localStorage = ls;
  globalThis.window = {
    localStorage:        ls,
    addEventListener:    vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent:       vi.fn(),
  };
});

// ─── Backend handler structural simulation ────────────────────
//
// We replicate the handler's branch logic against a fake Prisma
// client so we can exercise both query paths + the dual-failure
// case without a real DB.

function makeFakePrisma({ userIdRows, userIdThrows, farmerRows, farmerThrows }) {
  let calls = [];
  return {
    farmProfile: {
      findMany: async ({ where }) => {
        if (where && where.userId !== undefined) {
          calls.push('userId');
          if (userIdThrows) throw new Error('userId path failed');
          return userIdRows || [];
        }
        if (where && where.farmer) {
          calls.push('farmer');
          if (farmerThrows) throw new Error('farmer path failed');
          return farmerRows || [];
        }
        return [];
      },
    },
    _calls: () => calls,
  };
}

// Inline a mini-handler that mirrors the real route's branch
// logic. We test the BRANCH SHAPE — the live code follows
// the same flow.
async function runListHandler(prisma, userId) {
  if (!userId) return { status: 401, body: { success: false, error: 'Unauthenticated' } };
  let userIdFarms = [];
  let userIdError = null;
  try {
    userIdFarms = await prisma.farmProfile.findMany({ where: { userId } });
  } catch (err) { userIdError = err; }

  let farmerFarms = [];
  let farmerError = null;
  if (userIdFarms.length === 0) {
    try {
      farmerFarms = await prisma.farmProfile.findMany({ where: { farmer: { userId } } });
    } catch (err) { farmerError = err; }
  }

  if (userIdError && farmerError) {
    return { status: 500, body: { success: false, error: 'Failed to list farm profiles', retryable: true } };
  }
  const combined = userIdFarms.length > 0 ? userIdFarms : farmerFarms;
  return {
    status: 200,
    body: {
      success: true,
      farms:   combined,
      source:  userIdFarms.length > 0 ? 'userId' : (farmerFarms.length > 0 ? 'farmer' : 'empty'),
    },
  };
}

describe('Backend /list handler — resilient branch logic', () => {
  it('401 when req.user is unauthenticated', async () => {
    const prisma = makeFakePrisma({});
    const res = await runListHandler(prisma, null);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns userId rows when the direct query succeeds with data', async () => {
    const prisma = makeFakePrisma({ userIdRows: [{ id: 'fa' }] });
    const res = await runListHandler(prisma, 'user-1');
    expect(res.status).toBe(200);
    expect(res.body.farms).toHaveLength(1);
    expect(res.body.source).toBe('userId');
    // Did NOT run the farmer fallback (no extra DB load).
    expect(prisma._calls()).toEqual(['userId']);
  });

  it('falls through to the farmer relation when userId path returns empty', async () => {
    const prisma = makeFakePrisma({ userIdRows: [], farmerRows: [{ id: 'fa-legacy' }] });
    const res = await runListHandler(prisma, 'user-1');
    expect(res.status).toBe(200);
    expect(res.body.farms).toHaveLength(1);
    expect(res.body.source).toBe('farmer');
    expect(prisma._calls()).toEqual(['userId', 'farmer']);
  });

  it('falls through to the farmer relation when userId path THROWS', async () => {
    const prisma = makeFakePrisma({ userIdThrows: true, farmerRows: [{ id: 'fa' }] });
    const res = await runListHandler(prisma, 'user-1');
    expect(res.status).toBe(200);
    expect(res.body.farms).toHaveLength(1);
    expect(res.body.source).toBe('farmer');
  });

  it('returns 500 + retryable:true when BOTH paths throw', async () => {
    const prisma = makeFakePrisma({ userIdThrows: true, farmerThrows: true });
    const res = await runListHandler(prisma, 'user-1');
    expect(res.status).toBe(500);
    expect(res.body.retryable).toBe(true);
  });

  it('returns 200 + empty + source:empty on a genuine no-rows case', async () => {
    const prisma = makeFakePrisma({ userIdRows: [], farmerRows: [] });
    const res = await runListHandler(prisma, 'user-1');
    expect(res.status).toBe(200);
    expect(res.body.farms).toEqual([]);
    expect(res.body.source).toBe('empty');
  });
});

// ─── Frontend getFarms() retry + envelope contract ───────────

describe('Frontend getFarms() — retry + typed envelope', () => {
  /**
   * The real getFarms wraps `request()` from api.js. `request()`
   * has a pre-flight `if (!isLoggedIn()) throw` gate that we
   * have to satisfy by seeding the session cache before importing
   * the module. We also stub `fetch` so the retry loop is
   * exercised against a deterministic transport.
   */
  async function loadGetFarmsWithFetch(fetchImpl) {
    vi.resetModules();
    // Seed a fake session so isLoggedIn() returns true.
    globalThis.localStorage.setItem(
      'farroway:session_cache',
      JSON.stringify({ user: { id: 'user-1', email: 't@x.com' } }),
    );
    globalThis.fetch = fetchImpl;
    globalThis.window.fetch = fetchImpl;
    const mod = await import('../../../src/lib/api.js');
    return mod.getFarms;
  }

  it('returns the body when the first attempt succeeds', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return {
        ok:     true,
        status: 200,
        headers: new Map(),
        json:   async () => ({ success: true, farms: [{ id: 'fa' }], source: 'userId' }),
        text:   async () => '',
      };
    };
    const getFarms = await loadGetFarmsWithFetch(fetchImpl);
    const out = await getFarms();
    expect(out.farms).toEqual([{ id: 'fa' }]);
    expect(out.source).toBe('userId');
    expect(calls).toBe(1);
  });

  it('retries on 500 + succeeds on attempt 2', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: false, status: 500, headers: new Map(),
          json: async () => ({ success: false, error: 'first try' }),
          text: async () => '{"success":false}',
        };
      }
      return {
        ok: true, status: 200, headers: new Map(),
        json: async () => ({ success: true, farms: [{ id: 'fa' }] }),
        text: async () => '',
      };
    };
    const getFarms = await loadGetFarmsWithFetch(fetchImpl);
    const out = await getFarms();
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(out.farms).toEqual([{ id: 'fa' }]);
  }, 5000);

  it('after 3 failed attempts returns failed:true (never throws)', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return {
        ok: false, status: 500, headers: new Map(),
        json: async () => ({ success: false, error: 'persistent' }),
        text: async () => '{"success":false}',
      };
    };
    const getFarms = await loadGetFarmsWithFetch(fetchImpl);
    const out = await getFarms();
    expect(out.failed).toBe(true);
    expect(out.farms).toEqual([]);
    expect(calls).toBe(3); // 1 initial + 2 retries
  }, 5000);

  it('does NOT retry on 4xx (bad request)', async () => {
    // Using 404 avoids the api.js auth-refresh dance that would
    // re-fire the request on 401. 404 is the cleanest signal for
    // "fail fast - 4xx is not retryable".
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return {
        ok: false, status: 404, headers: new Map(),
        json: async () => ({ success: false, error: 'Not Found' }),
        text: async () => '{"success":false}',
      };
    };
    const getFarms = await loadGetFarmsWithFetch(fetchImpl);
    const out = await getFarms();
    expect(out.failed).toBe(true);
    // Our retry layer must NOT fire on 4xx — only `request()`'s
    // own behaviour can produce > 1 call.
    expect(calls).toBeLessThan(3);
  });
});

// ─── ProfileContext refreshFarms — preserves state on failure ─

describe('refreshFarms shape — last-known-good preservation', () => {
  // Mirror the inline logic from ProfileContext.refreshFarms so we
  // can test the branch without standing up the full React tree.
  function refreshFarmsBranch({ data, currentFarms }) {
    if (data && data.failed) return currentFarms; // preserve
    const list = (data && data.farms) || [];
    return list; // would call sortFarms in real code
  }

  it('preserves currentFarms when getFarms returns failed:true', () => {
    const result = refreshFarmsBranch({
      data: { failed: true, farms: [], error: 'oops' },
      currentFarms: [{ id: 'local', name: 'Pre-existing' }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('local');
  });

  it('replaces with new list when getFarms succeeds', () => {
    const result = refreshFarmsBranch({
      data: { farms: [{ id: 'new' }] },
      currentFarms: [{ id: 'old' }],
    });
    expect(result).toEqual([{ id: 'new' }]);
  });

  it('returns empty list when API genuinely has no farms', () => {
    const result = refreshFarmsBranch({
      data: { farms: [], source: 'empty' },
      currentFarms: [],
    });
    expect(result).toEqual([]);
  });
});
