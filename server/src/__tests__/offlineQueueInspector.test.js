/**
 * offlineQueueInspector.test.js — locks the admin-facing queue
 * inspector + the offline-aware listing creation wrapper.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory localStorage shim before the queue loads.
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
// navigator is typically read-only; use defineProperty so tests
// can toggle online/offline without touching the real browser stub.
try {
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true }, writable: true, configurable: true,
  });
} catch { /* env already has a compatible navigator */ }

import {
  enqueueAction, clearQueue, listQueue, hasPending,
} from '../../../src/lib/sync/offlineQueue.js';
import {
  getQueueStats, listFailedEntries, listAllEntries,
  retryOne, retryAllFailed, dismissEntry,
} from '../../../src/lib/sync/queueInspector.js';
import {
  createMarketplaceListingOfflineAware,
} from '../../../src/lib/marketplace.js';

beforeEach(() => { mem.clear(); clearQueue(); (globalThis.navigator || {}).onLine = true; });

// ═══════════════════════════════════════════════════════════════
// queueInspector — read helpers
// ═══════════════════════════════════════════════════════════════
describe('getQueueStats', () => {
  it('zero shape when queue is empty', () => {
    const s = getQueueStats();
    expect(s.total).toBe(0);
    expect(s.pending).toBe(0);
    expect(s.failed).toBe(0);
    expect(s.synced).toBe(0);
    expect(s.oldestPendingAt).toBeNull();
    expect(s.byType).toEqual([]);
  });

  it('counts pending + groups by type', () => {
    enqueueAction({ type: 'task_complete', farmId: 'f', taskId: 't1' });
    enqueueAction({ type: 'task_complete', farmId: 'f', taskId: 't2' });
    enqueueAction({ type: 'listing.draft', farmId: 'f', payload: { crop: 'maize' } });
    const s = getQueueStats();
    expect(s.total).toBe(3);
    expect(s.pending).toBe(3);
    expect(s.synced).toBe(0);
    const task = s.byType.find((r) => r.type === 'task_complete');
    expect(task.pending).toBe(2);
  });

  it('tracks failed entries separately', async () => {
    enqueueAction({ type: 'task_complete', farmId: 'f', taskId: 't' });
    // Mark failure by round-tripping through retryOne with a
    // transport that always fails.
    const badTransport = { send: async () => ({ ok: false, code: 'server_error' }) };
    const [entry] = listQueue({ pendingOnly: true });
    await retryOne(entry.id, { transport: badTransport });
    const s = getQueueStats();
    expect(s.failed).toBe(1);
    expect(s.pending).toBe(1);
  });
});

describe('listAllEntries / listFailedEntries', () => {
  it('listAllEntries returns every row', () => {
    enqueueAction({ type: 'task_complete', farmId: 'f', taskId: 't1' });
    enqueueAction({ type: 'task_complete', farmId: 'f', taskId: 't2' });
    expect(listAllEntries().length).toBe(2);
  });

  it('listFailedEntries filters to attempts > 0', async () => {
    enqueueAction({ type: 'task_complete', farmId: 'f', taskId: 'a' });
    enqueueAction({ type: 'task_complete', farmId: 'f', taskId: 'b' });
    const [first] = listQueue({ pendingOnly: true });
    await retryOne(first.id, {
      transport: { send: async () => ({ ok: false, code: 'server_error' }) },
    });
    const failed = listFailedEntries();
    expect(failed.length).toBe(1);
    expect(failed[0].id).toBe(first.id);
  });
});

// ═══════════════════════════════════════════════════════════════
// queueInspector — mutators
// ═══════════════════════════════════════════════════════════════
describe('retryOne', () => {
  it('success marks synced', async () => {
    enqueueAction({ type: 'task_complete', farmId: 'f', taskId: 't' });
    const [entry] = listQueue({ pendingOnly: true });
    const out = await retryOne(entry.id, {
      transport: { send: async () => ({ ok: true }) },
    });
    expect(out.ok).toBe(true);
    expect(hasPending()).toBe(false);
  });

  it('duplicate code is treated as synced', async () => {
    enqueueAction({ type: 'task_complete', farmId: 'f', taskId: 't' });
    const [entry] = listQueue({ pendingOnly: true });
    const out = await retryOne(entry.id, {
      transport: { send: async () => ({ ok: false, code: 'duplicate' }) },
    });
    expect(out.ok).toBe(true);
    expect(out.code).toBe('duplicate');
    expect(hasPending()).toBe(false);
  });

  it('failure bumps attempts + keeps the row', async () => {
    enqueueAction({ type: 'task_complete', farmId: 'f', taskId: 't' });
    const [entry] = listQueue({ pendingOnly: true });
    const out = await retryOne(entry.id, {
      transport: { send: async () => ({ ok: false, code: 'server_error' }) },
    });
    expect(out.ok).toBe(false);
    expect(hasPending()).toBe(true);
    const [now] = listQueue({ pendingOnly: true });
    expect(now.attempts).toBeGreaterThan(0);
    expect(now.lastError).toBe('server_error');
  });

  it('transport that throws is caught + recorded as failure', async () => {
    enqueueAction({ type: 'task_complete', farmId: 'f', taskId: 't' });
    const [entry] = listQueue({ pendingOnly: true });
    const out = await retryOne(entry.id, {
      transport: { send: async () => { throw new Error('network down'); } },
    });
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('transport_threw');
  });

  it('missing id / not found / already synced', async () => {
    expect((await retryOne(null, { transport: {} })).reason).toBe('missing_id');
    expect((await retryOne('nope', { transport: { send: async () => ({ ok: true }) } })).reason)
      .toBe('not_found');
  });
});

