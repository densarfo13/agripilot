/**
 * feedbackEngine.test.js — pure-function coverage for the farmer
 * action feedback loop:
 *
 *   actionTypes         → normalization + description helpers
 *   responseEngine      → progress, risk nudges, behavior summary,
 *                         next-action hint, issue priority boost
 *   harvestOutcome      → harvest normalization + quality derivation
 *                         + computeHarvestOutcome shape
 *
 * No DB / Prisma. Every fixture is in-memory.
 */
import { describe, it, expect } from 'vitest';
import {
  ACTION_TYPES,
  isValidActionType,
  normalizeAction,
  describeAction,
} from '../services/feedback/actionTypes.js';
import {
  computeProgress,
  applyActionToRisk,
  summarizeBehavior,
  deriveNextActionHint,
  priorityBoostFromIssues,
} from '../services/feedback/responseEngine.js';
import {
  normalizeHarvestInput,
  computeHarvestOutcome,
  _internal as harvestInternal,
} from '../services/feedback/harvestOutcome.js';

const mkTask = (o = {}) => ({
  id: 't' + Math.random().toString(36).slice(2, 8),
  status: 'pending',
  priority: 'medium',
  title: 'Water rows',
  dueDate: null,
  ...o,
});

const mkAction = (type, details = {}, daysAgo = 0) => ({
  actionType: type,
  occurredAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
  details,
});

// ─── actionTypes ──────────────────────────────────────────
describe('actionTypes', () => {
  it('validates known action types', () => {
    expect(isValidActionType('task_completed')).toBe(true);
    expect(isValidActionType('bogus')).toBe(false);
  });

  it('normalizes a raw action into the canonical shape', () => {
    const a = normalizeAction({
      actionType: 'task_completed',
      subjectId: 'task-1',
      cropCycleId: 'cycle-1',
      occurredAt: new Date('2026-04-01T10:00:00Z'),
      details: { taskTitle: 'Water' },
    });
    expect(a.actionType).toBe('task_completed');
    expect(a.subjectId).toBe('task-1');
    expect(a.cropCycleId).toBe('cycle-1');
    expect(typeof a.occurredAt).toBe('string');
    expect(a.details.taskTitle).toBe('Water');
  });

  it('rejects unknown action types by returning null', () => {
    expect(normalizeAction({ actionType: 'not_real' })).toBeNull();
  });

  it('describeAction produces farmer-facing strings', () => {
    expect(describeAction(mkAction(ACTION_TYPES.TASK_COMPLETED, { taskTitle: 'Water' })))
      .toMatch(/Completed: Water/);
    expect(describeAction(mkAction(ACTION_TYPES.TASK_SKIPPED, { taskTitle: 'Weed', reason: 'rain' })))
      .toMatch(/Skipped: Weed \(rain\)/);
    expect(describeAction(mkAction(ACTION_TYPES.ISSUE_REPORTED, { category: 'pest' })))
      .toMatch(/pest/);
    expect(describeAction(mkAction(ACTION_TYPES.HARVEST_REPORTED, { actualYieldKg: 42 })))
      .toMatch(/42/);
  });
});

// ─── computeProgress ──────────────────────────────────────
describe('computeProgress', () => {
  it('counts completed/skipped/total and produces a percent', () => {
    const p = computeProgress({ tasks: [
      mkTask({ status: 'completed' }),
      mkTask({ status: 'completed' }),
      mkTask({ status: 'skipped' }),
      mkTask({ status: 'pending' }),
    ]});
    expect(p.completed).toBe(2);
    expect(p.skipped).toBe(1);
    expect(p.total).toBe(4);
    expect(p.percent).toBe(50);
  });

  it('returns zeroes for empty/bad input', () => {
    expect(computeProgress({ tasks: [] })).toEqual({ percent: 0, completed: 0, skipped: 0, total: 0 });
    expect(computeProgress({})).toEqual({ percent: 0, completed: 0, skipped: 0, total: 0 });
  });
});

