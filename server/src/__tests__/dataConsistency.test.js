/**
 * dataConsistency.test.js — covers the structured-inputs +
 * alert-dedup + dismiss-memory contracts for v1 data cleanup.
 *
 * Scope (matches spec §9):
 *   1. saved farm is normalized (code + label pairs stored)
 *   2. farm storage keeps prior farms intact
 *   3. active farm switching still works
 *   4. dismiss memory blocks re-show for the current cycle
 *   5. dismiss memory re-surfaces when content materially changes
 *   6. dismiss memory expires after TTL
 *   7. edit-farm validator still enforces country + crop (v1 spec §1)
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Tiny localStorage stub so the offline-first helpers work in Node.
function installLocalStorage() {
  const map = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      key: (i) => Array.from(map.keys())[i] || null,
      get length() { return map.size; },
    },
  };
  return map;
}

import {
  saveFarm,
  getFarms,
  setActiveFarmId,
  getActiveFarmId,
  getActiveFarm,
  isAlertDismissed,
  dismissAlert,
  pruneDismissedAlerts,
  getDismissedAlerts,
  _dismissInternal,
} from '../../../src/store/farrowayLocal.js';

import { validateEditForm } from '../../../src/utils/editFarm/editFarmMapper.js';

beforeEach(() => {
  installLocalStorage();
});

// ─── Farm normalization ──────────────────────────────────────────
describe('saveFarm — normalized storage shape', () => {
  it('persists code + label pairs plus canonical fields', () => {
    const farm = saveFarm({
      name: 'North Block',
      crop: 'maize',
      cropLabel: 'Maize (corn)',
      country: 'GH',
      countryLabel: 'Ghana',
      state: 'AS',
      stateLabel: 'Ashanti',
      farmSize: 3.5,
      sizeUnit: 'ACRE',
      stage: 'planting',
    });
    expect(farm).toBeTruthy();
    expect(farm.id).toMatch(/.+/);
    expect(farm.name).toBe('North Block');
    expect(farm.crop).toBe('maize');
    expect(farm.cropLabel).toBe('Maize (corn)');
    expect(farm.countryCode).toBe('GH');
    expect(farm.countryLabel).toBe('Ghana');
    expect(farm.stateCode).toBe('AS');
    expect(farm.stateLabel).toBe('Ashanti');
    expect(farm.farmSize).toBe(3.5);
    expect(farm.sizeUnit).toBe('ACRE');
    expect(farm.stage).toBe('planting');
    expect(farm.createdAt).toBeGreaterThan(0);
    // Back-compat mirrors stay populated.
    expect(farm.country).toBe('GH');
    expect(farm.state).toBe('AS');
  });

  it('uppercases countryCode + lowercases crop for storage parity', () => {
    const farm = saveFarm({
      name: 'f',
      crop: 'RICE',
      country: 'ng',
    });
    expect(farm.crop).toBe('rice');
    expect(farm.countryCode).toBe('NG');
  });

  it('composes location label when not supplied', () => {
    const farm = saveFarm({
      name: 'x',
      crop: 'tomato',
      country: 'NG',
      countryLabel: 'Nigeria',
      state: 'LA',
      stateLabel: 'Lagos',
    });
    expect(farm.location).toBe('Lagos, Nigeria');
  });

  it('preserves existing farms when adding a new one', () => {
    const a = saveFarm({ name: 'A', crop: 'maize', country: 'GH' });
    const b = saveFarm({ name: 'B', crop: 'rice',  country: 'NG' });
    const farms = getFarms();
    expect(farms).toHaveLength(2);
    expect(farms.map((f) => f.id)).toEqual([a.id, b.id]);
  });

  it('first farm becomes active automatically; later saves respect setActive', () => {
    const a = saveFarm({ name: 'A', crop: 'maize', country: 'GH' });
    expect(getActiveFarmId()).toBe(a.id);

    const b = saveFarm({ name: 'B', crop: 'rice', country: 'NG' });
    expect(getActiveFarmId()).toBe(a.id); // unchanged — no setActive

    const c = saveFarm({ name: 'C', crop: 'cassava', country: 'GH', setActive: true });
    expect(getActiveFarmId()).toBe(c.id);
    expect(getActiveFarm().id).toBe(c.id);
  });

  it('setActiveFarmId + getActiveFarm agree', () => {
    const a = saveFarm({ name: 'A', crop: 'maize', country: 'GH' });
    const b = saveFarm({ name: 'B', crop: 'rice',  country: 'NG' });
    setActiveFarmId(b.id);
    expect(getActiveFarmId()).toBe(b.id);
    expect(getActiveFarm().id).toBe(b.id);
    expect(getFarms()).toHaveLength(2); // nothing removed on switch
  });
});

// ─── Dismiss memory ──────────────────────────────────────────────
describe('dismissAlert / isAlertDismissed', () => {
  it('returns false when nothing has been dismissed', () => {
    expect(isAlertDismissed('x', 'hello')).toBe(false);
  });

  it('hides the alert for the current cycle after dismissal', () => {
    dismissAlert('reminder:weather', 'Low rain expected — water soon');
    expect(isAlertDismissed('reminder:weather', 'Low rain expected — water soon'))
      .toBe(true);
  });

  it('re-surfaces when the content materially changes', () => {
    dismissAlert('reminder:weather', 'Low rain expected — water soon');
    expect(
      isAlertDismissed('reminder:weather', 'Extreme heat — protect seedlings'),
    ).toBe(false);
  });

  it('does not leak dismissal across alert ids', () => {
    dismissAlert('reminder:weather', 'Low rain');
    expect(isAlertDismissed('reminder:high_risk', 'Low rain')).toBe(false);
  });

  it('expires after the TTL window', () => {
    dismissAlert('reminder:weather', 'Low rain');
    const now = Date.now() + _dismissInternal.DISMISS_TTL_MS + 1000;
    expect(isAlertDismissed('reminder:weather', 'Low rain', now)).toBe(false);
  });

  it('expires when the day rolls over even inside TTL', () => {
    dismissAlert('reminder:weather', 'Low rain');
    // Simulate next calendar day: same alert, later date key.
    const future = Date.now() + 25 * 3600 * 1000;
    expect(isAlertDismissed('reminder:weather', 'Low rain', future)).toBe(false);
  });

  it('pruneDismissedAlerts removes stale entries only', () => {
    dismissAlert('a', 'fresh');
    // Hand-insert an ancient entry.
    const map = getDismissedAlerts();
    map['ancient'] = { ts: 1000, contentHash: 'x', cycleKey: '1970-01-01' };
    globalThis.window.localStorage.setItem(
      'farroway.dismissedAlerts', JSON.stringify(map),
    );
    pruneDismissedAlerts();
    const after = getDismissedAlerts();
    expect('a' in after).toBe(true);
    expect('ancient' in after).toBe(false);
  });
});

// ─── Edit-farm validator (spec §1 required fields) ───────────────
describe('validateEditForm — country + crop required', () => {
  it('blocks save when crop missing', () => {
    const errs = validateEditForm({ farmName: 'A', country: 'GH' });
    expect(errs.cropType).toBeTruthy();
  });
  it('blocks save when country missing', () => {
    const errs = validateEditForm({ farmName: 'A', cropType: 'maize' });
    expect(errs.country).toBeTruthy();
  });
  it('passes when all required fields present', () => {
    const errs = validateEditForm({
      farmName: 'A', cropType: 'maize', country: 'GH',
    });
    expect(errs).toEqual({});
  });
});
