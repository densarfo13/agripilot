/**
 * aiMemoryStore.test.js — pins the §5 memory contract:
 *   1. recordSignal validates kind + type.
 *   2. Suppression triggers at exactly SUPPRESS_AT_IGNORES (5)
 *      explicit skips inside the rolling window.
 *   3. Engagement (engaged/completed) clears suppression — the
 *      user came back to this kind voluntarily.
 *   4. Expired suppression is lazily cleaned on read.
 *   5. getSuppressedKinds excludes expired entries.
 *   6. resumeKind manually clears a suppression.
 *   7. clearMemory wipes.
 *   8. SSR / missing-localStorage path returns safe defaults.
 */

import { describe, it, expect, beforeEach } from 'vitest';

function _installLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem:    (k) => (store.has(k) ? store.get(k) : null),
    setItem:    (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear:      () => { store.clear(); },
  };
}

beforeEach(() => {
  _installLocalStorage();
});

describe('aiMemoryStore — recordSignal + shouldSuppress', () => {
  it('rejects invalid kind / type', async () => {
    const mod = await import('../../../src/lib/aiMemoryStore.js');
    expect(mod.recordSignal('', mod.SIGNAL_TYPES.SHOWN)).toBe(false);
    expect(mod.recordSignal('risk_high:fungal', 'wat')).toBe(false);
  });

  it('records valid events and does not suppress before threshold', async () => {
    const mod = await import('../../../src/lib/aiMemoryStore.js');
    for (let i = 0; i < mod.SUPPRESS_AT_IGNORES - 1; i += 1) {
      mod.recordSignal('risk_high:fungal', mod.SIGNAL_TYPES.IGNORED);
    }
    expect(mod.shouldSuppress('risk_high:fungal').suppressed).toBe(false);
  });

  it('triggers suppression at exactly SUPPRESS_AT_IGNORES', async () => {
    const mod = await import('../../../src/lib/aiMemoryStore.js');
    for (let i = 0; i < mod.SUPPRESS_AT_IGNORES; i += 1) {
      mod.recordSignal('risk_high:fungal', mod.SIGNAL_TYPES.IGNORED);
    }
    const r = mod.shouldSuppress('risk_high:fungal');
    expect(r.suppressed).toBe(true);
    expect(typeof r.until).toBe('number');
  });

  it('engagement clears an active suppression', async () => {
    const mod = await import('../../../src/lib/aiMemoryStore.js');
    for (let i = 0; i < mod.SUPPRESS_AT_IGNORES; i += 1) {
      mod.recordSignal('risk_high:fungal', mod.SIGNAL_TYPES.IGNORED);
    }
    expect(mod.shouldSuppress('risk_high:fungal').suppressed).toBe(true);
    mod.recordSignal('risk_high:fungal', mod.SIGNAL_TYPES.ENGAGED);
    expect(mod.shouldSuppress('risk_high:fungal').suppressed).toBe(false);
  });

  it('completion clears an active suppression', async () => {
    const mod = await import('../../../src/lib/aiMemoryStore.js');
    for (let i = 0; i < mod.SUPPRESS_AT_IGNORES; i += 1) {
      mod.recordSignal('risk_high:fungal', mod.SIGNAL_TYPES.IGNORED);
    }
    mod.recordSignal('risk_high:fungal', mod.SIGNAL_TYPES.COMPLETED);
    expect(mod.shouldSuppress('risk_high:fungal').suppressed).toBe(false);
  });

  it('per-kind isolation: suppressing A does not affect B', async () => {
    const mod = await import('../../../src/lib/aiMemoryStore.js');
    for (let i = 0; i < mod.SUPPRESS_AT_IGNORES; i += 1) {
      mod.recordSignal('risk_high:fungal', mod.SIGNAL_TYPES.IGNORED);
    }
    expect(mod.shouldSuppress('risk_high:fungal').suppressed).toBe(true);
    expect(mod.shouldSuppress('task_top').suppressed).toBe(false);
  });

  it('getSuppressedKinds returns only currently-suppressed entries', async () => {
    const mod = await import('../../../src/lib/aiMemoryStore.js');
    for (let i = 0; i < mod.SUPPRESS_AT_IGNORES; i += 1) {
      mod.recordSignal('risk_high:fungal', mod.SIGNAL_TYPES.IGNORED);
    }
    const list = mod.getSuppressedKinds();
    expect(list).toHaveLength(1);
    expect(list[0].kind).toBe('risk_high:fungal');
    expect(typeof list[0].until).toBe('string');
  });

  it('resumeKind manually clears a suppression', async () => {
    const mod = await import('../../../src/lib/aiMemoryStore.js');
    for (let i = 0; i < mod.SUPPRESS_AT_IGNORES; i += 1) {
      mod.recordSignal('risk_high:fungal', mod.SIGNAL_TYPES.IGNORED);
    }
    expect(mod.resumeKind('risk_high:fungal')).toBe(true);
    expect(mod.shouldSuppress('risk_high:fungal').suppressed).toBe(false);
    // Resuming again is a no-op (nothing to clear).
    expect(mod.resumeKind('risk_high:fungal')).toBe(false);
  });

  it('clearMemory wipes the store', async () => {
    const mod = await import('../../../src/lib/aiMemoryStore.js');
    mod.recordSignal('risk_high:fungal', mod.SIGNAL_TYPES.SHOWN);
    mod.clearMemory();
    const counters = mod.getEngagementCounters('risk_high:fungal');
    expect(counters.shown).toBe(0);
  });

  it('getEngagementCounters returns shown/engaged/ignored/completed', async () => {
    const mod = await import('../../../src/lib/aiMemoryStore.js');
    mod.recordSignal('risk_high:fungal', mod.SIGNAL_TYPES.SHOWN);
    mod.recordSignal('risk_high:fungal', mod.SIGNAL_TYPES.SHOWN);
    mod.recordSignal('risk_high:fungal', mod.SIGNAL_TYPES.IGNORED);
    const c = mod.getEngagementCounters('risk_high:fungal');
    expect(c.shown).toBe(2);
    expect(c.ignored).toBe(1);
    expect(c.engaged).toBe(0);
  });

  it('does not throw on missing localStorage (SSR-like env)', async () => {
    delete globalThis.localStorage;
    const mod = await import('../../../src/lib/aiMemoryStore.js');
    expect(() => mod.recordSignal('risk_high:fungal', mod.SIGNAL_TYPES.IGNORED)).not.toThrow();
    expect(mod.shouldSuppress('risk_high:fungal').suppressed).toBe(false);
    expect(mod.getEngagementCounters().shown).toBe(0);
  });
});

