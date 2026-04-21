/**
 * priceEngine.test.js — static price lookup + expected-value helpers.
 *
 * Spec §§2 + §12 #6-7, #18.
 */

import { describe, it, expect } from 'vitest';

import {
  getReferencePrice, getExpectedValue, listPricesForCountry,
} from '../../../src/lib/pricing/priceEngine.js';
import {
  PRICES, SUPPORTED_COUNTRIES, SUPPORTED_CROPS,
} from '../../../src/config/prices.js';

// ─── Config coverage ─────────────────────────────────────────────
describe('price config — spec-required coverage', () => {
  it('covers all five spec countries', () => {
    expect(SUPPORTED_COUNTRIES.slice().sort())
      .toEqual(['FR', 'GH', 'IN', 'NG', 'US']);
  });
  it('covers all ten spec crops', () => {
    for (const country of SUPPORTED_COUNTRIES) {
      for (const crop of SUPPORTED_CROPS) {
        expect(PRICES[country][crop]).toBeTruthy();
      }
    }
  });
});

// ─── Lookup ──────────────────────────────────────────────────────
describe('getReferencePrice', () => {
  it('returns a frozen row for known (country, crop)', () => {
    const r = getReferencePrice({ country: 'GH', crop: 'maize' });
    expect(r.price).toBeGreaterThan(0);
    expect(r.currency).toBe('GHS');
    expect(r.unit).toBe('kg');
    expect(r.source).toBe('country_crop');
  });

  it('case-insensitive country + crop inputs', () => {
    const r = getReferencePrice({ country: 'gh', crop: 'MAIZE' });
    expect(r.price).toBeGreaterThan(0);
    expect(r.source).toBe('country_crop');
  });

  it('unknown country → null', () => {
    expect(getReferencePrice({ country: 'ZZ', crop: 'maize' })).toBeNull();
  });

  it('unknown crop in known country → country_default fallback', () => {
    const r = getReferencePrice({ country: 'GH', crop: 'quinoa' });
    expect(r.price).toBeNull();
    expect(r.currency).toBe('GHS');
    expect(r.source).toBe('country_default');
  });

  it('missing country/crop arg → null', () => {
    expect(getReferencePrice({})).toBeNull();
  });
});

// ─── Expected value ──────────────────────────────────────────────
describe('getExpectedValue', () => {
  it('computes value × price correctly in kg', () => {
    const ghMaize = getReferencePrice({ country: 'GH', crop: 'maize' });
    const r = getExpectedValue({
      country: 'GH', crop: 'maize', estimatedYield: 1000, unit: 'kg',
    });
    expect(r.value).toBe(Math.round(ghMaize.price * 1000 * 100) / 100);
    expect(r.currency).toBe('GHS');
  });

  it('converts tonnes to kg when reference is per-kg', () => {
    const r1 = getExpectedValue({
      country: 'GH', crop: 'maize', estimatedYield: 1, unit: 't',
    });
    const r2 = getExpectedValue({
      country: 'GH', crop: 'maize', estimatedYield: 1000, unit: 'kg',
    });
    expect(r1.value).toBe(r2.value);
  });

  it('handles NaN / negative yield safely → value 0', () => {
    const r1 = getExpectedValue({
      country: 'GH', crop: 'maize', estimatedYield: NaN,
    });
    const r2 = getExpectedValue({
      country: 'GH', crop: 'maize', estimatedYield: -100,
    });
    expect(r1.value).toBe(0);
    expect(r2.value).toBe(0);
  });

  it('unknown country/crop → null', () => {
    expect(getExpectedValue({
      country: 'ZZ', crop: 'maize', estimatedYield: 100,
    })).toBeNull();
  });

  it('country_default fallback → null value (no price)', () => {
    expect(getExpectedValue({
      country: 'GH', crop: 'quinoa', estimatedYield: 100,
    })).toBeNull();
  });
});

// ─── Country listing ─────────────────────────────────────────────
describe('listPricesForCountry', () => {
  it('returns the full table alphabetically', () => {
    const rows = listPricesForCountry('GH');
    expect(rows.length).toBe(SUPPORTED_CROPS.length);
    const crops = rows.map((r) => r.crop);
    expect(crops).toEqual(crops.slice().sort());
    for (const row of rows) {
      expect(Object.isFrozen(row)).toBe(true);
    }
  });
  it('unknown country → []', () => {
    expect(listPricesForCountry('ZZ')).toEqual([]);
    expect(listPricesForCountry(null)).toEqual([]);
  });
});
