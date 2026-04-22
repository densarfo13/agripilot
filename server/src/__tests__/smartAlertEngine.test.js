/**
 * smartAlertEngine.test.js — locks the Smart Alerts engine contract.
 *
 * The engine is pure composition over existing engines. These tests
 * assert rule-by-rule behaviour + the overall shape contract
 * (action / reason / consequence always populated; IDs stable;
 * dedup by id; priority ordering).
 */

import { describe, it, expect } from 'vitest';

import {
  generateSmartAlerts,
  _internal,
} from '../../../src/lib/intelligence/smartAlertEngine.js';

function farm(overrides = {}) {
  return {
    id:       'farm-1',
    farmerId: 'farmer-1',
    crop:     'maize',
    cropStage:'vegetative',
    country:  'GH',
    farmType: 'small_farm',
    farmSize: 1,
    sizeUnit: 'hectare',
    normalizedAreaSqm: 10000,
    plantingDate: '2026-03-15',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// Shape contract
// ═══════════════════════════════════════════════════════════════
describe('generateSmartAlerts — shape', () => {
  it('returns a frozen array', () => {
    const a = generateSmartAlerts({ farm: farm() });
    expect(Array.isArray(a)).toBe(true);
    expect(Object.isFrozen(a)).toBe(true);
  });

  it('returns [] when no farm supplied', () => {
    expect(generateSmartAlerts({})).toEqual([]);
    expect(generateSmartAlerts({ farm: null })).toEqual([]);
  });

  it('every alert has action + reason + consequence + stable id', () => {
    const alerts = generateSmartAlerts({
      farm: farm({ cropStage: 'tasseling' }),
      weather: { status: 'excessive_heat' },
      date: '2026-05-15',
    });
    expect(alerts.length).toBeGreaterThan(0);
    for (const a of alerts) {
      expect(a.id).toBeTruthy();
      expect(a.action).toBeTruthy();
      expect(a.reason).toBeTruthy();
      expect(a.consequence).toBeTruthy();
      expect(['high', 'medium', 'low']).toContain(a.priority);
      expect(a.triggeredBy.rule).toBeTruthy();
    }
  });

  it('alerts are deterministic for identical inputs', () => {
    const a1 = generateSmartAlerts({
      farm: farm(), weather: { status: 'low_rain' }, date: '2026-05-15',
    });
    const a2 = generateSmartAlerts({
      farm: farm(), weather: { status: 'low_rain' }, date: '2026-05-15',
    });
    expect(a1.map((x) => x.id)).toEqual(a2.map((x) => x.id));
  });

  it('alerts are sorted by priority high → low', () => {
    const alerts = generateSmartAlerts({
      farm: farm({ cropStage: 'tasseling' }),
      weather: { status: 'low_rain' },
      date: '2026-05-15',
    });
    const weights = alerts.map((a) => _internal.PRIORITY_WEIGHT[a.priority]);
    for (let i = 1; i < weights.length; i += 1) {
      expect(weights[i - 1]).toBeGreaterThanOrEqual(weights[i]);
    }
  });

  it('dedups alerts with the same id', () => {
    // Fire weather + missed task at the same time; each alert has a
    // distinct rule → distinct id. Count of unique ids = count.
    const alerts = generateSmartAlerts({
      farm: farm(), weather: { status: 'low_rain' }, date: '2026-05-15',
    });
    const ids = new Set(alerts.map((a) => a.id));
    expect(ids.size).toBe(alerts.length);
  });
});

// ═══════════════════════════════════════════════════════════════
// Weather rule
// ═══════════════════════════════════════════════════════════════
describe('weather rules', () => {
  it('rain_expected → delay fertilizer alert (high priority)', () => {
    const alerts = generateSmartAlerts({
      farm: farm(), weather: { status: 'rain_expected' }, date: '2026-05-15',
    });
    const a = alerts.find((x) => x.triggeredBy.rule === 'weather.rain.delay_fertilizer');
    expect(a).toBeTruthy();
    expect(a.priority).toBe('high');
    expect(a.action).toMatch(/delay fertilizer/i);
  });

  it('low_rain → irrigate alert', () => {
    const alerts = generateSmartAlerts({
      farm: farm(), weather: { status: 'low_rain' }, date: '2026-05-15',
    });
    expect(alerts.some((a) => a.triggeredBy.rule === 'weather.dry.irrigate')).toBe(true);
  });

  it('excessive_heat at flowering → high priority (yield-critical)', () => {
    const hot = generateSmartAlerts({
      farm: farm({ cropStage: 'flowering' }),
      weather: { status: 'excessive_heat' }, date: '2026-05-15',
    });
    const a = hot.find((x) => x.triggeredBy.rule === 'weather.heat.water_morning');
    expect(a.priority).toBe('high');

    // At vegetative the same weather is medium only.
    const veg = generateSmartAlerts({
      farm: farm({ cropStage: 'vegetative' }),
      weather: { status: 'excessive_heat' }, date: '2026-05-15',
    });
    const b = veg.find((x) => x.triggeredBy.rule === 'weather.heat.water_morning');
    expect(b.priority).toBe('medium');
  });

  it('no weather → no weather alerts', () => {
    const alerts = generateSmartAlerts({ farm: farm(), date: '2026-05-15' });
    expect(alerts.some((a) => a.type === 'weather')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// Planting-window rule
// ═══════════════════════════════════════════════════════════════
describe('planting-window rule', () => {
  it('GH maize at planting stage in November → window closed alert', () => {
    const alerts = generateSmartAlerts({
      farm: farm({ cropStage: 'planting' }),
      date: '2026-11-15',
    });
    const a = alerts.find((x) => x.triggeredBy.rule === 'planting.window_closing');
    expect(a).toBeTruthy();
    expect(a.priority).toBe('high');
  });

  it('GH maize at planting in April → NO alert (within window)', () => {
    const alerts = generateSmartAlerts({
      farm: farm({ cropStage: 'planting' }),
      date: '2026-04-15',
    });
    expect(alerts.some((a) => a.triggeredBy.rule === 'planting.window_closing'))
      .toBe(false);
  });

  it('post-planting stage → rule does not fire', () => {
    const alerts = generateSmartAlerts({
      farm: farm({ cropStage: 'vegetative' }),
      date: '2026-11-15',
    });
    expect(alerts.some((a) => a.triggeredBy.rule === 'planting.window_closing'))
      .toBe(false);
  });

  it('parseMonths handles ranges + multi-windows', () => {
    const m1 = _internal.parseMonths('Apr–Jun');
    expect(m1.has(4) && m1.has(5) && m1.has(6)).toBe(true);
    const m2 = _internal.parseMonths('Mar–May / Aug–Sep');
    expect(m2.has(3) && m2.has(5) && m2.has(8) && m2.has(9)).toBe(true);
    expect(_internal.parseMonths('').size).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Pest-risk rule
// ═══════════════════════════════════════════════════════════════
describe('pest-risk rule', () => {
  it('cassava + tropical + wet + bulking → high-severity pest alert', () => {
    const alerts = generateSmartAlerts({
      farm: farm({ crop: 'cassava', cropStage: 'bulking' }),
      climate: 'tropical', season: 'wet',
      date: '2026-06-15',
    });
    const pestAlerts = alerts.filter((a) => a.triggeredBy.rule === 'pest.high_severity');
    expect(pestAlerts.length).toBeGreaterThan(0);
    for (const a of pestAlerts) expect(a.priority).toBe('high');
  });

  it('only high-severity patterns are promoted to alerts (medium stays in Farm Plan)', () => {
    const alerts = generateSmartAlerts({
      farm: farm({ crop: 'onion', cropStage: 'vegetative' }),
      climate: 'tropical', season: 'dry',
      date: '2026-11-15',
    });
    const pest = alerts.filter((a) => a.triggeredBy.rule === 'pest.high_severity');
    for (const a of pest) expect(a.triggeredBy.signals.severity).toBe('high');
  });
});

// ═══════════════════════════════════════════════════════════════
// Yield-impact rule
// ═══════════════════════════════════════════════════════════════
describe('yield-impact rule', () => {
  it('low_rain + growing crop → yield-drag alert', () => {
    const alerts = generateSmartAlerts({
      farm: farm(), weather: { status: 'low_rain' }, date: '2026-05-15',
    });
    const a = alerts.find((x) => x.triggeredBy.rule === 'yield.weather_drag');
    expect(a).toBeTruthy();
    expect(a.type).toBe('yield');
    expect(a.priority).toBe('high');
  });

  it('ok weather → no yield-drag alert', () => {
    const alerts = generateSmartAlerts({
      farm: farm(), weather: { status: 'ok' }, date: '2026-05-15',
    });
    expect(alerts.some((a) => a.triggeredBy.rule === 'yield.weather_drag'))
      .toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// Stage-transition rule
// ═══════════════════════════════════════════════════════════════
describe('stage-transition rule', () => {
  it('fires when nextStage is ≤3 days away', () => {
    // Maize lifecycle: planting(7) + germination(10) + vegetative(30)
    //   = 47 days to end of vegetative. A planting date 45 days
    //   before `date` puts us 2 days away from tasseling.
    const alerts = generateSmartAlerts({
      farm: farm({ plantingDate: '2026-03-15' }),
      date: '2026-04-29', // 45 days elapsed → 2 days remaining
    });
    const a = alerts.find((x) => x.triggeredBy.rule === 'stage.transition');
    expect(a).toBeTruthy();
    expect(a.triggeredBy.signals.daysUntil).toBeLessThanOrEqual(3);
  });

  it('does NOT fire when the stage has 10+ days left', () => {
    // Planting 10 days ago puts us at day 10 — squarely in the
    // germination stage (ends day 17 in maize lifecycle), so
    // ~7 days remain in germination which is >3 → no alert.
    const alerts = generateSmartAlerts({
      farm: farm({ plantingDate: '2026-04-21' }),
      date: '2026-05-01',
    });
    expect(alerts.some((a) => a.triggeredBy.rule === 'stage.transition'))
      .toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// Missed-task rule
// ═══════════════════════════════════════════════════════════════
describe('missed-task rule', () => {
  it('does nothing when no completedTaskIds set supplied', () => {
    const alerts = generateSmartAlerts({ farm: farm(), date: '2026-05-15' });
    expect(alerts.some((a) => a.triggeredBy.rule === 'task.missed_critical'))
      .toBe(false);
  });

  it('fires for high-priority tasks missing from completedTaskIds after 24h', () => {
    // Real-now minus 30h so the freshness gate lets us through.
    // ctx.date = real-now so the engine's age math matches.
    const now = new Date();
    const oldPlan = {
      now: [Object.freeze({
        id: 't1', templateId: 'mid.scout_pests',
        type: 'pest', priority: 'high',
        title: 'Scout for pests', description: 'd', why: 'w',
      })],
      thisWeek: [], comingUp: [], riskWatch: [], recommendations: [],
      assumptions: [], confidence: 'medium',
      generatedFor: { farmId: 'farm-1', crop: 'maize', stage: 'vegetative' },
      generatedAt:  new Date(now.getTime() - 30 * 60 * 60 * 1000).toISOString(),
    };
    const alerts = generateSmartAlerts({
      farm: farm(),
      plan: oldPlan,
      completedTaskIds: new Set(),
      date: now,
    });
    const a = alerts.find((x) => x.triggeredBy.rule === 'task.missed_critical');
    expect(a).toBeTruthy();
    expect(a.triggeredBy.signals.templateId).toBe('mid.scout_pests');
  });

  it('suppresses alert when the task is in completedTaskIds', () => {
    const now = new Date();
    const oldPlan = {
      now: [Object.freeze({
        id: 't1', templateId: 'mid.scout_pests', type: 'pest',
        priority: 'high', title: 'x', description: '', why: '',
      })],
      thisWeek: [], comingUp: [], riskWatch: [], recommendations: [],
      assumptions: [], confidence: 'medium',
      generatedFor: { farmId: 'farm-1' },
      generatedAt:  new Date(now.getTime() - 30 * 60 * 60 * 1000).toISOString(),
    };
    const alerts = generateSmartAlerts({
      farm: farm(), plan: oldPlan,
      completedTaskIds: new Set(['mid.scout_pests']),
      date: now,
    });
    expect(alerts.some((a) => a.triggeredBy.rule === 'task.missed_critical'))
      .toBe(false);
  });

  it('does NOT fire for fresh plans (<24h old)', () => {
    // The "missed task" check compares plan.generatedAt against the
    // engine's `now` (derived from ctx.date). Pass a Date object for
    // ctx.date that matches real-now so the plan looks fresh.
    const now = new Date();
    const freshPlan = {
      now: [Object.freeze({
        id: 't1', templateId: 'mid.scout_pests', type: 'pest',
        priority: 'high', title: 'x', description: '', why: '',
      })],
      thisWeek: [], comingUp: [], riskWatch: [], recommendations: [],
      assumptions: [], confidence: 'medium',
      generatedFor: { farmId: 'farm-1' },
      generatedAt:  now.toISOString(),
    };
    const alerts = generateSmartAlerts({
      farm: farm(), plan: freshPlan,
      completedTaskIds: new Set(),
      date: now,
    });
    expect(alerts.some((a) => a.triggeredBy.rule === 'task.missed_critical'))
      .toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// ID stability
// ═══════════════════════════════════════════════════════════════
describe('alert id stability', () => {
  it('same (farm, date, rule) produces the same id', () => {
    const a1 = generateSmartAlerts({
      farm: farm(), weather: { status: 'low_rain' }, date: '2026-05-15',
    });
    const a2 = generateSmartAlerts({
      farm: farm(), weather: { status: 'low_rain' }, date: '2026-05-15',
    });
    const id1 = a1.find((x) => x.triggeredBy.rule === 'weather.dry.irrigate').id;
    const id2 = a2.find((x) => x.triggeredBy.rule === 'weather.dry.irrigate').id;
    expect(id1).toBe(id2);
  });

  it('different dates produce different ids for the same rule', () => {
    const a1 = generateSmartAlerts({
      farm: farm(), weather: { status: 'low_rain' }, date: '2026-05-15',
    });
    const a2 = generateSmartAlerts({
      farm: farm(), weather: { status: 'low_rain' }, date: '2026-05-16',
    });
    const id1 = a1.find((x) => x.triggeredBy.rule === 'weather.dry.irrigate').id;
    const id2 = a2.find((x) => x.triggeredBy.rule === 'weather.dry.irrigate').id;
    expect(id1).not.toBe(id2);
  });
});
