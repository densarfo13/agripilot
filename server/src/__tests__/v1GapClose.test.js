/**
 * v1GapClose.test.js — tests for the v1 gap-close pass:
 *   - RBAC middleware
 *   - CropCycle status machine
 *   - Cycle risk engine
 *   - State mapping validator
 *   - Peanut task template
 */
import { describe, it, expect, vi } from 'vitest';
import { requireAuth, requireRole, requireOwnershipOrRole, blockRoles } from '../../middleware/rbac.js';
import { canTransition, isValidStatus, transitionError, TERMINAL_STATUSES, ACTIVE_STATUSES } from '../services/cropCycles/statusMachine.js';
import { assessCycleRisk } from '../services/cropCycles/cycleRiskEngine.js';
import { validateStateMapping } from '../domain/us/validateStateMapping.js';
import { templateFor, generateWeeklyTasks } from '../services/cropCycles/taskPlanEngine.js';

function makeRes() {
  const res = {};
  res.statusCode = 200;
  res.body = null;
  res.status = vi.fn((c) => { res.statusCode = c; return res; });
  res.json = vi.fn((b) => { res.body = b; return res; });
  return res;
}

// ─── RBAC ───────────────────────────────────────────────
describe('rbac.requireAuth', () => {
  it('401s when there is no user', () => {
    const res = makeRes();
    const next = vi.fn();
    requireAuth({ user: null }, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
  it('passes through when authenticated', () => {
    const res = makeRes();
    const next = vi.fn();
    requireAuth({ user: { id: 'u1', role: 'farmer' } }, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('rbac.requireRole', () => {
  it('admin always passes through', () => {
    const res = makeRes();
    const next = vi.fn();
    requireRole('reviewer')({ user: { id: 'u', role: 'admin' } }, res, next);
    expect(next).toHaveBeenCalled();
  });
  it('matching role passes', () => {
    const res = makeRes();
    const next = vi.fn();
    requireRole('reviewer')({ user: { id: 'u', role: 'reviewer' } }, res, next);
    expect(next).toHaveBeenCalled();
  });
  it('non-matching role gets 403', () => {
    const res = makeRes();
    const next = vi.fn();
    requireRole('reviewer')({ user: { id: 'u', role: 'farmer' } }, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('rbac.requireOwnershipOrRole', () => {
  it('allows owner through', async () => {
    const res = makeRes();
    const next = vi.fn();
    const mw = requireOwnershipOrRole({
      resolveOwnerId: async () => 'u1',
      allowRoles: ['admin'],
    });
    await mw({ user: { id: 'u1', role: 'farmer' } }, res, next);
    expect(next).toHaveBeenCalled();
  });
  it('allows reviewer via allow list', async () => {
    const res = makeRes();
    const next = vi.fn();
    const mw = requireOwnershipOrRole({
      resolveOwnerId: async () => 'other',
      allowRoles: ['reviewer'],
    });
    await mw({ user: { id: 'u1', role: 'reviewer' } }, res, next);
    expect(next).toHaveBeenCalled();
  });
  it('403s non-owner non-role', async () => {
    const res = makeRes();
    const next = vi.fn();
    const mw = requireOwnershipOrRole({
      resolveOwnerId: async () => 'someone_else',
      allowRoles: [],
    });
    await mw({ user: { id: 'u1', role: 'farmer' } }, res, next);
    expect(res.statusCode).toBe(403);
  });
  it('404s when resource is not found', async () => {
    const res = makeRes();
    const next = vi.fn();
    const mw = requireOwnershipOrRole({
      resolveOwnerId: async () => null,
      allowRoles: [],
    });
    await mw({ user: { id: 'u1', role: 'farmer' } }, res, next);
    expect(res.statusCode).toBe(404);
  });
});

describe('rbac.blockRoles', () => {
  it('blocks listed roles', () => {
    const res = makeRes();
    const next = vi.fn();
    blockRoles('buyer', 'investor')({ user: { id: 'u', role: 'buyer' } }, res, next);
    expect(res.statusCode).toBe(403);
  });
  it('lets other roles through', () => {
    const res = makeRes();
    const next = vi.fn();
    blockRoles('buyer', 'investor')({ user: { id: 'u', role: 'farmer' } }, res, next);
    expect(next).toHaveBeenCalled();
  });
});

// ─── Status machine ─────────────────────────────────────
describe('statusMachine', () => {
  it('accepts the happy path planned→planting→growing→flowering→harvest_ready→harvested', () => {
    const path = ['planned', 'planting', 'growing', 'flowering', 'harvest_ready', 'harvested'];
    for (let i = 1; i < path.length; i += 1) {
      expect(canTransition(path[i - 1], path[i])).toBe(true);
    }
  });
  it('rejects backwards jumps', () => {
    expect(canTransition('growing', 'planted')).toBe(false);
    expect(canTransition('harvest_ready', 'planted')).toBe(false);
  });
  it('rejects skipping states', () => {
    expect(canTransition('planned', 'harvest_ready')).toBe(false);
  });
  it('accepts active→delayed and active→failed', () => {
    for (const from of ['planning', 'planting', 'growing', 'flowering']) {
      if (!isValidStatus(from)) continue;
      expect(canTransition(from, 'delayed') || from === 'planning').toBeTruthy();
      expect(canTransition(from, 'failed') || from === 'planning').toBeTruthy();
    }
  });
  it('terminal states cannot leave', () => {
    for (const t of TERMINAL_STATUSES) {
      expect(canTransition(t, 'planting')).toBe(false);
      expect(canTransition(t, 'growing')).toBe(false);
    }
  });
  it('new cycles can only land on planned or planting', () => {
    expect(canTransition(null, 'planned')).toBe(true);
    expect(canTransition(null, 'planting')).toBe(true);
    expect(canTransition(null, 'growing')).toBe(false);
  });
  it('transitionError carries from/to context', () => {
    const err = transitionError('growing', 'planned');
    expect(err.code).toBe('invalid_status_transition');
    expect(err.from).toBe('growing');
    expect(err.to).toBe('planned');
    expect(err.status).toBe(409);
  });
  it('ACTIVE_STATUSES covers the main lifecycle but not terminals', () => {
    expect(ACTIVE_STATUSES.includes('harvested')).toBe(false);
    expect(ACTIVE_STATUSES.includes('failed')).toBe(false);
    expect(ACTIVE_STATUSES.includes('growing')).toBe(true);
  });
});

// ─── Cycle risk engine ──────────────────────────────────
describe('cycleRiskEngine.assessCycleRisk', () => {
  const cycle = {
    createdAt: new Date('2026-04-01'),
    plantingDate: new Date('2026-04-01'),
    lifecycleStatus: 'growing',
  };

  it('returns low risk on a clean cycle', () => {
    const r = assessCycleRisk({ tasks: [], issues: [], cycle, now: new Date('2026-04-02') });
    expect(r.riskLevel).toBe('low');
    expect(r.riskScore).toBe(0);
  });
  it('single overdue task raises risk modestly', () => {
    const tasks = [
      { status: 'pending', dueDate: new Date('2026-04-01'), title: 'Water the field', priority: 'high' },
    ];
    const r = assessCycleRisk({ tasks, issues: [], cycle, now: new Date('2026-04-05') });
    expect(r.riskScore).toBeGreaterThan(0);
    expect(r.reasons.join(' ')).toMatch(/overdue/);
    expect(r.nextAction).toMatch(/Water the field/);
  });
  it('three+ overdue tasks tips into high risk', () => {
    const tasks = [
      { status: 'pending', dueDate: new Date('2026-04-01'), title: 't1' },
      { status: 'pending', dueDate: new Date('2026-04-01'), title: 't2' },
      { status: 'pending', dueDate: new Date('2026-04-01'), title: 't3' },
      { status: 'pending', dueDate: new Date('2026-04-01'), title: 't4' },
    ];
    const r = assessCycleRisk({ tasks, issues: [], cycle, now: new Date('2026-04-10') });
    expect(['medium', 'high']).toContain(r.riskLevel);
    expect(r.riskScore).toBeGreaterThanOrEqual(25);
  });
  it('open high-severity issue raises risk to at least medium', () => {
    const r = assessCycleRisk({
      tasks: [],
      issues: [{ severity: 'high', status: 'open', category: 'pest' }],
      cycle,
      now: new Date('2026-04-05'),
    });
    expect(['medium', 'high']).toContain(r.riskLevel);
    expect(r.riskScore).toBeGreaterThanOrEqual(25);
  });
  it('two open high-severity issues push to high risk + surface nextAction', () => {
    const r = assessCycleRisk({
      tasks: [],
      issues: [
        { severity: 'high', status: 'open', category: 'pest' },
        { severity: 'high', status: 'in_review', category: 'disease' },
      ],
      cycle,
      now: new Date('2026-04-05'),
    });
    expect(r.riskLevel).toBe('high');
    expect(r.nextAction).toMatch(/pest|disease/i);
  });
  it('resolved issues do not count against risk', () => {
    const r = assessCycleRisk({
      tasks: [],
      issues: [{ severity: 'high', status: 'resolved', category: 'pest' }],
      cycle,
      now: new Date('2026-04-05'),
    });
    expect(r.riskLevel).toBe('low');
    expect(r.riskScore).toBe(0);
  });
  it('inactivity past 14 days adds risk', () => {
    const r = assessCycleRisk({
      tasks: [],
      issues: [],
      cycle: { ...cycle, createdAt: new Date('2026-03-01') },
      now: new Date('2026-04-01'),
    });
    expect(r.riskScore).toBeGreaterThan(0);
    expect(r.reasons.join(' ')).toMatch(/days/);
  });
});

// ─── State mapping validator ────────────────────────────
describe('validateStateMapping', () => {
  it('the shipped US_STATES table is valid', () => {
    const report = validateStateMapping();
    if (!report.ok) {
      // Surface failures clearly when it regresses.
      throw new Error('State mapping invalid:\n' + report.errors.join('\n'));
    }
    expect(report.ok).toBe(true);
    expect(report.count).toBe(51);
  });
});

// ─── Peanut task template ──────────────────────────────
describe('taskPlanEngine peanut template', () => {
  it('peanut has a dedicated specialized template', () => {
    const t = templateFor('peanut');
    expect(t.length).toBeGreaterThanOrEqual(5);
    expect(t.some((s) => /pegging|deep-till|leaf spot/i.test(s.title + ' ' + (s.detail || '')))).toBe(true);
  });
  it('peanut generates tasks with spaced due dates across months', () => {
    const planted = new Date('2026-04-15');
    const tasks = generateWeeklyTasks({ cropKey: 'peanut', plantedDate: planted });
    expect(tasks.length).toBeGreaterThanOrEqual(5);
    // The last task should be many weeks past planting.
    const last = tasks[tasks.length - 1];
    const diffDays = (last.dueDate.getTime() - planted.getTime()) / 86_400_000;
    expect(diffDays).toBeGreaterThan(60);
  });
  it('peanut differs from tomato', () => {
    const p = templateFor('peanut').map((s) => s.title).join('|');
    const t = templateFor('tomato').map((s) => s.title).join('|');
    expect(p).not.toBe(t);
  });
});
