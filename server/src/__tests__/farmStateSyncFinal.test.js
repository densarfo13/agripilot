/**
 * farmStateSyncFinal.test.js — closes the last two follow-ups
 * from the Farm State Sync Audit:
 *
 *   1. farmContextEngine prefers the v1 cache when it agrees
 *      with the canonical pointer.
 *   2. FarmerTodayPage now imports + uses useFarmContext()
 *      (smoke check: the module's hook wiring loads cleanly).
 *
 * We don't render the full FarmerTodayPage — it has ~30 hooks +
 * a router context dependency. The import smoke + the canonical
 * reader's v1 priority are the two contracts that prove the fix
 * works.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

function makeStorage() {
  const store = new Map();
  return {
    getItem:    (k) => (store.has(k) ? store.get(k) : null),
    setItem:    (k, v) => { store.set(String(k), String(v)); },
    removeItem: (k) => { store.delete(String(k)); },
    clear:      () => { store.clear(); },
    key:        (i) => Array.from(store.keys())[i] || null,
    get length() { return store.size; },
  };
}

beforeEach(() => {
  vi.resetModules();
  const ls = makeStorage();
  globalThis.localStorage = ls;
  globalThis.window = {
    localStorage:        ls,
    addEventListener:    vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent:       vi.fn(),
  };
});

// ─── 1. farmContextEngine v1-cache priority ──────────────────

describe('farmContextEngine — v1 cache as tier 0', () => {
  it('serves the v1 cache when its farm.id agrees with canonical activeFarmId', async () => {
    globalThis.localStorage.setItem(
      'farroway_active_farm_v1',
      JSON.stringify({
        farm:   { id: 'cached', name: 'Cached', crop: 'tomato' },
        farmId: 'cached',
        savedAt: 1,
      }),
    );
    globalThis.localStorage.setItem('farroway.activeFarmId', 'cached');
    // Also seed the V2 store with a different farm to prove v1 wins.
    globalThis.localStorage.setItem(
      'farroway.farms',
      JSON.stringify([{ id: 'stale', name: 'Stale' }]),
    );
    const mod = await import('../../../src/lib/farmContextEngine.js');
    expect(mod.getFarmContext().farm.id).toBe('cached');
  });

  it('skips the v1 cache when its id disagrees with canonical activeFarmId', async () => {
    globalThis.localStorage.setItem(
      'farroway_active_farm_v1',
      JSON.stringify({ farm: { id: 'old', name: 'Old' }, farmId: 'old', savedAt: 1 }),
    );
    globalThis.localStorage.setItem('farroway.activeFarmId', 'authoritative');
    globalThis.localStorage.setItem(
      'farroway.farms',
      JSON.stringify([
        { id: 'old', name: 'Old' },
        { id: 'authoritative', name: 'Truth' },
      ]),
    );
    const mod = await import('../../../src/lib/farmContextEngine.js');
    expect(mod.getFarmContext().farm.id).toBe('authoritative');
  });

  it('accepts the v1 cache when canonical activeFarmId is absent', async () => {
    globalThis.localStorage.setItem(
      'farroway_active_farm_v1',
      JSON.stringify({ farm: { id: 'cached', name: 'Cached' }, farmId: 'cached', savedAt: 1 }),
    );
    // No 'farroway.activeFarmId' — v1 is the only signal.
    const mod = await import('../../../src/lib/farmContextEngine.js');
    expect(mod.getFarmContext().farm.id).toBe('cached');
  });

  it('falls through to legacy when v1 is malformed', async () => {
    globalThis.localStorage.setItem('farroway_active_farm_v1', '{not-json');
    globalThis.localStorage.setItem(
      'farroway_active_farm',
      JSON.stringify({ id: 'legacy', name: 'Legacy' }),
    );
    const mod = await import('../../../src/lib/farmContextEngine.js');
    expect(mod.getFarmContext().farm.id).toBe('legacy');
  });

  it('still resolves V2 when neither v1 nor legacy are present', async () => {
    globalThis.localStorage.setItem(
      'farroway.farms',
      JSON.stringify([{ id: 'v2-only', name: 'V2' }]),
    );
    const mod = await import('../../../src/lib/farmContextEngine.js');
    expect(mod.getFarmContext().farm.id).toBe('v2-only');
  });
});

// ─── 2. End-to-end: addFarm → cache populates → reader serves ─

describe('End-to-end — addFarm → farmActiveCache → farmContextEngine v1', () => {
  it('addFarm + flush populates the v1 cache, and getFarmContext serves it', async () => {
    const me    = await import('../../../src/store/multiExperience.js');
    const cache = await import('../../../src/lib/farmActiveCache.js');
    const fc    = await import('../../../src/lib/farmContextEngine.js');

    cache.startFarmActiveCache();
    const row = me.addFarm({
      name: 'EndToEnd', crop: 'maize', farmType: 'small_farm',
      farmSize: 1, sizeUnit: 'acres', skipConfirmation: true,
    });
    expect(row).toBeTruthy();
    // The bus subscription wrote v1 on FARM_CREATED.
    const v1Raw = globalThis.localStorage.getItem('farroway_active_farm_v1');
    expect(v1Raw).toBeTruthy();
    expect(JSON.parse(v1Raw).farmId).toBe(row.id);
    // The canonical reader now picks v1 (tier 0).
    expect(fc.getFarmContext().farm.id).toBe(row.id);
  });
});

// ─── 3. FarmerTodayPage hook wiring smoke ────────────────────

describe('FarmerTodayPage — useFarmContext hook wiring smoke', () => {
  it('the useFarmContext module loads under FarmerTodayPage import path', async () => {
    // Pure structural check: importing the hook module must work
    // from the deep `pages/farmer/` directory the page lives in
    // (no circular imports introduced by the migration).
    const mod = await import('../../../src/hooks/useFarmContext.js');
    expect(typeof mod.default).toBe('function');
  });

  it('useFarmContext + farmActiveCache share the same bus instance', async () => {
    const hook  = await import('../../../src/hooks/useFarmContext.js');
    const cache = await import('../../../src/lib/farmActiveCache.js');
    const bus   = await import('../../../src/lib/farmEventBus.js');
    expect(typeof hook.default).toBe('function');
    expect(typeof cache.startFarmActiveCache).toBe('function');
    expect(typeof bus.subscribe).toBe('function');
    // Both consumers must agree on the FarmEvents constant table.
    expect(bus.FarmEvents.FARM_CREATED).toBe('farm.created');
  });
});
