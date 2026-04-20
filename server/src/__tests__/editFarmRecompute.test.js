/**
 * editFarmRecompute.test.js — contract for the post-edit
 * recompute coordination:
 *   classifyFarmChanges
 *   buildRecomputeIntent
 *   analyticsPayloadForChanges
 *   extra §13 dev assertions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  classifyFarmChanges, farmToEditForm,
} from '../../../src/utils/editFarm/editFarmMapper.js';
import {
  buildRecomputeIntent, analyticsPayloadForChanges,
} from '../../../src/utils/editFarm/recomputeIntent.js';
import {
  assertRecomputeTriggered,
  assertFarmerTypeNotMutated,
  assertHomeRefreshedAfterEdit,
} from '../../../src/utils/editFarm/editFarmDevAssertions.js';

// ─── classifyFarmChanges ─────────────────────────────────────
describe('classifyFarmChanges', () => {
  const farm = {
    id: 'f1', farmName: 'North', cropType: 'MAIZE',
    country: 'Ghana', location: 'Ashanti',
    size: 3.5, sizeUnit: 'ACRE', cropStage: 'vegetative',
    plantedAt: '2026-03-05T12:00:00Z',
  };

  it('returns all-false for untouched form', () => {
    const c = classifyFarmChanges(farmToEditForm(farm), farm);
    expect(c.hasChanges).toBe(false);
    expect(c.types).toEqual([]);
  });

  it('detects crop change', () => {
    const c = classifyFarmChanges({ ...farmToEditForm(farm), cropType: 'RICE' }, farm);
    expect(c.cropChanged).toBe(true);
    expect(c.types).toEqual(['crop']);
  });

  it('detects location change (country)', () => {
    const c = classifyFarmChanges({ ...farmToEditForm(farm), country: 'India' }, farm);
    expect(c.locationChanged).toBe(true);
    expect(c.types).toEqual(['location']);
  });

  it('detects location change (sub-region only)', () => {
    const c = classifyFarmChanges({ ...farmToEditForm(farm), location: 'Volta' }, farm);
    expect(c.locationChanged).toBe(true);
  });

  it('detects size change (value)', () => {
    const c = classifyFarmChanges({ ...farmToEditForm(farm), size: '10' }, farm);
    expect(c.sizeChanged).toBe(true);
  });

  it('detects size change (unit)', () => {
    const c = classifyFarmChanges({ ...farmToEditForm(farm), sizeUnit: 'HECTARE' }, farm);
    expect(c.sizeChanged).toBe(true);
  });

  it('detects stage change', () => {
    const c = classifyFarmChanges({ ...farmToEditForm(farm), cropStage: 'flowering' }, farm);
    expect(c.stageChanged).toBe(true);
  });

  it('detects plantedAt change', () => {
    const c = classifyFarmChanges({ ...farmToEditForm(farm), plantedAt: '2026-04-20' }, farm);
    expect(c.plantedAtChanged).toBe(true);
  });

  it('detects multiple simultaneous changes', () => {
    const c = classifyFarmChanges(
      { ...farmToEditForm(farm), cropType: 'RICE', country: 'India' }, farm);
    expect(c.cropChanged).toBe(true);
    expect(c.locationChanged).toBe(true);
    expect(c.types.sort()).toEqual(['crop', 'location']);
  });

  it('is frozen — caller cannot mutate the result', () => {
    const c = classifyFarmChanges(farmToEditForm(farm), farm);
    expect(Object.isFrozen(c)).toBe(true);
  });
});

// ─── buildRecomputeIntent ────────────────────────────────────
describe('buildRecomputeIntent — rule mapping (§8)', () => {
  it('noop when nothing changed', () => {
    const intent = buildRecomputeIntent({});
    expect(intent.rule).toBe('noop');
    expect(intent.shouldRefreshFarms).toBe(false);
    expect(intent.shouldRefreshHomeExperience).toBe(false);
    expect(intent.shouldRefreshTaskEngine).toBe(false);
  });

  it('crop-only → refresh task engine + home', () => {
    const intent = buildRecomputeIntent({
      cropChanged: true, types: ['crop'],
    });
    expect(intent.rule).toBe('crop_only');
    expect(intent.shouldRefreshTaskEngine).toBe(true);
    expect(intent.shouldRefreshHomeExperience).toBe(true);
    expect(intent.shouldRefreshWeather).toBe(false);
    expect(intent.shouldRefreshRegionProfile).toBe(false);
  });

  it('location-only → refresh weather + region + home', () => {
    const intent = buildRecomputeIntent({
      locationChanged: true, types: ['location'],
    });
    expect(intent.rule).toBe('location_only');
    expect(intent.shouldRefreshWeather).toBe(true);
    expect(intent.shouldRefreshRegionProfile).toBe(true);
    expect(intent.shouldRefreshHomeExperience).toBe(true);
    expect(intent.shouldRefreshTaskEngine).toBe(false);
  });

  it('stage-only → re-resolve task, no weather', () => {
    const intent = buildRecomputeIntent({ stageChanged: true, types: ['stage'] });
    expect(intent.rule).toBe('stage_only');
    expect(intent.shouldRefreshTaskEngine).toBe(true);
    expect(intent.shouldRefreshWeather).toBe(false);
  });

  it('crop + location → combined rule', () => {
    const intent = buildRecomputeIntent({
      cropChanged: true, locationChanged: true, types: ['crop', 'location'],
    });
    expect(intent.rule).toBe('crop_and_location');
    expect(intent.shouldRefreshWeather).toBe(true);
    expect(intent.shouldRefreshTaskEngine).toBe(true);
  });

  it('size-only → metadata only, no task restart (§8.C)', () => {
    const intent = buildRecomputeIntent({ sizeChanged: true, types: ['size'] });
    expect(intent.rule).toBe('metadata_only');
    expect(intent.shouldRefreshTaskEngine).toBe(false);
    expect(intent.shouldRefreshHomeExperience).toBe(false);
    expect(intent.shouldLogAnalyticsOnly).toBe(true);
  });

  it('name-only → metadata only', () => {
    const intent = buildRecomputeIntent({ nameChanged: true, types: ['name'] });
    expect(intent.rule).toBe('metadata_only');
    expect(intent.shouldLogAnalyticsOnly).toBe(true);
  });

  it('planted-date change triggers task engine + home', () => {
    const intent = buildRecomputeIntent({ plantedAtChanged: true, types: ['plantedAt'] });
    expect(intent.rule).toBe('planted_date_only');
    expect(intent.shouldRefreshTaskEngine).toBe(true);
    expect(intent.shouldRefreshHomeExperience).toBe(true);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(buildRecomputeIntent({}))).toBe(true);
  });
});

// ─── analyticsPayloadForChanges ──────────────────────────────
describe('analyticsPayloadForChanges', () => {
  it('mirrors the change flags + patch field list', () => {
    const payload = analyticsPayloadForChanges(
      { cropChanged: true, locationChanged: true, types: ['crop', 'location'] },
      { cropType: 'RICE', country: 'India' },
    );
    expect(payload.types.sort()).toEqual(['crop', 'location']);
    expect(payload.cropChanged).toBe(true);
    expect(payload.locationChanged).toBe(true);
    expect(payload.fieldsInPatch.sort()).toEqual(['country', 'cropType']);
  });

  it('safe on empty / malformed inputs', () => {
    expect(analyticsPayloadForChanges()).toBeTruthy();
    expect(analyticsPayloadForChanges(null, null)).toBeTruthy();
    expect(analyticsPayloadForChanges({}, {}).types).toEqual([]);
  });
});

// ─── §13 dev assertions ──────────────────────────────────────
describe('§13 dev assertions', () => {
  let warnSpy;
  beforeEach(() => {
    globalThis.window = globalThis.window || {};
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => { warnSpy.mockRestore(); });

  it('assertRecomputeTriggered silent when intent wants no refresh', () => {
    assertRecomputeTriggered({ shouldRefreshHomeExperience: false }, false);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('assertRecomputeTriggered silent when refresh happened', () => {
    assertRecomputeTriggered({ shouldRefreshHomeExperience: true }, true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('assertRecomputeTriggered warns when refresh needed but missing', () => {
    assertRecomputeTriggered({ shouldRefreshHomeExperience: true, rule: 'crop_only' }, false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('assertFarmerTypeNotMutated silent when unchanged', () => {
    assertFarmerTypeNotMutated('new', 'new');
    assertFarmerTypeNotMutated(null, null);
    assertFarmerTypeNotMutated(undefined, undefined);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('assertFarmerTypeNotMutated warns when mutated', () => {
    assertFarmerTypeNotMutated('new', 'existing');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('assertHomeRefreshedAfterEdit silent when intent does not require rebuild', () => {
    assertHomeRefreshedAfterEdit({ shouldRefreshHomeExperience: false }, false);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('assertHomeRefreshedAfterEdit silent when rebuild happened', () => {
    assertHomeRefreshedAfterEdit({ shouldRefreshHomeExperience: true }, true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('assertHomeRefreshedAfterEdit warns when required rebuild was skipped', () => {
    assertHomeRefreshedAfterEdit({ shouldRefreshHomeExperience: true, rule: 'crop_only' }, false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
