/**
 * offlineSyncReliability.test.js — locks the Fix 1 spec from the
 * final pre-launch hardening sprint:
 *   • 401 → token refresh → retry once
 *   • exponential backoff (1s, 3s, 10s, 30s cap)
 *   • retry limit → terminal FAILED state
 *   • FAILED rows are visible (listFailed) + reactivatable (retryFailed)
 *   • queue persists in localStorage (already), survives module reload
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// localStorage shim for the queue — node-friendly Map-backed.
function installLocalStorage() {
  const m = new Map();
  globalThis.window = globalThis.window || {};
  window.localStorage = {
    get length() { return m.size; },
    key(i) { return [...m.keys()][i] || null; },
    getItem(k) { return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { m.set(k, String(v)); },
    removeItem(k) { m.delete(k); },
    clear() { m.clear(); },
  };
  return m;
}

let storeMap;
beforeEach(async () => {
  vi.resetModules();
  storeMap = installLocalStorage();
});
afterEach(() => {
  delete window.localStorage;
});

async function loadQueue() {
  return import('../../../src/lib/sync/offlineQueue.js');
}
async function loadEngine() {
  return import('../../../src/lib/sync/syncEngine.js');
}
async function loadTransport() {
  return import('../../../src/lib/sync/transport.js');
}

// Simulate an online environment so syncPending will drain.
vi.mock('../../../src/lib/network/networkStatus.js', () => ({
  getNetworkStatus: () => ({ online: true }),
  setLastSyncAt: () => {},
}));

// ─── Persistence ───────────────────────────────────────────────
describe('offlineQueue — persistence', () => {
  it('survives module reload (localStorage-backed)', async () => {
    const a = await loadQueue();
    a.enqueueAction({ type: 'task_complete', payload: { x: 1 } });
    expect(a.pendingCount()).toBe(1);
    // "Reload" the module — the queue should still be there.
    vi.resetModules();
    const b = await loadQueue();
    expect(b.pendingCount()).toBe(1);
  });
});

// ─── Backoff + retry limit + FAILED state ──────────────────────
describe('markFailure — backoff + terminal FAILED', () => {
  it('schedules nextAttemptAt with exponential backoff', async () => {
    const q = await loadQueue();
    const row = q.enqueueAction({ type: 'task_complete', payload: {} });
    const t0 = Date.now();
    const after1 = q.markFailure(row.id, new Error('network'));
    expect(after1.attempts).toBe(1);
    expect(after1.nextAttemptAt).toBeGreaterThanOrEqual(t0 + 900);  // ~1s
    const after2 = q.markFailure(row.id, new Error('network'));
    expect(after2.attempts).toBe(2);
    expect(after2.nextAttemptAt - t0).toBeGreaterThanOrEqual(2900); // ~3s
  });

  it('flips to terminal FAILED after MAX_ATTEMPTS retries', async () => {
    const q = await loadQueue();
    const row = q.enqueueAction({ type: 'task_complete', payload: {} });
    let after;
    for (let i = 0; i < q._internal.MAX_ATTEMPTS; i += 1) {
      after = q.markFailure(row.id, new Error('network'));
    }
    expect(after.failed).toBe(true);
    expect(after.failedAt).toBeGreaterThan(0);
    expect(q.failedCount()).toBe(1);
    expect(q.pendingCount()).toBe(0);
  });

  it('permanent:true short-circuits the cap immediately', async () => {
    const q = await loadQueue();
    const row = q.enqueueAction({ type: 'task_complete', payload: {} });
    const after = q.markFailure(row.id, new Error('validation_error'),
                                  { permanent: true });
    expect(after.failed).toBe(true);
    expect(after.attempts).toBe(1);
  });

  it('listQueue(pendingOnly) skips rows whose nextAttemptAt is in the future', async () => {
    const q = await loadQueue();
    const row = q.enqueueAction({ type: 'task_complete', payload: {} });
    q.markFailure(row.id, new Error('network'));   // schedules ~1s out
    const ready = q.listQueue({ pendingOnly: true, now: Date.now() });
    expect(ready.length).toBe(0);
    const later = q.listQueue({ pendingOnly: true, now: Date.now() + 60_000 });
    expect(later.length).toBe(1);
  });

  it('retryFailed resets a FAILED row so it drains again', async () => {
    const q = await loadQueue();
    const row = q.enqueueAction({ type: 'task_complete', payload: {} });
    for (let i = 0; i < q._internal.MAX_ATTEMPTS; i += 1) {
      q.markFailure(row.id, new Error('network'));
    }
    expect(q.failedCount()).toBe(1);
    const reset = q.retryFailed(row.id);
    expect(reset.failed).toBe(false);
    expect(reset.attempts).toBe(0);
    expect(q.pendingCount()).toBe(1);
  });
});

// ─── Contract: makeTransport threads refreshAuth into send ─────
describe('makeTransport ↔ refreshAuth wiring', () => {
  it('passes refreshAuth callback through to send()', async () => {
    const { makeTransport } = await loadTransport();
    let calls = 0;
    let refreshed = 0;
    const fetchFn = async () => {
      calls += 1;
      if (calls === 1) {
        return { ok: false, status: 401, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };
    const refreshAuth = async () => { refreshed += 1; return true; };
    const transport = makeTransport({ fetchFn, refreshAuth });
    const out = await transport.send({
      id: 'a', type: 'task_complete', payload: {},
    });
    expect(out.ok).toBe(true);
    expect(refreshed).toBe(1);
    expect(calls).toBe(2);
  });
});

// ─── 401 → refresh → retry ─────────────────────────────────────
describe('transport — 401 refresh', () => {
  it('retries once after a successful refresh', async () => {
    const { send } = await loadTransport();
    let calls = 0;
    const fetchFn = async () => {
      calls += 1;
      if (calls === 1) {
        return { ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) };
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    };
    let refreshed = 0;
    const refreshAuth = async () => { refreshed += 1; return true; };
    const out = await send(
      { id: 'a', type: 'task_complete', payload: {} },
      { fetchFn, refreshAuth },
    );
    expect(out.ok).toBe(true);
    expect(calls).toBe(2);
    expect(refreshed).toBe(1);
  });

  it('does NOT retry when refresh fails — surfaces 401 unchanged', async () => {
    const { send } = await loadTransport();
    let calls = 0;
    const fetchFn = async () => {
      calls += 1;
      return { ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) };
    };
    const refreshAuth = async () => false;
    const out = await send(
      { id: 'a', type: 'task_complete', payload: {} },
      { fetchFn, refreshAuth },
    );
    expect(out.ok).toBe(false);
    expect(out.code).toBe('unauthorized');
    expect(calls).toBe(1);
  });

  it('falls through cleanly when refreshAuth is not supplied', async () => {
    const { send } = await loadTransport();
    const fetchFn = async () => ({ ok: false, status: 401, json: async () => ({}) });
    const out = await send(
      { id: 'a', type: 'task_complete', payload: {} },
      { fetchFn },
    );
    expect(out.ok).toBe(false);
    expect(out.code).toBe('unauthorized');
  });
});

// ─── End-to-end: engine respects backoff + terminal failure ────
describe('syncEngine + offlineQueue integration', () => {
  it('stops attempting a row once it goes FAILED', async () => {
    const q = await loadQueue();
    const { syncPending } = await loadEngine();
    const row = q.enqueueAction({ type: 'task_complete', payload: {} });
    let calls = 0;
    const transport = {
      async send() { calls += 1; return { ok: false, code: 'network_error' }; },
    };
    // Force-flush the backoff window between drains so we can reach
    // the cap inside one test without sleeping.
    for (let i = 0; i < q._internal.MAX_ATTEMPTS; i += 1) {
      const stored = q.listQueue({}).find((e) => e.id === row.id);
      if (stored) { stored.nextAttemptAt = 0; q._internal.writeRaw(q.listQueue({})); }
      // Reset + write back via the internals so the next drain sees it.
      const list = q._internal.readRaw();
      const r = list.find((e) => e.id === row.id);
      if (r) { r.nextAttemptAt = 0; q._internal.writeRaw(list); }
      // eslint-disable-next-line no-await-in-loop
      await syncPending({ transport, isOnline: true });
    }
    const failedRow = q.listFailed().find((e) => e.id === row.id);
    expect(failedRow).toBeTruthy();
    expect(calls).toBe(q._internal.MAX_ATTEMPTS);
    // Subsequent drain skips terminal-failed rows entirely.
    await syncPending({ transport, isOnline: true });
    expect(calls).toBe(q._internal.MAX_ATTEMPTS);
  });

  it('marks validation_error as terminal on first attempt', async () => {
    const q = await loadQueue();
    const { syncPending } = await loadEngine();
    const row = q.enqueueAction({ type: 'task_complete', payload: {} });
    const transport = {
      async send() { return { ok: false, code: 'validation_error' }; },
    };
    await syncPending({ transport, isOnline: true });
    const failedRow = q.listFailed().find((e) => e.id === row.id);
    expect(failedRow).toBeTruthy();
    expect(failedRow.attempts).toBe(1);
  });
});
