/**
 * autonomousActions.test.js — decision + action + scoring + cron.
 *
 * Backed by injected Prisma + dispatch stubs so no DB, Twilio, or
 * SendGrid calls fire. Exercises the full rule → decision → execute
 * → log flow plus the safety branches (dup, dry-run, missing
 * ActionLog table).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { scoreCandidate, sortByPriority }
  from '../modules/autonomousActions/scoringEngine.js';
import { decideActions, _internal as decisionInternal }
  from '../modules/autonomousActions/decisionEngine.js';
import { executeAction, _drainMemoryLog }
  from '../modules/autonomousActions/actionEngine.js';
import { runOnce, _internal as cronInternal }
  from '../modules/autonomousActions/cronRunner.js';

const NOW = new Date(2026, 3, 20, 12, 0, 0).getTime();
const DAY = 24 * 3600 * 1000;

function makePrisma({
  applications = [], farmers = [], issues = [],
  actionLogs = [],
  actionLogMissing = false,
} = {}) {
  const actionLog = actionLogMissing ? undefined : {
    findFirst: vi.fn(async ({ where } = {}) => {
      return actionLogs.find((r) =>
        r.actionType === where.actionType
        && r.targetId   === where.targetId
        && r.outcome    === 'success'
      ) || null;
    }),
    create: vi.fn(async ({ data }) => {
      const row = { id: `log_${actionLogs.length + 1}`, ...data };
      actionLogs.push(row);
      return row;
    }),
  };
  return {
    actionLog,
    _actionLogs: actionLogs,
    application: {
      findMany: vi.fn(async () => applications),
    },
    farmer: {
      findMany: vi.fn(async () => farmers),
    },
    issue: {
      findMany: vi.fn(async () => issues),
    },
  };
}

beforeEach(() => {
  _drainMemoryLog();
});

// ─── Scoring engine ──────────────────────────────────────────────
describe('scoreCandidate', () => {
  it('empty input → score 0 priority low', () => {
    const r = scoreCandidate({});
    expect(r.score).toBe(0);
    expect(r.priority).toBe('low');
  });

  it('big staple-crop farm + critical long-running issue → critical', () => {
    const r = scoreCandidate({
      farmer: { primaryCrop: 'maize' },
      application: { farmSizeAcres: 12, primaryCrop: 'maize' },
      issue: { severity: 'critical', createdAt: NOW - 20 * DAY },
      now: NOW,
    });
    expect(['high', 'critical']).toContain(r.priority);
    expect(r.reasons.some((x) => x.rule === 'staple_crop')).toBe(true);
    expect(r.reasons.some((x) => x.rule === 'issue_severity')).toBe(true);
    expect(r.reasons.some((x) => x.rule === 'issue_14d_plus')).toBe(true);
  });

  it('stalled onboarding fires invite_*_pending rule', () => {
    const r = scoreCandidate({
      application: { createdAt: NOW - 10 * DAY, acceptedAt: null },
      now: NOW,
    });
    expect(r.reasons.some((x) => x.rule === 'invite_7d_pending')).toBe(true);
  });

  it('inactive farmer fires inactive_*_plus rule', () => {
    const r = scoreCandidate({
      farmer: { lastLoginAt: NOW - 30 * DAY, primaryCrop: 'tomato' },
      now: NOW,
    });
    expect(r.reasons.some((x) => x.rule === 'inactive_21d_plus')).toBe(true);
  });
});

describe('sortByPriority', () => {
  it('orders by score desc, daysSince desc, stable', () => {
    const list = [
      { id: 'a', score: 40, daysSince: 3 },
      { id: 'b', score: 40, daysSince: 10 },
      { id: 'c', score: 80, daysSince: 1 },
    ];
    expect(sortByPriority(list).map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });
});

// ─── Decision engine ─────────────────────────────────────────────
describe('decideActions', () => {
  it('emits stalled onboarding decisions for invites older than 7 days', async () => {
    const prisma = makePrisma({
      applications: [{
        id: 'app_1', farmerId: 'f_1', createdAt: new Date(NOW - 10 * DAY),
        acceptedAt: null,
        farmer: { id: 'f_1', fullName: 'Ada',  phone: '+1', email: 'ada@x.com', primaryCrop: 'maize' },
      }],
    });
    const out = await decideActions({ prisma, now: NOW });
    expect(out).toHaveLength(1);
    expect(out[0].rule).toBe('stalled_onboarding_7d');
    expect(out[0].actionType).toBe('sms_reminder');
    expect(out[0].contact.phone).toBe('+1');
    expect(out[0].channel).toBe('sms');
  });

  it('emits inactive farmer decisions', async () => {
    const prisma = makePrisma({
      farmers: [{
        id: 'f_1', fullName: 'Kofi', phone: '+1', primaryCrop: 'cassava',
        updatedAt: new Date(NOW - 20 * DAY),
        user: { lastLoginAt: new Date(NOW - 20 * DAY), email: 'kofi@x.com' },
      }],
    });
    const out = await decideActions({ prisma, now: NOW });
    expect(out.some((d) => d.rule === 'inactive_farmer_14d')).toBe(true);
  });

  it('emits assign_officer for unassigned high-severity issues', async () => {
    const prisma = makePrisma({
      issues: [{
        id: 'iss_1', severity: 'high', status: 'open', assignedTo: null,
        issueType: 'pest', createdAt: new Date(NOW - 2 * DAY),
        farmerId: 'f_1',
      }],
    });
    const out = await decideActions({ prisma, now: NOW });
    expect(out[0].actionType).toBe('assign_officer');
    expect(out[0].rule).toBe('critical_issue_unassigned');
  });

  it('de-duplicates same farmer between stalled + inactive rules', async () => {
    // A stalled-onboarding applicant who also appears in the
    // inactive list must produce exactly ONE decision.
    const prisma = makePrisma({
      applications: [{
        id: 'app_1', farmerId: 'f_1', createdAt: new Date(NOW - 10 * DAY),
        farmer: { id: 'f_1', fullName: 'Ada', phone: '+1' },
      }],
      farmers: [{
        id: 'f_1', fullName: 'Ada', phone: '+1',
        updatedAt: new Date(NOW - 20 * DAY),
      }],
    });
    const out = await decideActions({ prisma, now: NOW });
    expect(out).toHaveLength(1);
    expect(out[0].rule).toBe('stalled_onboarding_7d');
  });

  it('tolerates Prisma being unavailable', async () => {
    const out = await decideActions({ prisma: null, now: NOW });
    expect(out).toEqual([]);
  });
});

// ─── Action engine ───────────────────────────────────────────────
describe('executeAction', () => {
  const baseDecision = {
    actionType: 'sms_reminder',
    targetType: 'farmer',
    targetId:   'f_1',
    rule:       'stalled_onboarding_7d',
    reason:     'Invite pending',
    priority:   'medium',
    score:      40,
    channel:    'sms',
    contact:    { phone: '+1', farmerId: 'f_1' },
    template:   { subject: 'S', message: 'M' },
  };

  it('dispatch success → outcome success + row written', async () => {
    const prisma = makePrisma();
    const dispatch = vi.fn(async () => ({ channel: 'sms', fallback: false }));
    const r = await executeAction(baseDecision, { prisma, dispatch, now: NOW });
    expect(r.outcome).toBe('success');
    expect(r.channel).toBe('sms');
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(prisma._actionLogs).toHaveLength(1);
    expect(prisma._actionLogs[0].outcome).toBe('success');
  });

  it('dispatch throws → outcome failure, reason captured', async () => {
    const prisma = makePrisma();
    const dispatch = vi.fn(async () => { throw new Error('provider down'); });
    const r = await executeAction(baseDecision, { prisma, dispatch, now: NOW });
    expect(r.outcome).toBe('failure');
    expect(r.reason).toMatch(/provider/);
    expect(prisma._actionLogs[0].outcome).toBe('failure');
  });

  it('same-day duplicate → skipped', async () => {
    const prisma = makePrisma({
      actionLogs: [{
        actionType: 'sms_reminder', targetId: 'f_1', outcome: 'success',
        createdAt: new Date(NOW - 2 * 3600 * 1000),
      }],
    });
    const dispatch = vi.fn();
    const r = await executeAction(baseDecision, { prisma, dispatch, now: NOW });
    expect(r.outcome).toBe('skipped');
    expect(r.reason).toBe('already_sent_today');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('dry-run → skipped, dispatch never called', async () => {
    const prisma = makePrisma();
    const dispatch = vi.fn();
    const r = await executeAction(baseDecision, { prisma, dispatch, now: NOW, dryRun: true });
    expect(r.outcome).toBe('skipped');
    expect(r.reason).toBe('dry_run');
    expect(dispatch).not.toHaveBeenCalled();
    expect(prisma._actionLogs[0].reason).toBe('dry_run');
  });

  it('missing ActionLog table → buffers in memory, still returns result', async () => {
    const prisma = makePrisma({ actionLogMissing: true });
    const dispatch = vi.fn(async () => ({ channel: 'sms', fallback: false }));
    const r = await executeAction(baseDecision, { prisma, dispatch, now: NOW });
    expect(r.outcome).toBe('success');
    expect(r.logId).toBeNull();  // no row id when DB is unavailable
    const drained = _drainMemoryLog();
    expect(drained).toHaveLength(1);
    expect(drained[0].outcome).toBe('success');
  });

  it('assign_officer with no officerId → skipped with reason', async () => {
    const prisma = makePrisma();
    const r = await executeAction({
      actionType: 'assign_officer', targetType: 'issue', targetId: 'i_1',
      rule: 'critical_issue_unassigned', reason: 'x', priority: 'high',
      score: 50, channel: 'in_app', contact: {}, template: { subject: 's', message: 'm' },
    }, { prisma, dispatch: vi.fn(), now: NOW });
    expect(r.outcome).toBe('skipped');
    expect(r.reason).toBe('no_officer_roster');
  });

  it('invalid decision → skipped, no dispatch', async () => {
    const prisma = makePrisma();
    const dispatch = vi.fn();
    const r = await executeAction({}, { prisma, dispatch });
    expect(r.outcome).toBe('skipped');
    expect(r.reason).toBe('invalid_decision');
    expect(dispatch).not.toHaveBeenCalled();
  });
});

// ─── Cron runner ─────────────────────────────────────────────────
describe('runOnce', () => {
  it('aggregates succeeded / skipped / failed counts', async () => {
    const prismaClient = makePrisma({
      applications: [{
        id: 'a', farmerId: 'f_1', createdAt: new Date(NOW - 10 * DAY),
        farmer: { id: 'f_1', fullName: 'Ada', phone: '+1' },
      }],
    });
    const dispatchFn = vi.fn(async () => ({ channel: 'sms', fallback: false }));
    const result = await runOnce({
      prismaClient, dispatchFn, now: NOW, dryRunOverride: false,
    });
    expect(result.cycle).toBe('ok');
    expect(result.stats.considered).toBeGreaterThan(0);
    expect(result.stats.attempted).toBeGreaterThan(0);
    expect(result.stats.succeeded).toBe(1);
    expect(dispatchFn).toHaveBeenCalledTimes(1);
  });

  it('dry-run cycle skips everything without calling dispatch', async () => {
    const prismaClient = makePrisma({
      applications: [{
        id: 'a', farmerId: 'f_1', createdAt: new Date(NOW - 10 * DAY),
        farmer: { id: 'f_1', fullName: 'Ada', phone: '+1' },
      }],
    });
    const dispatchFn = vi.fn();
    const result = await runOnce({
      prismaClient, dispatchFn, now: NOW, dryRunOverride: true,
    });
    expect(result.stats.skipped).toBe(result.stats.attempted);
    expect(dispatchFn).not.toHaveBeenCalled();
  });

  it('readConfig parses env overrides', () => {
    const before = process.env.AUTONOMOUS_ACTION_CRON;
    process.env.AUTONOMOUS_ACTION_CRON = '30 8 * * *';
    process.env.AUTONOMOUS_ACTION_DRY_RUN = '1';
    process.env.AUTONOMOUS_ACTION_BATCH = '25';
    const cfg = cronInternal.readConfig();
    expect(cfg.schedule).toBe('30 8 * * *');
    expect(cfg.dryRun).toBe(true);
    expect(cfg.batch).toBe(25);
    process.env.AUTONOMOUS_ACTION_CRON = before || '';
    delete process.env.AUTONOMOUS_ACTION_DRY_RUN;
    delete process.env.AUTONOMOUS_ACTION_BATCH;
  });
});

// ─── Internals exposed for coverage ──────────────────────────────
describe('decision internals', () => {
  it('clampLimit defends against NaN / negatives / huge values', () => {
    expect(decisionInternal.clampLimit(null, 10)).toBe(10);
    expect(decisionInternal.clampLimit(-5, 10)).toBe(10);
    expect(decisionInternal.clampLimit(10_000)).toBe(500);
    expect(decisionInternal.clampLimit(25)).toBe(25);
  });
});
