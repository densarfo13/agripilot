/**
 * harvestSystem.test.js — locks the Harvest Detection + Completion
 * contract (spec §14, all 12 scenarios):
 *
 *   1. timeline reaching final stage moves crop into harvest
 *   2. manual harvest override is respected
 *   3. harvest tasks appear when crop is harvest-ready
 *   4. recordHarvest saves correctly
 *   5. valueEstimate is produced when price data exists
 *   6. cycle state becomes 'completed' after recording
 *   7. completed cycle no longer shows growth tasks
 *   8. next-step guidance appears after harvest
 *   9. old farms without harvest data still work
 *  10. language-keyed copy (harvest.*) is present on every branch
 *  11. long-absence farmer sees harvest_ready on return
 *  12. no crashes on missing plantingDate / missing farm
 */

import { describe, it, expect, beforeEach } from 'vitest';

function installMemoryStorage() {
  const store = new Map();
  const mem = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i) => Array.from(store.keys())[i] || null,
    get length() { return store.size; },
  };
  globalThis.window = globalThis.window || {};
  globalThis.window.localStorage = mem;
  return mem;
}

import { detectHarvestState } from '../../../src/lib/harvest/harvestDetectionEngine.js';
import { getCropCycleState }  from '../../../src/lib/harvest/cropCycleCompletionEngine.js';
import { getHarvestTasks }    from '../../../src/lib/harvest/harvestTaskEngine.js';
import { getHarvestSummary }  from '../../../src/lib/harvest/harvestSummaryEngine.js';
import {
  recordHarvest, listHarvests, getLatestHarvest, HARVEST_UNITS,
} from '../../../src/lib/harvest/harvestRecordStore.js';
import { generateDailyTasks } from '../../../src/lib/dailyTasks/taskEngine.js';
import { detectMilestones }   from '../../../src/lib/progress/milestoneEngine.js';

function isoAgo(days) { return new Date(Date.now() - days * 86400000).toISOString(); }

beforeEach(() => { installMemoryStorage(); });

// ─── Detection ───────────────────────────────────────────────────
describe('detectHarvestState', () => {
  it('scenario 1 — timeline reaching final stage → harvest_ready', () => {
    // maize total = 7+10+30+14+30+14 = 105 days; day 100 is inside
    // the harvest stage (starts at 91).
    const r = detectHarvestState({
      farm: { id: 'f1', crop: 'maize', plantingDate: isoAgo(100) },
    });
    expect(r.cycleState).toBe('harvest_ready');
    expect(r.harvestReady).toBe(true);
    expect(r.currentStage).toBe('harvest');
  });

  it('scenario 2 — manual harvest override wins over early planting date', () => {
    const r = detectHarvestState({
      farm: {
        id: 'f1', crop: 'cassava',
        plantingDate: isoAgo(30),          // would be establishment
        manualStageOverride: 'harvest',
      },
    });
    expect(r.harvestReady).toBe(true);
    expect(r.cycleState).toBe('harvest_ready');
    expect(r.why[0].tag).toBe('manual_override');
  });

  it('detects approaching transition (not yet harvest-ready)', () => {
    // maize tasseling is day 47-61; day 60 has 1 day left → imminent,
    // but nextStage = grain_fill, not harvest.
    const r = detectHarvestState({
      farm: { id: 'f1', crop: 'maize', plantingDate: isoAgo(60) },
    });
    expect(r.harvestReady).toBe(false);
    // Harvest is 2 stages away — not the imminent transition we flag.
    expect(r.harvestApproaching).toBe(false);
  });

  it('detects harvest approaching when nextStage === harvest', () => {
    // maize grain_fill day 61-91; day 89 has 2 days left, next=harvest.
    const r = detectHarvestState({
      farm: { id: 'f1', crop: 'maize', plantingDate: isoAgo(89) },
    });
    expect(r.harvestApproaching).toBe(true);
    expect(r.cycleState).toBe('active');
  });

  it('scenario 11 — long absence → overshoot → harvest_ready with daysPastExpectedHarvest', () => {
    // maize total = 105; day 200 is 95 days past.
    const r = detectHarvestState({
      farm: { id: 'f1', crop: 'maize', plantingDate: isoAgo(200) },
    });
    expect(r.harvestReady).toBe(true);
    expect(r.daysPastExpectedHarvest).toBeGreaterThan(0);
  });

  it('scenario 9 — old farm without harvest data → active, no crash', () => {
    const r = detectHarvestState({
      farm: { id: 'legacy', crop: 'maize' },   // no plantingDate, no records
    });
    expect(r).not.toBeNull();
    expect(r.cycleState).toBe('active');
    expect(r.harvestReady).toBe(false);
  });

  it('scenario 12 — no farm → null; no crop → safe active state', () => {
    expect(detectHarvestState({ farm: null })).toBeNull();
    const r = detectHarvestState({ farm: { id: 'x' } });
    expect(r.cycleState).toBe('active');
    expect(r.why[0].tag).toBe('no_crop');
  });
});

