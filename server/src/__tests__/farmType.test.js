/**
 * farmType.test.js — farmType field persistence + edit round-trip
 * + tier behaviour.
 */

import { describe, it, expect, beforeEach } from 'vitest';

function installLocalStorage() {
  const map = new Map();
  globalThis.window = {
    location: { search: '', pathname: '/' },
    localStorage: {
      getItem:    (k) => (map.has(k) ? map.get(k) : null),
      setItem:    (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      key:        (i) => Array.from(map.keys())[i] || null,
      get length() { return map.size; },
    },
    addEventListener: () => {}, removeEventListener: () => {},
  };
}

import {
  saveFarm, getFarms, updateFarm,
} from '../../../src/store/farrowayLocal.js';

import {
  farmToEditForm, editFormToPatch,
} from '../../../src/utils/editFarm/editFarmMapper.js';

import {
  FARM_TYPES, DEFAULT_FARM_TYPE, normalizeFarmType,
  getFarmTypePolicy, adjustTasksForFarmType,
  shouldShowAlertForFarmType, simplifyCopyForFarmType,
} from '../../../src/lib/farm/farmTypeBehavior.js';

beforeEach(() => {
  installLocalStorage();
});

// ─── Persistence ─────────────────────────────────────────────────
describe('saveFarm — farmType', () => {
  it('persists the three canonical tiers', () => {
    const a = saveFarm({ name: 'A', crop: 'maize', country: 'GH', farmType: 'backyard' });
    const b = saveFarm({ name: 'B', crop: 'maize', country: 'GH', farmType: 'small_farm' });
    const c = saveFarm({ name: 'C', crop: 'maize', country: 'GH', farmType: 'commercial' });
    expect(a.farmType).toBe('backyard');
    expect(b.farmType).toBe('small_farm');
    expect(c.farmType).toBe('commercial');
  });

  it('falls back to small_farm when unset', () => {
    const farm = saveFarm({ name: 'X', crop: 'maize', country: 'GH' });
    expect(farm.farmType).toBe('small_farm');
  });

  it('falls back to small_farm on unknown value', () => {
    const farm = saveFarm({ name: 'X', crop: 'maize', country: 'GH', farmType: 'super_mega' });
    expect(farm.farmType).toBe('small_farm');
  });

  it('recognises historical aliases', () => {
    const home = saveFarm({ name: 'H', crop: 'maize', country: 'GH', farmType: 'home_food' });
    const big  = saveFarm({ name: 'B', crop: 'maize', country: 'GH', farmType: 'commercial_farm' });
    expect(home.farmType).toBe('backyard');
    expect(big.farmType).toBe('commercial');
  });

  it('is queryable via getFarms', () => {
    saveFarm({ name: 'A', crop: 'maize', country: 'GH', farmType: 'backyard' });
    saveFarm({ name: 'B', crop: 'maize', country: 'GH', farmType: 'commercial' });
    const farms = getFarms();
    expect(farms.map((f) => f.farmType).sort())
      .toEqual(['backyard', 'commercial']);
  });
});

describe('updateFarm — farmType', () => {
  it('can change farmType via updateFarm', () => {
    const a = saveFarm({ name: 'A', crop: 'maize', country: 'GH', farmType: 'small_farm' });
    const after = updateFarm(a.id, { farmType: 'commercial' });
    expect(after.farmType).toBe('commercial');
    expect(getFarms()[0].farmType).toBe('commercial');
  });

  it('unchanged farmType → no-op (returns unchanged farm)', () => {
    const a = saveFarm({ name: 'A', crop: 'maize', country: 'GH', farmType: 'backyard' });
    const after = updateFarm(a.id, { farmType: 'backyard' });
    expect(after.farmType).toBe('backyard');
  });
});

// ─── Edit form round-trip ────────────────────────────────────────
describe('edit form round-trip', () => {
  it('farmToEditForm loads the existing farmType value', () => {
    const farm = { farmType: 'commercial', farmName: 'North', cropType: 'maize', country: 'GH' };
    const form = farmToEditForm(farm);
    expect(form.farmType).toBe('commercial');
  });

  it('missing farmType defaults to small_farm', () => {
    const form = farmToEditForm({ farmName: 'X', cropType: 'maize', country: 'GH' });
    expect(form.farmType).toBe('small_farm');
  });

  it('editFormToPatch only emits farmType when it changed', () => {
    const original = { farmName: 'A', cropType: 'maize', country: 'GH', farmType: 'small_farm' };
    const unchanged = editFormToPatch(
      farmToEditForm(original),
      original,
    );
    expect('farmType' in unchanged).toBe(false);

    const edited = { ...farmToEditForm(original), farmType: 'commercial' };
    const patch = editFormToPatch(edited, original);
    expect(patch.farmType).toBe('commercial');
  });

  it('round-trips through farmToEditForm → patch → updateFarm', () => {
    const farm = saveFarm({ name: 'A', crop: 'maize', country: 'GH', farmType: 'small_farm' });
    const original = { ...farm, farmName: farm.name, cropType: farm.crop };
    const form = farmToEditForm(original);
    const nextForm = { ...form, farmType: 'commercial' };
    const patch = editFormToPatch(nextForm, original);
    expect(patch.farmType).toBe('commercial');
    const applied = updateFarm(farm.id, patch);
    expect(applied.farmType).toBe('commercial');
  });
});

// ─── Behavior helpers ────────────────────────────────────────────
describe('farmTypeBehavior policies', () => {
  it('normalizeFarmType canonicalises known + unknown values', () => {
    expect(normalizeFarmType('backyard')).toBe('backyard');
    expect(normalizeFarmType('small_farm')).toBe('small_farm');
    expect(normalizeFarmType('commercial')).toBe('commercial');
    expect(normalizeFarmType('COMMERCIAL')).toBe('commercial');
    expect(normalizeFarmType('')).toBe(DEFAULT_FARM_TYPE);
    expect(normalizeFarmType(null)).toBe(DEFAULT_FARM_TYPE);
    expect(normalizeFarmType('sparkles')).toBe(DEFAULT_FARM_TYPE);
  });

  it('exports the three canonical tiers', () => {
    expect(FARM_TYPES).toEqual(['backyard', 'small_farm', 'commercial']);
  });

  it('getFarmTypePolicy returns tier-specific limits', () => {
    expect(getFarmTypePolicy('backyard').maxDailyTasks).toBe(2);
    expect(getFarmTypePolicy('small_farm').maxDailyTasks).toBe(3);
    expect(getFarmTypePolicy('commercial').maxDailyTasks).toBe(6);
  });

  it('adjustTasksForFarmType: backyard trims + drops commercial-only tasks', () => {
    const tasks = [
      { id: 'daily.water' },
      { id: 'daily.inspect' },
      { id: 'daily.feedback' },
      { id: 'daily.review' },
      { id: 'mid.calibrate_sprayer' }, // commercial-only
    ];
    const backyard = adjustTasksForFarmType({ tasks, farmType: 'backyard' });
    expect(backyard).toHaveLength(2);
    expect(backyard.every((t) => t.id !== 'mid.calibrate_sprayer')).toBe(true);
  });

  it('adjustTasksForFarmType: commercial keeps everything up to its cap', () => {
    const tasks = Array.from({ length: 10 }, (_, i) => ({ id: `daily.task_${i}` }));
    const commercial = adjustTasksForFarmType({ tasks, farmType: 'commercial' });
    expect(commercial).toHaveLength(6);
  });

  it('adjustTasksForFarmType: unknown input safely falls back to small_farm cap', () => {
    const tasks = Array.from({ length: 10 }, (_, i) => ({ id: `daily.task_${i}` }));
    const result = adjustTasksForFarmType({ tasks });
    expect(result).toHaveLength(3);
  });

  it('shouldShowAlertForFarmType: backyard suppresses low/medium', () => {
    expect(shouldShowAlertForFarmType({ severity: 'low' },      'backyard')).toBe(false);
    expect(shouldShowAlertForFarmType({ severity: 'medium' },   'backyard')).toBe(false);
    expect(shouldShowAlertForFarmType({ severity: 'high' },     'backyard')).toBe(true);
    expect(shouldShowAlertForFarmType({ severity: 'critical' }, 'backyard')).toBe(true);
  });

  it('shouldShowAlertForFarmType: small_farm blocks low only', () => {
    expect(shouldShowAlertForFarmType({ severity: 'low' },    'small_farm')).toBe(false);
    expect(shouldShowAlertForFarmType({ severity: 'medium' }, 'small_farm')).toBe(true);
  });

  it('shouldShowAlertForFarmType: commercial shows everything', () => {
    for (const sev of ['low', 'medium', 'high', 'critical']) {
      expect(shouldShowAlertForFarmType({ severity: sev }, 'commercial')).toBe(true);
    }
  });

  it('simplifyCopyForFarmType swaps plain copy on backyard, rich elsewhere', () => {
    const copy = { rich: 'Apply NPK 15:15:15 at 250 kg/ha', plain: 'Add fertilizer as advised' };
    expect(simplifyCopyForFarmType(copy, 'backyard')).toBe(copy.plain);
    expect(simplifyCopyForFarmType(copy, 'small_farm')).toBe(copy.rich);
    expect(simplifyCopyForFarmType(copy, 'commercial')).toBe(copy.rich);
    // Plain missing → always return rich
    expect(simplifyCopyForFarmType({ rich: 'x' }, 'backyard')).toBe('x');
  });
});
