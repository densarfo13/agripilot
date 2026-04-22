/**
 * areaConversion.test.js — locks the spec contract for
 * src/lib/units/areaConversion.js:
 *   • toSquareMeters / fromSquareMeters / convertArea with every
 *     supported canonical unit
 *   • getDefaultUnit + getAllowedUnits by farmType × country
 *   • normalizeUnit for every legacy / localised input
 *   • getAreaUnitLabel delegates to the existing i18n table
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

import {
  toSquareMeters, fromSquareMeters, convertArea,
  getDefaultUnit, getAllowedUnits,
  getAreaUnitLabel, normalizeUnit,
  AREA_UNITS, SMALL_AREA_UNITS_LC, LAND_AREA_UNITS_LC,
  _internal,
} from '../../../src/lib/units/areaConversion.js';

// ─── Canonical factors ──────────────────────────────────────────
describe('toSquareMeters', () => {
  it('converts every canonical unit to m² using the exact factor', () => {
    expect(toSquareMeters(1, 'sqft')).toBeCloseTo(0.09290304, 8);
    expect(toSquareMeters(1, 'sqm')).toBe(1);
    expect(toSquareMeters(1, 'acres')).toBeCloseTo(4046.8564224, 4);
    expect(toSquareMeters(1, 'hectares')).toBe(10000);
  });

  it('accepts string numerics', () => {
    expect(toSquareMeters('2.5', 'acres')).toBeCloseTo(10117.14, 1);
  });

  it('accepts uppercase / plural / label aliases', () => {
    expect(toSquareMeters(1, 'ACRE')).toBeCloseTo(4046.86, 1);
    expect(toSquareMeters(1, 'sq ft')).toBeCloseTo(0.0929, 3);
    expect(toSquareMeters(1, 'square meter')).toBe(1);
    expect(toSquareMeters(1, 'm2')).toBe(1);
  });

  it('returns null on invalid inputs', () => {
    expect(toSquareMeters('', 'acres')).toBeNull();
    expect(toSquareMeters(null, 'acres')).toBeNull();
    expect(toSquareMeters('abc', 'acres')).toBeNull();
    expect(toSquareMeters(1, 'bananas')).toBeNull();
    expect(toSquareMeters(1, null)).toBeNull();
  });
});

describe('fromSquareMeters', () => {
  it('is the inverse of toSquareMeters', () => {
    const sqm = toSquareMeters(3, 'acres');
    expect(fromSquareMeters(sqm, 'acres')).toBeCloseTo(3, 6);
  });

  it('converts m² into every canonical unit', () => {
    expect(fromSquareMeters(10000, 'hectares')).toBe(1);
    expect(fromSquareMeters(4046.8564224, 'acres')).toBeCloseTo(1, 6);
    expect(fromSquareMeters(0.09290304, 'sqft')).toBeCloseTo(1, 6);
  });

  it('returns null on invalid inputs', () => {
    expect(fromSquareMeters('', 'acres')).toBeNull();
    expect(fromSquareMeters(1, 'bananas')).toBeNull();
  });
});

describe('convertArea — cross-tier via square meters', () => {
  it('converts sqft → sqm with 4-decimal rounding', () => {
    expect(convertArea(1000, 'sqft', 'sqm')).toBeCloseTo(92.903, 3);
  });

  it('converts acres → hectares', () => {
    expect(convertArea(5, 'acres', 'hectares')).toBeCloseTo(2.0234, 3);
  });

  it('converts CROSS-TIER sqft → acres (spec example)', () => {
    // 1000 sqft = 92.903 sqm = 0.0229568… acres
    const out = convertArea(1000, 'sqft', 'acres');
    expect(out).toBeCloseTo(0.023, 3);
  });

  it('converts CROSS-TIER hectares → sqm', () => {
    expect(convertArea(1, 'hectares', 'sqm')).toBe(10000);
  });

  it('returns null on unknown units', () => {
    expect(convertArea(1, 'sqft', 'bananas')).toBeNull();
    expect(convertArea(1, 'bananas', 'acres')).toBeNull();
  });

  it('round-trip is lossless within rounding tolerance', () => {
    const once = convertArea(2.5, 'acres', 'sqm');
    const back = convertArea(once, 'sqm', 'acres');
    expect(back).toBeCloseTo(2.5, 3);
  });
});

// ─── Defaults by farmType × country ─────────────────────────────
describe('getDefaultUnit', () => {
  it('backyard + US → sqft', () => {
    expect(getDefaultUnit({ farmType: 'backyard', countryCode: 'US' })).toBe('sqft');
  });

  it('backyard + non-US → sqm', () => {
    expect(getDefaultUnit({ farmType: 'backyard', countryCode: 'GH' })).toBe('sqm');
    expect(getDefaultUnit({ farmType: 'backyard', countryCode: 'IN' })).toBe('sqm');
    expect(getDefaultUnit({ farmType: 'backyard', countryCode: '' })).toBe('sqm');
  });

  it('small_farm + US → acres', () => {
    expect(getDefaultUnit({ farmType: 'small_farm', countryCode: 'US' })).toBe('acres');
  });

  it('small_farm + non-US → hectares', () => {
    expect(getDefaultUnit({ farmType: 'small_farm', countryCode: 'GH' })).toBe('hectares');
  });

  it('commercial + US → acres', () => {
    expect(getDefaultUnit({ farmType: 'commercial', countryCode: 'US' })).toBe('acres');
  });

  it('commercial + non-US → hectares', () => {
    expect(getDefaultUnit({ farmType: 'commercial', countryCode: 'KE' })).toBe('hectares');
  });

  it('unknown farmType falls back to land tier', () => {
    expect(getDefaultUnit({ farmType: 'martian', countryCode: 'US' })).toBe('acres');
  });

  it('accepts spec shorthand "small" alongside "small_farm"', () => {
    expect(getDefaultUnit({ farmType: 'small', countryCode: 'US' })).toBe('acres');
    expect(getDefaultUnit({ farmType: 'small', countryCode: 'GH' })).toBe('hectares');
  });
});

describe('getAllowedUnits', () => {
  it('backyard returns the small-area tier with default first', () => {
    expect(getAllowedUnits({ farmType: 'backyard', countryCode: 'US' })).toEqual(['sqft', 'sqm']);
    expect(getAllowedUnits({ farmType: 'backyard', countryCode: 'GH' })).toEqual(['sqm', 'sqft']);
  });

  it('small / commercial return the land-area tier with default first', () => {
    expect(getAllowedUnits({ farmType: 'small_farm', countryCode: 'US' })).toEqual(['acres', 'hectares']);
    expect(getAllowedUnits({ farmType: 'commercial', countryCode: 'GH' })).toEqual(['hectares', 'acres']);
  });

  it('unknown farmType falls back to the land tier', () => {
    expect(getAllowedUnits({ farmType: 'banana', countryCode: 'US' })).toEqual(['acres', 'hectares']);
  });
});

// ─── Normaliser ────────────────────────────────────────────────
describe('normalizeUnit', () => {
  it('canonical lowercase codes round-trip', () => {
    for (const u of AREA_UNITS) expect(normalizeUnit(u)).toBe(u);
  });

  it('collapses uppercase + legacy singular to canonical', () => {
    expect(normalizeUnit('ACRE')).toBe('acres');
    expect(normalizeUnit('HECTARE')).toBe('hectares');
    expect(normalizeUnit('SQFT')).toBe('sqft');
    expect(normalizeUnit('SQM')).toBe('sqm');
  });

  it('collapses display / drift labels', () => {
    expect(normalizeUnit('Acres')).toBe('acres');
    expect(normalizeUnit('Hectares')).toBe('hectares');
    expect(normalizeUnit('Square Feet')).toBe('sqft');
    expect(normalizeUnit('Square Meters')).toBe('sqm');
    expect(normalizeUnit('ha')).toBe('hectares');
    expect(normalizeUnit('ft2')).toBe('sqft');
    expect(normalizeUnit('m^2')).toBe('sqm');
    expect(normalizeUnit('Ekari')).toBe('acres');     // Swahili drift
    expect(normalizeUnit('Hekta')).toBe('hectares');  // Swahili drift
  });

  it('returns null for unknown / empty input', () => {
    expect(normalizeUnit(null)).toBeNull();
    expect(normalizeUnit('')).toBeNull();
    expect(normalizeUnit('bananas')).toBeNull();
  });
});

// ─── Label helper ───────────────────────────────────────────────
describe('getAreaUnitLabel', () => {
  it('returns non-empty labels for every canonical unit in English', () => {
    expect(getAreaUnitLabel('sqft', 'en')).toBeTruthy();
    expect(getAreaUnitLabel('sqm', 'en')).toBeTruthy();
    expect(getAreaUnitLabel('acres', 'en')).toBeTruthy();
    expect(getAreaUnitLabel('hectares', 'en')).toBeTruthy();
  });

  it('falls back gracefully on unknown language', () => {
    expect(getAreaUnitLabel('acres', 'klingon')).toBeTruthy();
  });

  it('returns empty on unknown code', () => {
    expect(getAreaUnitLabel('bananas', 'en')).toBe('');
  });
});

// ─── Constants sanity ──────────────────────────────────────────
describe('exported constants', () => {
  it('lists the four canonical units + tier subsets', () => {
    expect(AREA_UNITS).toEqual(['sqft', 'sqm', 'acres', 'hectares']);
    expect(SMALL_AREA_UNITS_LC).toEqual(['sqft', 'sqm']);
    expect(LAND_AREA_UNITS_LC).toEqual(['acres', 'hectares']);
  });

  it('SQM_PER_UNIT matches spec factors', () => {
    const { SQM_PER_UNIT } = _internal;
    expect(SQM_PER_UNIT.sqft).toBe(0.09290304);
    expect(SQM_PER_UNIT.sqm).toBe(1);
    expect(SQM_PER_UNIT.acres).toBe(4046.8564224);
    expect(SQM_PER_UNIT.hectares).toBe(10000);
  });
});

// ─── Storage integration (farrowayLocal.saveFarm) ──────────────
describe('farrowayLocal.js wires normalizedAreaSqm', () => {
  const code = readFile('src/store/farrowayLocal.js');

  it('imports toSquareMeters from the canonical area module', () => {
    expect(code).toContain("from '../lib/units/areaConversion.js'");
    expect(code).toContain('toSquareMeters');
  });

  it('saveFarm writes the normalizedAreaSqm field', () => {
    expect(code).toMatch(/normalizedAreaSqm:\s*toSquareMeters\(/);
  });

  it('getFarms back-fills normalizedAreaSqm on legacy rows', () => {
    expect(code).toMatch(/normalizedAreaSqm\s*!=\s*null/);
    expect(code).toContain('sqm == null ? row');
  });

  it('updateFarm recomputes normalizedAreaSqm on size / unit changes', () => {
    expect(code).toMatch(/changed\.farmSize\s*!=\s*null.*changed\.sizeUnit/s);
  });
});