describe('retryAllFailed', () => {
  it('drives every failed entry through the transport', async () => {
    enqueueAction({ type: 'task_complete', farmId: 'f', taskId: 'a' });
    enqueueAction({ type: 'task_complete', farmId: 'f', taskId: 'b' });
    const bad = { send: async () => ({ ok: false, code: 'server_error' }) };
    // Fail both once so both have attempts > 0.
    for (const e of listQueue({ pendingOnly: true })) {
      await retryOne(e.id, { transport: bad });
    }
    expect(listFailedEntries().length).toBe(2);

    const good = { send: async () => ({ ok: true }) };
    const report = await retryAllFailed({ transport: good });
    expect(report.attempted).toBe(2);
    expect(report.succeeded).toBe(2);
    expect(hasPending()).toBe(false);
  });
});

describe('dismissEntry', () => {
  it('removes an entry from the queue entirely', () => {
    const first = enqueueAction({ type: 'task_complete', farmId: 'f', taskId: 'x' });
    enqueueAction({ type: 'task_complete', farmId: 'f', taskId: 'y' });
    expect(listAllEntries().length).toBe(2);
    dismissEntry(first.id);
    expect(listAllEntries().length).toBe(1);
    expect(listAllEntries()[0].taskId).toBe('y');
  });
});

// ═══════════════════════════════════════════════════════════════
// createMarketplaceListingOfflineAware
// ═══════════════════════════════════════════════════════════════
describe('createMarketplaceListingOfflineAware', () => {
  function mockFetch(response) {
    globalThis.fetch = async () => response;
  }
  function throwingFetch(err) {
    globalThis.fetch = async () => { throw err; };
  }

  it('online + server success → queued:false', async () => {
    (globalThis.navigator || {}).onLine = true;
    mockFetch({
      ok: true, status: 200,
      json: async () => ({ success: true, data: { id: 'l1', crop: 'MAIZE' } }),
    });
    const out = await createMarketplaceListingOfflineAware({
      crop: 'maize', quantity: 50, farmId: 'f1',
    });
    expect(out.queued).toBe(false);
    expect(out.listing.id).toBe('l1');
    expect(hasPending()).toBe(false);
  });

  it('offline → queued:true (listing.draft in queue)', async () => {
    (globalThis.navigator || {}).onLine = false;
    const out = await createMarketplaceListingOfflineAware({
      crop: 'maize', quantity: 50, farmId: 'f1',
    });
    expect(out.queued).toBe(true);
    expect(out.queueId).toBeTruthy();
    const [entry] = listQueue({ pendingOnly: true });
    expect(entry.type).toBe('listing.draft');
    expect(entry.farmId).toBe('f1');
    expect(entry.payload.crop).toBe('maize');
    expect(entry.payload.quantity).toBe(50);
  });

  it('online but fetch throws → queued:true (network fallback)', async () => {
    (globalThis.navigator || {}).onLine = true;
    throwingFetch(new Error('network refused'));
    const out = await createMarketplaceListingOfflineAware({
      crop: 'rice', quantity: 10, farmId: 'f2',
    });
    expect(out.queued).toBe(true);
    const [entry] = listQueue({ pendingOnly: true });
    expect(entry.type).toBe('listing.draft');
    expect(entry.payload.crop).toBe('rice');
  });

  it('online + validation error → throws (does NOT queue)', async () => {
    (globalThis.navigator || {}).onLine = true;
    mockFetch({
      ok: false, status: 400,
      json: async () => ({ success: false, error: 'missing_crop' }),
    });
    await expect(createMarketplaceListingOfflineAware({
      quantity: 0, farmId: 'f1',
    })).rejects.toMatchObject({ code: 'missing_crop' });
    expect(hasPending()).toBe(false);
  });

  it('dedupes rapid same-farm+same-crop drafts', async () => {
    (globalThis.navigator || {}).onLine = false;
    await createMarketplaceListingOfflineAware({ crop: 'maize', quantity: 10, farmId: 'f1' });
    await createMarketplaceListingOfflineAware({ crop: 'maize', quantity: 10, farmId: 'f1' });
    await createMarketplaceListingOfflineAware({ crop: 'maize', quantity: 20, farmId: 'f1' });
    expect(listQueue({ pendingOnly: true }).length).toBe(1);
  });
});
