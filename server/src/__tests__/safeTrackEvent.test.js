/**
 * safeTrackEvent.test.js — pins the analytics contract:
 *   1. never blocks the UI (caller never awaits a result)
 *   2. never throws
 *   3. times out safely (5s race)
 *   4. swallows network failures
 *
 * The wrapper must satisfy all four legs even when the underlying
 * trackEvent is misbehaving (hangs forever, throws synchronously,
 * returns garbage, throws asynchronously).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.setConfig({ testTimeout: 10000 });

// Re-stub the api.js trackEvent before each test so we can model
// every failure shape the wrapper has to absorb. The wrapper
// imports from '../api.js' relatively, so we mock that path.
beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('safeTrackEvent — non-blocking + never-throws contract', () => {
  it('returns synchronously (does not await trackEvent)', async () => {
    // trackEvent returns a forever-pending promise — wrapper must
    // not await it. We measure that safeTrackEvent itself resolves
    // immediately by checking that it returns synchronously.
    vi.doMock('../../../src/lib/api.js', () => ({
      trackEvent: () => new Promise(() => { /* forever pending */ }),
    }));
    const { safeTrackEvent } = await import('../../../src/lib/analytics.js');
    const before = Date.now();
    // No await — must complete instantly.
    safeTrackEvent('boot', { test: true });
    const after = Date.now();
    expect(after - before).toBeLessThan(50);
  });

  it('never throws when trackEvent throws synchronously', async () => {
    vi.doMock('../../../src/lib/api.js', () => ({
      trackEvent: () => { throw new Error('synchronous boom'); },
    }));
    const { safeTrackEvent } = await import('../../../src/lib/analytics.js');
    expect(() => safeTrackEvent('boot')).not.toThrow();
  });

  it('never throws when trackEvent returns a non-thenable', async () => {
    vi.doMock('../../../src/lib/api.js', () => ({
      trackEvent: () => 'oops — not a promise',
    }));
    const { safeTrackEvent } = await import('../../../src/lib/analytics.js');
    expect(() => safeTrackEvent('boot')).not.toThrow();
  });

  it('never throws when trackEvent returns null/undefined', async () => {
    vi.doMock('../../../src/lib/api.js', () => ({
      trackEvent: () => null,
    }));
    const { safeTrackEvent } = await import('../../../src/lib/analytics.js');
    expect(() => safeTrackEvent('boot')).not.toThrow();
  });

  it('swallows network failures (rejected promise)', async () => {
    vi.doMock('../../../src/lib/api.js', () => ({
      trackEvent: () => Promise.reject(new Error('network down')),
    }));
    const { safeTrackEvent } = await import('../../../src/lib/analytics.js');
    // Should not surface the rejection — no unhandled rejection.
    expect(() => safeTrackEvent('boot')).not.toThrow();
    // Tick the microtask queue so the rejection's catch handler runs.
    await new Promise((r) => setTimeout(r, 0));
  });

  it('completes synchronously even when trackEvent is missing', async () => {
    vi.doMock('../../../src/lib/api.js', () => ({}));
    const { safeTrackEvent } = await import('../../../src/lib/analytics.js');
    // The named import will be undefined — wrapper must not crash.
    expect(() => safeTrackEvent('boot')).not.toThrow();
  });

  it('handles undefined/null arguments without throwing', async () => {
    vi.doMock('../../../src/lib/api.js', () => ({
      trackEvent: () => Promise.resolve({ ok: true }),
    }));
    const { safeTrackEvent } = await import('../../../src/lib/analytics.js');
    expect(() => safeTrackEvent(undefined)).not.toThrow();
    expect(() => safeTrackEvent(null)).not.toThrow();
    expect(() => safeTrackEvent('boot', undefined)).not.toThrow();
    expect(() => safeTrackEvent('boot', null)).not.toThrow();
  });
});

describe('safeTrackEvent — 5s timeout race', () => {
  it('resolves the race after ~5 seconds when trackEvent hangs', async () => {
    vi.useFakeTimers();
    let raceResolution = null;
    let raceResolved = false;
    vi.doMock('../../../src/lib/api.js', () => ({
      // Forever-pending — the timeout MUST win.
      trackEvent: () => new Promise(() => {}),
    }));
    // Re-stub Promise.race so we can capture the resolution value
    // the wrapper sees from the race.
    const realRace = Promise.race.bind(Promise);
    const raceSpy = vi.fn(async (promises) => {
      const winner = await realRace(promises);
      raceResolution = winner;
      raceResolved = true;
      return winner;
    });
    // eslint-disable-next-line no-global-assign
    Promise.race = raceSpy;

    const { safeTrackEvent } = await import('../../../src/lib/analytics.js');
    safeTrackEvent('long_event');

    // Advance time past the 5s timeout window.
    await vi.advanceTimersByTimeAsync(5_100);

    expect(raceResolved).toBe(true);
    expect(raceResolution).toEqual({ skipped: true, reason: 'timeout' });

    // Restore the real Promise.race.
    // eslint-disable-next-line no-global-assign
    Promise.race = realRace;
  });
});
