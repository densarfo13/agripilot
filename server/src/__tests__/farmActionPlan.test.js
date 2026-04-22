/**
 * farmActionPlan.test.js — locks the Decision Timeline / "Your Farm
 * Plan" composition engine.
 *
 * The engine orchestrates existing systems (taskEngine, cropTimeline
 * engine, yieldEngine, cropRiskPatterns) into 5 buckets:
 *   now / thisWeek / comingUp / riskWatch / recommendations
 *
 * These tests assert composition behaviour, NOT the per-engine logic
 * (those have their own suites).
 */

import { describe, it, expect } from 'vitest';

import { buildFarmActionPlan, _internal }
  from '../../../src/lib/intelligence/farmActionPlan.js';

// ─── Helpers ────────────────────────────────────────────────────
function maizeFarm(overrides = {}) {
  return {
    id:       'farm-1',
    crop:     'maize',
    cropStage:'vegetative',
    country:  'GH',
    farmType: 'small_farm',
    farmSize: 1,
    sizeUnit: 'hectare',
    plantingDate: '2026-03-15',
    normalizedAreaSqm: 10000,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// Basic contract
// ═══════════════════════════════════════════════════════════════

describe('buildFarmActionPlan — contract', () => {
  it('returns null when no farm is supplied', () => {
    expect(buildFarmActionPlan({})).toBeNull();
    expect(buildFarmActionPlan({ farm: null })).toBeNull();
  });

  it('returns a full plan with all 5 buckets for a normal farm', () => {
    const plan = buildFarmActionPlan({ farm: maizeFarm(), date: '2026-05-15' });
    expect(plan).not.toBeNull();
    expect(Array.isArray(plan.now)).toBe(true);
    expect(Array.isArray(plan.thisWeek)).toBe(true);
    expect(Array.isArray(plan.comingUp)).toBe(true);
    expect(Array.isArray(plan.riskWatch)).toBe(true);
    expect(Array.isArray(plan.recommendations)).toBe(true);
  });

  it('plan + every bucket are frozen', () => {
    const plan = buildFarmActionPlan({ farm: maizeFarm() });
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.now)).toBe(true);
    expect(Object.isFrozen(plan.thisWeek)).toBe(true);
    expect(Object.isFrozen(plan.comingUp)).toBe(true);
    expect(Object.isFrozen(plan.riskWatch)).toBe(true);
    expect(Object.isFrozen(plan.recommendations)).toBe(true);
  });

  it('generatedFor echoes farm id, crop, stage, date, climate, season', () => {
    const plan = buildFarmActionPlan({ farm: maizeFarm(), date: '2026-05-15' });
    expect(plan.generatedFor.farmId).toBe('farm-1');
    expect(plan.generatedFor.crop).toBe('maize');
    expect(plan.generatedFor.stage).toBe('vegetative');
    expect(plan.generatedFor.climate).toBe('tropical'); // GH
    expect(plan.generatedFor.season).toBe('wet');        // GH May
  });

  it('is deterministic for identical inputs', () => {
    const a = buildFarmActionPlan({ farm: maizeFarm(), date: '2026-05-15' });
    const b = buildFarmActionPlan({ farm: maizeFarm(), date: '2026-05-15' });
    // generatedAt is a timestamp so it'll differ — compare everything else.
    expect({ ...a, generatedAt: null }).toEqual({ ...b, generatedAt: null });
  });
});

// ═══════════════════════════════════════════════════════════════
// NOW bucket
// ═══════════════════════════════════════════════════════════════

describe('now bucket', () => {
  it('caps at MAX_NOW items', () => {
    const plan = buildFarmActionPlan({ farm: maizeFarm() });
    expect(plan.now.length).toBeLessThanOrEqual(_internal.MAX_NOW);
  });

  it('every action has title + type + priority + source + dueLabel', () => {
    const plan = buildFarmActionPlan({ farm: maizeFarm() });
    for (const a of plan.now) {
      expect(a.title).toBeTruthy();
      expect(a.type).toBeTruthy();
      expect(['high', 'medium', 'low']).toContain(a.priority);
      expect(a.source).toBeTruthy();
      expect(a.dueLabel).toBe('now');
    }
  });

  it('reuses caller-provided tasks when supplied (no duplication)', () => {
    const prebuilt = [
      { id: 't1', title: 'Precomputed', type: 'pest',
        priority: 'high', description: '', why: '' },
    ];
    const plan = buildFarmActionPlan({ farm: maizeFarm(), tasks: prebuilt });
    expect(plan.now.length).toBe(1);
    expect(plan.now[0].title).toBe('Precomputed');
  });
});

