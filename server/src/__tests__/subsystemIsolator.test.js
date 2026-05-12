/**
 * subsystemIsolator.test.js — pins the §9 contract:
 *   1. runIsolated returns the fn value on success.
 *   2. runIsolated returns the fallback on throw.
 *   3. runIsolatedAsync resolves with fn value on success.
 *   4. runIsolatedAsync resolves with fallback on rejection.
 *   5. timeoutMs causes async failure to fall back instead of hanging.
 *   6. onError hook fires (but its own throw is contained).
 *   7. Telemetry records ok / failure / timeout per subsystem.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { runIsolated, runIsolatedAsync } from '../../../src/lib/subsystemIsolator.js';
import * as tel from '../../../src/lib/farmTelemetry.js';

beforeEach(() => {
  tel._resetTelemetry();
});

describe('runIsolated — sync', () => {
  it('returns fn value on success', () => {
    expect(runIsolated('w', () => 42, 'fallback')).toBe(42);
    expect(tel.getTelemetrySnapshot().counts['subsystem.w.ok']).toBe(1);
  });

  it('returns fallback on throw + records failure', () => {
    expect(runIsolated('w', () => { throw new Error('x'); }, 'fallback')).toBe('fallback');
    const snap = tel.getTelemetrySnapshot();
    expect(snap.counts['subsystem.w.failure']).toBe(1);
    expect(snap.errors['subsystem.w'].count).toBe(1);
  });

  it('returns fallback when fn is not a function', () => {
    expect(runIsolated('w', null, 'fb')).toBe('fb');
  });

  it('fires onError hook (and contains its own throw)', () => {
    let called = false;
    runIsolated('w', () => { throw new Error('inner'); }, null, {
      onError: () => { called = true; throw new Error('logger broke'); },
    });
    expect(called).toBe(true);
  });
});

describe('runIsolatedAsync — async', () => {
  it('resolves with fn value on success', async () => {
    const r = await runIsolatedAsync('w', async () => 'ok', 'fb');
    expect(r).toBe('ok');
  });

  it('resolves with fallback on rejection (NEVER rejects)', async () => {
    const r = await runIsolatedAsync('w', async () => { throw new Error('x'); }, 'fb');
    expect(r).toBe('fb');
    expect(tel.getTelemetrySnapshot().counts['subsystem.w.failure']).toBe(1);
  });

  it('returns fallback on timeout', async () => {
    const r = await runIsolatedAsync(
      'slow',
      () => new Promise((res) => setTimeout(() => res('late'), 200)),
      'fb',
      { timeoutMs: 30 },
    );
    expect(r).toBe('fb');
    const snap = tel.getTelemetrySnapshot();
    expect(snap.counts['subsystem.slow.timeout']).toBe(1);
  });

  it('does not throw when fn is missing', async () => {
    const r = await runIsolatedAsync('w', null, 'fb');
    expect(r).toBe('fb');
  });
});
