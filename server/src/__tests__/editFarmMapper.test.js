/**
 * editFarmMapper.test.js — behavioral contract for the
 * standalone Edit Farm data layer.
 *
 * Covers:
 *   • farmToEditForm always returns a complete, safe form
 *   • editFormToPatch returns ONLY changed fields
 *   • onboarding state can NEVER appear in the patch
 *   • empty strings → undefined (never clobbers good data)
 *   • hasAnyChange + validateEditForm agree with the mapper
 *   • dev assertions fire loud in dev, silent in unmet preconditions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  farmToEditForm, editFormToPatch,
  hasAnyChange, validateEditForm,
} from '../../../src/utils/editFarm/editFarmMapper.js';
import {
  assertEditRouteNotOnboarding,
  assertNoStepIndicatorInEdit,
  assertFarmWasUpdatedNotRecreated,
  assertEditPatchHasNoOnboardingState,
} from '../../../src/utils/editFarm/editFarmDevAssertions.js';

// ─── farmToEditForm ──────────────────────────────────────────
describe('farmToEditForm', () => {
  it('returns a complete empty form for null / undefined / non-object', () => {
    const f1 = farmToEditForm(null);
    const f2 = farmToEditForm(undefined);
    const f3 = farmToEditForm('nope');
    const keys = ['farmName', 'cropType', 'country', 'location',
                  'size', 'sizeUnit', 'cropStage', 'plantedAt'];
    for (const f of [f1, f2, f3]) {
      for (const k of keys) expect(k in f).toBe(true);
    }
    expect(f1.farmName).toBe('');
    expect(f1.cropStage).toBe('planning');
  });

  it('maps a realistic farm record into the form shape', () => {
    const form = farmToEditForm({
      id: 'farm_abc',
      farmName: 'North Block',
      cropType: 'MAIZE',
      country: 'Ghana',
      location: 'Ashanti',
      size: 3.5,
      sizeUnit: 'ACRE',
      cropStage: 'vegetative',
      plantedAt: '2026-03-05T12:00:00Z',
    });
    expect(form.farmName).toBe('North Block');
    expect(form.cropType).toBe('MAIZE');
    expect(form.country).toBe('Ghana');
    expect(form.location).toBe('Ashanti');
    expect(form.size).toBe('3.5');
    expect(form.cropStage).toBe('vegetative');
    // Date is sliced to YYYY-MM-DD for the <input type="date"> control.
    expect(form.plantedAt).toBe('2026-03-05');
  });

  it('falls back to farm.crop / farm.stage when cropType / cropStage missing', () => {
    const form = farmToEditForm({ crop: 'rice', stage: 'planting' });
    expect(form.cropType).toBe('rice');
    expect(form.cropStage).toBe('planting');
  });

  it('coerces numeric size to string for the input', () => {
    expect(farmToEditForm({ size: 0 }).size).toBe('0');
    expect(farmToEditForm({ size: 12.75 }).size).toBe('12.75');
  });
});

// ─── editFormToPatch ─────────────────────────────────────────
describe('editFormToPatch — only changed fields', () => {
  const farm = {
    id: 'f1', farmName: 'North', cropType: 'MAIZE',
    country: 'Ghana', location: 'Ashanti',
    size: 3.5, sizeUnit: 'ACRE', cropStage: 'vegetative',
    plantedAt: '2026-03-05T12:00:00Z',
  };

  it('returns an empty patch when nothing changed', () => {
    const form = farmToEditForm(farm);
    const patch = editFormToPatch(form, farm);
    expect(patch).toEqual({});
  });

  it('includes ONLY the one field the user changed', () => {
    const form = { ...farmToEditForm(farm), farmName: 'Main Block' };
    const patch = editFormToPatch(form, farm);
    expect(patch).toEqual({ farmName: 'Main Block' });
  });

  it('coerces size to Number', () => {
    const form = { ...farmToEditForm(farm), size: '7.25' };
    const patch = editFormToPatch(form, farm);
    expect(patch).toEqual({ size: 7.25 });
  });

  it('maps cleared size "" to no patch entry (preserves server value)', () => {
    const form = { ...farmToEditForm(farm), size: '' };
    const patch = editFormToPatch(form, farm);
    // Original size was 3.5, form now '' → treated as change.
    // But the value is undefined → key is dropped from patch.
    expect('size' in patch).toBe(false);
  });

  it('maps plantedAt to an ISO timestamp; clearing sends explicit null', () => {
    const form = { ...farmToEditForm(farm), plantedAt: '2026-04-19' };
    const patch = editFormToPatch(form, farm);
    expect(patch.plantedAt.startsWith('2026-04-19')).toBe(true);

    const cleared = { ...farmToEditForm(farm), plantedAt: '' };
    const patchC = editFormToPatch(cleared, farm);
    // Empty plantedAt ≠ original → change → sent as null (explicit clear).
    expect(patchC.plantedAt).toBeNull();
  });

  it('trims string fields before emitting', () => {
    const form = { ...farmToEditForm(farm), location: '  Central  ' };
    const patch = editFormToPatch(form, farm);
    expect(patch.location).toBe('Central');
  });
});

// ─── NO onboarding state in patch (§7) ───────────────────────
describe('editFormToPatch — forbidden onboarding keys are stripped', () => {
  it('silently drops farmerType / onboardingCompleted / hasSeenIntro / createdVia', () => {
    const farm = { id: 'f1', farmName: 'A' };
    const form = {
      ...farmToEditForm(farm),
      farmName: 'B',
      farmerType:          'new',
      onboardingCompleted: true,
      hasSeenIntro:        true,
      createdVia:          'fast_onboarding',
      onboardingPath:      'fast',
    };
    const patch = editFormToPatch(form, farm);
    expect(patch.farmName).toBe('B');
    expect('farmerType'          in patch).toBe(false);
    expect('onboardingCompleted' in patch).toBe(false);
    expect('hasSeenIntro'        in patch).toBe(false);
    expect('createdVia'          in patch).toBe(false);
    expect('onboardingPath'      in patch).toBe(false);
  });
});

// ─── hasAnyChange + validateEditForm ─────────────────────────
describe('hasAnyChange', () => {
  it('false when nothing edited', () => {
    const farm = { farmName: 'A', cropType: 'MAIZE' };
    expect(hasAnyChange(farmToEditForm(farm), farm)).toBe(false);
  });
  it('true when any field differs', () => {
    const farm = { farmName: 'A', cropType: 'MAIZE' };
    const form = { ...farmToEditForm(farm), cropType: 'RICE' };
    expect(hasAnyChange(form, farm)).toBe(true);
  });
});

describe('validateEditForm', () => {
  it('flags missing farmName', () => {
    expect(validateEditForm({ farmName: '' }).farmName).toBeTruthy();
    expect(validateEditForm({}).farmName).toBeTruthy();
  });
  it('flags negative size', () => {
    expect(validateEditForm({ farmName: 'A', size: -1 }).size).toBeTruthy();
  });
  it('empty size is fine — size is optional', () => {
    expect('size' in validateEditForm({ farmName: 'A', size: '' })).toBe(false);
  });
  it('returns empty object for a valid form', () => {
    expect(validateEditForm({ farmName: 'A', size: '3' })).toEqual({});
  });
});

// ─── Dev assertions ──────────────────────────────────────────
describe('editFarm dev assertions', () => {
  let warnSpy;
  beforeEach(() => {
    globalThis.window = globalThis.window || {};
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => { warnSpy.mockRestore(); });

  it('assertEditRouteNotOnboarding silent on edit module path', () => {
    assertEditRouteNotOnboarding('/src/pages/EditFarmScreen.jsx');
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('assertEditRouteNotOnboarding warns on onboarding module path', () => {
    assertEditRouteNotOnboarding('/src/pages/onboarding/fast/FastOnboardingFlow.jsx');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    assertEditRouteNotOnboarding('/src/utils/fastOnboarding/index.js');
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it('assertNoStepIndicatorInEdit silent when absent', () => {
    assertNoStepIndicatorInEdit(false);
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('assertNoStepIndicatorInEdit warns when present', () => {
    assertNoStepIndicatorInEdit(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('assertFarmWasUpdatedNotRecreated silent when ids match', () => {
    assertFarmWasUpdatedNotRecreated('farm_1', 'farm_1');
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('assertFarmWasUpdatedNotRecreated warns when ids differ', () => {
    assertFarmWasUpdatedNotRecreated('farm_1', 'farm_NEW');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
  it('assertFarmWasUpdatedNotRecreated silent when either id is missing', () => {
    assertFarmWasUpdatedNotRecreated(null, 'f1');
    assertFarmWasUpdatedNotRecreated('f1', null);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('assertEditPatchHasNoOnboardingState silent on clean patch', () => {
    assertEditPatchHasNoOnboardingState({ farmName: 'X', size: 2 });
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it('assertEditPatchHasNoOnboardingState warns on forbidden keys', () => {
    assertEditPatchHasNoOnboardingState({ farmName: 'X', farmerType: 'new' });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    assertEditPatchHasNoOnboardingState({ createdVia: 'fast_onboarding' });
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});