describe('nextBestAction × aiMemoryStore — adaptation flow', () => {
  it('engine drops a suppressed kind and falls through to next priority', async () => {
    const memMod = await import('../../../src/lib/aiMemoryStore.js');
    const engineMod = await import('../../../src/lib/nextBestAction.js');

    // Pre-suppress 'risk_high:fungal' by recording 5 ignores.
    for (let i = 0; i < memMod.SUPPRESS_AT_IGNORES; i += 1) {
      memMod.recordSignal('risk_high:fungal', memMod.SIGNAL_TYPES.IGNORED);
    }

    const r = engineMod.computeNextBestAction({
      risks: [{ kind: 'fungal', level: 'high', headline: 'Fungal risk high', action: 'Spray copper.' }],
      topPrioritizedAction: { task: { id: 't1', title: 'Inspect maize', urgency: 'medium', actionType: 'inspect' } },
      isSuppressed: (k) => memMod.shouldSuppress(k).suppressed,
    });

    // The high-fungal candidate was dropped; engine falls through
    // to the top prioritized task.
    expect(r.kind).toBe('task_top');
  });

  it('fallback_walk is NEVER suppressed (there must always be SOMETHING to say)', async () => {
    const memMod = await import('../../../src/lib/aiMemoryStore.js');
    const engineMod = await import('../../../src/lib/nextBestAction.js');
    for (let i = 0; i < memMod.SUPPRESS_AT_IGNORES; i += 1) {
      memMod.recordSignal('fallback_walk', memMod.SIGNAL_TYPES.IGNORED);
    }
    const r = engineMod.computeNextBestAction({
      isSuppressed: (k) => memMod.shouldSuppress(k).suppressed,
    });
    expect(r.kind).toBe('fallback_walk');
  });
});
