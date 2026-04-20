/**
 * interventionEngines.test.js — contract for:
 *   server/src/modules/ngoAdmin/interventionEngine.js
 *   server/src/modules/ngoAdmin/alertService.js
 *   src/core/farm/taskOverride.js
 */

import { describe, it, expect } from 'vitest';

import interventionPkg from '../../../server/src/modules/ngoAdmin/interventionEngine.js';
const { getIntervention } = interventionPkg;

import alertPkg from '../../../server/src/modules/ngoAdmin/alertService.js';
const { generateAlerts, generateAlertStrings } = alertPkg;

import {
  shouldOverrideTasks, buildEmergencyTaskList,
  maybeOverrideTasks, emergencyHeaderBanner,
  EMERGENCY_TASK_CODES,
} from '../../../src/core/farm/taskOverride.js';

// ─── getIntervention ─────────────────────────────────────────
describe('getIntervention', () => {
  it('high risk → critical with three steps (structured keys)', () => {
    const iv = getIntervention({ risk: 'high' });
    expect(iv.level).toBe('critical');
    expect(iv.actionKey).toBe('intervention.critical.action');
    expect(iv.actionFallback).toBe('Immediate intervention required');
    expect(iv.stepKeys.length).toBe(3);
    expect(iv.stepFallbacks.length).toBe(3);
    expect(iv.stepKeys[0]).toMatch(/^intervention\./);
  });

  it('medium risk → warning with two steps', () => {
    const iv = getIntervention({ risk: 'medium' });
    expect(iv.level).toBe('warning');
    expect(iv.stepKeys.length).toBe(2);
  });

  it('low risk → safe with no steps', () => {
    const iv = getIntervention({ risk: 'low' });
    expect(iv.level).toBe('safe');
    expect(iv.stepKeys).toEqual([]);
  });

  it('critical + planting stage tailors the first step', () => {
    const iv = getIntervention({ risk: 'high', stage: 'planting' });
    expect(iv.stepKeys[0]).toBe('intervention.critical.step.stage_planting');
    expect(iv.stepFallbacks[0]).toMatch(/planting/i);
  });

  it('critical + harvest stage tailors the first step', () => {
    const iv = getIntervention({ risk: 'high', stage: 'harvest' });
    expect(iv.stepKeys[0]).toBe('intervention.critical.step.stage_harvest');
  });

  it('critical + non-sensitive stage keeps the generic first step', () => {
    const iv = getIntervention({ risk: 'high', stage: 'maintain' });
    expect(iv.stepKeys[0]).toBe('intervention.critical.step.inspect_today');
  });

  it('unknown risk → safe (defensive)', () => {
    expect(getIntervention({ risk: 'bogus' }).level).toBe('safe');
    expect(getIntervention({}).level).toBe('safe');
    expect(getIntervention().level).toBe('safe');
  });

  it('returns frozen result with crop + stage passed through', () => {
    const iv = getIntervention({ risk: 'high', crop: 'MAIZE', stage: 'harvest' });
    expect(Object.isFrozen(iv)).toBe(true);
    expect(iv.crop).toBe('MAIZE');
    expect(iv.stage).toBe('harvest');
  });
});

