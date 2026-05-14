/**
 * farmStateSynchronization.test.js — verify the Farm State
 * Synchronization Audit fix.
 *
 *   Critical bug it closes:
 *     Home read 'No farm added yet' while My Farm showed an
 *     active farm. Root cause: Home's `useMemo([], _resolveFarm)`
 *     was stale + the FarmGardenProfileCard's entity fallback
 *     was gated on `experienceMode === 'farm'`. A farm added
 *     after Home mounted never propagated.
 *
 *   What the fix introduces (tested here):
 *     • useFarmContext() — reactive subscription to the canonical
 *       farm context. Re-reads on FARM_CREATED / FARM_UPDATED /
 *       LOCATION_UPDATED / CROP_ADDED / experience-switched /
 *       storage events.
 *     • multiExperience.addFarm publishes FARM_CREATED on the
 *       typed bus.
 *     • _emitSwitch mirrors to FARM_UPDATED on the typed bus.
 *
 * We don't render Home here (it's heavy). Instead we verify the
 * underlying contracts:
 *   a) the bus publish path fires on addFarm + switch
 *   b) getFarmContext() resolves an active farm regardless of
 *      `farroway_active_experience` state — i.e. the same lookup
 *      logic the hook subscribes to.
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
  // farrowayLocal + a few legacy stores read `window.localStorage`
  // directly. Mirror the same Map-backed storage onto a synthetic
  // window so addFarm / saveFarm actually persist within tests.
  globalThis.window = {
    localStorage:        ls,
    addEventListener:    vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent:       vi.fn(),
  };
});

// ─── farmContextEngine resilience ─────────────────────────────

describe('farmContextEngine.getFarmContext() canonical reader', () => {
  it('returns the V2 farm even when activeFarmId is missing', async () => {
    globalThis.localStorage.setItem(
      'farroway.farms',
      JSON.stringify([{ id: 'a', name: 'Alpha', crop: 'tomato' }]),
    );
    const mod = await import('../../../src/lib/farmContextEngine.js');
    const ctx = mod.getFarmContext();
    expect(ctx.hasFarm).toBe(true);
    expect(ctx.farm).toBeTruthy();
    expect(ctx.farm.id).toBe('a');
  });

  it('returns the V2 farm even when farroway_active_experience is null', async () => {
    globalThis.localStorage.setItem(
      'farroway.farms',
      JSON.stringify([{ id: 'a', name: 'Alpha' }]),
    );
    globalThis.localStorage.setItem('farroway.activeFarmId', 'a');
    // Explicitly no `farroway_active_experience` key — this is
    // exactly the divergence shape that caused Home to render
    // "No farm added yet" while My Farm rendered the farm.
    const mod = await import('../../../src/lib/farmContextEngine.js');
    const ctx = mod.getFarmContext();
    expect(ctx.farm && ctx.farm.id).toBe('a');
    expect(ctx.hasFarm).toBe(true);
  });

  it('prefers legacy farroway_active_farm over V2 when both are set', async () => {
    globalThis.localStorage.setItem('farroway_active_farm', JSON.stringify({ id: 'legacy', name: 'Legacy' }));
    globalThis.localStorage.setItem('farroway.farms', JSON.stringify([{ id: 'v2', name: 'V2' }]));
    const mod = await import('../../../src/lib/farmContextEngine.js');
    expect(mod.getFarmContext().farm.id).toBe('legacy');
  });

  it('returns hasFarm=false on a clean install', async () => {
    const mod = await import('../../../src/lib/farmContextEngine.js');
    const ctx = mod.getFarmContext();
    expect(ctx.hasFarm).toBe(false);
    expect(ctx.farm).toBeNull();
  });
});

// ─── multiExperience publishes FARM_CREATED + FARM_UPDATED ────

describe('multiExperience publishes typed FarmEvents on writes', () => {
  it('addFarm fires FARM_CREATED on the typed bus', async () => {
    // jsdom 'window' for _emitSwitch's CustomEvent — install before
    // module evaluation so its top-level guards are quiet.
    const bus = await import('../../../src/lib/farmEventBus.js');
    bus._resetBus();
    const created = [];
    const updated = [];
    bus.subscribe(bus.FarmEvents.FARM_CREATED, (p) => created.push(p));
    bus.subscribe(bus.FarmEvents.FARM_UPDATED, (p) => updated.push(p));

    const me = await import('../../../src/store/multiExperience.js');
    const row = me.addFarm({
      name:     'Test Farm',
      crop:     'tomato',
      farmType: 'small_farm',
      farmSize: 1,
      sizeUnit: 'acres',
      skipConfirmation: true,
    });
    expect(row).toBeTruthy();
    expect(created.length).toBeGreaterThanOrEqual(1);
    expect(created[0].farmId).toBe(row.id);
    // _emitSwitch ALSO fires FARM_UPDATED with experience info.
    expect(updated.length).toBeGreaterThanOrEqual(1);
    expect(updated[0].experience).toBe('farm');
  });

  it('addFarm fires FARM_UPDATED at least once (the bus mirror inside _emitSwitch)', async () => {
    // _emitSwitch mirrors every experience-switch dispatch to the
    // typed bus. addFarm itself triggers _emitSwitch (active farm
    // is pinned), so an addFarm call must produce at least one
    // FARM_UPDATED. A separate switchExperience() to a fresh
    // experience is what produces the additional firings — we
    // don't exercise that here because the simpler signal proves
    // the mirror is wired.
    const bus = await import('../../../src/lib/farmEventBus.js');
    bus._resetBus();
    const updated = [];
    bus.subscribe(bus.FarmEvents.FARM_UPDATED, (p) => updated.push(p));

    const me = await import('../../../src/store/multiExperience.js');
    me.addFarm({ name: 'A', crop: 'tomato', farmType: 'small_farm', farmSize: 1, sizeUnit: 'acres', skipConfirmation: true });
    expect(updated.length).toBeGreaterThanOrEqual(1);
    expect(updated[0].experience).toBe('farm');
  });
});

// ─── useFarmContext hook contract ─────────────────────────────

describe('useFarmContext hook surface', () => {
  it('module loads + default export is a function', async () => {
    const mod = await import('../../../src/hooks/useFarmContext.js');
    expect(typeof mod.default).toBe('function');
  });

  it('the hook closes over getFarmContext + farmEventBus imports without throwing', async () => {
    // Smoke check — import the hook module + the engine + the bus
    // together to verify the wiring doesn't introduce a circular
    // import (the new event-bus dependency is the riskiest part).
    const [hook, ctxMod, bus] = await Promise.all([
      import('../../../src/hooks/useFarmContext.js'),
      import('../../../src/lib/farmContextEngine.js'),
      import('../../../src/lib/farmEventBus.js'),
    ]);
    expect(typeof hook.default).toBe('function');
    expect(typeof ctxMod.getFarmContext).toBe('function');
    expect(typeof bus.subscribe).toBe('function');
    expect(bus.FarmEvents.FARM_CREATED).toBeTruthy();
  });
});

// ─── Acceptance: Home + My Farm see the same active farm ──────

describe('Acceptance — Home + My Farm read the same canonical entity', () => {
  it('after addFarm, getFarmContext() AND useExperience snapshot resolve the same farm id', async () => {
    const me = await import('../../../src/store/multiExperience.js');
    const fc = await import('../../../src/lib/farmContextEngine.js');
    const row = me.addFarm({
      name: 'Same', crop: 'tomato', farmType: 'small_farm',
      farmSize: 1, sizeUnit: 'acres', skipConfirmation: true,
    });
    expect(row).toBeTruthy();
    // Home's canonical reader.
    const homeCtx = fc.getFarmContext();
    // My Farm's snapshot reader.
    const myFarmSnap = me.getExperienceSnapshot();

    expect(homeCtx.farm && homeCtx.farm.id).toBe(row.id);
    expect(myFarmSnap.activeEntity && myFarmSnap.activeEntity.id).toBe(row.id);
    // Both surfaces must agree.
    expect(homeCtx.farm.id).toBe(myFarmSnap.activeEntity.id);
  });
});
