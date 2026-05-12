/**
 * farmWorkerRegistry.test.js — pins the §5 contract:
 *   1. registerWorker / hasWorker / unregisterWorker round-trip.
 *   2. enqueueWork resolves with the worker's return value.
 *   3. Worker failure rejects the caller's promise + bumps telemetry.
 *   4. Concurrency cap is respected.
 *   5. dedupeKey collapses two rapid submissions into one promise.
 *   6. unregisterWorker rejects pending jobs.
 *   7. QUEUE_CAP rejects further submissions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as w from '../../../src/lib/farmWorkerRegistry.js';
import * as tel from '../../../src/lib/farmTelemetry.js';

beforeEach(() => {
  w._resetWorkers();
  tel._resetTelemetry();
});

describe('farmWorkerRegistry — basic', () => {
  it('registers + reports hasWorker', () => {
    expect(w.hasWorker('x')).toBe(false);
    w.registerWorker('x', async () => 1);
    expect(w.hasWorker('x')).toBe(true);
  });

  it('enqueueWork resolves with the worker return value', async () => {
    w.registerWorker('echo', async (p) => p + 1);
    const r = await w.enqueueWork('echo', 41);
    expect(r).toBe(42);
  });

  it('rejects when worker not registered', async () => {
    await expect(w.enqueueWork('nope', null)).rejects.toThrow(/not_registered/);
  });

  it('worker failure rejects + bumps failure telemetry', async () => {
    w.registerWorker('flaky', async () => { throw new Error('boom'); });
    await expect(w.enqueueWork('flaky', null)).rejects.toThrow('boom');
    const snap = tel.getTelemetrySnapshot();
    expect(snap.counts['worker.flaky.failure']).toBe(1);
    expect(snap.errors['worker.flaky'].count).toBe(1);
  });

  it('worker success bumps success telemetry', async () => {
    w.registerWorker('ok', async () => 7);
    await w.enqueueWork('ok', null);
    const snap = tel.getTelemetrySnapshot();
    expect(snap.counts['worker.ok.success']).toBe(1);
    expect(snap.timings['worker.ok']).toBeDefined();
  });
});

describe('farmWorkerRegistry — concurrency + dedupe', () => {
  it('respects concurrency cap', async () => {
    let inflight = 0;
    let maxInflight = 0;
    w.registerWorker('slow', async () => {
      inflight += 1;
      maxInflight = Math.max(maxInflight, inflight);
      await new Promise((r) => setTimeout(r, 20));
      inflight -= 1;
    }, { concurrency: 2 });

    const promises = Array.from({ length: 5 }, () => w.enqueueWork('slow', null));
    await Promise.all(promises);
    expect(maxInflight).toBeLessThanOrEqual(2);
  });

  it('dedupeKey collapses queued submissions', async () => {
    let calls = 0;
    w.registerWorker('dedupable', async (p) => {
      calls += 1;
      return p;
    }, { concurrency: 1 });

    // First call kicks the worker. While it's running, two rapid
    // dedup-keyed calls queue — both should resolve to the SAME
    // result (the later payload wins) and the worker fires once.
    const p1 = w.enqueueWork('dedupable', 'first');
    const p2 = w.enqueueWork('dedupable', 'duplicate-a', { dedupeKey: 'k' });
    const p3 = w.enqueueWork('dedupable', 'duplicate-b', { dedupeKey: 'k' });

    await Promise.all([p1, p2, p3]);
    // First non-dedup call + ONE dedup-keyed run = 2 invocations.
    expect(calls).toBe(2);
    expect(await p2).toBe('duplicate-b');
    expect(await p3).toBe('duplicate-b');
  });
});

describe('farmWorkerRegistry — unregister + queue cap', () => {
  it('unregisterWorker rejects pending jobs', async () => {
    let release;
    w.registerWorker('slow', async () => new Promise((r) => { release = r; }), { concurrency: 1 });

    const inflight = w.enqueueWork('slow', null);
    const queued = w.enqueueWork('slow', null);
    // Let the microtask drain so 'inflight' is actually inflight.
    await Promise.resolve();
    w.unregisterWorker('slow');

    await expect(queued).rejects.toThrow(/unregistered/);
    // Release the inflight job so the test doesn't hang.
    release(null);
    await Promise.resolve();
    void inflight;
  });

  it('rejects new submissions when the queue is full', async () => {
    w.registerWorker('packed', async () => new Promise((r) => setTimeout(r, 50)), { concurrency: 1 });
    // Fill the queue to QUEUE_CAP.
    const ps = [];
    for (let i = 0; i < w.QUEUE_CAP; i += 1) {
      ps.push(w.enqueueWork('packed', i));
    }
    // The next one should reject.
    await expect(w.enqueueWork('packed', 'overflow')).rejects.toThrow(/queue_full/);
    // Let the queued ones drain so the test cleans up.
    await Promise.all(ps.map((p) => p.catch(() => null)));
  });
});