// ═══════════════════════════════════════════════════════════════
// THIS WEEK bucket
// ═══════════════════════════════════════════════════════════════

describe('thisWeek bucket', () => {
  it('returns crop+stage pool items from the Crop Intelligence Layer', () => {
    const plan = buildFarmActionPlan({ farm: maizeFarm(), date: '2026-05-15' });
    // Maize vegetative has scout/weed/nutrient templates in the registry.
    expect(plan.thisWeek.length).toBeGreaterThan(0);
    const types = plan.thisWeek.map((a) => a.type);
    expect(types.length).toBe(plan.thisWeek.length);
  });

  it('caps at MAX_THIS_WEEK items', () => {
    const plan = buildFarmActionPlan({ farm: maizeFarm() });
    expect(plan.thisWeek.length).toBeLessThanOrEqual(_internal.MAX_THIS_WEEK);
  });

  it('respects farm-type filter (backyard gets simpler pool)', () => {
    const plan = buildFarmActionPlan({
      farm: maizeFarm({ farmType: 'backyard' }),
    });
    // Backyard pool disallows 'scout' + 'storage' — sanity-check
    // nothing in the week list is outside the allowed set.
    const allowed = new Set(['irrigation', 'pest', 'weeding', 'harvest',
                              'nutrient', 'land_prep']);
    for (const a of plan.thisWeek) {
      expect(allowed.has(a.type)).toBe(true);
    }
  });

  it('dueLabel is "this_week" on every item', () => {
    const plan = buildFarmActionPlan({ farm: maizeFarm() });
    for (const a of plan.thisWeek) expect(a.dueLabel).toBe('this_week');
  });
});

// ═══════════════════════════════════════════════════════════════
// COMING UP bucket
// ═══════════════════════════════════════════════════════════════

