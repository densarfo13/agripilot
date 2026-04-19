/**
 * todayEngine.test.js — pure-function tests for the Today feed
 * priority scoring + risk overrides.
 */
import { describe, it, expect } from 'vitest';
import { buildTodayFeed } from '../services/today/todayEngine.js';

function mkTask(overrides) {
  return {
    id: 't-' + Math.random().toString(36).slice(2, 8),
    status: 'pending',
    title: 'Water the rows',
    priority: 'medium',
    dueDate: null,
    ...overrides,
  };
}

const NOW = new Date('2026-06-01T09:00:00Z');

describe('buildTodayFeed — priority scoring', () => {
  it('returns a primary + max 2 secondaries', () => {
    const feed = buildTodayFeed({
      pendingTasks: [
        mkTask({ id: 'a', title: 'Plant tomatoes deep', priority: 'high',   dueDate: new Date('2026-06-01') }),
        mkTask({ id: 'b', title: 'Mulch around rows',    priority: 'medium',dueDate: new Date('2026-06-05') }),
        mkTask({ id: 'c', title: 'Check irrigation',     priority: 'medium',dueDate: new Date('2026-06-10') }),
        mkTask({ id: 'd', title: 'Renovate orchard',     priority: 'low',   dueDate: new Date('2026-07-01') }),
      ],
      cycle: { lifecycleStatus: 'planting' },
      cropKey: 'tomato',
      now: NOW,
    });
    expect(feed.primaryTask).toBeTruthy();
    expect(feed.secondaryTasks.length).toBeLessThanOrEqual(2);
    expect(feed.primaryTask.id).not.toBe(feed.secondaryTasks[0]?.id);
  });

  it('stage-relevant task wins over higher-priority irrelevant one', () => {
    const feed = buildTodayFeed({
      pendingTasks: [
        mkTask({ id: 'stage', title: 'Plant tomatoes deep', priority: 'medium', dueDate: new Date('2026-06-01') }),
        mkTask({ id: 'other', title: 'Renovate orchard',    priority: 'high',   dueDate: new Date('2026-06-01') }),
      ],
      cycle: { lifecycleStatus: 'planting' },
      cropKey: 'tomato',
      now: NOW,
    });
    expect(feed.primaryTask.id).toBe('stage');
  });

  it('overdue tasks get the overdueBoost', () => {
    const feed = buildTodayFeed({
      pendingTasks: [
        mkTask({ id: 'old', title: 'Spray pest',  priority: 'medium', dueDate: new Date('2026-05-25') }),
        mkTask({ id: 'new', title: 'Check moisture', priority: 'medium', dueDate: new Date('2026-06-03') }),
      ],
      cycle: { lifecycleStatus: 'growing' },
      cropKey: 'tomato',
      now: NOW,
    });
    expect(feed.primaryTask.id).toBe('old');
    expect(feed.overdueTasksCount).toBe(1);
  });
});

describe('buildTodayFeed — risk overrides', () => {
  it('heat risk elevates a synthetic shade task', () => {
    const feed = buildTodayFeed({
      pendingTasks: [mkTask({ id: 'orig', title: 'Thin seedlings' })],
      cycle: { lifecycleStatus: 'growing' },
      cropKey: 'lettuce',
      cropProfile: { heatTolerance: 'low' },
      heatBandLevel: 0.9,
      now: NOW,
    });
    expect(feed.primaryTask.source).toBe('override:heat');
    expect(feed.primaryTask.title).toMatch(/shade|water|heat/i);
  });

  it('open high-severity pest issue elevates a scouting override', () => {
    const feed = buildTodayFeed({
      pendingTasks: [mkTask({ id: 'orig', title: 'Mulch around rows' })],
      openIssues: [{ category: 'pest', severity: 'high', status: 'open' }],
      cycle: { lifecycleStatus: 'growing' },
      cropKey: 'tomato',
      now: NOW,
    });
    expect(feed.primaryTask.source).toBe('override:pest');
    expect(feed.primaryTask.title).toMatch(/pest|disease/i);
  });

  it('overdue planting task elevates to primary', () => {
    const feed = buildTodayFeed({
      pendingTasks: [
        mkTask({ id: 'plant', title: 'Plant tomatoes', priority: 'medium', dueDate: new Date('2026-05-20') }),
        mkTask({ id: 'other', title: 'Mulch around rows', priority: 'high', dueDate: new Date('2026-06-02') }),
      ],
      cycle: { lifecycleStatus: 'planned' },
      cropKey: 'tomato',
      now: NOW,
    });
    expect(feed.primaryTask.id).toBe('plant');
  });

  it('3+ overdue tasks elevates a catchup synthetic task', () => {
    const feed = buildTodayFeed({
      pendingTasks: [
        mkTask({ id: '1', title: 'Water the rows',     priority: 'medium', dueDate: new Date('2026-05-25') }),
        mkTask({ id: '2', title: 'Scout for pests',    priority: 'medium', dueDate: new Date('2026-05-26') }),
        mkTask({ id: '3', title: 'Side-dress fertilizer', priority: 'medium', dueDate: new Date('2026-05-27') }),
        mkTask({ id: '4', title: 'Stake tomatoes',     priority: 'medium', dueDate: new Date('2026-05-28') }),
      ],
      cycle: { lifecycleStatus: 'growing' },
      cropKey: 'tomato',
      now: NOW,
    });
    expect(feed.primaryTask.source).toBe('override:catchup');
    expect(feed.nextActionSummary).toMatch(/overdue/i);
  });
});

describe('buildTodayFeed — risk alerts', () => {
  it('surfaces overdue count when >0', () => {
    const feed = buildTodayFeed({
      pendingTasks: [mkTask({ id: 'o', title: 'Water', dueDate: new Date('2026-05-20') })],
      now: NOW,
    });
    expect(feed.riskAlerts.some((r) => /overdue/i.test(r))).toBe(true);
  });

  it('surfaces open high-severity issue count', () => {
    const feed = buildTodayFeed({
      pendingTasks: [],
      openIssues: [
        { severity: 'high', status: 'open', category: 'pest' },
        { severity: 'high', status: 'in_review', category: 'disease' },
      ],
      now: NOW,
    });
    expect(feed.riskAlerts.some((r) => /issue/i.test(r))).toBe(true);
  });

  it('empty state returns empty alerts + null primary', () => {
    const feed = buildTodayFeed({ pendingTasks: [], now: NOW });
    expect(feed.primaryTask).toBeNull();
    expect(feed.riskAlerts.length).toBe(0);
    expect(feed.secondaryTasks.length).toBe(0);
  });
});

describe('buildTodayFeed — payload shape', () => {
  it('every primary carries an ETA and priorityScore', () => {
    const feed = buildTodayFeed({
      pendingTasks: [mkTask({ id: 'x', title: 'Plant tomatoes', priority: 'high', dueDate: new Date('2026-06-01') })],
      cycle: { lifecycleStatus: 'planting' },
      cropKey: 'tomato',
      now: NOW,
    });
    expect(feed.timeEstimateMinutes).toBeGreaterThan(0);
    expect(feed.priorityScore).toBeGreaterThan(0);
    expect(feed.primaryTask.timeEstimateMinutes).toBeGreaterThan(0);
  });
});
