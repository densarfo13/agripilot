/**
 * timelineAutoAdvance.test.js — locks the on-every-read timeline
 * auto-advance behaviour wired into taskScheduler.
 *
 *   1. scheduler passes the timeline stage into generateDailyTasks
 *   2. plan regenerates when the timeline stage drifts (same day,
 *      different stage after a plantingDate correction)
 *   3. plan is persisted with a stageSnapshot field
 *   4. manual override forces the persisted stage — no auto-advance
 *   5. missing plantingDate → falls back to farm.cropStage, no crash
 *   6. missing durations → falls back to generic lifecycle, no crash
 *   7. subsequent calls on the same day + same stage hit the cache
 *      (completion state preserved)
 *   8. timelineStage param wins over farm.cropStage inside the
 *      task engine itself
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

import {
  getTodayTasks, markTaskComplete, resetForFarm,
} from '../../../src/lib/dailyTasks/taskScheduler.js';
import { getCropTimeline } from '../../../src/lib/timeline/cropTimelineEngine.js';
import { generateDailyTasks } from '../../../src/lib/dailyTasks/taskEngine.js';

function isoAgo(days, from = Date.now()) {
  return new Date(from - days * 86400000).toISOString();
}

beforeEach(() => { installMemoryStorage(); });

describe('taskScheduler — auto-advance from timeline', () => {
  it('persists the timeline stageSnapshot alongside the plan', () => {
    const farm = {
      id: 'f1', crop: 'maize', farmType: 'small_farm',
      plantingDate: isoAgo(20),   // vegetative
    };
    const now = new Date();
    const plan = getTodayTasks({ farm, weather: { status: 'ok' }, now });

    expect(plan.source).toBe('generated');
    expect(plan.stage).toBe('vegetative');    // maize at day 20

    const raw = JSON.parse(window.localStorage.getItem('farroway.dailyTasks.v1'));
    expect(raw.byFarm.f1.stageSnapshot).toBe('vegetative');
  });

  it('serves from cache when the stage has not drifted', () => {
    const farm = {
      id: 'f1', crop: 'maize', farmType: 'small_farm',
      plantingDate: isoAgo(20),
    };
    const now = new Date();
    const first  = getTodayTasks({ farm, weather: { status: 'ok' }, now });
    const second = getTodayTasks({ farm, weather: { status: 'ok' }, now });
    expect(first.source).toBe('generated');
    expect(second.source).toBe('persisted');
    expect(second.stage).toBe(first.stage);
    expect(second.tasks.map((t) => t.id)).toEqual(first.tasks.map((t) => t.id));
  });

  it('regenerates (same day) when the timeline stage changes', () => {
    const farm1 = {
      id: 'f1', crop: 'maize', farmType: 'small_farm',
      plantingDate: isoAgo(20),   // vegetative
    };
    const now = new Date();
    const before = getTodayTasks({ farm: farm1, weather: { status: 'ok' }, now });
    expect(before.stage).toBe('vegetative');

    // Farmer corrects plantingDate (e.g. realises they planted earlier).
    const farm2 = { ...farm1, plantingDate: isoAgo(60) };   // → tasseling
    const after = getTodayTasks({ farm: farm2, weather: { status: 'ok' }, now });
    expect(after.stage).toBe('tasseling');
    expect(after.source).toBe('generated');
  });

  it('respects manualStageOverride — never auto-advances past it', () => {
    const farm = {
      id: 'f1', crop: 'cassava', farmType: 'small_farm',
      plantingDate: isoAgo(200),         // would otherwise be bulking/maturation
      manualStageOverride: 'planting',   // farmer insists it's still planting
    };
    const now = new Date();
    const plan = getTodayTasks({ farm, weather: { status: 'ok' }, now });
    expect(plan.stage).toBe('planting');

    // Also confirm the timeline agrees.
    const tl = getCropTimeline({ farm, now });
    expect(tl.currentStage).toBe('planting');
    expect(tl.manualOverride).toBe(true);
  });

  it('clearing the override re-enables auto-estimate on next read', () => {
    const base = {
      id: 'f1', crop: 'cassava', farmType: 'small_farm',
      plantingDate: isoAgo(60),
    };
    const now = new Date();
    // First: farmer has override set to "planting".
    const withOverride = getTodayTasks({
      farm: { ...base, manualStageOverride: 'planting' },
      weather: { status: 'ok' }, now,
    });
    expect(withOverride.stage).toBe('planting');

    // Farmer clears the override — scheduler must re-estimate.
    const cleared = getTodayTasks({
      farm: { ...base, manualStageOverride: null },
      weather: { status: 'ok' }, now,
    });
    // cassava day 60: planting 0-14, establishment 14-44, vegetative 44-104
    expect(cleared.stage).toBe('vegetative');
    expect(cleared.source).toBe('generated');
  });

  it('missing plantingDate → falls back to farm.cropStage, no crash', () => {
    const farm = {
      id: 'f2', crop: 'tomato', farmType: 'small_farm',
      cropStage: 'flowering',   // no plantingDate
    };
    const plan = getTodayTasks({ farm, weather: { status: 'ok' }, now: new Date() });
    expect(plan.stage).toBe('flowering');
    expect(plan.tasks.length).toBeGreaterThan(0);
  });

  it('missing crop → no timeline stage, scheduler still returns a plan', () => {
    const farm = { id: 'f3', farmType: 'small_farm' };
    const plan = getTodayTasks({ farm, weather: { status: 'ok' }, now: new Date() });
    expect(plan.stage).toBeNull();
    expect(plan.tasks.length).toBeGreaterThan(0);
  });

  it('unknown crop → generic lifecycle, scheduler falls back cleanly', () => {
    const farm = {
      id: 'f4', crop: 'dragonfruit', farmType: 'small_farm',
      plantingDate: isoAgo(20),
    };
    const plan = getTodayTasks({ farm, weather: { status: 'ok' }, now: new Date() });
    // Generic lifecycle stage 2 @ day 20 = establishment (14+30)
    expect(plan.stage).toBe('establishment');
    expect(plan.tasks.length).toBeGreaterThan(0);
  });

  it('markTaskComplete still works across an auto-advance regeneration', () => {
    const farm1 = {
      id: 'f5', crop: 'maize', farmType: 'small_farm',
      plantingDate: isoAgo(20),
    };
    const now = new Date();
    const plan1 = getTodayTasks({ farm: farm1, weather: { status: 'ok' }, now });
    const taskId = plan1.tasks[0].id;
    markTaskComplete('f5', taskId);

    // Stage drift forces a regenerate — completion state may not
    // carry over (new template ids), but it must NOT crash.
    const farm2 = { ...farm1, plantingDate: isoAgo(60) };
    const plan2 = getTodayTasks({ farm: farm2, weather: { status: 'ok' }, now });
    expect(plan2.source).toBe('generated');
    expect(plan2.stage).toBe('tasseling');
    // Old completion still lives in the completions stream (for streak).
    const rawComp = window.localStorage.getItem('farroway.taskCompletions');
    expect(rawComp).not.toBeNull();
  });
});

describe('taskEngine — timelineStage still wins over farm.cropStage', () => {
  it('direct call with timelineStage beats farm.cropStage on pool choice', () => {
    const farm = { id: 'x', crop: 'cassava', farmType: 'small_farm',
                   cropStage: 'planting' };
    const plan = generateDailyTasks({
      farm, timelineStage: 'harvest',
      weather: { status: 'ok' }, date: '2025-05-10',
    });
    expect(plan.stage).toBe('harvest');
  });

  it('without timelineStage, falls through to farm.cropStage (back-compat)', () => {
    const farm = { id: 'x', crop: 'cassava', farmType: 'small_farm',
                   cropStage: 'harvest' };
    const plan = generateDailyTasks({
      farm, weather: { status: 'ok' }, date: '2025-05-10',
    });
    expect(plan.stage).toBe('harvest');
  });
});
