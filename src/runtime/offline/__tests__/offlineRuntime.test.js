/**
 * offlineRuntime.test.js — Wave 7 hardening tests.
 *
 * Six scenarios from the spec:
 *   1. offline scan          — scan queue accepts a draft offline
 *   2. offline task completion — mutation queue accepts the write
 *   3. reconnect synchronization — drain fires in DRAIN_ORDER
 *   4. duplicate prevention  — idempotency-key cache suppresses
 *   5. queue replay          — drain is a no-op on second call
 *   6. state restoration     — restoreActiveContext returns frozen envelope
 *
 * The tests use the reset helpers to avoid cross-test leakage. The
 * harness substitutes a stub adapter where the legacy queues would
 * otherwise hit IDB / localStorage (we only test the runtime layer's
 * contract; the underlying queues have their own coverage).
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  registerQueue, getQueueDepth, drainQueue, getRegistrySnapshot,
  QUEUE_KIND, _resetForTests as resetRegistry,
} from '../queueRegistry.js';
import {
  reconcileOnReconnect, markIdempotencyKeySeen,
  isDuplicateIdempotencyKey, getReconciliationSnapshot,
  _resetForTests as resetReconcile,
} from '../reconcileReconnect.js';
import {
  restoreActiveContext, getRestorationSnapshot,
  _resetForTests as resetRestoration,
} from '../../continuity/continuityRestoration.js';

function makeStubAdapter(kind, initialDepth) {
  let depth = initialDepth;
  let drained = 0;
  return {
    adapterId: 'stub:' + kind,
    depth: () => depth,
    drain: async () => {
      drained += depth;
      const out = { ok: true, drained: depth, kind };
      depth = 0;
      return out;
    },
    inspect: () => [],
    _stub: { getDrainedCount: () => drained },
  };
}

describe('wave 7 — offline reliability', () => {
  beforeEach(() => {
    resetRegistry();
    resetReconcile();
    resetRestoration();
  });

  it('1. offline scan: queue registry accepts depth + drain', async () => {
    const stub = makeStubAdapter(QUEUE_KIND.SCAN, 3);
    const res = registerQueue(QUEUE_KIND.SCAN, stub);
    expect(res.ok).toBe(true);
    const depth = await getQueueDepth(QUEUE_KIND.SCAN);
    expect(depth).toBe(3);
  });

  it('2. offline task completion: mutation queue registers under journal/task/notification', () => {
    const adapter = makeStubAdapter('mutation', 5);
    for (const k of [QUEUE_KIND.JOURNAL, QUEUE_KIND.TASK, QUEUE_KIND.NOTIFICATION]) {
      const r = registerQueue(k, adapter);
      expect(r.ok).toBe(true);
    }
  });

  it('3. reconnect synchronization drains in deterministic order', async () => {
    const order = [];
    const adapters = {};
    for (const k of Object.values(QUEUE_KIND)) {
      const adapter = {
        adapterId: 'stub:' + k,
        depth: () => 1,
        drain: async () => { order.push(k); return { ok: true, drained: 1 }; },
        inspect: () => [],
      };
      adapters[k] = adapter;
      registerQueue(k, adapter);
    }
    const res = await reconcileOnReconnect({ trigger: 'test' });
    expect(res.ok).toBe(true);
    expect(res.drainOrder[0]).toBe(QUEUE_KIND.SCAN);
    expect(order[0]).toBe(QUEUE_KIND.SCAN);
    expect(order[order.length - 1]).toBe(QUEUE_KIND.RECOMMENDATION_ACK);
  });

  it('4. duplicate prevention: idempotency cache suppresses repeats', () => {
    expect(isDuplicateIdempotencyKey('k-abc')).toBe(false);
    const first = markIdempotencyKeySeen('k-abc');
    expect(first).toBe(false);
    const second = markIdempotencyKeySeen('k-abc');
    expect(second).toBe(true);
    expect(isDuplicateIdempotencyKey('k-abc')).toBe(true);
  });

  it('5. queue replay is idempotent — repeated drains return no_op when empty', async () => {
    registerQueue(QUEUE_KIND.SCAN, makeStubAdapter(QUEUE_KIND.SCAN, 2));
    const first = await drainQueue(QUEUE_KIND.SCAN);
    expect(first.ok).toBe(true);
    expect(first.drained).toBe(2);
    const second = await drainQueue(QUEUE_KIND.SCAN);
    // depth was reset to 0 by the first drain
    expect(second.ok).toBe(true);
    expect(second.drained).toBe(0);
  });

  it('6. state restoration: returns frozen activeFarm/Crop/Season/Task envelope', () => {
    const ctx = restoreActiveContext({ trigger: 'test' });
    expect(ctx).toBeDefined();
    expect(Object.isFrozen(ctx)).toBe(true);
    // Shape — values may be null in a test env without canonical store
    expect(ctx).toHaveProperty('activeFarm');
    expect(ctx).toHaveProperty('activeCrop');
    expect(ctx).toHaveProperty('activeSeason');
    expect(ctx).toHaveProperty('activeTask');
    expect(ctx.trigger).toBe('test');
    const snap = getRestorationSnapshot();
    expect(snap.restorationsTriggered).toBeGreaterThan(0);
  });

  it('registry snapshot covers declared kinds + coverage ratio', async () => {
    for (const k of Object.values(QUEUE_KIND)) {
      registerQueue(k, makeStubAdapter(k, 0));
    }
    const snap = await getRegistrySnapshot();
    expect(snap.declared).toBe(5);
    expect(snap.registered).toBe(5);
    expect(snap.coverage).toBe(1);
  });

  it('reconciliation snapshot reports drain order + duplicates suppressed', async () => {
    markIdempotencyKeySeen('a');
    markIdempotencyKeySeen('a'); // duplicate
    const snap = await getReconciliationSnapshot();
    expect(snap.duplicatesSuppressed).toBeGreaterThan(0);
    expect(Array.isArray(snap.drainOrder)).toBe(true);
    expect(snap.drainOrder.length).toBe(5);
  });
});
