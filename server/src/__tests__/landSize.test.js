import { describe, it, expect } from 'vitest';
import { toHectares, fromHectares, isValidUnit, unitLabel, computeLandSizeFields, VALID_UNITS } from '../utils/landSize.js';

describe('Land Size Conversion', () => {
  // ─── toHectares ──────────────────────────────────────
  describe('toHectares', () => {
    it('converts acres to hectares correctly', () => {
      expect(toHectares(1, 'ACRE')).toBeCloseTo(0.404686, 4);
      expect(toHectares(5, 'ACRE')).toBeCloseTo(2.02343, 4);
      expect(toHectares(10, 'ACRE')).toBeCloseTo(4.04686, 4);
      expect(toHectares(100, 'ACRE')).toBeCloseTo(40.4686, 3);
    });

    it('passes hectares through unchanged', () => {
      expect(toHectares(1, 'HECTARE')).toBe(1);
      expect(toHectares(5.5, 'HECTARE')).toBe(5.5);
      expect(toHectares(0.25, 'HECTARE')).toBe(0.25);
    });

    it('converts square meters to hectares correctly', () => {
      expect(toHectares(10000, 'SQUARE_METER')).toBeCloseTo(1, 4);
      expect(toHectares(5000, 'SQUARE_METER')).toBeCloseTo(0.5, 4);
      expect(toHectares(500, 'SQUARE_METER')).toBeCloseTo(0.05, 4);
    });

    it('returns null for null/NaN/undefined input', () => {
      expect(toHectares(null, 'ACRE')).toBeNull();
      expect(toHectares(undefined, 'ACRE')).toBeNull();
      expect(toHectares(NaN, 'ACRE')).toBeNull();
    });

    it('returns null for invalid unit', () => {
      expect(toHectares(5, 'BOGUS')).toBeNull();
    });

    it('is case-insensitive on unit', () => {
      expect(toHectares(1, 'acre')).toBeCloseTo(0.404686, 4);
      expect(toHectares(1, 'Hectare')).toBe(1);
    });

    it('defaults to ACRE when unit is falsy', () => {
      expect(toHectares(1, null)).toBeCloseTo(0.404686, 4);
      expect(toHectares(1, '')).toBeCloseTo(0.404686, 4);
    });
  });

  // ─── fromHectares ────────────────────────────────────
  describe('fromHectares', () => {
    it('converts hectares to acres correctly', () => {
      expect(fromHectares(1, 'ACRE')).toBeCloseTo(2.47105, 3);
    });

    it('converts hectares to square meters', () => {
      expect(fromHectares(1, 'SQUARE_METER')).toBe(10000);
    });

    it('returns hectares unchanged', () => {
      expect(fromHectares(3.5, 'HECTARE')).toBe(3.5);
    });

    it('round-trips accurately', () => {
      const originalAcres = 7.3;
      const hectares = toHectares(originalAcres, 'ACRE');
      const backToAcres = fromHectares(hectares, 'ACRE');
      expect(backToAcres).toBeCloseTo(originalAcres, 4);
    });
  });

  // ─── isValidUnit ─────────────────────────────────────
  describe('isValidUnit', () => {
    it('accepts valid units', () => {
      expect(isValidUnit('ACRE')).toBe(true);
      expect(isValidUnit('HECTARE')).toBe(true);
      expect(isValidUnit('SQUARE_METER')).toBe(true);
    });

    it('rejects invalid units', () => {
      expect(isValidUnit('FOOT')).toBe(false);
      expect(isValidUnit('')).toBe(false);
      expect(isValidUnit(null)).toBe(false);
    });
  });

  // ─── unitLabel ───────────────────────────────────────
  describe('unitLabel', () => {
    it('returns correct labels', () => {
      expect(unitLabel('ACRE')).toBe('acres');
      expect(unitLabel('HECTARE')).toBe('hectares');
      expect(unitLabel('SQUARE_METER')).toBe('m²');
    });

    it('defaults to acres for unknown unit', () => {
      expect(unitLabel(null)).toBe('acres');
      expect(unitLabel(undefined)).toBe('acres');
    });
  });

  // ─── computeLandSizeFields ───────────────────────────
  describe('computeLandSizeFields', () => {
    it('computes all fields for acres', () => {
      const result = computeLandSizeFields(5, 'ACRE');
      expect(result.landSizeValue).toBe(5);
      expect(result.landSizeUnit).toBe('ACRE');
      expect(result.landSizeHectares).toBeCloseTo(2.02343, 4);
    });

    it('computes all fields for hectares', () => {
      const result = computeLandSizeFields(3, 'HECTARE');
      expect(result.landSizeValue).toBe(3);
      expect(result.landSizeUnit).toBe('HECTARE');
      expect(result.landSizeHectares).toBe(3);
    });

    it('computes all fields for square meters', () => {
      const result = computeLandSizeFields(2500, 'SQUARE_METER');
      expect(result.landSizeValue).toBe(2500);
      expect(result.landSizeUnit).toBe('SQUARE_METER');
      expect(result.landSizeHectares).toBeCloseTo(0.25, 4);
    });

    it('returns nulls for empty/null/NaN value', () => {
      expect(computeLandSizeFields(null, 'ACRE')).toEqual({ landSizeValue: null, landSizeUnit: null, landSizeHectares: null });
      expect(computeLandSizeFields('', 'ACRE')).toEqual({ landSizeValue: null, landSizeUnit: null, landSizeHectares: null });
      expect(computeLandSizeFields(undefined, 'ACRE')).toEqual({ landSizeValue: null, landSizeUnit: null, landSizeHectares: null });
    });

    it('defaults to ACRE when unit is missing', () => {
      const result = computeLandSizeFields(10);
      expect(result.landSizeUnit).toBe('ACRE');
      expect(result.landSizeHectares).toBeCloseTo(4.04686, 3);
    });

    it('accepts string values and parses them', () => {
      const result = computeLandSizeFields('7.5', 'HECTARE');
      expect(result.landSizeValue).toBe(7.5);
      expect(result.landSizeHectares).toBe(7.5);
    });

    it('handles zero value', () => {
      const result = computeLandSizeFields(0, 'ACRE');
      expect(result.landSizeValue).toBe(0);
      expect(result.landSizeHectares).toBe(0);
    });
  });

  // ─── VALID_UNITS ─────────────────────────────────────
  describe('VALID_UNITS', () => {
    it('contains exactly three units', () => {
      expect(VALID_UNITS).toHaveLength(3);
      expect(VALID_UNITS).toContain('ACRE');
      expect(VALID_UNITS).toContain('HECTARE');
      expect(VALID_UNITS).toContain('SQUARE_METER');
    });
  });

  // ─── Edge cases & precision ──────────────────────────
  describe('precision and edge cases', () => {
    it('handles very small values', () => {
      const result = toHectares(0.01, 'ACRE');
      expect(result).toBeCloseTo(0.00404686, 6);
    });

    it('handles very large values', () => {
      const result = toHectares(100000, 'SQUARE_METER');
      expect(result).toBeCloseTo(10, 4);
    });

    it('maintains 6 decimal place precision', () => {
      const result = toHectares(1, 'ACRE');
      const decimals = result.toString().split('.')[1]?.length || 0;
      expect(decimals).toBeLessThanOrEqual(6);
    });
  });
});