// ─── applyActionToRisk ────────────────────────────────────
describe('applyActionToRisk', () => {
  it('issue with high severity forces risk to high', () => {
    const out = applyActionToRisk({
      action: mkAction(ACTION_TYPES.ISSUE_REPORTED, { severity: 'high' }),
      base: 'low',
    });
    expect(out).toBe('high');
  });

  it('medium issue bumps low → medium but does not overshoot', () => {
    expect(applyActionToRisk({
      action: mkAction(ACTION_TYPES.ISSUE_REPORTED, { severity: 'medium' }),
      base: 'low',
    })).toBe('medium');
    expect(applyActionToRisk({
      action: mkAction(ACTION_TYPES.ISSUE_REPORTED, { severity: 'medium' }),
      base: 'high',
    })).toBe('high');
  });

  it('skipped task without weather reason climbs the ladder', () => {
    expect(applyActionToRisk({
      action: mkAction(ACTION_TYPES.TASK_SKIPPED, { reason: 'busy' }),
      base: 'low',
    })).toBe('medium');
    expect(applyActionToRisk({
      action: mkAction(ACTION_TYPES.TASK_SKIPPED, { reason: 'busy' }),
      base: 'medium',
    })).toBe('high');
  });

  it('weather-reason skip does not raise risk', () => {
    expect(applyActionToRisk({
      action: mkAction(ACTION_TYPES.TASK_SKIPPED, { reason: 'heavy rain' }),
      base: 'low',
    })).toBe('low');
  });

  it('high-priority completion can step medium down to low', () => {
    expect(applyActionToRisk({
      action: mkAction(ACTION_TYPES.TASK_COMPLETED, { priority: 'high' }),
      base: 'medium',
    })).toBe('low');
  });

  it('harvest report collapses risk to low', () => {
    expect(applyActionToRisk({
      action: mkAction(ACTION_TYPES.HARVEST_REPORTED),
      base: 'high',
    })).toBe('low');
  });
});

// ─── summarizeBehavior ────────────────────────────────────
describe('summarizeBehavior', () => {
  it('derives completion/skip rates and streak', () => {
    const tasks = [
      mkTask({ status: 'completed' }),
      mkTask({ status: 'completed' }),
      mkTask({ status: 'skipped' }),
    ];
    const actions = [
      mkAction(ACTION_TYPES.TASK_COMPLETED, {}, 0),
      mkAction(ACTION_TYPES.TASK_COMPLETED, {}, 1),
      mkAction(ACTION_TYPES.TASK_COMPLETED, {}, 2),
      mkAction(ACTION_TYPES.TASK_SKIPPED, {}, 3),
    ];
    const s = summarizeBehavior(actions, tasks);
    expect(s.streak).toBe(3);
    expect(s.completionRate).toBeCloseTo(2 / 3, 2);
    expect(s.skipRate).toBeCloseTo(1 / 3, 2);
    expect(s.totalCompleted).toBe(2);
    expect(s.totalSkipped).toBe(1);
  });

  it('counts recent issues (last 10 actions)', () => {
    const actions = [
      mkAction(ACTION_TYPES.ISSUE_REPORTED, { category: 'pest' }, 0),
      mkAction(ACTION_TYPES.TASK_COMPLETED, {}, 1),
      mkAction(ACTION_TYPES.ISSUE_REPORTED, { category: 'water' }, 2),
    ];
    const s = summarizeBehavior(actions, []);
    expect(s.recentIssueCount).toBe(2);
  });
});

// ─── deriveNextActionHint ─────────────────────────────────
describe('deriveNextActionHint', () => {
  it('issue dominates all other hints', () => {
    expect(deriveNextActionHint({ recentIssueCount: 1, skipRate: 0.9 }, 'growing'))
      .toMatch(/issue/i);
  });

  it('high skip rate surfaces the skip hint', () => {
    expect(deriveNextActionHint({ recentIssueCount: 0, skipRate: 0.6 }, 'growing'))
      .toMatch(/skipped/i);
  });

  it('streak hint lands when farmer is on a roll', () => {
    expect(deriveNextActionHint({ recentIssueCount: 0, skipRate: 0, streak: 4 }, 'growing'))
      .toMatch(/streak/i);
  });

  it('harvest_ready stage nudges harvest when no other signal', () => {
    expect(deriveNextActionHint({}, 'harvest_ready')).toMatch(/harvest/i);
  });
});

