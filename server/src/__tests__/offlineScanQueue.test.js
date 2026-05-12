/**
 * offlineScanQueue.test.js — pins the §10 contract:
 *   1. enqueueScan persists + returns an id.
 *   2. The queue is bounded (oldest dropped at QUEUE_CAP).
 *   3. drainQueue removes successful entries + bumps attempts on failure.
 *   4. drainQueue never throws when retryFn throws.
 *   5. Idempotency: same retryFn called repeatedly degrades gracefully.
 *   6. clearQueue wipes.
 *
 * The Node test env has no real localStorage — we stub it on
 * `globalThis` before each test so the module's storage path runs.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// A minimal localStorage shim. Resets per-test.
function _installLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem:    (k) => (store.has(k) ? store.get(k) : null),
    setItem:    (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear:      () => { store.clear(); },
  };
  return store;
}

beforeEach(() => {
  _installLocalStorage();
  vi.resetModules();
});

describe('offlineScanQueue — enqueue + read', () => {
  it('enqueueScan persists an entry and returns its id', async () => {
    const mod = await import('../../../src/lib/offlineScanQueue.js');
    const id = mod.enqueueScan({
      imageBase64: 'data:image/jpeg;base64,abc',
      cropName: 'maize',
    });
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    const list = mod.listQueuedScans();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(id);
    expect(list[0].imageBase64).toBe('data:image/jpeg;base64,abc');
    expect(list[0].cropName).toBe('maize');
    expect(list[0].attempts).toBe(0);
  });

  it('enqueueScan rejects missing or empty imageBase64', async () => {
    const mod = await import('../../../src/lib/offlineScanQueue.js');
    expect(mod.enqueueScan({})).toBeNull();
    expect(mod.enqueueScan({ imageBase64: '' })).toBeNull();
    expect(mod.enqueueScan(null)).toBeNull();
  });

  it('caps the queue at QUEUE_CAP entries (drops oldest)', async () => {
    const mod = await import('../../../src/lib/offlineScanQueue.js');
    for (let i = 0; i < mod.QUEUE_CAP + 3; i += 1) {
      mod.enqueueScan({ imageBase64: 'data:img,' + i, cropName: 'c' + i });
    }
    const list = mod.listQueuedScans();
    expect(list).toHaveLength(mod.QUEUE_CAP);
    // The oldest 3 should be gone — the surviving first entry has
    // a higher index than 0.
    expect(list[0].cropName).not.toBe('c0');
  });

  it('getQueuedScanCount counts only non-exhausted entries', async () => {
    const mod = await import('../../../src/lib/offlineScanQueue.js');
    mod.enqueueScan({ imageBase64: 'data:img,a' });
    mod.enqueueScan({ imageBase64: 'data:img,b' });
    expect(mod.getQueuedScanCount()).toBe(2);
  });
});

describe('offlineScanQueue — drain', () => {
  it('drainQueue removes successful entries and returns their results', async () => {
    const mod = await import('../../../src/lib/offlineScanQueue.js');
    mod.enqueueScan({ imageBase64: 'data:a' });
    mod.enqueueScan({ imageBase64: 'data:b' });
    const retryFn = vi.fn(async (entry) => ({ ok: true, id: entry.id }));
    const results = await mod.drainQueue(retryFn);
    expect(retryFn).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(2);
    expect(mod.getQueuedScanCount()).toBe(0);
  });

  it('drainQueue bumps attempts on failure and keeps the entry', async () => {
    const mod = await import('../../../src/lib/offlineScanQueue.js');
    mod.enqueueScan({ imageBase64: 'data:a' });
    const retryFn = vi.fn(async () => { throw new Error('still offline'); });
    await mod.drainQueue(retryFn);
    const list = mod.listQueuedScans();
    expect(list).toHaveLength(1);
    expect(list[0].attempts).toBe(1);
    expect(list[0].lastErrorAt).not.toBeNull();
  });

  it('drainQueue drops entries that exceed MAX_ATTEMPTS', async () => {
    const mod = await import('../../../src/lib/offlineScanQueue.js');
    mod.enqueueScan({ imageBase64: 'data:a' });
    const failingFn = async () => { throw new Error('still offline'); };
    for (let i = 0; i < mod.MAX_ATTEMPTS; i += 1) {
      await mod.drainQueue(failingFn);
    }
    // Entry is now at MAX_ATTEMPTS — getQueuedScanCount excludes it.
    expect(mod.getQueuedScanCount()).toBe(0);
  });

  it('drainQueue with no retryFn returns []', async () => {
    const mod = await import('../../../src/lib/offlineScanQueue.js');
    mod.enqueueScan({ imageBase64: 'data:a' });
    const r = await mod.drainQueue(null);
    expect(r).toEqual([]);
  });

  it('drainQueue never throws when retryFn throws synchronously', async () => {
    const mod = await import('../../../src/lib/offlineScanQueue.js');
    mod.enqueueScan({ imageBase64: 'data:a' });
    const retryFn = () => { throw new Error('sync boom'); };
    await expect(mod.drainQueue(retryFn)).resolves.toBeDefined();
  });

  it('clearQueue wipes the slot', async () => {
    const mod = await import('../../../src/lib/offlineScanQueue.js');
    mod.enqueueScan({ imageBase64: 'data:a' });
    mod.clearQueue();
    expect(mod.getQueuedScanCount()).toBe(0);
  });
});

describe('offlineScanQueue — isLikelyOnline', () => {
  it('returns true when navigator is missing (Node env)', async () => {
    const mod = await import('../../../src/lib/offlineScanQueue.js');
    expect(mod.isLikelyOnline()).toBe(true);
  });
});
