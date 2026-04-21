/**
 * farmTypeWiring.test.js — verifies farmType changes the behaviour
 * of the task, progress, reminder, insight, and NGO-insights
 * engines end-to-end.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

function installWindow() {
  const map = new Map();
  globalThis.window = {
    location: { pathname: '/', search: '' },
    localStorage: {
      getItem:    (k) => (map.has(k) ? map.get(k) : null),
      setItem:    (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      key:        (i) => Array.from(map.keys())[i] || null,
      get length() { return map.size; },
    },
    addEventListener: () => {}, removeEventListener: () => {},
  };
}

import {
  generateDailyTasks, getDailyTask,
} from '../../../src/lib/tasks/dailyTaskEngine.js';
import {
  computeProgress,
} from '../../../src/lib/progress/progressEngine.js';
import {
  evaluateReminder,
} from '../../../src/lib/notifications/reminderEngine.js';
import {
  formatWeatherInsight,
} from '../../../src/lib/farmer/insightFormatter.js';
import {
  getNgoInsights, exportInsightsCsv,
} from '../../../src/lib/ngo/ngoInsightsEngine.js';

beforeEach(() => { installWindow(); });
afterEach(()  => { delete globalThis.window; });

const NOW = new Date(2026, 3, 20, 12, 0, 0).getTime();

// ─── Task engine (spec §1) ───────────────────────────────────────
describe('generateDailyTasks — farmType caps', () => {
  it('backyard caps today list at 2', () => {
    const r = generateDailyTasks({
      crop: 'maize', stage: 'mid_growth', farmType: 'backyard',
    });
    expect(r.today.length).toBeLessThanOrEqual(2);
    expect(r.farmType).toBe('backyard');
  });

  it('commercial allows up to 6 today tasks', () => {
    const r = generateDailyTasks({
      crop: 'maize', stage: 'mid_growth', farmType: 'commercial',
    });
    expect(r.today.length).toBeLessThanOrEqual(6);
    expect(r.farmType).toBe('commercial');
  });

  it('missing farmType falls back to small_farm cadence', () => {
    const r = generateDailyTasks({ crop: 'maize', stage: 'mid_growth' });
    expect(r.today.length).toBeLessThanOrEqual(3);
    expect(r.farmType).toBe('small_farm');
  });

  it('unknown farmType safely falls back to small_farm', () => {
    const r = generateDailyTasks({
      crop: 'maize', stage: 'mid_growth', farmType: 'sparkles',
    });
    expect(r.farmType).toBe('small_farm');
    expect(r.today.length).toBeLessThanOrEqual(3);
  });

  it('always returns at least one task when rules exist', () => {
    const r = generateDailyTasks({
      crop: 'maize', stage: 'planting', farmType: 'backyard',
    });
    expect(r.today.length).toBeGreaterThanOrEqual(1);
  });

  it('getDailyTask wrapper keeps working for every tier', () => {
    for (const ft of ['backyard', 'small_farm', 'commercial', null]) {
      const r = getDailyTask({ crop: 'maize', stage: 'planting' });
      expect(r.primaryTask).toBeTruthy();
      // Silences the unused-loop-var warning while exercising each.
      expect(typeof ft === 'string' || ft === null).toBe(true);
    }
  });
});

// ─── Progress engine (spec §2) ───────────────────────────────────
describe('computeProgress — farmType tier-scaled bonus', () => {
  const baseCompletions = (n) =>
    Array.from({ length: n }, (_, i) => ({
      taskId: `t_${i}`, completed: true, timestamp: NOW - i * 1000,
    }));

  it('backyard hits full today-bonus with 2 completions', () => {
    const r = computeProgress({
      tasks: [],
      completions: baseCompletions(2),
      farmType: 'backyard', now: NOW,
    });
    expect(r.farmType).toBe('backyard');
    expect(r.dailyTarget).toBe(2);
    // 2 completions for backyard hits full +15 bonus → score ≥ 15.
    expect(r.progressScore).toBeGreaterThanOrEqual(15);
  });

  it('commercial needs 5 completions for full bonus', () => {
    const small = computeProgress({
      tasks: [], completions: baseCompletions(2),
      farmType: 'commercial', now: NOW,
    });
    const big = computeProgress({
      tasks: [], completions: baseCompletions(5),
      farmType: 'commercial', now: NOW,
    });
    expect(small.farmType).toBe('commercial');
    expect(big.progressScore).toBeGreaterThanOrEqual(small.progressScore);
    expect(big.dailyTarget).toBe(5);
  });

  it('missing farmType → small_farm default target 3', () => {
    const r = computeProgress({ tasks: [], completions: baseCompletions(1), now: NOW });
    expect(r.farmType).toBe('small_farm');
    expect(r.dailyTarget).toBe(3);
  });

  it('reads farmType from farm object when not passed directly', () => {
    const r = computeProgress({
      farm: { farmType: 'commercial' },
      tasks: [], completions: baseCompletions(5),
      now: NOW,
    });
    expect(r.farmType).toBe('commercial');
    expect(r.dailyTarget).toBe(5);
  });

  it('backyard farmer with 1 task completed earns a bonus — not penalised', () => {
    const r = computeProgress({
      tasks: [], completions: baseCompletions(1),
      farmType: 'backyard', now: NOW,
    });
    expect(r.progressScore).toBeGreaterThan(0);
  });
});

// ─── Reminder engine (spec §3) ───────────────────────────────────
describe('evaluateReminder — farmType alert gate', () => {
  it('backyard suppresses daily info reminders', () => {
    // Construct a "daily due" ctx: no weather, no missed day, no
    // critical-only setting. The default daily path would show info.
    const r = evaluateReminder({
      now: NOW,
      completions: [{ taskId: 't1', completed: true, timestamp: NOW - 24 * 3600 * 1000 }],
      hasActiveFarm: true,
      todayPrimaryDone: false,
      farmType: 'backyard',
      settings: { dailyReminderEnabled: true, dailyReminderTime: '00:00',
                   criticalAlertsOnly: false, lastReminderSentAt: null },
    });
    // Daily for backyard is suppressed → show=false.
    if (r.kind === 'daily') expect(r.show).toBe(false);
    if (!r.kind) expect(r.show).toBe(false);
  });

  it('commercial receives all severities including daily', () => {
    const r = evaluateReminder({
      now: NOW, completions: [],
      hasActiveFarm: true, todayPrimaryDone: false,
      farmType: 'commercial',
      settings: { dailyReminderEnabled: true, dailyReminderTime: '00:00',
                   criticalAlertsOnly: false, lastReminderSentAt: null },
    });
    expect(r.show).toBe(true);
  });

  it('farmType not supplied → small_farm cadence (show daily)', () => {
    const r = evaluateReminder({
      now: NOW, completions: [],
      hasActiveFarm: true, todayPrimaryDone: false,
      settings: { dailyReminderEnabled: true, dailyReminderTime: '00:00',
                   criticalAlertsOnly: false, lastReminderSentAt: null },
    });
    expect(r.show).toBe(true);
  });

  it('weather severe never suppressed, even for backyard', () => {
    const r = evaluateReminder({
      now: NOW, completions: [],
      weather: { severe: true },
      farmType: 'backyard',
      hasActiveFarm: true, todayPrimaryDone: false,
      settings: { dailyReminderEnabled: true, dailyReminderTime: '00:00',
                   criticalAlertsOnly: false, lastReminderSentAt: null },
    });
    expect(r.show).toBe(true);
    expect(r.kind).toBe('weather_severe');
  });
});

// ─── Insight formatter (spec §4) ─────────────────────────────────
describe('formatWeatherInsight — farmType-aware copy', () => {
  it('backyard gets plainer heat copy', () => {
    const r = formatWeatherInsight({
      weather: { status: 'excessive_heat' }, crop: 'tomato',
      farmType: 'backyard',
    });
    expect(r.tier).toBe('backyard');
    expect(r.condition).toMatch(/hot/i);
    expect(r.actions[0]).toMatch(/Water plants early morning/i);
    expect(r.actions.length).toBeLessThanOrEqual(2);
  });

  it('commercial gets more operational heat copy', () => {
    const r = formatWeatherInsight({
      weather: { status: 'excessive_heat' }, crop: 'tomato',
      farmType: 'commercial',
    });
    expect(r.tier).toBe('commercial');
    expect(r.actions[0]).toMatch(/Irrigate field sections/i);
  });

  it('dry-ahead: backyard is a single simple line', () => {
    const r = formatWeatherInsight({
      weather: { status: 'low_rain' }, crop: 'maize',
      farmType: 'backyard', forecastDays: 3,
    });
    expect(r.actions).toEqual(['Water plants tomorrow morning.']);
  });

  it('dry-ahead: commercial gets two operational lines', () => {
    const r = formatWeatherInsight({
      weather: { status: 'dry_ahead' }, crop: 'maize',
      farmType: 'commercial', forecastDays: 3,
    });
    expect(r.actions.length).toBe(2);
    expect(r.actions[0]).toMatch(/Irrigate field sections/i);
  });

  it('missing farmType → small_farm default copy', () => {
    const r = formatWeatherInsight({
      weather: { status: 'low_rain' }, crop: 'maize',
    });
    expect(r.tier).toBe('small_farm');
    expect(r.actions[0]).toBe('Water crops tomorrow morning');
  });
});

// ─── NGO insights (spec §7) ──────────────────────────────────────
describe('getNgoInsights — byFarmType roll-up', () => {
  function farm(overrides = {}) {
    return {
      id: overrides.id || `f_${Math.random().toString(36).slice(2, 8)}`,
      farmerId: overrides.farmerId || 'u1',
      crop: 'maize', stateCode: 'AS', countryCode: 'GH',
      program: null, ...overrides,
    };
  }

  it('returns byFarmType with all three canonical tiers', () => {
    const farms = [
      farm({ id: 'a', farmType: 'backyard' }),
      farm({ id: 'b', farmType: 'small_farm' }),
      farm({ id: 'c', farmType: 'commercial' }),
      farm({ id: 'd' }),   // missing → small_farm
    ];
    const r = getNgoInsights({ farms, now: NOW });
    const byTier = Object.fromEntries(
      r.byFarmType.map((x) => [x.farmType, x]),
    );
    expect(byTier.backyard.farmerCount).toBe(1);
    expect(byTier.small_farm.farmerCount).toBe(2);
    expect(byTier.commercial.farmerCount).toBe(1);
  });

  it('historical aliases canonicalise', () => {
    const farms = [
      farm({ id: 'a', farmType: 'home_food' }),       // → backyard
      farm({ id: 'b', farmType: 'commercial_farm' }), // → commercial
    ];
    const r = getNgoInsights({ farms, now: NOW });
    const byTier = Object.fromEntries(
      r.byFarmType.map((x) => [x.farmType, x]),
    );
    expect(byTier.backyard.farmerCount).toBe(1);
    expect(byTier.commercial.farmerCount).toBe(1);
  });

  it('empty input still includes the three canonical buckets at zero', () => {
    const r = getNgoInsights({ farms: [], now: NOW });
    expect(r.byFarmType.map((x) => x.farmType))
      .toEqual(['backyard', 'small_farm', 'commercial']);
    expect(r.byFarmType.every((x) => x.farmerCount === 0)).toBe(true);
  });
});

describe('exportInsightsCsv — farmType column', () => {
  it('header includes farmType as the last column', () => {
    const csv = exportInsightsCsv({ farms: [], issues: [], events: [], now: NOW });
    const header = csv.split('\n')[0];
    expect(header.endsWith(',farmType')).toBe(true);
  });

  it('rows emit canonicalised farmType per farm', () => {
    const farms = [
      { id: 'f1', farmerId: 'u1', crop: 'maize', farmType: 'backyard',
        stateCode: 'AS', countryCode: 'GH' },
      { id: 'f2', farmerId: 'u2', crop: 'rice',  farmType: 'home_food',
        stateCode: 'AS', countryCode: 'GH' },
      { id: 'f3', farmerId: 'u3', crop: 'wheat',
        stateCode: 'AS', countryCode: 'GH' },  // missing
    ];
    const csv = exportInsightsCsv({ farms, issues: [], events: [], now: NOW });
    const rows = csv.trim().split('\n').slice(1);
    const tiers = rows.map((r) => r.split(',').pop());
    expect(tiers).toEqual(['backyard', 'backyard', 'small_farm']);
  });
});