// ─── priorityBoostFromIssues ──────────────────────────────
describe('priorityBoostFromIssues', () => {
  it('boosts scouting task when pest issue is open', () => {
    const b = priorityBoostFromIssues(
      mkTask({ title: 'Scout for pests' }),
      [{ category: 'pest', severity: 'high' }],
    );
    expect(b).toBeGreaterThan(0);
  });

  it('returns 0 for unrelated task', () => {
    const b = priorityBoostFromIssues(
      mkTask({ title: 'Update records' }),
      [{ category: 'pest', severity: 'high' }],
    );
    expect(b).toBe(0);
  });

  it('caps at 20 regardless of issue count', () => {
    const b = priorityBoostFromIssues(
      mkTask({ title: 'Scout for pests' }),
      Array(20).fill({ category: 'pest', severity: 'high' }),
    );
    expect(b).toBeLessThanOrEqual(20);
  });
});

// ─── harvestOutcome helpers ───────────────────────────────
describe('normalizeHarvestInput', () => {
  it('rejects non-finite yield and invalid quality bands', () => {
    const n = normalizeHarvestInput({ actualYieldKg: 'abc', qualityBand: 'ok' });
    expect(n.actualYieldKg).toBeNull();
    expect(n.qualityBand).toBeNull();
  });

  it('accepts valid yield + quality + truncates notes', () => {
    const n = normalizeHarvestInput({
      actualYieldKg: 42, qualityBand: 'good', notes: 'x'.repeat(1000),
    });
    expect(n.actualYieldKg).toBe(42);
    expect(n.qualityBand).toBe('good');
    expect(n.notes.length).toBeLessThanOrEqual(500);
  });
});

describe('deriveQualityBand (internal)', () => {
  it('excellent when completion high + no issues', () => {
    expect(harvestInternal.deriveQualityBand({
      completionRate: 0.9, skipRate: 0, issueCount: 0,
    })).toBe('excellent');
  });

  it('poor when very little got done', () => {
    expect(harvestInternal.deriveQualityBand({
      completionRate: 0.2, skipRate: 0.5, issueCount: 3,
    })).toBe('poor');
  });
});

describe('computeHarvestOutcome', () => {
  it('assembles progress + issue count + yield into the outcome', () => {
    const cycle = {
      id: 'c1', cropType: 'tomato',
      plantingDate: new Date(Date.now() - 90 * 86_400_000),
    };
    const tasks = [
      mkTask({ status: 'completed' }),
      mkTask({ status: 'completed' }),
      mkTask({ status: 'skipped' }),
    ];
    const actions = [
      mkAction(ACTION_TYPES.ISSUE_REPORTED, { category: 'pest' }),
      mkAction(ACTION_TYPES.TASK_COMPLETED),
    ];
    const out = computeHarvestOutcome({
      cycle, tasks, actions,
      input: { actualYieldKg: 12, qualityBand: 'good' },
    });
    expect(out.cropKey).toBe('tomato');
    expect(out.actualYieldKg).toBe(12);
    expect(out.qualityBand).toBe('good');
    expect(out.completedTasksCount).toBe(2);
    expect(out.skippedTasksCount).toBe(1);
    expect(out.issueCount).toBe(1);
    expect(out.durationDays).toBeGreaterThanOrEqual(89);
  });

  it('derives quality band when farmer did not supply one', () => {
    const out = computeHarvestOutcome({
      cycle: { id: 'c1', cropType: 'bean' },
      tasks: [mkTask({ status: 'completed' })],
      actions: [],
      input: { actualYieldKg: 5 },
    });
    expect(['poor', 'fair', 'good', 'excellent']).toContain(out.qualityBand);
  });
});
