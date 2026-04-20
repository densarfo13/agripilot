/**
 * farmerJourney.test.js — journey state store + derivation + router.
 *
 * Spec §10 checklist:
 *   1. state transitions (including forward-only guard)
 *   2. returning user flow (persistence roundtrip)
 *   3. task completion updates (don't regress state)
 *   4. fallback when data missing (safe default)
 *   5. router maps every state to a real route
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  getJourneyState, setJourneyState, advanceJourney, resetJourney,
  STATES, _keys,
} from '../../../src/store/farmerJourney.js';
import {
  deriveJourneyState, _internal as signalsInternals,
} from '../../../src/lib/journey/journeySignals.js';
import {
  getRouteForState, shouldRedirect, _routes,
} from '../../../src/lib/journey/journeyRouter.js';

function installLocalStorage() {
  const map = new Map();
  globalThis.window = {
    localStorage: {
      getItem:    (k) => map.has(k) ? map.get(k) : null,
      setItem:    (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    },
  };
  return map;
}

// ─── Store: defaults + roundtrip (spec §10.2) ─────────────────────
describe('farmerJourney store', () => {
  beforeEach(() => { installLocalStorage(); });
  afterEach(()  => { delete globalThis.window; });

  it('defaults to onboarding when storage is empty', () => {
    const s = getJourneyState();
    expect(s.state).toBe('onboarding');
    expect(s.crop).toBeNull();
    expect(s.farmId).toBeNull();
    expect(s.history).toEqual([]);
  });

  it('set + read roundtrip; history records transitions', () => {
    setJourneyState({ state: 'crop_selected', crop: 'maize', _now: 1000 });
    setJourneyState({ state: 'planning',       crop: 'maize', _now: 2000 });
    setJourneyState({ state: 'active_farming', crop: 'maize', _now: 3000 });
    const s = getJourneyState();
    expect(s.state).toBe('active_farming');
    expect(s.crop).toBe('maize');
    expect(s.history.map((h) => h.state))
      .toEqual(['crop_selected','planning','active_farming']);
    expect(s.enteredAt).toBe(3000);
  });

  it('same-state write only updates lastUpdatedAt / fields', () => {
    setJourneyState({ state: 'planning', crop: 'maize', _now: 1000 });
    setJourneyState({ state: 'planning', plantedAt: 1234, _now: 1500 });
    const s = getJourneyState();
    expect(s.state).toBe('planning');
    expect(s.plantedAt).toBe(1234);
    expect(s.history.length).toBe(1);  // no transition pushed
    expect(s.enteredAt).toBe(1000);    // preserved
    expect(s.lastUpdatedAt).toBe(1500);
  });

  it('invalid state falls through to current / default', () => {
    setJourneyState({ state: 'planning', _now: 1 });
    const r = setJourneyState({ state: 'warp_drive', _now: 2 });
    expect(r.state.state).toBe('planning');    // preserved
  });

  it('storage key is under farroway.*', () => {
    expect(_keys.STORAGE_KEY.startsWith('farroway.')).toBe(true);
  });

  it('resetJourney wipes storage — user sign-out flow', () => {
    setJourneyState({ state: 'active_farming', _now: 1 });
    resetJourney();
    expect(getJourneyState().state).toBe('onboarding');
  });

  it('history caps at 16 entries', () => {
    for (let i = 0; i < 20; i += 1) {
      setJourneyState({ state: i % 2 ? 'planning' : 'active_farming', _now: i });
    }
    expect(getJourneyState().history.length).toBeLessThanOrEqual(16);
  });
});

// ─── advanceJourney — forward-only guard (spec §10.1) ─────────────
describe('advanceJourney', () => {
  beforeEach(() => { installLocalStorage(); });
  afterEach(()  => { delete globalThis.window; });

  it('promotes forward through the ordered state list', () => {
    expect(advanceJourney('crop_selected').ok).toBe(true);
    expect(advanceJourney('planning').ok).toBe(true);
    expect(advanceJourney('active_farming').ok).toBe(true);
    expect(getJourneyState().state).toBe('active_farming');
  });

  it('refuses to regress without force:true', () => {
    advanceJourney('active_farming');
    const bad = advanceJourney('planning');
    expect(bad.ok).toBe(false);
    expect(bad.reason).toBe('regression_blocked');
    expect(getJourneyState().state).toBe('active_farming');
  });

  it('force:true overrides the guard', () => {
    advanceJourney('active_farming');
    const ok = advanceJourney('planning', { force: true });
    expect(ok.ok).toBe(true);
    expect(getJourneyState().state).toBe('planning');
  });

  it('rejects invalid states cleanly', () => {
    expect(advanceJourney('warp_drive').ok).toBe(false);
    expect(advanceJourney(null).ok).toBe(false);
  });
});

// ─── Derivation rules (spec §10.4) ────────────────────────────────
describe('deriveJourneyState', () => {
  it('no signals at all → onboarding', () => {
    const d = deriveJourneyState();
    expect(d.state).toBe('onboarding');
    expect(d.reason).toBe('default_onboarding');
  });

  it('farm without crop → crop_selected', () => {
    const d = deriveJourneyState({ activeFarm: { id: 'f1' } });
    expect(d.state).toBe('crop_selected');
  });

  it('farm + crop, no planting date → planning', () => {
    const d = deriveJourneyState({
      activeFarm: { id: 'f1', crop: 'maize' },
    });
    expect(d.state).toBe('planning');
  });

  it('preserves crop_selected when the record says so', () => {
    const d = deriveJourneyState({
      activeFarm: { id: 'f1', crop: 'maize' },
      journeyRecord: { state: 'crop_selected' },
    });
    expect(d.state).toBe('crop_selected');
  });

  it('plantedAt within window → active_farming', () => {
    const now = Date.now();
    const d = deriveJourneyState({
      activeCycle: { id: 'c1', cropType: 'rice', plantedAt: now - 30 * 86400000 },
      now,
    });
    expect(d.state).toBe('active_farming');
    expect(d.plantedAt).toBeTruthy();
  });

  it('plantedAt beyond 210 days → harvest', () => {
    const now = Date.now();
    const d = deriveJourneyState({
      activeCycle: { id: 'c1', cropType: 'maize', plantedAt: now - 300 * 86400000 },
      now,
    });
    expect(d.state).toBe('harvest');
  });

  it('stage harvest_ready → harvest', () => {
    const d = deriveJourneyState({
      activeCycle: { id: 'c1', cropType: 'maize', lifecycleStatus: 'harvest_ready' },
    });
    expect(d.state).toBe('harvest');
  });

  it('harvestedAt present → post_harvest', () => {
    const d = deriveJourneyState({
      activeCycle: { id: 'c1', cropType: 'maize', harvestedAt: Date.now() },
    });
    expect(d.state).toBe('post_harvest');
  });

  it('stage post_harvest → post_harvest', () => {
    const d = deriveJourneyState({
      profile: { id: 'p1', cropType: 'maize', cropStage: 'post_harvest' },
    });
    expect(d.state).toBe('post_harvest');
  });

  it('helper classifiers recognise the main stage groups', () => {
    expect(signalsInternals.stageIndicatesHarvest('harvest_ready')).toBe(true);
    expect(signalsInternals.stageIndicatesHarvest('near_harvest')).toBe(true);
    expect(signalsInternals.stageIndicatesHarvest('planting')).toBe(false);
    expect(signalsInternals.stageIndicatesPostHarvest('post_harvest')).toBe(true);
    expect(signalsInternals.stageIndicatesPostHarvest('harvested')).toBe(true);
  });
});

// ─── Router (spec §10.5) ─────────────────────────────────────────
describe('journeyRouter', () => {
  it('maps every state to a concrete route', () => {
    for (const s of STATES) {
      const r = getRouteForState(s);
      expect(typeof r).toBe('string');
      expect(r.startsWith('/')).toBe(true);
    }
  });

  it('unknown state → /today fallback', () => {
    expect(getRouteForState('ghost')).toBe('/today');
    expect(getRouteForState(null)).toBe('/today');
  });

  it('shouldRedirect: root paths always redirect into the journey', () => {
    expect(shouldRedirect('onboarding', '/').redirect).toBe(true);
    expect(shouldRedirect('onboarding', '/welcome').redirect).toBe(true);
    expect(shouldRedirect('onboarding', '/start').redirect).toBe(true);
  });

  it('shouldRedirect: non-root paths stay', () => {
    expect(shouldRedirect('active_farming', '/today').redirect).toBe(false);
    expect(shouldRedirect('active_farming', '/my-farm').redirect).toBe(false);
  });

  it('shouldRedirect: empty currentPath routes to target', () => {
    expect(shouldRedirect('active_farming', '').redirect).toBe(true);
    expect(shouldRedirect('active_farming', null).redirect).toBe(true);
  });

  it('_routes exposes the concrete map for debugging', () => {
    expect(_routes.onboarding).toBe('/onboarding/fast');
    expect(_routes.active_farming).toBe('/today');
  });
});

// ─── End-to-end: returning user + task-completion doesn't regress ─
describe('farmerJourney — returning user flow (spec §10.2, §10.3)', () => {
  beforeEach(() => { installLocalStorage(); });
  afterEach(()  => { delete globalThis.window; });

  it('returning user is placed back into their last state', () => {
    advanceJourney('active_farming', { crop: 'maize', farmId: 'f1' });
    // Simulate app reload — new getJourneyState call reads same storage.
    const s = getJourneyState();
    expect(s.state).toBe('active_farming');
    expect(s.crop).toBe('maize');
    expect(getRouteForState(s.state)).toBe('/today');
  });

  it('task completion write (same state) does not reset history', () => {
    advanceJourney('active_farming', { crop: 'maize', _now: 1000 });
    // A later "same state" write caused by task completion.
    setJourneyState({ state: 'active_farming', _now: 2000 });
    const s = getJourneyState();
    expect(s.history.length).toBe(1);
    expect(s.state).toBe('active_farming');
  });
});
