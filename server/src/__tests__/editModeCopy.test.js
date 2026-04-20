/**
 * editModeCopy.test.js — contract for the pure mapper from
 * EditFarmScreen's mode query-param to header copy.
 */

import { describe, it, expect } from 'vitest';

import { EDIT_MODES, getEditModeCopy } from '../../../src/utils/editFarm/editModeCopy.js';

describe('EDIT_MODES constants', () => {
  it('exposes three stable mode values', () => {
    expect(EDIT_MODES.EDIT).toBe('edit');
    expect(EDIT_MODES.COMPLETE_PROFILE).toBe('complete_profile');
    expect(EDIT_MODES.COMPLETE_FOR_RECOMMENDATION).toBe('complete_for_recommendation');
  });
  it('is frozen', () => {
    expect(Object.isFrozen(EDIT_MODES)).toBe(true);
  });
});

describe('getEditModeCopy', () => {
  it('returns plain Edit Farm copy for unknown mode', () => {
    const c = getEditModeCopy('unknown');
    expect(c.titleKey).toBe('farm.editFarm.title');
    expect(c.titleFallback).toBe('Edit Farm');
  });

  it('returns Edit Farm copy when mode is null / empty / non-string', () => {
    expect(getEditModeCopy(null).titleKey).toBe('farm.editFarm.title');
    expect(getEditModeCopy('').titleKey).toBe('farm.editFarm.title');
    expect(getEditModeCopy(undefined).titleKey).toBe('farm.editFarm.title');
    expect(getEditModeCopy(42).titleKey).toBe('farm.editFarm.title');
  });

  it('returns Complete Profile copy for complete_profile mode', () => {
    const c = getEditModeCopy('complete_profile');
    expect(c.titleKey).toBe('farm.editFarm.completeProfileTitle');
    expect(c.titleFallback).toMatch(/Complete your farm profile/);
    expect(c.helperKey).toBe('farm.editFarm.completeProfileHelper');
    expect(c.helperFallback).toMatch(/missing details/);
  });

  it('returns Recommendation copy for complete_for_recommendation mode', () => {
    const c = getEditModeCopy('complete_for_recommendation');
    expect(c.titleKey).toBe('farm.editFarm.completeForRecTitle');
    expect(c.titleFallback).toMatch(/better recommendations/);
    expect(c.helperKey).toBe('farm.editFarm.completeForRecHelper');
    expect(c.helperFallback).toMatch(/crop recommendations/);
  });

  it('returns Edit Farm copy for "edit" mode explicitly', () => {
    expect(getEditModeCopy('edit').titleKey).toBe('farm.editFarm.title');
  });

  it('result is frozen for every mode', () => {
    expect(Object.isFrozen(getEditModeCopy('edit'))).toBe(true);
    expect(Object.isFrozen(getEditModeCopy('complete_profile'))).toBe(true);
    expect(Object.isFrozen(getEditModeCopy('complete_for_recommendation'))).toBe(true);
    expect(Object.isFrozen(getEditModeCopy('bogus'))).toBe(true);
  });
});
