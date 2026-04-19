/**
 * feedbackService.test.js — exercises the Prisma-facing feedback
 * wrappers via an in-memory stub so behavior is verified without a
 * live DB. Catches schema drifts that the pure-function tests miss.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  logAction,
  getRecentActions,
  recordTaskCompleted,
  recordTaskSkipped,
  recordIssueReported,
  recordHarvestOutcome,
} from '../services/feedback/feedbackService.js';

function makeStubPrisma() {
  const actionLogs = [];
  const cycles = new Map();
  const tasks = new Map();
  const outcomes = new Map();
  return {
    _state: { actionLogs, cycles, tasks, outcomes },
    farmerActionLog: {
      create: async ({ data }) => {
        const row = { id: 'log-' + (actionLogs.length + 1), ...data };
        actionLogs.push(row);
        return row;
      },
      findMany: async ({ where = {}, orderBy, take = 50 } = {}) => {
        let rows = [...actionLogs];
        if (where.farmProfileId) rows = rows.filter((r) => r.farmProfileId === where.farmProfileId);
        if (where.cropCycleId) rows = rows.filter((r) => r.cropCycleId === where.cropCycleId);
        rows.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
        return rows.slice(0, take);
      },
    },
    cycleTaskPlan: {
      update: async ({ where, data }) => {
        const prev = tasks.get(where.id) || { id: where.id };
        const next = { ...prev, ...data };
        tasks.set(where.id, next);
        return next;
      },
    },
    v2CropCycle: {
      findUnique: async ({ where, select }) => {
        const c = cycles.get(where.id);
        if (!c) return null;
        if (!select) return c;
        const out = {};
        for (const k of Object.keys(select)) out[k] = c[k];
        return out;
      },
      update: async ({ where, data }) => {
        const prev = cycles.get(where.id) || { id: where.id };
        const next = { ...prev, ...data };
        cycles.set(where.id, next);
        return next;
      },
    },
    harvestOutcome: {
      upsert: async ({ where, create, update }) => {
        const existing = outcomes.get(where.cropCycleId);
        const row = existing
          ? { ...existing, ...update }
          : { id: 'h-' + (outcomes.size + 1), ...create, cropCycleId: where.cropCycleId };
        outcomes.set(where.cropCycleId, row);
        return row;
      },
    },
  };
}

describe('feedbackService — logAction + getRecentActions', () => {
  let prisma;
  beforeEach(() => { prisma = makeStubPrisma(); });

  it('persists a normalized action and reads it back', async () => {
    const row = await logAction(prisma, {
      actionType: 'task_completed',
      cropCycleId: 'c1',
      farmProfileId: 'f1',
      details: { taskTitle: 'Water', priority: 'high' },
    });
    expect(row).toBeTruthy();
    expect(row.actionType).toBe('task_completed');

    const list = await getRecentActions(prisma, { cropCycleId: 'c1' });
    expect(list).toHaveLength(1);
    expect(list[0].actionType).toBe('task_completed');
    expect(list[0].details.taskTitle).toBe('Water');
  });

  it('rejects invalid action types silently (returns null)', async () => {
    const row = await logAction(prisma, { actionType: 'bogus' });
    expect(row).toBeNull();
    expect(prisma._state.actionLogs).toHaveLength(0);
  });

  it('filters by farmProfileId', async () => {
    await logAction(prisma, { actionType: 'task_completed', farmProfileId: 'f1' });
    await logAction(prisma, { actionType: 'task_completed', farmProfileId: 'f2' });
    const list = await getRecentActions(prisma, { farmProfileId: 'f1' });
    expect(list).toHaveLength(1);
  });
});

describe('feedbackService — recordTaskCompleted', () => {
  it('updates task, logs action, and persists risk band', async () => {
    const prisma = makeStubPrisma();
    prisma._state.cycles.set('c1', { id: 'c1', riskBand: 'medium' });
    prisma._state.tasks.set('t1', { id: 't1', status: 'pending' });

    const out = await recordTaskCompleted(prisma, {
      user: { id: 'u1' },
      task: { id: 't1', title: 'Water', priority: 'high', cropCycleId: 'c1' },
    });

    expect(out.task.status).toBe('completed');
    expect(prisma._state.actionLogs).toHaveLength(1);
    expect(prisma._state.actionLogs[0].actionType).toBe('task_completed');
    // high-priority completion drops medium → low
    expect(out.riskBand).toBe('low');
    expect(prisma._state.cycles.get('c1').riskBand).toBe('low');
  });
});

describe('feedbackService — recordTaskSkipped', () => {
  it('marks task skipped, logs, and bumps risk low → medium', async () => {
    const prisma = makeStubPrisma();
    prisma._state.cycles.set('c1', { id: 'c1', riskBand: 'low' });
    prisma._state.tasks.set('t1', { id: 't1', status: 'pending' });

    const out = await recordTaskSkipped(prisma, {
      user: { id: 'u1' },
      task: { id: 't1', title: 'Weed', cropCycleId: 'c1' },
      reason: 'too busy',
    });

    expect(out.task.status).toBe('skipped');
    expect(out.riskBand).toBe('medium');
    expect(prisma._state.actionLogs[0].details.reason).toBe('too busy');
  });

  it('weather-reason skip does not raise risk', async () => {
    const prisma = makeStubPrisma();
    prisma._state.cycles.set('c1', { id: 'c1', riskBand: 'low' });
    prisma._state.tasks.set('t1', { id: 't1', status: 'pending' });

    const out = await recordTaskSkipped(prisma, {
      user: { id: 'u1' },
      task: { id: 't1', title: 'Water', cropCycleId: 'c1' },
      reason: 'heavy rain',
    });
    expect(out.riskBand).toBe('low');
  });
});

describe('feedbackService — recordIssueReported', () => {
  it('high-severity issue forces risk to high', async () => {
    const prisma = makeStubPrisma();
    prisma._state.cycles.set('c1', { id: 'c1', riskBand: 'low' });

    const out = await recordIssueReported(prisma, {
      user: { id: 'u1' },
      issue: { id: 'i1', cropCycleId: 'c1', farmProfileId: 'f1', category: 'pest', severity: 'high' },
    });
    expect(out.riskBand).toBe('high');
    expect(prisma._state.actionLogs[0].actionType).toBe('issue_reported');
  });
});

describe('feedbackService — recordHarvestOutcome', () => {
  it('writes harvest outcome, collapses risk to low, and logs', async () => {
    const prisma = makeStubPrisma();
    prisma._state.cycles.set('c1', { id: 'c1', riskBand: 'high', profileId: 'f1' });

    const out = await recordHarvestOutcome(prisma, {
      user: { id: 'u1' },
      cycle: { id: 'c1', profileId: 'f1', cropType: 'tomato',
        plantingDate: new Date(Date.now() - 80 * 86400000) },
      tasks: [
        { id: 't1', status: 'completed' },
        { id: 't2', status: 'completed' },
        { id: 't3', status: 'skipped' },
      ],
      actions: [],
      input: { actualYieldKg: 25, qualityBand: 'good' },
    });

    expect(out.outcome.cropKey).toBe('tomato');
    expect(out.outcome.actualYieldKg).toBe(25);
    expect(out.outcome.qualityBand).toBe('good');
    expect(out.row).toBeTruthy();
    expect(out.riskBand).toBe('low');
    expect(prisma._state.actionLogs[0].actionType).toBe('harvest_reported');
  });
});

describe('feedbackService — graceful degrade when tables missing', () => {
  it('returns null from logAction on P2021-style errors without throwing', async () => {
    const prisma = {
      farmerActionLog: {
        create: async () => {
          const e = new Error('relation "farmer_action_logs" does not exist');
          e.code = 'P2021';
          throw e;
        },
      },
    };
    const out = await logAction(prisma, { actionType: 'task_completed' });
    expect(out).toBeNull();
  });

  it('getRecentActions returns [] on any Prisma error', async () => {
    const prisma = {
      farmerActionLog: { findMany: async () => { throw new Error('offline'); } },
    };
    const out = await getRecentActions(prisma);
    expect(out).toEqual([]);
  });
});