// ─── Recording + completion ─────────────────────────────────────
describe('recordHarvest + completion', () => {
  it('scenario 4 — recordHarvest saves with normalised fields', () => {
    const rec = recordHarvest({
      farmId: 'f1', crop: 'Maize',
      harvestedAmount: 42.5, harvestedUnit: 'KG',
      plantingDate: isoAgo(100),
    });
    expect(rec).not.toBeNull();
    expect(rec.farmId).toBe('f1');
    expect(rec.crop).toBe('maize');
    expect(rec.harvestedAmount).toBe(42.5);
    expect(rec.harvestedUnit).toBe('kg');
    expect(rec.cycleCompletedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(listHarvests('f1').length).toBe(1);
  });

  it('rejects non-positive amounts + unknown units safely', () => {
    expect(recordHarvest({ farmId: 'f1', harvestedAmount: 0 })).toBeNull();
    expect(recordHarvest({ farmId: 'f1', harvestedAmount: -1 })).toBeNull();
    expect(recordHarvest({ farmId: 'f1', harvestedAmount: 10,
      harvestedUnit: 'gallons' })).toBeNull();
    expect(recordHarvest({ farmId: null, harvestedAmount: 10 })).toBeNull();
  });

  it('scenario 6 — cycle state becomes "completed" after recording', () => {
    const farm = { id: 'f1', crop: 'maize', plantingDate: isoAgo(100) };
    expect(detectHarvestState({ farm }).cycleState).toBe('harvest_ready');
    recordHarvest({
      farmId: 'f1', crop: 'maize', harvestedAmount: 50,
      harvestedUnit: 'bags', plantingDate: farm.plantingDate,
    });
    const after = detectHarvestState({ farm });
    expect(after.cycleState).toBe('completed');
    expect(after.latestHarvest.harvestedAmount).toBe(50);
  });

  it('getLatestHarvest returns the newest record (append-only)', () => {
    recordHarvest({ farmId: 'f1', crop: 'maize', harvestedAmount: 10, harvestedUnit: 'kg' });
    recordHarvest({ farmId: 'f1', crop: 'maize', harvestedAmount: 20, harvestedUnit: 'kg' });
    expect(getLatestHarvest('f1').harvestedAmount).toBe(20);
  });
});

// ─── Summary + value estimate ───────────────────────────────────
describe('getHarvestSummary', () => {
  it('scenario 5 — value estimate is produced when price data exists', () => {
    const record = {
      id: 'r1', farmId: 'f1', crop: 'maize',
      harvestedAmount: 500, harvestedUnit: 'kg',
      harvestedAt: new Date().toISOString(),
      plantingDate: null, cycleCompletedAt: new Date().toISOString(),
    };
    const s = getHarvestSummary({ record, farm: { crop: 'maize', countryCode: 'NG' } });
    expect(s.valueEstimate).not.toBeNull();
    expect(s.valueEstimate.currency).toBe('NGN');
    expect(s.valueEstimate.lowValue).toBeGreaterThan(0);
    expect(s.cropCycleCompleted).toBe(true);
  });

  it('unit → kg conversion works for bags (50kg) and tons', () => {
    const base = {
      id: 'r', farmId: 'f1', crop: 'maize',
      harvestedAt: new Date().toISOString(),
      cycleCompletedAt: new Date().toISOString(),
    };
    const bags = getHarvestSummary({
      record: { ...base, harvestedAmount: 2, harvestedUnit: 'bags' },
      farm: { crop: 'maize' },
    });
    const tons = getHarvestSummary({
      record: { ...base, harvestedAmount: 0.1, harvestedUnit: 'tons' },
      farm: { crop: 'maize' },
    });
    expect(bags.amountInKg).toBe(100);
    expect(tons.amountInKg).toBe(100);
  });

  it('scenario 8 — next-step guidance is always populated', () => {
    const record = {
      id: 'r', farmId: 'f1', crop: 'maize',
      harvestedAmount: 50, harvestedUnit: 'kg',
      harvestedAt: new Date().toISOString(),
      cycleCompletedAt: new Date().toISOString(),
    };
    const s = getHarvestSummary({ record, farm: { crop: 'maize' } });
    expect(s.nextStepKey).toBe('harvest.summary.nextStep');
    expect(s.nextStepFallback.length).toBeGreaterThan(0);
  });

  it('returns null on a null record (no crash)', () => {
    expect(getHarvestSummary({ record: null })).toBeNull();
  });
});

// ─── Harvest tasks ──────────────────────────────────────────────
describe('getHarvestTasks', () => {
  it('scenario 3 — emits templates when cycleState = harvest_ready', () => {
    const tpl = getHarvestTasks({
      farmType: 'small_farm',
      harvestState: { cycleState: 'harvest_ready' },
    });
    expect(tpl.length).toBeGreaterThan(0);
    expect(tpl.every((t) => t.type === 'harvest')).toBe(true);
    expect(tpl.every((t) => t.id && t.title && t.why)).toBe(true);
  });

  it('emits nothing when cycleState is active or completed', () => {
    expect(getHarvestTasks({
      farmType: 'small_farm', harvestState: { cycleState: 'active' },
    })).toEqual([]);
    expect(getHarvestTasks({
      farmType: 'small_farm', harvestState: { cycleState: 'completed' },
    })).toEqual([]);
  });

  it('backyard vs commercial use different wording banks', () => {
    const b = getHarvestTasks({ farmType: 'backyard',
      harvestState: { cycleState: 'harvest_ready' } });
    const c = getHarvestTasks({ farmType: 'commercial',
      harvestState: { cycleState: 'harvest_ready' } });
    expect(b[0].title).not.toBe(c[0].title);
    expect(b.length).toBeLessThanOrEqual(c.length);
  });
});

// ─── Cycle completion engine ─────────────────────────────────────
describe('getCropCycleState', () => {
  it('injects harvest tasks only when harvest_ready', () => {
    const s = getCropCycleState({
      farm: { id: 'f1', crop: 'maize', plantingDate: isoAgo(100) },
    });
    expect(s.state).toBe('harvest_ready');
    expect(s.shouldInjectHarvestTasks).toBe(true);
    expect(s.shouldSuppressGrowthTasks).toBe(false);
  });

  it('suppresses growth tasks only when completed', () => {
    recordHarvest({ farmId: 'f1', crop: 'maize', harvestedAmount: 50, harvestedUnit: 'kg',
                    plantingDate: isoAgo(100) });
    const s = getCropCycleState({
      farm: { id: 'f1', crop: 'maize', plantingDate: isoAgo(100) },
    });
    expect(s.state).toBe('completed');
    expect(s.shouldSuppressGrowthTasks).toBe(true);
    expect(s.shouldInjectHarvestTasks).toBe(false);
    expect(s.nextStep.actionKey).toBe('start_new_cycle');
  });
});

// ─── Task engine integration ────────────────────────────────────
describe('taskEngine + harvest integration', () => {
  it('scenario 3 — harvest templates flow into the daily plan', () => {
    const farm = { id: 'f1', crop: 'maize', farmType: 'small_farm',
                   plantingDate: isoAgo(100) };
    // Use today so the plantingDate (100 days ago) lines up with the
    // harvest-stage detection (maize total = 105 days).
    const plan = generateDailyTasks({ farm, weather: { status: 'ok' } });
    expect(plan.cycleState).toBe('harvest_ready');
    expect(plan.tasks.some((t) => String(t.templateId).startsWith('harvest.'))).toBe(true);
  });

  it('scenario 7 — completed cycle returns a single "plan next cycle" card', () => {
    recordHarvest({ farmId: 'f1', crop: 'maize', harvestedAmount: 50,
      harvestedUnit: 'kg', plantingDate: isoAgo(100) });
    const plan = generateDailyTasks({
      farm: { id: 'f1', crop: 'maize', farmType: 'small_farm',
              plantingDate: isoAgo(100) },
      weather: { status: 'ok' },
    });
    expect(plan.cycleState).toBe('completed');
    expect(plan.tasks.length).toBe(1);
    expect(plan.tasks[0].templateId).toBe('cycle.completed.plan_next');
    // No vegetative / growth templates sneaking in.
    expect(plan.tasks.every((t) => !/^(mid|plant)\./.test(t.templateId))).toBe(true);
  });
});

// ─── Milestone integration ──────────────────────────────────────
describe('milestoneEngine + harvest records', () => {
  it('fires first_harvest_recorded + crop_cycle_completed when a record exists', () => {
    const ms = detectMilestones({
      farm: { harvestRecords: [{ id: 'r1', harvestedAmount: 50 }] },
    });
    const types = ms.map((m) => m.type);
    expect(types).toContain('first_harvest_recorded');
    expect(types).toContain('crop_cycle_completed');
  });

  it('does NOT fire cycle_completed without a concrete record', () => {
    const ms = detectMilestones({ completions: [] });
    expect(ms.find((m) => m.type === 'crop_cycle_completed')).toBeUndefined();
  });
});

// ─── HARVEST_UNITS catalog ──────────────────────────────────────
describe('HARVEST_UNITS', () => {
  it('exposes the five spec-mandated units', () => {
    const keys = HARVEST_UNITS.map((u) => u.key).sort();
    expect(keys).toEqual(['bags', 'crates', 'kg', 'pieces', 'tons']);
  });

  it('every unit has an i18n key + English fallback', () => {
    for (const u of HARVEST_UNITS) {
      expect(u.labelKey).toMatch(/^harvest\.unit\./);
      expect(typeof u.fallback).toBe('string');
      expect(u.fallback.length).toBeGreaterThan(0);
    }
  });
});
