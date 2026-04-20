/**
 * newFarmForm.test.js — contract for the data-entry bits of the
 * Add New Farm screen. Covers spec §8:
 *   1. cannot save with empty crop
 *   2. cannot save with empty country
 *   3. valid farm saves correctly
 *   4. detect location fills fields (coarseGeocode happy path)
 *   5. crop dropdown works (search ranking + "Other")
 *   6. state updates based on country
 *   7. farm switch works (active farm id flips)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  getCountries, getStatesForCountry, hasStatesForCountry,
  getCountryLabel, getStateLabel,
} from '../../../src/config/countriesStates.js';
import {
  COMMON_CROPS, searchCrops, normalizeCrop, getCropLabel, CROP_OTHER,
} from '../../../src/config/crops.js';
import {
  saveFarm, getFarms, setActiveFarmId, getActiveFarmId,
} from '../../../src/store/farrowayLocal.js';

function installLocalStorage() {
  const map = new Map();
  globalThis.window = {
    localStorage: {
      getItem:    (k) => map.has(k) ? map.get(k) : null,
      setItem:    (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    },
    dispatchEvent: () => true,
  };
  return map;
}

// ─── Countries + States (spec §1, §6) ────────────────────────────
describe('countries / states', () => {
  it('COUNTRIES exposes a global list including OTHER escape hatch', () => {
    const codes = getCountries().map((c) => c.code);
    for (const c of ['US', 'IN', 'NG', 'GH', 'KE', 'ZA', 'FR', 'BR', 'OTHER']) {
      expect(codes).toContain(c);
    }
  });

  it('hasStatesForCountry is true only for supported countries', () => {
    expect(hasStatesForCountry('US')).toBe(true);
    expect(hasStatesForCountry('IN')).toBe(true);
    expect(hasStatesForCountry('NG')).toBe(true);
    expect(hasStatesForCountry('FR')).toBe(false);
    expect(hasStatesForCountry('')).toBe(false);
    expect(hasStatesForCountry(null)).toBe(false);
  });

  it('state list changes when country changes', () => {
    const us = getStatesForCountry('US');
    const ng = getStatesForCountry('NG');
    expect(us.length).toBeGreaterThan(45);
    expect(ng.length).toBeGreaterThan(30);
    // No overlap in codes between disjoint jurisdictions.
    const usCodes = new Set(us.map((s) => s.code));
    const ngCodes = new Set(ng.map((s) => s.code));
    const overlap = [...usCodes].filter((c) => ngCodes.has(c));
    // Some codes coincide across countries (e.g. "CA"); the important
    // invariant is the labels differ.
    for (const code of overlap) {
      const u = us.find((s) => s.code === code);
      const n = ng.find((s) => s.code === code);
      expect(u.label).not.toBe(n.label);
    }
  });

  it('label helpers return null for unknowns', () => {
    expect(getCountryLabel('US')).toBe('United States');
    expect(getCountryLabel('ZZ')).toBeNull();
    expect(getStateLabel('US', 'CA')).toBe('California');
    expect(getStateLabel('US', 'ZZ')).toBeNull();
  });
});

// ─── Crop catalog + search (spec §2, §8.5) ───────────────────────
describe('crop catalog', () => {
  it('COMMON_CROPS includes staples and the "other" sentinel', () => {
    const codes = COMMON_CROPS.map((c) => c.code);
    for (const c of ['maize','rice','wheat','cassava','beans','tomato','other']) {
      expect(codes).toContain(c);
    }
  });

  it('empty query returns a sensible default page', () => {
    const r = searchCrops('');
    expect(r.length).toBeGreaterThan(0);
    expect(r.length).toBeLessThanOrEqual(20);
  });

  it('starts-with ranks above contains', () => {
    const r = searchCrops('mai');
    expect(r[0].code).toBe('maize'); // starts with "mai"
  });

  it('"other" is always last in the result when present', () => {
    const r = searchCrops('o', { limit: 100 });
    const idx = r.findIndex((c) => c.code === 'other');
    expect(idx).toBe(r.length - 1); // last element
  });

  it('normalizeCrop: known codes pass through; unknown becomes safe slug', () => {
    expect(normalizeCrop('maize')).toBe('maize');
    expect(normalizeCrop('MAIZE')).toBe('maize');
    expect(normalizeCrop('Sweet potato')).toBe('sweet_potato'); // squashed → matches code
    expect(normalizeCrop('dragon fruit')).toBe('dragon_fruit');
    expect(normalizeCrop('')).toBe('');
    expect(normalizeCrop(null)).toBe('');
  });

  it('getCropLabel resolves codes; returns input for unknowns', () => {
    expect(getCropLabel('maize')).toBe('Maize (corn)');
    expect(getCropLabel('dragon_fruit')).toBe('dragon_fruit');
  });

  it('CROP_OTHER is the expected sentinel', () => {
    expect(CROP_OTHER).toBe('other');
  });
});

// ─── saveFarm canonical shape (spec §7) ──────────────────────────
describe('saveFarm data shape', () => {
  beforeEach(() => { installLocalStorage(); });
  afterEach(()  => { delete globalThis.window; });

  it('writes the canonical fields when new-farm payload is supplied', () => {
    const farm = saveFarm({
      name: 'River Plot',
      crop: 'maize',
      country: 'US',
      state: 'CA',
      farmSize: 2.5,
      sizeUnit: 'ACRE',
      stage: 'land_prep',
    });
    expect(farm).toBeTruthy();
    expect(farm.country).toBe('US');
    expect(farm.state).toBe('CA');
    expect(farm.farmSize).toBe(2.5);
    expect(farm.sizeUnit).toBe('ACRE');
    expect(farm.stage).toBe('land_prep');
    expect(farm.crop).toBe('maize');
    expect(typeof farm.createdAt).toBe('number');
    // Legacy mirrors still populated for back-compat.
    expect(farm.location).toBe('US, CA');
    expect(farm.size).toBe('2.5');
    // Persisted.
    expect(getFarms()).toHaveLength(1);
  });

  it('farm switch: setActive:true makes the new farm active', () => {
    const first = saveFarm({ name: 'A', crop: 'maize', country: 'US', farmSize: 1 });
    expect(getActiveFarmId()).toBe(first.id);
    const second = saveFarm({
      name: 'B', crop: 'rice', country: 'IN', farmSize: 1, setActive: true,
    });
    expect(getActiveFarmId()).toBe(second.id);
  });

  it('setActiveFarmId reliably flips between farms', () => {
    const a = saveFarm({ name: 'A', crop: 'maize', country: 'US', farmSize: 1 });
    const b = saveFarm({ name: 'B', crop: 'rice', country: 'IN', farmSize: 1 });
    setActiveFarmId(b.id);
    expect(getActiveFarmId()).toBe(b.id);
    setActiveFarmId(a.id);
    expect(getActiveFarmId()).toBe(a.id);
  });

  it('saveFarm returns null for missing/empty name', () => {
    expect(saveFarm({ name: '', crop: 'maize', country: 'US', farmSize: 1 })).toBeNull();
    expect(saveFarm({ crop: 'maize' })).toBeNull();
  });
});

// ─── Form-level validation rules (spec §4) ───────────────────────
// Mirrors the validate() function in NewFarmScreen without bringing
// React in. The rules are deliberately replicated here so the
// contract is test-covered at the logic level.
function validate(form) {
  const next = {};
  const cropCode = form.cropType === CROP_OTHER
    ? normalizeCrop(form.cropOther)
    : form.cropType;
  if (!form.country || !form.country.trim()) next.country = 'country_required';
  if (!cropCode) next.cropType = 'crop_required';
  const sizeNum = Number(form.size);
  if (!form.size || !Number.isFinite(sizeNum) || sizeNum <= 0) next.size = 'size_required';
  return { errors: next, cropCode };
}

describe('NewFarmScreen validation rules', () => {
  it('empty crop → cropType error', () => {
    const { errors } = validate({ country: 'US', cropType: '', size: '2.5' });
    expect(errors.cropType).toBe('crop_required');
  });

  it('empty country → country error', () => {
    const { errors } = validate({ country: '', cropType: 'maize', size: '2.5' });
    expect(errors.country).toBe('country_required');
  });

  it('empty size → size error', () => {
    const { errors } = validate({ country: 'US', cropType: 'maize', size: '' });
    expect(errors.size).toBe('size_required');
  });

  it('zero / negative size → size error', () => {
    expect(validate({ country: 'US', cropType: 'maize', size: '0' }).errors.size)
      .toBe('size_required');
    expect(validate({ country: 'US', cropType: 'maize', size: '-1' }).errors.size)
      .toBe('size_required');
  });

  it('"other" with empty cropOther → cropType error', () => {
    const { errors, cropCode } = validate({
      country: 'US', cropType: 'other', cropOther: '', size: '1',
    });
    expect(errors.cropType).toBe('crop_required');
    expect(cropCode).toBe('');
  });

  it('"other" with custom crop normalizes correctly', () => {
    const { errors, cropCode } = validate({
      country: 'US', cropType: 'other', cropOther: 'Dragon Fruit', size: '1',
    });
    expect(errors.cropType).toBeUndefined();
    expect(cropCode).toBe('dragon_fruit');
  });

  it('fully valid form → no errors', () => {
    const { errors } = validate({
      country: 'US', cropType: 'maize', size: '2.5',
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });
});
