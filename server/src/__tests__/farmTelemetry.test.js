/**
 * farmTelemetry.test.js — pins the §8 contract:
 *   1. trackCount increments + returns new value; rejects bad names.
 *   2. trackTiming end() records once; cancel() suppresses recording.
 *   3. trackError stores last message + count.
 *   4. instrumented() wraps an async fn with success + failure metrics.
 *   5. getTelemetrySnapshot returns p50/p95/avg + counts + errors.
 *   6. _resetTelemetry wipes everything.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as t from '../../../src/lib/farmTelemetry.js';

beforeEach(() => {
  t._resetTelemetry();
});

describe('farmTelemetry — counts', () => {
  it('increments + returns new value', () => {
    expect(t.trackCount('a')).toBe(1);
    expect(t.trackCount('a')).toBe(2);
    expect(t.trackCount('a', 5)).toBe(7);
  });

  it('rejects bad names', () => {
    expect(t.trackCount(null)).toBe(0);
    expect(t.trackCount('')).toBe(0);
  });
});

describe('farmTelemetry — timing', () => {
  it('records a sample on end()', () => {
    const timing = t.trackTiming('op');
    timing.end();
    const snap = t.getTelemetrySnapshot();
    expect(snap.timings.op.count).toBe(1);
  });

  it('end() is idempotent', () => {
    const timing = t.trackTiming('op');
    timing.end();
    timing.end();
    const snap = t.getTelemetrySnapshot();
    expect(snap.timings.op.count).toBe(1);
  });

  it('cancel() prevents recording', () => {
    const timing = t.trackTiming('op');
    timing.cancel();
    timing.end();
    const snap = t.getTelemetrySnapshot();
    expect(snap.timings.op).toBeUndefined();
  });
});

describe('farmTelemetry — errors', () => {
  it('stores message + count', () => {
    t.trackError('op', new Error('boom'));
    t.trackError('op', new Error('boom2'));
    const snap = t.getTelemetrySnapshot();
    expect(snap.errors.op.count).toBe(2);
    expect(snap.errors.op.lastError).toBe('boom2');
  });

  it('accepts string errors', () => {
    t.trackError('op', 'something failed');
    const snap = t.getTelemetrySnapshot();
    expect(snap.errors.op.lastError).toBe('something failed');
  });
});

describe('farmTelemetry — instrumented()', () => {
  it('records success + timing on resolved fn', async () => {
    const result = await t.instrumented('myop', async () => 42);
    expect(result).toBe(42);
    const snap = t.getTelemetrySnapshot();
    expect(snap.counts['myop.success']).toBe(1);
    expect(snap.timings.myop.count).toBe(1);
  });

  it('records failure + error + timing on rejected fn', async () => {
    await expect(t.instrumented('myop', async () => { throw new Error('nope'); })).rejects.toThrow('nope');
    const snap = t.getTelemetrySnapshot();
    expect(snap.counts['myop.failure']).toBe(1);
    expect(snap.errors.myop.count).toBe(1);
    expect(snap.timings.myop.count).toBe(1);
  });
});

describe('farmTelemetry — snapshot', () => {
  it('returns counts + timings + errors + sinceMs', async () => {
    t.trackCount('counter.a', 3);
    const tm = t.trackTiming('lat'); tm.end();
    t.trackError('lat', 'oops');
    const snap = t.getTelemetrySnapshot();
    expect(snap.counts['counter.a']).toBe(3);
    expect(snap.timings.lat).toBeDefined();
    expect(snap.errors.lat).toBeDefined();
    expect(snap.sinceMs).toBeGreaterThanOrEqual(0);
  });

  it('p50/p95 are computed', () => {
    for (let i = 0; i < 50; i += 1) {
      const tm = t.trackTiming('lat');
      tm.end();
    }
    const snap = t.getTelemetrySnapshot();
    expect(snap.timings.lat.count).toBe(50);
    expect(snap.timings.lat.p50Ms).toBeGreaterThanOrEqual(0);
    expect(snap.timings.lat.p95Ms).toBeGreaterThanOrEqual(snap.timings.lat.p50Ms);
  });
});
