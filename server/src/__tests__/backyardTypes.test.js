/**
 * backyardTypes.test.js — verifies the spec §3-§5/§7 contract:
 *   • BACKYARD_TYPES exposes the 7 backyard variants + 2 farm
 *     catch-alls.
 *   • resolveBackyardType walks the priority ladder:
 *       1. explicit backyardType field
 *       2. growingSetup legacy field
 *       3. farmType + farmSize inference
 *   • getTaskCopyForBackyardType + getHeroCopyForBackyardType
 *     return non-null { title, reason } / { title, line, cta }.
 *   • Never throws on null / non-object / malformed input.
 */

import { describe, it, expect } from 'vitest';
import {
  BACKYARD_TYPES,
  resolveBackyardType,
  getTaskCopyForBackyardType,
  getHeroCopyForBackyardType,
  isBackyardType,
} from '../../../src/lib/backyardTypes.js';

describe('BACKYARD_TYPES catalog', () => {
  it('exposes the 7 backyard subtypes + 2 farm catch-alls', () => {
    expect(BACKYARD_TYPES.POTS).toBe('pots');
    expect(BACKYARD_TYPES.RAISED_BED).toBe('raised_bed');
    expect(BACKYARD_TYPES.BACKYARD_SOIL_BED).toBe('backyard_soil_bed');
    expect(BACKYARD_TYPES.BALCONY_PATIO).toBe('balcony_patio');
    expect(BACKYARD_TYPES.INDOOR_GROW).toBe('indoor_grow');
    expect(BACKYARD_TYPES.GREENHOUSE).toBe('greenhouse');
    expect(BACKYARD_TYPES.MIXED).toBe('mixed');
    expect(BACKYARD_TYPES.SMALL_FARM).toBe('small_farm');
    expect(BACKYARD_TYPES.COMMERCIAL).toBe('commercial');
  });
});

describe('resolveBackyardType priority ladder', () => {
  it('returns small_farm for null / non-object input', () => {
    expect(resolveBackyardType(null)).toBe('small_farm');
    expect(resolveBackyardType(undefined)).toBe('small_farm');
    expect(resolveBackyardType('not-an-object')).toBe('small_farm');
    expect(resolveBackyardType(42)).toBe('small_farm');
  });

  it('honours explicit row.backyardType', () => {
    expect(resolveBackyardType({ backyardType: 'pots' })).toBe('pots');
    expect(resolveBackyardType({ backyardType: 'greenhouse' })).toBe('greenhouse');
    expect(resolveBackyardType({ backyardType: 'raised_bed' })).toBe('raised_bed');
  });

  it('honours legacy aliases (pot → pots, raised → raised_bed, etc.)', () => {
    expect(resolveBackyardType({ backyardType: 'pot' })).toBe('pots');
    expect(resolveBackyardType({ backyardType: 'container' })).toBe('pots');
    expect(resolveBackyardType({ backyardType: 'raised' })).toBe('raised_bed');
    expect(resolveBackyardType({ backyardType: 'patio' })).toBe('balcony_patio');
    expect(resolveBackyardType({ backyardType: 'tunnel' })).toBe('greenhouse');
  });

  it('falls back to growingSetup when backyardType missing', () => {
    expect(resolveBackyardType({ growingSetup: 'pots' })).toBe('pots');
    expect(resolveBackyardType({ growingSetup: 'greenhouse' })).toBe('greenhouse');
  });

  it('infers MIXED for backyard farmType without subtype hint', () => {
    expect(resolveBackyardType({ farmType: 'backyard' })).toBe('mixed');
    expect(resolveBackyardType({ farmType: 'home_garden' })).toBe('mixed');
    expect(resolveBackyardType({ farmType: 'home' })).toBe('mixed');
  });

  it('infers SMALL_FARM for non-backyard farmType', () => {
    expect(resolveBackyardType({ farmType: 'small_farm' })).toBe('small_farm');
    expect(resolveBackyardType({ farmType: 'commercial', farmSize: 1 })).toBe('small_farm');
    expect(resolveBackyardType({ farmType: undefined })).toBe('small_farm');
  });

  it('infers COMMERCIAL for non-backyard with farmSize ≥ 50 acres', () => {
    expect(resolveBackyardType({
      farmType: 'commercial', farmSize: 60, sizeUnit: 'acres',
    })).toBe('commercial');
    expect(resolveBackyardType({
      farmType: 'small_farm', farmSize: 100, sizeUnit: 'acres',
    })).toBe('commercial');
  });

  it('explicit field beats inference', () => {
    // farmType=backyard would normally infer 'mixed', but the
    // explicit backyardType wins.
    expect(resolveBackyardType({
      farmType: 'backyard', backyardType: 'greenhouse',
    })).toBe('greenhouse');
  });
});

describe('copy lookups', () => {
  it('getTaskCopyForBackyardType returns { title, reason } for every catalog value', () => {
    for (const t of Object.values(BACKYARD_TYPES)) {
      const copy = getTaskCopyForBackyardType(t);
      expect(copy).toBeTruthy();
      expect(typeof copy.title).toBe('string');
      expect(copy.title.length).toBeGreaterThan(0);
      expect(typeof copy.reason).toBe('string');
      expect(copy.reason.length).toBeGreaterThan(0);
    }
  });

  it('getHeroCopyForBackyardType returns { title, line, cta } for every catalog value', () => {
    for (const t of Object.values(BACKYARD_TYPES)) {
      const copy = getHeroCopyForBackyardType(t);
      expect(copy).toBeTruthy();
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.line.length).toBeGreaterThan(0);
      expect(copy.cta.length).toBeGreaterThan(0);
    }
  });

  it('unknown type falls back to small_farm copy', () => {
    expect(getTaskCopyForBackyardType('not-a-type').title)
      .toBe('Walk your field and check crop health');
    expect(getHeroCopyForBackyardType('not-a-type').title)
      .toBe('Today on your farm');
  });

  it('pots copy mentions pots specifically', () => {
    expect(getTaskCopyForBackyardType('pots').title.toLowerCase()).toContain('pot');
    expect(getHeroCopyForBackyardType('pots').line.toLowerCase()).toContain('pot');
  });

  it('greenhouse copy mentions greenhouse specifically', () => {
    expect(getHeroCopyForBackyardType('greenhouse').title.toLowerCase()).toContain('greenhouse');
  });
});

describe('isBackyardType', () => {
  it('returns true for every backyard variant', () => {
    expect(isBackyardType('pots')).toBe(true);
    expect(isBackyardType('raised_bed')).toBe(true);
    expect(isBackyardType('backyard_soil_bed')).toBe(true);
    expect(isBackyardType('balcony_patio')).toBe(true);
    expect(isBackyardType('indoor_grow')).toBe(true);
    expect(isBackyardType('greenhouse')).toBe(true);
    expect(isBackyardType('mixed')).toBe(true);
  });

  it('returns false for farm catch-alls + unknown', () => {
    expect(isBackyardType('small_farm')).toBe(false);
    expect(isBackyardType('commercial')).toBe(false);
    expect(isBackyardType('not-a-type')).toBe(false);
    expect(isBackyardType(null)).toBe(false);
  });
});