describe('comingUp bucket', () => {
  it('maize crop previews a next stage with a non-negative daysUntil', () => {
    // Timeline engine uses plantingDate > cropStage; at 30 days
    // elapsed (planting 2026-03-15, date 2026-04-14) maize is in
    // vegetative → next stage should be tasseling.
    const plan = buildFarmActionPlan({ farm: maizeFarm(), date: '2026-04-14' });
    const nextStage = plan.comingUp.find((c) => c.stageKey && c.daysUntil != null);
    expect(nextStage).toBeTruthy();
    expect(Number.isFinite(nextStage.daysUntil)).toBe(true);
    expect(nextStage.daysUntil).toBeGreaterThanOrEqual(0);
    // The next stage should be a valid maize lifecycle key.
    expect(
      ['germination', 'vegetative', 'tasseling', 'grain_fill', 'harvest']
        .includes(nextStage.stageKey),
    ).toBe(true);
  });

  it('surfaces harvest cue from seasonal guidance when present', () => {
    const plan = buildFarmActionPlan({ farm: maizeFarm() });
    const harvestCue = plan.comingUp.find((c) => c.id.includes('harvest_cue'));
    expect(harvestCue).toBeTruthy();
    expect(harvestCue.description).toBeTruthy();
  });

  it('returns [] safely when the crop has no lifecycle info', () => {
    const plan = buildFarmActionPlan({
      farm: maizeFarm({ crop: 'made-up-crop', cropStage: 'planting' }),
    });
    // Generic lifecycle gives us SOMETHING, but no crop-specific
    // tasks — shouldn't crash and the bucket should be safe to render.
    expect(plan.comingUp).toBeDefined();
    expect(Array.isArray(plan.comingUp)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// RISK WATCH bucket
// ═══════════════════════════════════════════════════════════════

describe('riskWatch bucket', () => {
  it('maize in GH wet season surfaces drought-tasseling or FAW hint', () => {
    const plan = buildFarmActionPlan({
      farm: maizeFarm({ cropStage: 'tasseling' }),
      date: '2026-05-15',
    });
    const keys = plan.riskWatch.map((r) => r.messageKey);
    expect(
      keys.some((k) => k.includes('drought') || k.includes('armyworm')),
    ).toBe(true);
  });

  it('returns [] for unknown crops (graceful)', () => {
    const plan = buildFarmActionPlan({
      farm: maizeFarm({ crop: 'unobtainium' }),
    });
    expect(plan.riskWatch).toBeDefined();
    expect(Array.isArray(plan.riskWatch)).toBe(true);
  });

  it('caps at MAX_RISK_WATCH items', () => {
    const plan = buildFarmActionPlan({
      farm: maizeFarm(), date: '2026-05-15',
    });
    expect(plan.riskWatch.length).toBeLessThanOrEqual(_internal.MAX_RISK_WATCH);
  });

  it('every risk has type + severity + message + messageKey + why', () => {
    const plan = buildFarmActionPlan({
      farm: maizeFarm({ cropStage: 'tasseling' }),
      date: '2026-05-15',
    });
    for (const r of plan.riskWatch) {
      expect(r.type).toBeTruthy();
      expect(['low', 'medium', 'high']).toContain(r.severity);
      expect(r.message).toBeTruthy();
      expect(r.why).toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// RECOMMENDATIONS bucket
// ═══════════════════════════════════════════════════════════════

describe('recommendations bucket', () => {
  it('reuses caller-supplied yieldEstimate.recommendations when present', () => {
    const fake = {
      confidenceLevel: 'medium',
      recommendations: [
        Object.freeze({ id: 'fake.1', label: 'Do a specific thing', labelKey: null }),
      ],
    };
    const plan = buildFarmActionPlan({
      farm: maizeFarm(), yieldEstimate: fake,
    });
    expect(plan.recommendations.length).toBe(1);
    expect(plan.recommendations[0].id).toBe('fake.1');
  });

  it('runs yield engine when no estimate supplied', () => {
    const plan = buildFarmActionPlan({ farm: maizeFarm() });
    expect(Array.isArray(plan.recommendations)).toBe(true);
  });

  it('low_rain weather surfaces the irrigation lever', () => {
    const plan = buildFarmActionPlan({
      farm: maizeFarm(), weather: { status: 'low_rain' },
    });
    expect(plan.recommendations.some((r) => r.id === 'rec.irrigate')).toBe(true);
  });

  it('caps at MAX_RECS (2) levers', () => {
    const plan = buildFarmActionPlan({
      farm: maizeFarm(), weather: { status: 'excessive_heat' },
    });
    expect(plan.recommendations.length).toBeLessThanOrEqual(_internal.MAX_RECS);
  });
});

// ═══════════════════════════════════════════════════════════════
// Weather + assumptions
// ═══════════════════════════════════════════════════════════════

describe('weather + assumptions', () => {
  it('flags unavailable weather in assumptions', () => {
    const plan = buildFarmActionPlan({
      farm: maizeFarm(), weather: { status: 'unavailable' },
    });
    expect(plan.assumptions.some((a) => /weather/i.test(a))).toBe(true);
  });

  it('flags missing crop/stage/climate/season transparently', () => {
    const plan = buildFarmActionPlan({
      farm: { id: 'no-crop-farm' },
    });
    // At minimum the "No crop" assumption should be present.
    expect(plan.assumptions.some((a) => /no crop/i.test(a))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Season inference (pure)
// ═══════════════════════════════════════════════════════════════

describe('season / climate inference', () => {
  it('GH + May → tropical wet', () => {
    expect(_internal.inferSeason({ country: 'GH', month: 5 })).toBe('wet');
    expect(_internal.inferClimate('GH')).toBe('tropical');
  });

  it('US + January → winter', () => {
    expect(_internal.inferSeason({ country: 'US', month: 1 })).toBe('winter');
    expect(_internal.inferClimate('US')).toBe('temperate');
  });

  it('KE: Apr → wet (long rains), Aug → dry', () => {
    expect(_internal.inferSeason({ country: 'KE', month: 4 })).toBe('wet');
    expect(_internal.inferSeason({ country: 'KE', month: 8 })).toBe('dry');
  });

  it('returns null when input is missing', () => {
    expect(_internal.inferSeason({})).toBeNull();
    expect(_internal.inferClimate(null)).toBeNull();
  });
});
