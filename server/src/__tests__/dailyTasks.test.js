/**
 * dailyTasks.test.js — locks the daily-task generator + scheduler
 * contract:
 *   • 1 high + 1–2 medium (+ optional low) each day
 *   • weather status preempts the high slot
 *   • crop-specific templates beat generic for the same priority
 *   • farm-type modifies medium-task count (backyard 1, others 2)
 *   • scheduler regenerates on a new local date
 *   • markTaskComplete / skipTask update persisted state
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { generateDailyTasks } from '../../../src/lib/dailyTasks/taskEngine.js';
import {
  getTodayTasks, markTaskComplete, skipTask, resetForFarm, _internal as schedInt,
} from '../../../src/lib/dailyTasks/taskScheduler.js';
import { TEMPLATES } from '../../../src/lib/dailyTasks/taskTemplates.js';

// ─── Minimal localStorage shim for the scheduler's persistence ──
function installMemoryStorage() {
  const store = new Map();
  const mem = {
    getItem:    (k) => (store.has(k) ? store.get(k) : null),
    setItem:    (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear:      () => { store.clear(); },
    key:        (i) => Array.from(store.keys())[i] || null,
    get length() { return store.size; },
  };
  globalThis.window = globalThis.window || {};
  globalThis.window.localStorage = mem;
  return mem;
}

// ─── generateDailyTasks (pure) ───────────────────────────────────
describe('generateDailyTasks — priority mix', () => {
  it('produces exactly 1 high + 1–2 medium tasks for small_farm', () => {
    const plan = generateDailyTasks({
      farm: { id: 'f1', crop: 'maize', farmType: 'small_farm', cropStage: 'mid_growth' },
      weather: { status: 'ok' },
      date: '2025-05-10',
    });
    const highs  = plan.tasks.filter((t) => t.priority === 'high').length;
    const medium = plan.tasks.filter((t) => t.priority === 'medium').length;
    expect(highs).toBe(1);
    expect(medium).toBeGreaterThanOrEqual(1);
    expect(medium).toBeLessThanOrEqual(2);
  });

  it('backyard gets 1 medium; commercial gets 2', () => {
    const backyard = generateDailyTasks({
      farm: { id: 'b1', crop: 'tomato', farmType: 'backyard', cropStage: 'mid_growth' },
      weather: { status: 'ok' }, date: '2025-05-10',
    });
    const commercial = generateDailyTasks({
      farm: { id: 'c1', crop: 'maize', farmType: 'commercial', cropStage: 'mid_growth' },
      weather: { status: 'ok' }, date: '2025-05-10',
    });
    expect(backyard.tasks.filter((t) => t.priority === 'medium').length).toBe(1);
    expect(commercial.tasks.filter((t) => t.priority === 'medium').length).toBe(2);
  });

  it('low task appears on roughly half the days (deterministic per farm×date)', () => {
    const seen = new Set();
    for (let d = 1; d <= 14; d += 1) {
      const plan = generateDailyTasks({
        farm: { id: 'f1', crop: 'maize', farmType: 'small_farm', cropStage: 'mid_growth' },
        weather: { status: 'ok' },
        date: `2025-05-${String(d).padStart(2, '0')}`,
      });
      seen.add(plan.tasks.some((t) => t.priority === 'low'));
    }
    // Over 14 days we should see both states (true AND false).
    expect(seen.has(true)).toBe(true);
    expect(seen.has(false)).toBe(true);
  });
});

describe('generateDailyTasks — weather preempts high slot', () => {
  it('dry-weather template replaces the high-priority task when status=low_rain', () => {
    const plan = generateDailyTasks({
      farm: { id: 'f1', crop: 'maize', farmType: 'small_farm', cropStage: 'mid_growth' },
      weather: { status: 'low_rain' },
      date: '2025-05-10',
    });
    const high = plan.tasks.find((t) => t.priority === 'high');
    expect(high).toBeDefined();
    expect(high.templateId).toBe('weather.dry.irrigate');
    expect(plan.weatherTrigger).toBe('low_rain');
  });

  it('heat-weather template fires on excessive_heat', () => {
    const plan = generateDailyTasks({
      farm: { id: 'f1', crop: 'tomato', farmType: 'small_farm', cropStage: 'mid_growth' },
      weather: { status: 'excessive_heat' },
      date: '2025-05-10',
    });
    const high = plan.tasks.find((t) => t.priority === 'high');
    expect(high.templateId).toBe('weather.hot.water_morning');
  });

  it('no weather match → falls back to stage pool high task', () => {
    const plan = generateDailyTasks({
      farm: { id: 'f1', crop: 'maize', farmType: 'small_farm', cropStage: 'mid_growth' },
      weather: { status: 'ok' }, date: '2025-05-10',
    });
    const high = plan.tasks.find((t) => t.priority === 'high');
    expect(high.templateId).toMatch(/^mid\./);
    expect(plan.weatherTrigger).toBeNull();
  });
});

describe('generateDailyTasks — crop-specific templates beat generic', () => {
  it('rice gets the paddy-bund high task in pre_planting', () => {
    const plan = generateDailyTasks({
      farm: { id: 'r1', crop: 'rice', farmType: 'small_farm', cropStage: 'pre_planting' },
      weather: { status: 'ok' }, date: '2025-05-10',
    });
    const high = plan.tasks.find((t) => t.priority === 'high');
    expect(high.templateId).toBe('prep.rice.bund');
  });

  it('maize pre_planting uses the generic high task (no override defined)', () => {
    const plan = generateDailyTasks({
      farm: { id: 'm1', crop: 'maize', farmType: 'small_farm', cropStage: 'pre_planting' },
      weather: { status: 'ok' }, date: '2025-05-10',
    });
    const high = plan.tasks.find((t) => t.priority === 'high');
    expect(high.templateId).toMatch(/^prep\./);
    expect(high.templateId).not.toBe('prep.rice.bund');
  });
});

describe('generateDailyTasks — task shape', () => {
  it('every task carries id/farmId/date/type/priority/title/description/why/status', () => {
    const plan = generateDailyTasks({
      farm: { id: 'f1', crop: 'maize', farmType: 'small_farm', cropStage: 'mid_growth' },
      weather: { status: 'ok' }, date: '2025-05-10',
    });
    for (const task of plan.tasks) {
      expect(task.id).toMatch(/^f1:2025-05-10:/);
      expect(task.farmId).toBe('f1');
      expect(task.date).toBe('2025-05-10');
      expect(task.type).toMatch(/^[a-z_]+$/);
      expect(['high', 'medium', 'low']).toContain(task.priority);
      expect(typeof task.title).toBe('string');
      expect(typeof task.description).toBe('string');
      expect(typeof task.why).toBe('string');
      expect(task.status).toBe('pending');
    }
  });

  it('falls back to the generic mid_growth pool for unknown stages', () => {
    const plan = generateDailyTasks({
      farm: { id: 'f1', crop: 'maize', farmType: 'small_farm', cropStage: 'space_exploration' },
      weather: { status: 'ok' }, date: '2025-05-10',
    });
    expect(plan.stage).toBe('mid_growth');
    expect(plan.tasks.length).toBeGreaterThan(0);
  });
});

// ─── Scheduler (persistence + daily refresh) ─────────────────────
describe('taskScheduler — daily refresh + persistence', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  it('regenerates on first call of the day and persists', () => {
    const farm = { id: 'f1', crop: 'maize', farmType: 'small_farm', cropStage: 'mid_growth' };
    const first = getTodayTasks({ farm, weather: { status: 'ok' }, now: new Date('2025-05-10T09:00:00') });
    expect(first.source).toBe('generated');
    const second = getTodayTasks({ farm, weather: { status: 'ok' }, now: new Date('2025-05-10T18:00:00') });
    expect(second.source).toBe('persisted');
    expect(second.tasks.length).toBe(first.tasks.length);
    // Same ids → same plan
    expect(second.tasks.map((t) => t.id)).toEqual(first.tasks.map((t) => t.id));
  });

  it('regenerates when the local date rolls over', () => {
    const farm = { id: 'f1', crop: 'maize', farmType: 'small_farm', cropStage: 'mid_growth' };
    const day1 = getTodayTasks({ farm, weather: { status: 'ok' }, now: new Date('2025-05-10T22:00:00') });
    const day2 = getTodayTasks({ farm, weather: { status: 'ok' }, now: new Date('2025-05-11T07:00:00') });
    expect(day1.date).toBe('2025-05-10');
    expect(day2.date).toBe('2025-05-11');
    expect(day2.source).toBe('generated');
  });

  it('markTaskComplete updates status and logs a completion event', () => {
    const farm = { id: 'f1', crop: 'maize', farmType: 'small_farm', cropStage: 'mid_growth' };
    const plan = getTodayTasks({ farm, weather: { status: 'ok' }, now: new Date('2025-05-10T09:00:00') });
    const tid  = plan.tasks[0].id;
    markTaskComplete('f1', tid);
    const after = getTodayTasks({ farm, weather: { status: 'ok' }, now: new Date('2025-05-10T09:05:00') });
    expect(after.tasks.find((t) => t.id === tid).status).toBe('complete');
    // Completion stream fired
    const raw = window.localStorage.getItem('farroway.taskCompletions');
    const list = JSON.parse(raw);
    expect(list.length).toBe(1);
    expect(list[0].taskId).toBe(tid);
    expect(list[0].completed).toBe(true);
  });

  it('skipTask updates status without writing a completion', () => {
    const farm = { id: 'f1', crop: 'maize', farmType: 'small_farm', cropStage: 'mid_growth' };
    const plan = getTodayTasks({ farm, weather: { status: 'ok' }, now: new Date('2025-05-10T09:00:00') });
    const tid  = plan.tasks[0].id;
    skipTask('f1', tid);
    const after = getTodayTasks({ farm, weather: { status: 'ok' }, now: new Date('2025-05-10T09:05:00') });
    expect(after.tasks.find((t) => t.id === tid).status).toBe('skipped');
    expect(window.localStorage.getItem('farroway.taskCompletions')).toBeNull();
  });

  it('resetForFarm clears the persisted plan', () => {
    const farm = { id: 'f1', crop: 'maize', farmType: 'small_farm', cropStage: 'mid_growth' };
    getTodayTasks({ farm, weather: { status: 'ok' }, now: new Date('2025-05-10T09:00:00') });
    resetForFarm('f1');
    const after = getTodayTasks({ farm, weather: { status: 'ok' }, now: new Date('2025-05-10T09:05:00') });
    expect(after.source).toBe('generated');
  });

  it('two farms keep independent plans', () => {
    const a = { id: 'farm-a', crop: 'maize', farmType: 'small_farm', cropStage: 'mid_growth' };
    const b = { id: 'farm-b', crop: 'cassava', farmType: 'commercial', cropStage: 'pre_planting' };
    const now = new Date('2025-05-10T09:00:00');
    const pa = getTodayTasks({ farm: a, weather: { status: 'ok' }, now });
    const pb = getTodayTasks({ farm: b, weather: { status: 'ok' }, now });
    expect(pa.farmId).toBe('farm-a');
    expect(pb.farmId).toBe('farm-b');
    // Different farm types → different medium count
    expect(pb.tasks.filter((t) => t.priority === 'medium').length).toBe(2);
  });
});

// ─── Template sanity — every stage has a generic pool ────────────
describe('taskTemplates', () => {
  it('every defined stage exposes a generic list with at least 1 high task', () => {
    for (const [stage, rules] of Object.entries(TEMPLATES)) {
      expect(Array.isArray(rules.generic)).toBe(true);
      const hasHigh = rules.generic.some((t) => t.priority === 'high');
      expect(hasHigh, `stage ${stage} should have a high-priority task`).toBe(true);
    }
  });
});
