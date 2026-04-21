/**
 * ngoWeeklyReport.test.js — weekly report engine + sender + cron.
 */

import { describe, it, expect, vi } from 'vitest';

import {
  buildWeeklyReport, formatReportAsText,
  formatReportAsCsv,  formatReportAsHtml,
} from '../modules/ngoReports/weeklyReportEngine.js';

import {
  sendWeeklyReport,
} from '../modules/ngoReports/weeklyReportSender.js';

import {
  runWeeklyReportOnce, _internal as cronInternal,
} from '../modules/ngoReports/weeklyReportCron.js';

const NOW = new Date(2026, 3, 20, 12, 0, 0).getTime();
const DAY = 24 * 3600 * 1000;

function makePrisma({
  farmerCount = 0,
  farmEvents = [],
  completions = 0, priorCompletions = 0,
  assignments = 0,
  issuesOpen = 0, issuesResolved = 0, priorOpen = 0,
  highRiskMetrics = [],
  issues = [],
  actionLogs = [],
  users = [],
} = {}) {
  return {
    farmer: {
      count: vi.fn(async ({ where }) => farmerCount),
      findUnique: vi.fn(async ({ where }) => ({ id: where.id, fullName: `Farmer ${where.id}` })),
      findMany: vi.fn(async ({ where }) => {
        if (where && where.id && where.id.in) {
          return where.id.in.map((id) => ({ id, fullName: `Farmer ${id}` }));
        }
        return [];
      }),
    },
    farmEvent: {
      findMany: vi.fn(async ({ where }) => {
        const gte = where && where.createdAt && where.createdAt.gte;
        const lt  = where && where.createdAt && where.createdAt.lt;
        return farmEvents.filter((e) => {
          const t = new Date(e.createdAt).getTime();
          if (gte && t < gte.getTime()) return false;
          if (lt  && t >= lt.getTime()) return false;
          return true;
        });
      }),
    },
    farmTaskCompletion: {
      count: vi.fn(async ({ where }) => {
        const lt = where && where.completedAt && where.completedAt.lt;
        return lt ? priorCompletions : completions;
      }),
    },
    farmTaskAssignment: {
      count: vi.fn(async () => assignments),
    },
    issue: {
      count: vi.fn(async ({ where }) => {
        if (where.status === 'resolved') return issuesResolved;
        if (where.createdAt && where.createdAt.lt) return priorOpen;
        return issuesOpen;
      }),
      findMany: vi.fn(async () => issues),
    },
    farmMetrics: {
      findMany: vi.fn(async () => highRiskMetrics),
    },
    actionLog: {
      findMany: vi.fn(async () => actionLogs),
    },
    user: {
      findMany: vi.fn(async () => users),
    },
  };
}

// ─── Engine ──────────────────────────────────────────────────────
describe('buildWeeklyReport', () => {
  it('empty prisma → zeroed sections, no throws', async () => {
    const report = await buildWeeklyReport({ prisma: null, now: NOW });
    expect(report.summary.totalFarmers).toBe(0);
    expect(report.summary.activeFarmers).toBe(0);
    expect(report.activity.byDay).toEqual([]);
    expect(report.risk.topRiskyFarms).toEqual([]);
    expect(report.needsAttention).toEqual([]);
    expect(Object.isFrozen(report)).toBe(true);
  });

  it('aggregates summary across a normal dataset', async () => {
    const prisma = makePrisma({
      farmerCount: 120,
      farmEvents: [
        { farmerId: 'f1', type: 'task_completed', createdAt: new Date(NOW - 2 * DAY) },
        { farmerId: 'f2', type: 'login',         createdAt: new Date(NOW - DAY) },
        { farmerId: 'f3', type: 'login',         createdAt: new Date(NOW - 10 * DAY) },
      ],
      completions: 45, priorCompletions: 30,
      assignments: 60,
      issuesOpen: 5, issuesResolved: 2, priorOpen: 3,
      highRiskMetrics: [
        { farmId: 'f_a', metric: 'risk_score', value: 75, capturedAt: new Date(NOW - DAY), metadata: { factors: [] } },
        { farmId: 'f_b', metric: 'risk_score', value: 32, capturedAt: new Date(NOW - DAY), metadata: {} },
        { farmId: 'f_c', metric: 'risk_score', value: 12, capturedAt: new Date(NOW - DAY), metadata: {} },
      ],
      issues: [
        { id: 'i1', farmId: 'f_a', status: 'open', severity: 'critical', issueType: 'pest',
          createdAt: new Date(NOW - 3 * DAY), updatedAt: new Date(NOW - DAY), farmerName: 'Ada' },
      ],
      actionLogs: [
        { actionType: 'sms_reminder', outcome: 'success' },
        { actionType: 'sms_reminder', outcome: 'failure' },
        { actionType: 'assign_to_officer', outcome: 'success' },
      ],
    });
    const report = await buildWeeklyReport({ prisma, now: NOW });
    expect(report.summary.totalFarmers).toBe(120);
    expect(report.summary.activeFarmers).toBe(2); // f1 + f2 in window
    expect(report.summary.inactiveFarmers).toBe(118);
    expect(report.summary.openIssues).toBe(5);
    expect(report.summary.resolvedIssues).toBe(2);
    expect(report.summary.highRiskFarmers).toBe(1); // only f_a (>=60)
    expect(report.summary.changeVsPrior.tasksCompleted).toBe(15);
    expect(report.summary.taskCompletionRate).toBe(Math.round((45 / 60) * 100) / 100);
    expect(report.risk.distribution.critical).toBe(1);
    expect(report.risk.topRiskyFarms[0].score).toBe(75);
    expect(report.needsAttention).toHaveLength(1);
    expect(report.actionsTaken.find((a) => a.type === 'sms_reminder').successRate).toBeCloseTo(0.5, 2);
  });

  it('activity.byDay groups by ISO date', async () => {
    const prisma = makePrisma({
      farmEvents: [
        { farmerId: 'f1', createdAt: new Date(NOW - DAY) },
        { farmerId: 'f2', createdAt: new Date(NOW - DAY) },
        { farmerId: 'f3', createdAt: new Date(NOW - 2 * DAY) },
      ],
    });
    const report = await buildWeeklyReport({ prisma, now: NOW });
    expect(report.activity.byDay.length).toBeGreaterThan(0);
    const day = report.activity.byDay.find((d) => d.count === 2);
    expect(day).toBeTruthy();
  });

  it('honours program filter on summary + activity', async () => {
    const prisma = makePrisma({ farmerCount: 77 });
    const report = await buildWeeklyReport({ prisma, program: 'ngo_ghana_2026', now: NOW });
    expect(report.meta.program).toBe('ngo_ghana_2026');
    expect(prisma.farmer.count).toHaveBeenCalledWith({ where: { program: 'ngo_ghana_2026' } });
  });
});

