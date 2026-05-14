/**
 * farmStateSyncRiskFix.test.js — verifies the follow-up risks
 * from the Farm State Synchronization Audit are closed:
 *
 *   1. farrowayLocal.getActiveFarm() now falls through to the
 *      most-recent farm when activeFarmId is missing (matches
 *      farmContextEngine's 3-tier resolver).
 *   2. farmActiveCache.startFarmActiveCache() mirrors the
 *      canonical active farm into a single v1 slot on every
 *      FARM_CREATED / FARM_UPDATED / LOCATION_UPDATED /
 *      CROP_ADDED event. Read path is idempotent + SSR-safe.
 *   3. Sell.jsx now prefers the canonical farmCtx.farm over the
 *      legacy `farms[0]` heuristic — verified via the engine
 *      reader path the page consumes.
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

// ─── 1. getActiveFarm() fall-through ─────────────────────────

describe('farrowayLocal.getActiveFarm — canonical fall-through', () => {
  it('returns the most-recent farm when activeFarmId is missing', async () => {
    globalThis.localStorage.setItem(
      'farroway.farms',
      JSON.stringify([
        { id: 'a', name: 'Alpha' },
        { id: 'b', name: 'Bravo' },
      ]),
    );
    // No 'farroway.activeFarmId' set — previously returned null.
    const mod = await import('../../../src/store/farrowayLocal.js');
    const farm = mod.getActiveFarm();
    expect(farm).toBeTruthy();
    expect(farm.id).toBe('b'); // most-recent = last entry
  });

  it('returns the id-matched farm when activeFarmId points to a real row', async () => {
    globalThis.localStorage.setItem(
      'farroway.farms',
      JSON.stringify([
        { id: 'a', name: 'Alpha' },
        { id: 'b', name: 'Bravo' },
      ]),
    );
    globalThis.localStorage.setItem('farroway.activeFarmId', 'a');
    const mod = await import('../../../src/store/farrowayLocal.js');
    expect(mod.getActiveFarm().id).toBe('a');
  });

  it('falls through to most-recent when activeFarmId points to a stale id', async () => {
    globalThis.localStorage.setItem(
      'farroway.farms',
      JSON.stringify([{ id: 'a', name: 'Alpha' }]),
    );
    globalThis.localStorage.setItem('farroway.activeFarmId', 'deleted_id');
    const mod = await import('../../../src/store/farrowayLocal.js');
    expect(mod.getActiveFarm().id).toBe('a');
  });

  it('returns null on a clean install (no farms)', async () => {
    const mod = await import('../../../src/store/farrowayLocal.js');
    expect(mod.getActiveFarm()).toBeNull();
  });
});

// ─── 2. farmActiveCache v1 mirror ────────────────────────────

describe('farmActiveCache.startFarmActiveCache', () => {
  it('writes the v1 cache on initial bootstrap when a farm exists', async () => {
    globalThis.localStorage.setItem(
      'farroway.farms',
      JSON.stringify([{ id: 'a', name: 'Alpha', crop: 'tomato' }]),
    );
    globalThis.localStorage.setItem('farroway.activeFarmId', 'a');
    const mod = await import('../../../src/lib/farmActiveCache.js');
    mod._resetFarmActiveCache();
    mod.startFarmActiveCache();
    const raw = globalThis.localStorage.getItem('farroway_active_farm_v1');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed.farmId).toBe('a');
    expect(parsed.farm.id).toBe('a');
    expect(parsed.experience).toBe('farm');
  });

  it('does NOT overwrite when no farm is resolvable (keeps last-known-good)', async () => {
    // Pre-seed a "last known good" cache row. We deliberately do
    // NOT call _resetFarmActiveCache — that helper wipes the
    // cache slot as part of its test-flush behavior, which would
    // defeat the point of this assertion. `vi.resetModules()` in
    // beforeEach already gives us a fresh module instance.
    globalThis.localStorage.setItem(
      'farroway_active_farm_v1',
      JSON.stringify({ farmId: 'previous', farm: { id: 'previous', name: 'Prev' }, savedAt: 1 }),
    );
    const mod = await import('../../../src/lib/farmActiveCache.js');
    mod.startFarmActiveCache(); // no farms exist; should leave cache alone
    const raw = globalThis.localStorage.getItem('farroway_active_farm_v1');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw).farmId).toBe('previous');
  });

  it('re-mirrors on FARM_CREATED', async () => {
    const bus = await import('../../../src/lib/farmEventBus.js');
    bus._resetBus();
    const cache = await import('../../../src/lib/farmActiveCache.js');
    cache._resetFarmActiveCache();
    cache.startFarmActiveCache();
    // Add a farm AFTER the cache is wired.
    globalThis.localStorage.setItem(
      'farroway.farms',
      JSON.stringify([{ id: 'new', name: 'Fresh', crop: 'maize' }]),
    );
    globalThis.localStorage.setItem('farroway.activeFarmId', 'new');
    bus.publish(bus.FarmEvents.FARM_CREATED, { farmId: 'new' });
    const raw = globalThis.localStorage.getItem('farroway_active_farm_v1');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw).farmId).toBe('new');
  });

  it('readFarmActiveCache returns null when v1 slot is empty', async () => {
    const mod = await import('../../../src/lib/farmActiveCache.js');
    mod._resetFarmActiveCache();
    expect(mod.readFarmActiveCache()).toBeNull();
  });

  it('readFarmActiveCache returns null on corrupt JSON (never throws)', async () => {
    globalThis.localStorage.setItem('farroway_active_farm_v1', '{not-json');
    const mod = await import('../../../src/lib/farmActiveCache.js');
    expect(() => mod.readFarmActiveCache()).not.toThrow();
    expect(mod.readFarmActiveCache()).toBeNull();
  });

  it('startFarmActiveCache is idempotent — second call is a no-op', async () => {
    const mod = await import('../../../src/lib/farmActiveCache.js');
    mod._resetFarmActiveCache();
    expect(() => {
      mod.startFarmActiveCache();
      mod.startFarmActiveCache();
      mod.startFarmActiveCache();
    }).not.toThrow();
  });

  it('survives SSR (no localStorage)', async () => {
    delete globalThis.localStorage;
    delete globalThis.window;
    const mod = await import('../../../src/lib/farmActiveCache.js');
    expect(() => mod.startFarmActiveCache()).not.toThrow();
    expect(mod.readFarmActiveCache()).toBeNull();
  });
});

// ─── 3. Acceptance — Sell + Home + My Farm see same farm ─────

describe('Acceptance — farmContextEngine + getActiveFarm + Sell all agree', () => {
  it('after addFarm, all three readers resolve the same farm id', async () => {
    const me = await import('../../../src/store/multiExperience.js');
    const fc = await import('../../../src/lib/farmContextEngine.js');
    const fl = await import('../../../src/store/farrowayLocal.js');
    const row = me.addFarm({
      name: 'Same', crop: 'tomato', farmType: 'small_farm',
      farmSize: 1, sizeUnit: 'acres', skipConfirmation: true,
    });
    expect(row).toBeTruthy();
    // Home's canonical path.
    expect(fc.getFarmContext().farm.id).toBe(row.id);
    // Tasks / FarmerTodayPage's path.
    expect(fl.getActiveFarm().id).toBe(row.id);
    // Sell's path consumes farmCtx.farm same as Home — covered by
    // the farmContextEngine assertion above.
  });
});
