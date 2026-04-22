/**
 * offlineSyncTransport.test.js — locks the sync transport +
 * integration with the existing offline queue + sync engine.
 *
 * Covers:
 *   • transport.send routing by action type (path + method + body)
 *   • 2xx → ok:true; 409 duplicate → code:duplicate
 *   • 4xx / 5xx / network error → ok:false with typed codes
 *   • Idempotency-Key header forwarded from action.id
 *   • syncEngine end-to-end: pending action drained + marked synced
 *   • syncEngine: transport failure marks failure without losing data
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory localStorage shim — has to be in place BEFORE the
// offlineQueue module loads, since it reads the current storage
// at import time in some code paths.
const mem = new Map();
globalThis.window = globalThis.window || {};
globalThis.window.localStorage = {
  getItem:     (k) => (mem.has(k) ? mem.get(k) : null),
  setItem:     (k, v) => mem.set(k, String(v)),
  removeItem:  (k) => mem.delete(k),
  clear:       () => mem.clear(),
  get length() { return mem.size; },
  key(i)       { return Array.from(mem.keys())[i] || null; },
};
globalThis.window.addEventListener    = () => {};
globalThis.window.removeEventListener = () => {};
globalThis.window.dispatchEvent        = () => true;

import { send, makeTransport, ROUTES, SUPPORTED_TYPES }
  from '../../../src/lib/sync/transport.js';
import {
  enqueueAction, listQueue, hasPending, pendingCount, clearQueue,
} from '../../../src/lib/sync/offlineQueue.js';
import { syncPending } from '../../../src/lib/sync/syncEngine.js';

beforeEach(() => { mem.clear(); clearQueue(); });

// ═══════════════════════════════════════════════════════════════
// transport.send — routing
// ═══════════════════════════════════════════════════════════════
describe('transport.send routing', () => {
  function captureFetch(responseInit = {}) {
    const calls = [];
    const fetchFn = vi.fn(async (path, opts) => {
      calls.push({ path, opts });
      const {
        status = 200,
        body   = { success: true, data: { ok: true } },
      } = responseInit;
      return {
        ok:      status >= 200 && status < 300,
        status,
        json:    async () => body,
      };
    });
    return { fetchFn, calls };
  }

  it('task_complete routes to POST /api/tasks/completed with farmId+templateId', async () => {
    const { fetchFn, calls } = captureFetch();
    const out = await send({
      id: 'q1', type: 'task_complete',
      farmId: 'farm-1', taskId: 'mid.scout_pests',
      payload: { completedAt: '2026-05-15T10:00:00Z' },
    }, { fetchFn });
    expect(out.ok).toBe(true);
    expect(calls[0].path).toBe('/api/tasks/completed');
    expect(calls[0].opts.method).toBe('POST');
    expect(calls[0].opts.credentials).toBe('include');
    const body = JSON.parse(calls[0].opts.body);
    expect(body.farmId).toBe('farm-1');
    expect(body.templateId).toBe('mid.scout_pests');
    expect(body.completedAt).toBe('2026-05-15T10:00:00Z');
    // Idempotency-Key forwarded.
    expect(calls[0].opts.headers['Idempotency-Key']).toBe('q1');
  });

  it('task_skip routes to POST /api/tasks/skipped', async () => {
    const { fetchFn, calls } = captureFetch();
    await send({ id: 'q2', type: 'task_skip', farmId: 'f', taskId: 't',
                  payload: { skippedAt: '2026-05-15T10:00:00Z' } },
                { fetchFn });
    expect(calls[0].path).toBe('/api/tasks/skipped');
    expect(calls[0].opts.method).toBe('POST');
  });

  it('task_uncomplete routes to DELETE /api/tasks/completed', async () => {
    const { fetchFn, calls } = captureFetch();
    await send({ id: 'q3', type: 'task_uncomplete',
                  farmId: 'f', taskId: 't' }, { fetchFn });
    expect(calls[0].path).toBe('/api/tasks/completed');
    expect(calls[0].opts.method).toBe('DELETE');
  });

  it('crop.update routes to PATCH /api/farms/:id with patch body', async () => {
    const { fetchFn, calls } = captureFetch();
    await send({
      id: 'q4', type: 'crop.update',
      farmId: 'farm-1',
      payload: { crop: 'maize', cropStage: 'vegetative' },
    }, { fetchFn });
    expect(calls[0].path).toBe('/api/farms/farm-1');
    expect(calls[0].opts.method).toBe('PATCH');
    const body = JSON.parse(calls[0].opts.body);
    expect(body.crop).toBe('maize');
    expect(body.cropStage).toBe('vegetative');
  });

  it('farm.update mirrors the whole payload onto /api/farms/:id', async () => {
    const { fetchFn, calls } = captureFetch();
    await send({
      id: 'q5', type: 'farm.update',
      payload: { farmId: 'farm-2', region: 'Ashanti', country: 'GH' },
    }, { fetchFn });
    expect(calls[0].path).toBe('/api/farms/farm-2');
    const body = JSON.parse(calls[0].opts.body);
    expect(body.region).toBe('Ashanti');
  });

  it('listing.draft routes to /api/marketplace/list with minimal body', async () => {
    const { fetchFn, calls } = captureFetch();
    await send({
      id: 'q6', type: 'listing.draft',
      payload: { crop: 'maize', quantity: 50, price: 0.25, region: 'AS' },
    }, { fetchFn });
    expect(calls[0].path).toBe('/api/marketplace/list');
    const body = JSON.parse(calls[0].opts.body);
    expect(body.crop).toBe('maize');
    expect(body.quantity).toBe(50);
    expect(body.price).toBe(0.25);
  });

  it('photo.metadata routes to POST /api/photos/metadata', async () => {
    const { fetchFn, calls } = captureFetch();
    await send({
      id: 'q7', type: 'photo.metadata',
      farmId: 'f',
      payload: { kind: 'crop', metadata: { gps: { lat: 1, lng: 2 } }, clientId: 'c' },
    }, { fetchFn });
    expect(calls[0].path).toBe('/api/photos/metadata');
    expect(calls[0].opts.method).toBe('POST');
  });

  it('ROUTES exports the canonical supported list', () => {
    expect(SUPPORTED_TYPES).toEqual(Object.keys(ROUTES));
  });
});

// ═══════════════════════════════════════════════════════════════
// transport.send — error handling
// ═══════════════════════════════════════════════════════════════
describe('transport.send error handling', () => {
  function fakeFetch(status, body) {
    return async () => ({
      ok:     status >= 200 && status < 300,
      status,
      json:   async () => body,
    });
  }
  function throwingFetch(err) {
    return async () => { throw err; };
  }

  it('unknown type → ok:false code=unsupported_type', async () => {
    const out = await send({ id: 'q', type: 'made.up', payload: {} });
    expect(out.ok).toBe(false);
    expect(out.code).toBe('unsupported_type');
  });

  it('missing type → ok:false code=missing_action_type', async () => {
    const out = await send({ id: 'q' });
    expect(out.ok).toBe(false);
    expect(out.code).toBe('missing_action_type');
  });

  it('network error → ok:false code=network_error', async () => {
    const out = await send({ id: 'q', type: 'task_complete', farmId: 'f', taskId: 't' },
      { fetchFn: throwingFetch(new Error('ENOTFOUND')) });
    expect(out.ok).toBe(false);
    expect(out.code).toBe('network_error');
  });

  it('500 → ok:false code=server_error', async () => {
    const out = await send({ id: 'q', type: 'task_complete', farmId: 'f', taskId: 't' },
      { fetchFn: fakeFetch(500, { error: 'boom' }) });
    expect(out.ok).toBe(false);
    expect(out.code).toBe('server_error');
  });

  it('409 duplicate → code=duplicate (engine marks synced)', async () => {
    const out = await send({ id: 'q', type: 'task_complete', farmId: 'f', taskId: 't' },
      { fetchFn: fakeFetch(409, { error: 'duplicate' }) });
    expect(out.ok).toBe(false);
    expect(out.code).toBe('duplicate');
  });

  it('400 validation → ok:false code from body', async () => {
    const out = await send({ id: 'q', type: 'task_complete', farmId: 'f', taskId: 't' },
      { fetchFn: fakeFetch(400, { error: 'missing_farm' }) });
    expect(out.ok).toBe(false);
    expect(out.code).toBe('missing_farm');
  });
});

// ═══════════════════════════════════════════════════════════════
// Sync engine end-to-end with fake transport
// ═══════════════════════════════════════════════════════════════
describe('syncPending end-to-end', () => {
  it('drains pending actions when online + marks them synced', async () => {
    enqueueAction({ type: 'task_complete', farmId: 'f', taskId: 't1' });
    enqueueAction({ type: 'task_complete', farmId: 'f', taskId: 't2' });
    expect(pendingCount()).toBe(2);

    const sent = [];
    const transport = {
      send: async (a) => { sent.push(a.taskId); return { ok: true }; },
    };

    const report = await syncPending({ transport, isOnline: true });
    expect(report.attempted).toBe(2);
    expect(report.succeeded).toBe(2);
    expect(report.failed).toBe(0);
    expect(sent.sort()).toEqual(['t1', 't2']);
    expect(hasPending()).toBe(false);
  });

  it('leaves failures queued + bumps attempts', async () => {
    enqueueAction({ type: 'task_complete', farmId: 'f', taskId: 't1' });
    const transport = {
      send: async () => ({ ok: false, code: 'server_error' }),
    };
    const report = await syncPending({ transport, isOnline: true });
    expect(report.failed).toBe(1);
    expect(hasPending()).toBe(true);
    const [entry] = listQueue({ pendingOnly: true });
    expect(entry.attempts).toBeGreaterThan(0);
    expect(entry.lastError).toBe('server_error');
  });

  it('offline → skips with no side effects', async () => {
    enqueueAction({ type: 'task_complete', farmId: 'f', taskId: 't' });
    const sent = [];
    const transport = { send: async (a) => { sent.push(a); return { ok: true }; } };
    const report = await syncPending({ transport, isOnline: false });
    expect(report.skipped).toBe(1);
    expect(sent.length).toBe(0);
    expect(hasPending()).toBe(true);
  });

  it('duplicate code marks synced (stops retrying)', async () => {
    enqueueAction({ type: 'task_complete', farmId: 'f', taskId: 't' });
    const transport = {
      send: async () => ({ ok: false, code: 'duplicate' }),
    };
    const report = await syncPending({ transport, isOnline: true });
    expect(report.succeeded).toBe(1);
    expect(hasPending()).toBe(false);
  });

  it('dedupKey coalesces rapid duplicate enqueues', () => {
    enqueueAction({ type: 'task_complete', farmId: 'f', taskId: 't',
                     dedupKey: 'task:f:t:today' });
    enqueueAction({ type: 'task_complete', farmId: 'f', taskId: 't',
                     dedupKey: 'task:f:t:today' });
    enqueueAction({ type: 'task_complete', farmId: 'f', taskId: 't',
                     dedupKey: 'task:f:t:today' });
    expect(pendingCount()).toBe(1);
  });
});