// ─── Formatters ──────────────────────────────────────────────────
describe('formatters', () => {
  it('plain-text render carries the decision-first sections', async () => {
    const prisma = makePrisma({
      farmerCount: 10,
      issues: [
        { id: 'i1', farmId: 'f1', status: 'open', severity: 'critical', issueType: 'pest',
          createdAt: new Date(NOW - DAY), updatedAt: new Date(NOW), farmerName: 'Ada' },
      ],
      actionLogs: [{ actionType: 'sms_reminder', outcome: 'success' }],
    });
    const report = await buildWeeklyReport({ prisma, now: NOW });
    const text = formatReportAsText(report);
    expect(text).toMatch(/Summary:/);
    expect(text).toMatch(/Needs attention:/);
    expect(text).toMatch(/Actions taken:/);
    expect(text).toMatch(/sms_reminder/);
  });

  it('csv export emits stable headers + a row per ranked farm', async () => {
    const prisma = makePrisma({
      highRiskMetrics: [
        { farmId: 'f1', metric: 'risk_score', value: 70, capturedAt: new Date(NOW), metadata: {} },
        { farmId: 'f2', metric: 'risk_score', value: 40, capturedAt: new Date(NOW), metadata: {} },
      ],
    });
    const report = await buildWeeklyReport({ prisma, now: NOW });
    const csv = formatReportAsCsv(report);
    const [header, ...rows] = csv.trim().split('\n');
    expect(header.split(',')).toEqual(
      ['farmId','farmerName','score','level','reason','priority','daysSince'],
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0]).toMatch(/70/);
  });

  it('html export is print-to-PDF ready + escapes user-supplied text', async () => {
    const prisma = makePrisma({
      issues: [{
        id: 'x', farmId: 'f1', status: 'open', severity: 'high',
        issueType: '<script>alert(1)</script>',
        createdAt: new Date(NOW - DAY), updatedAt: new Date(NOW),
        farmerName: null,
      }],
    });
    const report = await buildWeeklyReport({ prisma, now: NOW });
    const html = formatReportAsHtml(report);
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toMatch(/Weekly report/);
    expect(html).not.toMatch(/<script>alert\(1\)<\/script>/);
    expect(html).toMatch(/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  });

  it('html renders a friendly state when no attention items', async () => {
    const report = await buildWeeklyReport({ prisma: null, now: NOW });
    expect(formatReportAsHtml(report)).toMatch(/Everything looks clear/);
  });
});

