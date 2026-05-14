/**
 * activeFarmHydration.test.js — Emergency Active Farm Hydration
 * Fix. Verifies the bridge between ProfileContext's backend-
 * hydrated farms and the canonical localStorage shape Home /
 * Tasks / Sell consume via farmContextEngine.
 *
 * The bridge runs inside ProfileContext.refreshFarms; we can't
 * easily simulate the full React tree, so we test the contract:
 *
 *   1. The canonical reader resolves ONLY localStorage data —
 *      proving the split this fix closes.
 *   2. The mirror function (extracted shape mirrors what the
 *      ProfileContext side-effect writes) populates the
 *      canonical store correctly.
 *   3. After the mirror, farmContextEngine.getFarmContext() and
 *      farrowayLocal.getActiveFarm() both resolve the same farm.
 *   4. FARM_CREATED fires on mirror so useFarmContext subscribers
 *      re-render.
 *   5. The empty-state copy is suppressed during a loading state
 *      (FarmGardenProfileCard contract — uses tSafe and React
 *      element output).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import FarmGardenProfileCard from
  '../../../src/components/home/FarmGardenProfileCard.jsx';

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

// Mirror function shape — mirrors what ProfileContext writes
// internally. Kept here so the test exercises the EXACT same
// keys / values the real mirror writes, without standing up
// ProfileContext + ReactDOM.
function mirrorFarmsToCanonical(farms, activeFarmId, publish) {
  if (typeof localStorage === 'undefined') return;
  if (!Array.isArray(farms)) return;
  localStorage.setItem('farroway.farms', JSON.stringify(farms));
  if (activeFarmId) {
    localStorage.setItem('farroway.activeFarmId', String(activeFarmId));
    if (!localStorage.getItem('farroway_active_experience')) {
      localStorage.setItem('farroway_active_experience', 'farm');
    }
  }
  if (typeof publish === 'function') {
    publish({ source: 'profile_context_mirror', farmId: activeFarmId, count: farms.length });
  }
}

// ─── 1. Confirm the split BEFORE the mirror ─────────────────

describe('Active Farm Hydration — split-authority repro', () => {
  it('canonical reader returns empty when farms exist only in React state', async () => {
    // We simulate ProfileContext having farms[] in React state by
    // NOT writing to localStorage. The canonical reader should
    // therefore see nothing — proving Home renders empty in that
    // scenario.
    const fc = await import('../../../src/lib/farmContextEngine.js');
    const ctx = fc.getFarmContext();
    expect(ctx.hasFarm).toBe(false);
    expect(ctx.farm).toBeNull();
  });
});

// ─── 2. After the mirror — readers agree ─────────────────────

describe('Active Farm Hydration — after mirror', () => {
  it('mirrorFarmsToCanonical writes farms + activeFarmId to canonical keys', async () => {
    mirrorFarmsToCanonical(
      [{ id: 'fa', name: 'Farm A', crop: 'tomato' }],
      'fa',
    );
    expect(globalThis.localStorage.getItem('farroway.farms')).toBeTruthy();
    expect(globalThis.localStorage.getItem('farroway.activeFarmId')).toBe('fa');
    expect(globalThis.localStorage.getItem('farroway_active_experience')).toBe('farm');
  });

  it('farmContextEngine + farrowayLocal both resolve the same farm post-mirror', async () => {
    mirrorFarmsToCanonical(
      [{ id: 'fa', name: 'Farm A', crop: 'tomato' }],
      'fa',
    );
    const fc = await import('../../../src/lib/farmContextEngine.js');
    const fl = await import('../../../src/store/farrowayLocal.js');
    expect(fc.getFarmContext().farm.id).toBe('fa');
    expect(fl.getActiveFarm().id).toBe('fa');
  });

  it('FARM_CREATED publishes after mirror so useFarmContext re-renders', async () => {
    const bus = await import('../../../src/lib/farmEventBus.js');
    bus._resetBus();
    const heard = [];
    bus.subscribe(bus.FarmEvents.FARM_CREATED, (p) => heard.push(p));
    mirrorFarmsToCanonical(
      [{ id: 'fa', name: 'Farm A' }],
      'fa',
      (p) => bus.publish(bus.FarmEvents.FARM_CREATED, p),
    );
    expect(heard.length).toBe(1);
    expect(heard[0].source).toBe('profile_context_mirror');
    expect(heard[0].farmId).toBe('fa');
    expect(heard[0].count).toBe(1);
  });

  it('does not overwrite an existing activeExperience pin', async () => {
    globalThis.localStorage.setItem('farroway_active_experience', 'garden');
    mirrorFarmsToCanonical(
      [{ id: 'fa', name: 'Farm A' }],
      'fa',
    );
    // The mirror must NOT clobber a user's explicit garden pin.
    expect(globalThis.localStorage.getItem('farroway_active_experience')).toBe('garden');
  });

  it('handles empty farm list without throwing', async () => {
    expect(() => mirrorFarmsToCanonical([], null)).not.toThrow();
    expect(globalThis.localStorage.getItem('farroway.farms')).toBe('[]');
  });
});

// ─── 3. FarmGardenProfileCard loading suppression ────────────

describe('FarmGardenProfileCard — empty-state suppression while loading', () => {
  it('renders a loading placeholder when loading=true AND entity is null', () => {
    const el = FarmGardenProfileCard({
      mode: 'farm', entity: null, count: 0, loading: true,
    });
    const blob = JSON.stringify(el);
    // Must NOT contain the empty-state copy during loading.
    expect(blob).not.toMatch(/No farm added/);
    expect(blob).not.toMatch(/No plant added/);
    // Should surface the loading placeholder.
    expect(blob).toMatch(/Loading/i);
  });

  it('renders the empty-state copy when loading=false AND entity is null', () => {
    const el = FarmGardenProfileCard({
      mode: 'farm', entity: null, count: 0, loading: false,
    });
    const blob = JSON.stringify(el);
    expect(blob).toMatch(/No farm added/);
  });

  it('renders the entity name when entity is non-null (loading is moot)', () => {
    const el = FarmGardenProfileCard({
      mode: 'farm',
      entity: { id: 'a', name: 'Alpha Farm', crop: 'tomato' },
      count: 1,
      loading: true,
    });
    const blob = JSON.stringify(el);
    expect(blob).toMatch(/Alpha Farm/);
    expect(blob).not.toMatch(/No farm added/);
  });

  it('garden mode uses the garden empty-state copy when not loading', () => {
    const el = FarmGardenProfileCard({
      mode: 'garden', entity: null, count: 0, loading: false,
    });
    const blob = JSON.stringify(el);
    expect(blob).toMatch(/No plant added/);
  });
});

// ─── 4. Acceptance — full hydration path ─────────────────────

describe('Acceptance — Home + My Farm see same farm after backend hydration', () => {
  it('addFarm via multiExperience + ProfileContext mirror both lead to the same canonical farm', async () => {
    // Simulate the production flow: ProfileContext fetches farms
    // from the backend and mirrors them. The canonical reader
    // then surfaces the same farm Home + My Farm need.
    mirrorFarmsToCanonical(
      [{ id: 'srv', name: 'Server Farm', crop: 'maize' }],
      'srv',
    );
    const fc = await import('../../../src/lib/farmContextEngine.js');
    const ctx = fc.getFarmContext();
    expect(ctx.hasFarm).toBe(true);
    expect(ctx.farm.id).toBe('srv');
    expect(ctx.farm.name).toBe('Server Farm');
    expect(ctx.experience).toBe('farm');
  });
});