// ─── generateAlerts (server side) ────────────────────────────
describe('generateAlerts (server)', () => {
  it('empty when nothing triggers', () => {
    expect(generateAlerts({ risk: 'low', weather: {} })).toEqual([]);
  });

  it('high risk → critical alert with fallback', () => {
    const a = generateAlerts({ risk: 'high' });
    expect(a.length).toBe(1);
    expect(a[0].severity).toBe('critical');
    expect(a[0].id).toBe('alert.high_risk');
    expect(a[0].fallback).toBe('High risk detected. Take action today.');
  });

  it('rainTomorrow → warning alert', () => {
    const a = generateAlerts({ risk: 'low', weather: { rainTomorrow: true } });
    expect(a[0].id).toBe('alert.rain_tomorrow');
    expect(a[0].severity).toBe('warning');
  });

  it('heavyRainExpected → critical alert', () => {
    const a = generateAlerts({ weather: { heavyRainExpected: true } });
    expect(a[0].severity).toBe('critical');
  });

  it('drought OR dry+tempHigh → warning', () => {
    expect(generateAlerts({ weather: { drought: true } })[0].id)
      .toBe('alert.drought_stress');
    expect(generateAlerts({ weather: { dry: true, tempHigh: true } })[0].id)
      .toBe('alert.drought_stress');
  });

  it('pest risk — high → warning; critical → critical', () => {
    const hi = generateAlerts({ pestRisk: { level: 'high', pest: 'armyworm' } });
    expect(hi[0].severity).toBe('warning');
    expect(hi[0].params.pest).toBe('armyworm');
    const cr = generateAlerts({ pestRisk: { level: 'critical' } });
    expect(cr[0].severity).toBe('critical');
  });

  it('sorts critical → warning', () => {
    const a = generateAlerts({
      risk: 'high', weather: { rainTomorrow: true },
    });
    expect(a[0].severity).toBe('critical');
    expect(a[1].severity).toBe('warning');
  });

  it('dedupes by id', () => {
    // high risk twice via string + object: should only produce one high_risk alert
    const a = generateAlerts({ risk: 'critical' });
    expect(a.filter((x) => x.id === 'alert.high_risk').length).toBe(1);
  });

  it('generateAlertStrings returns spec-compatible plain English', () => {
    const ss = generateAlertStrings({ risk: 'high', weather: { rainTomorrow: true } });
    expect(ss[0]).toMatch(/High risk/i);
    expect(ss[1]).toMatch(/Rain expected/i);
  });

  it('every alert entry is frozen with a stable id', () => {
    const a = generateAlerts({ risk: 'high' });
    for (const x of a) {
      expect(Object.isFrozen(x)).toBe(true);
      expect(typeof x.id).toBe('string');
    }
  });
});

// ─── taskOverride (farmer side) ──────────────────────────────
describe('taskOverride', () => {
  it('shouldOverrideTasks true for high / critical', () => {
    expect(shouldOverrideTasks('high')).toBe(true);
    expect(shouldOverrideTasks('critical')).toBe(true);
    expect(shouldOverrideTasks({ level: 'high' })).toBe(true);
  });

  it('shouldOverrideTasks false for low / medium / null', () => {
    expect(shouldOverrideTasks('low')).toBe(false);
    expect(shouldOverrideTasks('medium')).toBe(false);
    expect(shouldOverrideTasks(null)).toBe(false);
    expect(shouldOverrideTasks(undefined)).toBe(false);
  });

  it('buildEmergencyTaskList returns primary + supporting', () => {
    const list = buildEmergencyTaskList({ farmId: 'F1' });
    expect(list.primary.isPrimary).toBe(true);
    expect(list.supporting.length).toBe(2);
    expect(list.all.length).toBe(3);
  });

  it('every emergency task carries structured titleKey + fallback', () => {
    const { all } = buildEmergencyTaskList({});
    for (const t of all) {
      expect(t.titleKey).toMatch(/^task\.emergency\./);
      expect(typeof t.titleFallback).toBe('string');
      expect(t.emergency).toBe(true);
      expect(Object.isFrozen(t)).toBe(true);
    }
  });

  it('primary is the highest priority emergency task', () => {
    const { primary } = buildEmergencyTaskList({});
    expect(primary.code).toBe('inspect_farm_immediately');
  });

  it('maybeOverrideTasks returns input unchanged for low risk', () => {
    const normal = { primary: { id: 'x', isPrimary: true }, supporting: [], all: [{ id: 'x' }] };
    expect(maybeOverrideTasks(normal, 'low')).toBe(normal);
  });

  it('maybeOverrideTasks swaps in emergency list for high risk', () => {
    const normal = { primary: null, supporting: [], all: [] };
    const out = maybeOverrideTasks(normal, 'high', { farmId: 'F1' });
    expect(out.primary.emergency).toBe(true);
  });

  it('emergencyHeaderBanner emits critical LocalizedPayload', () => {
    const b = emergencyHeaderBanner();
    expect(b.key).toBe('farmer.banner.task_override.emergency');
    expect(b.severity).toBe('critical');
    expect(typeof b.fallback).toBe('string');
    expect(Object.isFrozen(b)).toBe(true);
  });

  it('EMERGENCY_TASK_CODES is stable and frozen', () => {
    expect(EMERGENCY_TASK_CODES).toEqual([
      'inspect_farm_immediately',
      'check_water_levels',
      'follow_emergency_recommendations',
    ]);
    expect(Object.isFrozen(EMERGENCY_TASK_CODES)).toBe(true);
  });
});