// ─── Sender ──────────────────────────────────────────────────────
describe('sendWeeklyReport', () => {
  it('no recipients → skipped cleanly', async () => {
    const r = await sendWeeklyReport({ recipients: [], prisma: null });
    expect(r.sent).toBe(0);
    expect(r.reason).toBe('no_recipients');
  });

  it('sends one email per recipient with scoped report', async () => {
    const fetchEmail = vi.fn(async () => ({ sent: true }));
    const prisma = makePrisma({ farmerCount: 5 });
    const r = await sendWeeklyReport({
      recipients: [
        { email: 'a@ngo.com', program: 'p1' },
        { email: 'b@ngo.com', program: 'p2' },
      ],
      prisma, now: NOW, fetchEmail,
    });
    expect(r.sent).toBe(2);
    expect(r.failed).toBe(0);
    expect(fetchEmail).toHaveBeenCalledTimes(2);
    // Subject contains the program label.
    expect(fetchEmail.mock.calls[0][0].subject).toMatch(/p1/);
    expect(fetchEmail.mock.calls[1][0].subject).toMatch(/p2/);
  });

  it('skip outcome from fetcher is tagged, not counted as failure', async () => {
    const fetchEmail = vi.fn(async () => ({ sent: false, skipped: true, reason: 'email_not_configured' }));
    const r = await sendWeeklyReport({
      recipients: [{ email: 'x@ngo.com' }],
      prisma: null, now: NOW, fetchEmail,
    });
    expect(r.skipped).toBe(1);
    expect(r.failed).toBe(0);
  });

  it('thrown fetcher turns into failed row, loop continues', async () => {
    const fetchEmail = vi.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ sent: true });
    const r = await sendWeeklyReport({
      recipients: [
        { email: 'a@ngo.com' },
        { email: 'b@ngo.com' },
      ],
      prisma: null, now: NOW, fetchEmail,
    });
    expect(r.sent).toBe(1);
    expect(r.failed).toBe(1);
    const b = r.deliveries.find((d) => d.email === 'b@ngo.com');
    expect(b.outcome).toBe('sent');
  });

  it('calls actionLog when provided', async () => {
    const actionLog = vi.fn(async () => {});
    await sendWeeklyReport({
      recipients: [{ email: 'a@ngo.com' }],
      prisma: null, now: NOW,
      fetchEmail: async () => ({ sent: true }),
      actionLog,
    });
    expect(actionLog).toHaveBeenCalledTimes(1);
    const call = actionLog.mock.calls[0][0];
    expect(call.actionType).toBe('weekly_report_email');
    expect(call.outcome).toBe('success');
  });
});

// ─── Cron runner ─────────────────────────────────────────────────
describe('runWeeklyReportOnce', () => {
  it('dryRun compiles + logs but never calls sendgrid', async () => {
    const prisma = makePrisma({
      farmerCount: 12,
      users: [{ id: 'u1', email: 'a@ngo.com', fullName: 'Ada', role: 'ngo_admin' }],
    });
    const fetchEmail = vi.fn();
    const res = await runWeeklyReportOnce({
      prisma, dryRunOverride: true, fetchEmail, now: NOW,
    });
    expect(res.cycle).toBe('ok');
    expect(res.dryRun).toBe(true);
    expect(res.recipients).toBeGreaterThan(0);
    expect(res.skipped).toBeGreaterThan(0);
    expect(fetchEmail).not.toHaveBeenCalled();
  });

  it('with recipients passed explicitly bypasses prisma.user query', async () => {
    const prisma = makePrisma({ farmerCount: 3 });
    const fetchEmail = vi.fn(async () => ({ sent: true }));
    const res = await runWeeklyReportOnce({
      prisma, now: NOW, fetchEmail,
      recipients: [{ email: 'ops@farroway.com' }],
    });
    expect(res.sent).toBe(1);
    expect(res.recipients).toBe(1);
  });

  it('missing recipients → cycle ok with 0 sent', async () => {
    const prisma = { user: { findMany: async () => [] } };
    const res = await runWeeklyReportOnce({
      prisma, now: NOW, fetchEmail: vi.fn(),
    });
    expect(res.sent).toBe(0);
    expect(res.recipients).toBe(0);
  });

  it('readConfig parses env overrides', () => {
    const before = process.env.NGO_WEEKLY_REPORT_CRON;
    process.env.NGO_WEEKLY_REPORT_CRON = '30 9 * * 1';
    process.env.NGO_WEEKLY_REPORT_DRY_RUN = '1';
    process.env.NGO_WEEKLY_REPORT_PROGRAM = 'p1,p2';
    const cfg = cronInternal.readConfig();
    expect(cfg.schedule).toBe('30 9 * * 1');
    expect(cfg.dryRun).toBe(true);
    expect(cfg.programs).toEqual(['p1', 'p2']);
    process.env.NGO_WEEKLY_REPORT_CRON = before || '';
    delete process.env.NGO_WEEKLY_REPORT_DRY_RUN;
    delete process.env.NGO_WEEKLY_REPORT_PROGRAM;
  });
});
