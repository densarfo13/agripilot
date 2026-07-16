/**
 * orgPilotMetrics.test.js — locks the organization pilot-metrics
 * aggregators + Prisma wrapper + CSV export.
 */

import { describe, it, expect } from 'vitest';

import {
  buildPilotMetrics,
  computeAdoption, computeEngagement, computePerformance,
  computeOutcomes, computeTrends, computeTopRegions,
  computeAtRiskFarmers, deltaOf,
  computeScanEvidence, emptyScanEvidence,
} from '../modules/organizations/pilotMetricsService.js';
import { buildPilotMetricsCsv } from '../modules/organizations/exportService.js';

// ═══════════════════════════════════════════════════════════════
// computeAdoption
// ═══════════════════════════════════════════════════════════════
describe('computeAdoption', () => {
  const NOW = Date.parse('2026-05-15T00:00:00Z');
  const day = (n) => new Date(NOW - n * 24 * 60 * 60 * 1000);

  it('zero shape on empty input', () => {
    expect(computeAdoption([], { now: NOW })).toEqual({
      total: 0, activeWeekly: 0, activeMonthly: 0,
      newThisPeriod: 0, adoptionRate: 0,
    });
  });

  it('counts active farmers by update recency', () => {
    const out = computeAdoption([
      { updatedAt: day(2)  },
      { updatedAt: day(10) },
      { updatedAt: day(40) },
    ], { now: NOW, windowDays: 30 });
    expect(out.total).toBe(3);
    expect(out.activeWeekly).toBe(1);
    expect(out.activeMonthly).toBe(2);
  });

  it('newThisPeriod uses createdAt within windowDays', () => {
    const out = computeAdoption([
      { createdAt: day(5)  },
      { createdAt: day(40) },
    ], { now: NOW, windowDays: 30 });
    expect(out.newThisPeriod).toBe(1);
  });

  it('adoptionRate rounded to 3dp', () => {
    const out = computeAdoption([
      { updatedAt: day(1) }, { updatedAt: day(1) },
      { updatedAt: day(1) }, { updatedAt: day(60) },
    ], { now: NOW });
    expect(out.adoptionRate).toBeCloseTo(0.75, 3);
  });
});

// ═══════════════════════════════════════════════════════════════
// computeEngagement
// ═══════════════════════════════════════════════════════════════
describe('computeEngagement', () => {
  it('null rates on empty input', () => {
    const out = computeEngagement({});
    expect(out.taskCompletionRate).toBeNull();
    expect(out.notificationEngagement).toBeNull();
  });

  it('onTime + late + rate', () => {
    const out = computeEngagement({
      completionEvents: [
        { onTime: true }, { onTime: true }, { onTime: false },
        { onTime: true }, { onTime: false },
      ],
      windowDays: 30,
    });
    expect(out.tasksCompleted).toBe(5);
    expect(out.onTime).toBe(3);
    expect(out.late).toBe(2);
    expect(out.taskCompletionRate).toBeCloseTo(0.6, 2);
  });

  it('tasks/week normalises against window', () => {
    const out = computeEngagement({
      completionEvents: new Array(12).fill({ onTime: true }),
      windowDays: 28,
    });
    expect(out.tasksCompletedPerWeek).toBeCloseTo(3, 1);
  });

  it('notification engagement = read/total', () => {
    const out = computeEngagement({
      smartAlerts: [
        { read: true }, { read: true }, { read: false }, { read: false },
      ],
    });
    expect(out.notificationEngagement).toBeCloseTo(0.5, 2);
  });
});

// ═══════════════════════════════════════════════════════════════
// computePerformance
// ═══════════════════════════════════════════════════════════════
describe('computePerformance', () => {
  const now = new Date('2026-05-15T00:00:00Z');
  const snap = (farmerId, overall, daysAgo = 0) => ({
    farmerId, createdAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
    metadata: { kind: 'farroway_score_snapshot', overall },
  });

  it('neutral shape on no snapshots', () => {
    const out = computePerformance({});
    expect(out.averageScore).toBeNull();
    expect(out.scoreBand).toBeNull();
  });

  it('averages latest per farmer + derives band', () => {
    const out = computePerformance({
      scoreSnapshots: [snap('f1', 50, 5), snap('f1', 80, 1), snap('f2', 70, 2)],
      farmers: [{ id: 'f1' }, { id: 'f2' }],
      farms: [],
    });
    expect(out.averageScore).toBe(75);
    expect(out.scoreBand).toBe('strong');
  });

  it('parses stringified metadata', () => {
    const out = computePerformance({
      scoreSnapshots: [{
        farmerId: 'f1', createdAt: now,
        metadata: JSON.stringify({ kind: 'farroway_score_snapshot', overall: 88 }),
      }],
      farmers: [{ id: 'f1' }],
    });
    expect(out.averageScore).toBe(88);
    expect(out.scoreBand).toBe('excellent');
  });
});

// ═══════════════════════════════════════════════════════════════
// computeOutcomes
// ═══════════════════════════════════════════════════════════════
describe('computeOutcomes', () => {
  it('zero shape on empty', () => {
    expect(computeOutcomes({})).toEqual({
      estimatedYieldKg: 0, marketplaceListings: 0,
      marketplaceRequests: 0, acceptedRequests: 0,
    });
  });

  it('projects yield per crop', () => {
    expect(computeOutcomes({
      farms: [
        { crop: 'maize',    landSizeHectares: 2 },   // 5000
        { crop: 'cassava',  landSizeHectares: 1 },   // 12000
        { crop: 'unknown',  landSizeHectares: 1 },   // 3000 generic
      ],
    }).estimatedYieldKg).toBe(5000 + 12000 + 3000);
  });

  it('counts marketplace actions', () => {
    const out = computeOutcomes({
      auditLogs: [
        { action: 'marketplace.listing.created' },
        { action: 'marketplace.listing.created' },
        { action: 'marketplace.request.created' },
        { action: 'marketplace.bulk_request.created' },
        { action: 'marketplace.request.accepted' },
        { action: 'marketplace.request.declined' },
      ],
    });
    expect(out.marketplaceListings).toBe(2);
    expect(out.marketplaceRequests).toBe(2);
    expect(out.acceptedRequests).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// computeTrends
// ═══════════════════════════════════════════════════════════════
describe('computeTrends', () => {
  const NOW = Date.parse('2026-05-15T00:00:00Z');
  const day = (n) => new Date(NOW - n * 24 * 60 * 60 * 1000);

  it('emits N buckets', () => {
    const out = computeTrends({
      bucket: 'week', bucketCount: 4, now: NOW,
      farmers: [], completionEvents: [], auditLogs: [], scoreSnapshots: [],
    });
    expect(out.length).toBe(4);
  });

  it('buckets events by week', () => {
    const out = computeTrends({
      bucket: 'week', bucketCount: 2, now: NOW,
      farmers: [{ updatedAt: day(2) }],
      completionEvents: [{ completedAt: day(2), onTime: true }],
      auditLogs: [{ action: 'marketplace.listing.created', createdAt: day(2) }],
      scoreSnapshots: [{
        farmerId: 'a', createdAt: day(2),
        metadata: { kind: 'farroway_score_snapshot', overall: 80 },
      }],
    });
    const latest = out[out.length - 1];
    expect(latest.active).toBe(1);
    expect(latest.tasks).toBe(1);
    expect(latest.listings).toBe(1);
    expect(latest.avgScore).toBe(80);
  });

  it('monthly buckets snap to 1st of month UTC', () => {
    const out = computeTrends({ bucket: 'month', bucketCount: 3, now: NOW });
    for (const b of out) expect(new Date(b.monthStart).getUTCDate()).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// computeTopRegions + computeAtRiskFarmers
// ═══════════════════════════════════════════════════════════════
describe('computeTopRegions', () => {
  it('groups by region, sorts by count desc', () => {
    const out = computeTopRegions({
      farmers: [
        { id: 'f1', region: 'Ashanti' }, { id: 'f2', region: 'Ashanti' },
        { id: 'f3', region: 'Lagos' },
      ],
      scoreSnapshots: [{
        farmerId: 'f1', createdAt: new Date(),
        metadata: { kind: 'farroway_score_snapshot', overall: 80 },
      }],
    });
    expect(out[0].region).toBe('Ashanti');
    expect(out[0].farmers).toBe(2);
  });

  it('caps at limit', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `f${i}`, region: `R${i}` }));
    expect(computeTopRegions({ farmers: many, limit: 3 }).length).toBe(3);
  });

  it('uses real task completion rate when 3+ events resolved', () => {
    const out = computeTopRegions({
      farmers: [
        { id: 'f1', region: 'Ashanti' }, { id: 'f2', region: 'Ashanti' },
      ],
      completionEvents: [
        { farmerId: 'f1', onTime: true  },
        { farmerId: 'f1', onTime: true  },
        { farmerId: 'f2', onTime: false },
      ],
    });
    const ashanti = out.find((r) => r.region === 'Ashanti');
    expect(ashanti.taskCompletionRateSource).toBe('events');
    expect(ashanti.taskCompletionRate).toBeCloseTo(0.667, 3);
    expect(ashanti.onTime).toBe(2);
    expect(ashanti.late).toBe(1);
  });

  it('falls back to score proxy below 3 resolved events', () => {
    const out = computeTopRegions({
      farmers: [{ id: 'f1', region: 'Lagos' }],
      scoreSnapshots: [{
        farmerId: 'f1', createdAt: new Date(),
        metadata: { kind: 'farroway_score_snapshot', overall: 82 },
      }],
      completionEvents: [{ farmerId: 'f1', onTime: true }],
    });
    expect(out[0].taskCompletionRateSource).toBe('score_proxy');
    expect(out[0].taskCompletionRate).toBe(1);
  });
});

describe('computeAtRiskFarmers', () => {
  const NOW = Date.parse('2026-05-15T00:00:00Z');

  it('flags low score, high alerts, inactive', () => {
    const OLD = NOW - 60 * 24 * 60 * 60 * 1000;
    const out = computeAtRiskFarmers({
      farmers: [
        { id: 'f1', updatedAt: new Date(NOW) },
        { id: 'f2', updatedAt: new Date(OLD) },
      ],
      scoreSnapshots: [{ farmerId: 'f1', createdAt: new Date(NOW),
        metadata: { kind: 'farroway_score_snapshot', overall: 30 } }],
      alerts: [
        { farmerId: 'f2', read: false, metadata: { priority: 'high' } },
        { farmerId: 'f2', read: false, metadata: { priority: 'high' } },
      ],
      now: NOW,
    });
    const byId = Object.fromEntries(out.map((r) => [r.farmerId, r]));
    expect(byId.f1.reasons.some((r) => r.code === 'low_score')).toBe(true);
    expect(byId.f2.reasons.some((r) => r.code === 'inactive')).toBe(true);
    expect(byId.f2.reasons.some((r) => r.code === 'high_alerts')).toBe(true);
  });

  it('sorts worst-first', () => {
    const OLD = NOW - 60 * 24 * 60 * 60 * 1000;
    const out = computeAtRiskFarmers({
      farmers: [
        { id: 'f1', updatedAt: new Date(NOW) },
        { id: 'f2', updatedAt: new Date(OLD) },
      ],
      scoreSnapshots: [{ farmerId: 'f1', createdAt: new Date(NOW),
        metadata: { kind: 'farroway_score_snapshot', overall: 20 } }],
      alerts: [
        { farmerId: 'f2', read: false, metadata: { priority: 'high' } },
        { farmerId: 'f2', read: false, metadata: { priority: 'high' } },
      ],
      now: NOW,
    });
    expect(out[0].farmerId).toBe('f2');
  });

  it('empty result when nothing is at risk', () => {
    const out = computeAtRiskFarmers({
      farmers: [{ id: 'f1', updatedAt: new Date(NOW) }],
      scoreSnapshots: [{ farmerId: 'f1', createdAt: new Date(NOW),
        metadata: { kind: 'farroway_score_snapshot', overall: 90 } }],
      now: NOW,
    });
    expect(out).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════
// buildPilotMetrics (DB wrapper)
// ═══════════════════════════════════════════════════════════════
describe('buildPilotMetrics', () => {
  function makePrisma({ farmers = [], farms = [], notifications = [], auditLogs = [] } = {}) {
    return {
      farmer: {
        async findMany({ where }) {
          return farmers.filter((f) => f.organizationId === where.organizationId);
        },
      },
      farmProfile: {
        async findMany({ where }) {
          const ids = Array.isArray(where.farmerId?.in) ? new Set(where.farmerId.in) : null;
          return farms.filter((fp) => !ids || ids.has(fp.farmerId));
        },
      },
      farmerNotification: {
        async findMany({ where }) {
          const ids = Array.isArray(where.farmerId?.in) ? new Set(where.farmerId.in) : null;
          return notifications.filter((n) => (!ids || ids.has(n.farmerId))
            && (!where.createdAt?.gte || new Date(n.createdAt) >= where.createdAt.gte));
        },
      },
      auditLog: {
        async findMany({ where }) {
          return auditLogs.filter((a) => a.organizationId === where.organizationId
            && (!where.createdAt?.gte || new Date(a.createdAt) >= where.createdAt.gte)
            && (!where.action?.in || where.action.in.includes(a.action)));
        },
      },
    };
  }

  it('empty org → zeroed shape', async () => {
    const out = await buildPilotMetrics(makePrisma(), { organizationId: 'org-1' });
    expect(out.adoption.total).toBe(0);
    expect(out.engagement.tasksCompleted).toBe(0);
    expect(out.atRiskFarmers).toEqual([]);
  });

  it('null prisma → null', async () => {
    expect(await buildPilotMetrics(null, { organizationId: 'x' })).toBeNull();
  });

  it('integrates across all sources', async () => {
    const nowMs = Date.parse('2026-05-15T00:00:00Z');
    const t = new Date(nowMs - 24 * 60 * 60 * 1000);
    const prisma = makePrisma({
      farmers: [
        { id: 'f1', organizationId: 'org-1', fullName: 'A',
          updatedAt: t, createdAt: t, region: 'Ashanti' },
        { id: 'f2', organizationId: 'org-1', fullName: 'B',
          updatedAt: t, createdAt: t, region: 'Ashanti' },
      ],
      farms: [
        { farmerId: 'f1', crop: 'maize', landSizeHectares: 1 },
        { farmerId: 'f2', crop: 'rice',  landSizeHectares: 2 },
      ],
      notifications: [
        { farmerId: 'f1', notificationType: 'system', createdAt: t,
          metadata: { kind: 'farroway_score_snapshot', overall: 80 } },
      ],
      auditLogs: [
        { organizationId: 'org-1', action: 'marketplace.listing.created', createdAt: t },
        { organizationId: 'org-1', action: 'marketplace.listing.created', createdAt: t },
        { organizationId: 'org-1', action: 'marketplace.request.created', createdAt: t },
      ],
    });
    const out = await buildPilotMetrics(prisma, { organizationId: 'org-1', now: nowMs });
    expect(out.adoption.total).toBe(2);
    expect(out.outcomes.marketplaceListings).toBe(2);
    expect(out.outcomes.marketplaceRequests).toBe(1);
    expect(out.outcomes.estimatedYieldKg).toBe(2500 + 2 * 3000);
    expect(out.topRegions[0].region).toBe('Ashanti');
    expect(out.topRegions[0].farmers).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// CSV export
// ═══════════════════════════════════════════════════════════════
describe('buildPilotMetricsCsv', () => {
  it('emits every section header + well-formed rows', () => {
    const csv = buildPilotMetricsCsv({
      organizationId: 'org-1',
      window: { days: 30 },
      adoption:    { total: 2, activeWeekly: 2, activeMonthly: 2,
                     newThisPeriod: 0, adoptionRate: 0.5 },
      engagement:  { tasksCompleted: 4, tasksCompletedPerWeek: 1,
                     taskCompletionRate: 0.75, onTime: 3, late: 1,
                     notificationEngagement: 0.5 },
      performance: { averageScore: 80, scoreBand: 'strong',
                     scoreDistribution: { excellent: 0, strong: 2, improving: 0, needs_help: 0 },
                     trustDistribution: { low: 0, medium: 1, high: 1, average: 75, count: 2 } },
      outcomes:    { estimatedYieldKg: 7500, marketplaceListings: 2,
                     marketplaceRequests: 1, acceptedRequests: 0 },
      trends:      { weekly: [{ weekStart: '2026-05-11', active: 2, tasks: 1,
                                listings: 2, requests: 1, avgScore: 80 }], monthly: [] },
      topRegions: [{ region: 'Ashanti', farmers: 2, averageScore: 80, taskCompletionRate: 1 }],
      atRiskFarmers: [{ farmerId: 'f3', fullName: 'C', region: 'Lagos',
                         score: 30, reasons: [{ code: 'low_score' }] }],
      generatedAt: '2026-05-15T00:00:00Z',
    });
    expect(csv).toMatch(/section,adoption/);
    expect(csv).toMatch(/section,engagement/);
    expect(csv).toMatch(/section,performance/);
    expect(csv).toMatch(/section,outcomes/);
    expect(csv).toMatch(/section,trends_weekly/);
    expect(csv).toMatch(/section,top_regions/);
    expect(csv).toMatch(/section,at_risk_farmers/);
    expect(csv).toMatch(/Ashanti,2,80/);
    expect(csv).toMatch(/f3,C,Lagos,30,low_score/);
  });

  it('emits period_over_period section when supplied', () => {
    const csv = buildPilotMetricsCsv({
      organizationId: 'org-1',
      window: { days: 30 },
      adoption:    { total: 1, activeWeekly: 1, activeMonthly: 1, newThisPeriod: 0, adoptionRate: 1 },
      engagement:  { tasksCompleted: 3, tasksCompletedPerWeek: 1,
                     taskCompletionRate: 1, onTime: 3, late: 0,
                     notificationEngagement: null, source: 'audit_log' },
      performance: { averageScore: null, scoreBand: null,
                     scoreDistribution: {}, trustDistribution: {} },
      outcomes:    { estimatedYieldKg: 0, marketplaceListings: 0,
                     marketplaceRequests: 0, acceptedRequests: 0 },
      trends:      { weekly: [], monthly: [] },
      topRegions:  [{ region: 'X', farmers: 1, averageScore: null,
                       taskCompletionRate: 1, taskCompletionRateSource: 'events' }],
      atRiskFarmers: [],
      periodOverPeriod: {
        previousWindow: { from: '2026-03-16T00:00:00Z', to: '2026-04-15T00:00:00Z' },
        adoption: {
          activeMonthly: { current: 1, previous: 0, absolute: 1, relative: null },
          adoptionRate:  { current: 1, previous: 0.5, absolute: 0.5, relative: 1 },
          newThisPeriod: { current: 0, previous: 0, absolute: 0, relative: 0 },
        },
        engagement: {
          tasksCompleted: { current: 3, previous: 1, absolute: 2, relative: 2 },
        },
        outcomes: {
          marketplaceListings: { current: 0, previous: 2, absolute: -2, relative: -1 },
        },
      },
      generatedAt: '2026-05-15T00:00:00Z',
    });
    expect(csv).toMatch(/section,period_over_period/);
    expect(csv).toMatch(/previous_window_from,2026-03-16/);
    expect(csv).toMatch(/adoption_active_monthly,1,0,1,/);
    expect(csv).toMatch(/engagement_tasks_completed,3,1,2,2/);
    expect(csv).toMatch(/outcomes_marketplace_listings,0,2,-2,-1/);
    expect(csv).toMatch(/task_completion_rate_source/);
    expect(csv).toMatch(/completion_source,audit_log/);
  });
});

// ═══════════════════════════════════════════════════════════════
// deltaOf
// ═══════════════════════════════════════════════════════════════
describe('deltaOf', () => {
  it('null / null → full-null shape', () => {
    expect(deltaOf(null, null)).toEqual({
      current: null, previous: null, absolute: null, relative: null,
    });
  });

  it('null / value → nulled absolute + relative', () => {
    expect(deltaOf(null, 5)).toEqual({
      current: null, previous: 5, absolute: null, relative: null,
    });
    expect(deltaOf(5, null)).toEqual({
      current: 5, previous: null, absolute: null, relative: null,
    });
  });

  it('positive and negative absolutes', () => {
    expect(deltaOf(8, 5)).toEqual({
      current: 8, previous: 5, absolute: 3, relative: 0.6,
    });
    expect(deltaOf(2, 5)).toEqual({
      current: 2, previous: 5, absolute: -3, relative: -0.6,
    });
  });

  it('previous=0 → relative null unless current is also 0', () => {
    expect(deltaOf(3, 0).relative).toBeNull();
    expect(deltaOf(0, 0).relative).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// buildPilotMetrics — real task events + PoP
// ═══════════════════════════════════════════════════════════════
describe('buildPilotMetrics (real events + PoP)', () => {
  function makePrisma({ farmers = [], farms = [], notifications = [], auditLogs = [] } = {}) {
    return {
      farmer: {
        async findMany({ where }) {
          return farmers.filter((f) => f.organizationId === where.organizationId);
        },
      },
      farmProfile: {
        async findMany({ where }) {
          const ids = Array.isArray(where.farmerId?.in) ? new Set(where.farmerId.in) : null;
          return farms.filter((fp) => !ids || ids.has(fp.farmerId));
        },
      },
      farmerNotification: {
        async findMany({ where }) {
          const ids = Array.isArray(where.farmerId?.in) ? new Set(where.farmerId.in) : null;
          return notifications.filter((n) => (!ids || ids.has(n.farmerId))
            && (!where.createdAt?.gte || new Date(n.createdAt) >= where.createdAt.gte));
        },
      },
      auditLog: {
        async findMany({ where }) {
          return auditLogs.filter((a) => a.organizationId === where.organizationId
            && (!where.createdAt?.gte || new Date(a.createdAt) >= where.createdAt.gte)
            && (!where.action?.in || where.action.in.includes(a.action)));
        },
      },
    };
  }

  it('prefers AuditLog task events over smart-alert proxy', async () => {
    const now = new Date('2026-05-15T00:00:00Z');
    const nowMs = now.getTime();
    const t = new Date(nowMs - 24 * 60 * 60 * 1000); // 1 day before
    const prisma = makePrisma({
      farmers: [{
        id: 'f1', organizationId: 'org-1', fullName: 'A',
        updatedAt: t, createdAt: t, region: 'Ashanti',
      }],
      auditLogs: [
        { organizationId: 'org-1', action: 'task.completed',
          createdAt: t, details: { farmerId: 'f1', templateId: 't1' } },
        { organizationId: 'org-1', action: 'task.completed',
          createdAt: t, details: { farmerId: 'f1', templateId: 't2' } },
        { organizationId: 'org-1', action: 'task.skipped',
          createdAt: t, details: { farmerId: 'f1', templateId: 't3' } },
      ],
    });
    const out = await buildPilotMetrics(prisma, {
      organizationId: 'org-1', now: nowMs,
    });
    expect(out.engagement.source).toBe('audit_log');
    expect(out.engagement.tasksCompleted).toBe(3);
    expect(out.engagement.onTime).toBe(2);
    expect(out.engagement.late).toBe(1);
  });

  it('falls back to smart-alert proxy when no task events exist', async () => {
    const nowMs = Date.parse('2026-05-15T00:00:00Z');
    const t = new Date(nowMs - 24 * 60 * 60 * 1000);
    const prisma = makePrisma({
      farmers: [{
        id: 'f1', organizationId: 'org-1', fullName: 'A',
        updatedAt: t, createdAt: t,
      }],
      notifications: [{
        farmerId: 'f1', notificationType: 'system', read: true, createdAt: t,
        metadata: { kind: 'smart_alert' },
      }],
    });
    const out = await buildPilotMetrics(prisma, {
      organizationId: 'org-1', now: nowMs,
    });
    expect(out.engagement.source).toBe('smart_alert_proxy');
    expect(out.engagement.tasksCompleted).toBe(1);
  });

  it('computes periodOverPeriod deltas', async () => {
    const now   = new Date('2026-05-15T00:00:00Z');
    const older = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000); // in prev window
    const prisma = makePrisma({
      farmers: [{
        id: 'f1', organizationId: 'org-1', fullName: 'A',
        updatedAt: now, createdAt: now,
      }],
      auditLogs: [
        { organizationId: 'org-1', action: 'marketplace.listing.created', createdAt: now },
        { organizationId: 'org-1', action: 'marketplace.listing.created', createdAt: now },
        { organizationId: 'org-1', action: 'marketplace.listing.created', createdAt: older },
        { organizationId: 'org-1', action: 'task.completed',
          createdAt: now,   details: { farmerId: 'f1', templateId: 't1' } },
        { organizationId: 'org-1', action: 'task.completed',
          createdAt: older, details: { farmerId: 'f1', templateId: 't2' } },
      ],
    });
    const out = await buildPilotMetrics(prisma, {
      organizationId: 'org-1', windowDays: 30, now: now.getTime(),
    });
    expect(out.periodOverPeriod).toBeTruthy();
    expect(out.periodOverPeriod.previousWindow.from).toBeTruthy();
    expect(out.periodOverPeriod.outcomes.marketplaceListings.current).toBe(2);
    expect(out.periodOverPeriod.outcomes.marketplaceListings.previous).toBe(1);
    expect(out.periodOverPeriod.outcomes.marketplaceListings.absolute).toBe(1);
    expect(out.periodOverPeriod.engagement.tasksCompleted.current).toBe(1);
    expect(out.periodOverPeriod.engagement.tasksCompleted.previous).toBe(1);
  });

  it('empty org → zeroed periodOverPeriod shape', async () => {
    const out = await buildPilotMetrics(makePrisma(), { organizationId: 'org-0' });
    expect(out.periodOverPeriod).toBeTruthy();
    expect(out.periodOverPeriod.adoption.activeMonthly).toEqual({
      current: 0, previous: 0, absolute: 0, relative: 0,
    });
    expect(out.engagement.source).toBe('audit_log');
  });
});

// ═══════════════════════════════════════════════════════════════
// computeScanEvidence — real scan aggregation, never estimated
// ═══════════════════════════════════════════════════════════════
describe('computeScanEvidence', () => {
  const NOW = Date.parse('2026-05-15T00:00:00Z');
  const DAY = 24 * 60 * 60 * 1000;

  it('empty input → hasData:false, helpfulRate null (no fabrication)', () => {
    const s = computeScanEvidence([], { now: NOW });
    expect(s.hasData).toBe(false);
    expect(s.total).toBe(0);
    expect(s.feedback.responded).toBe(0);
    expect(s.feedback.helpfulRate).toBeNull();
    expect(s.topIssues).toEqual([]);
    expect(s.topCrops).toEqual([]);
    // emptyScanEvidence must match the zero shape exactly.
    expect(emptyScanEvidence()).toEqual(s);
  });

  it('counts feedback / confidence / outcomes exactly as stored', () => {
    const rows = [
      { userFeedback: 'helpful',     confidence: 'high',   predictedIssue: 'Leaf blight', cropName: 'Maize', outcome: 'recovered', createdAt: new Date(NOW - 1 * DAY) },
      { userFeedback: 'helpful',     confidence: 'medium', predictedIssue: 'Leaf blight', cropName: 'Maize', outcome: 'spread',    createdAt: new Date(NOW - 2 * DAY) },
      { userFeedback: 'not_sure',    confidence: 'low',    predictedIssue: 'Aphids',      plantName: 'Tomato',                     createdAt: new Date(NOW - 3 * DAY) },
      { userFeedback: 'not_helpful', confidence: 'high',   predictedIssue: '',            cropName: '',                            createdAt: new Date(NOW - 4 * DAY) },
      { /* no feedback yet */         confidence: 'weird',                                                                          createdAt: new Date(NOW - 5 * DAY) },
    ];
    const s = computeScanEvidence(rows, { now: NOW });
    expect(s.total).toBe(5);
    expect(s.hasData).toBe(true);
    expect(s.feedback).toMatchObject({ helpful: 2, notSure: 1, notHelpful: 1, none: 1, responded: 4 });
    // helpfulRate = 2 helpful / 4 responded = 0.5 (rounded to 3dp)
    expect(s.feedback.helpfulRate).toBe(0.5);
    expect(s.confidence).toEqual({ high: 2, medium: 1, low: 1, unknown: 1 });
    expect(s.outcomes).toMatchObject({ recovered: 1, spread: 1, lost: 0, unknown: 0, none: 3, reported: 2 });
    // Top issue is the one with the highest count; blanks are excluded.
    expect(s.topIssues[0]).toEqual({ label: 'Leaf blight', count: 2 });
    expect(s.topIssues.map((i) => i.label)).not.toContain('');
    expect(s.topCrops[0]).toEqual({ label: 'Maize', count: 2 });
  });

  it('§6 species confirmation — rates from REAL decisions only, null until decided', () => {
    // No decisions yet → null rates, never a fabricated 0%.
    const none = computeScanEvidence([{ userFeedback: 'helpful', createdAt: new Date(NOW - DAY) }], { now: NOW });
    expect(none.speciesConfirmation).toMatchObject({ confirmed: 0, rejected: 0, decided: 0, confirmationRate: null, falseIdentificationRate: null });
    // 2 confirmed + 2 rejected → 0.5 / 0.5; rejected plant names feed topUnknownPlants.
    const rows = [
      { userFeedback: 'farmer_confirmed_species', plantName: 'Tomato',  createdAt: new Date(NOW - DAY) },
      { userFeedback: 'farmer_confirmed_species', plantName: 'Maize',   createdAt: new Date(NOW - DAY) },
      { userFeedback: 'farmer_rejected_species',  plantName: 'Cassava', createdAt: new Date(NOW - DAY) },
      { userFeedback: 'farmer_rejected_species',  plantName: 'Cassava', createdAt: new Date(NOW - DAY) },
    ];
    const s = computeScanEvidence(rows, { now: NOW });
    expect(s.speciesConfirmation).toMatchObject({ confirmed: 2, rejected: 2, decided: 4, confirmationRate: 0.5, falseIdentificationRate: 0.5 });
    expect(s.speciesConfirmation.topUnknownPlants[0]).toEqual({ label: 'Cassava', count: 2 });
    // Species events are NOT double-counted into helpful/none feedback buckets.
    expect(s.feedback.none).toBe(0);
  });

  it('inWindow counts only rows within windowDays; total counts all loaded', () => {
    const rows = [
      { confidence: 'high', createdAt: new Date(NOW - 2 * DAY) },   // in 30d window
      { confidence: 'low',  createdAt: new Date(NOW - 40 * DAY) },  // outside 30d window
    ];
    const s = computeScanEvidence(rows, { now: NOW, windowDays: 30 });
    expect(s.total).toBe(2);
    expect(s.inWindow).toBe(1);
  });

  it('topN is deterministic (count desc, then label asc) and capped at 5', () => {
    const rows = ['b', 'b', 'a', 'a', 'c', 'd', 'e', 'f', 'g'].map((crop, i) => ({
      cropName: crop, createdAt: new Date(NOW - i * DAY),
    }));
    const s = computeScanEvidence(rows, { now: NOW });
    expect(s.topCrops).toHaveLength(5);
    // a and b both have count 2 → a before b (alpha tiebreak)
    expect(s.topCrops[0]).toEqual({ label: 'a', count: 2 });
    expect(s.topCrops[1]).toEqual({ label: 'b', count: 2 });
  });

  it('buildPilotMetrics surfaces org-scoped scan evidence via farmer.userId', async () => {
    const prisma = {
      farmer: {
        async findMany({ where }) {
          expect(where.organizationId).toBe('org-1');
          return [
            { id: 'f1', userId: 'u1', region: 'North', createdAt: new Date(NOW - 10 * DAY) },
            { id: 'f2', userId: 'u2', region: 'North', createdAt: new Date(NOW - 10 * DAY) },
            { id: 'f3', userId: null, region: 'North', createdAt: new Date(NOW - 10 * DAY) }, // no login acct
          ];
        },
      },
      scanTrainingEvent: {
        async findMany({ where }) {
          // Must be scoped to the org's farmer user accounts only.
          expect(where.userId.in.sort()).toEqual(['u1', 'u2']);
          return [
            { userId: 'u1', userFeedback: 'helpful', confidence: 'high', predictedIssue: 'Leaf blight', cropName: 'Maize', createdAt: new Date(NOW - 1 * DAY) },
            { userId: 'u2', userFeedback: 'not_sure', confidence: 'low',  predictedIssue: 'Aphids',      cropName: 'Tomato', createdAt: new Date(NOW - 2 * DAY) },
          ];
        },
      },
    };
    const out = await buildPilotMetrics(prisma, { organizationId: 'org-1', windowDays: 30, now: NOW });
    expect(out.scan).toBeTruthy();
    expect(out.scan.total).toBe(2);
    expect(out.scan.hasData).toBe(true);
    expect(out.scan.feedback.helpful).toBe(1);
    expect(out.scan.feedback.notSure).toBe(1);
    // Both issues have count 1 → deterministic alpha tiebreak (Aphids < Leaf blight).
    expect(out.scan.topIssues.map((i) => i.label)).toEqual(['Aphids', 'Leaf blight']);
    expect(out.scan.topIssues.every((i) => i.count === 1)).toBe(true);
  });

  it('org with no farmers → scan is the honest empty shape', async () => {
    const prisma = { farmer: { async findMany() { return []; } } };
    const out = await buildPilotMetrics(prisma, { organizationId: 'org-empty' });
    expect(out.scan).toEqual(emptyScanEvidence());
    expect(out.scan.hasData).toBe(false);
  });

  it('CSV export includes a scan_evidence section (empty rate stays blank)', () => {
    const csv = buildPilotMetricsCsv({
      organizationId: 'org-1',
      window: { days: 30 }, generatedAt: '2026-05-15T00:00:00Z',
      adoption: { total: 0, activeWeekly: 0, activeMonthly: 0, newThisPeriod: 0, adoptionRate: 0 },
      engagement: { tasksCompleted: 0, tasksCompletedPerWeek: 0, taskCompletionRate: null, onTime: 0, late: 0, notificationEngagement: null, source: 'audit_log' },
      performance: { averageScore: null, scoreBand: null, scoreDistribution: {}, trustDistribution: {} },
      outcomes: { estimatedYieldKg: 0, marketplaceListings: 0, marketplaceRequests: 0, acceptedRequests: 0 },
      scan: computeScanEvidence([
        { userFeedback: 'helpful', confidence: 'high', predictedIssue: 'Leaf blight', cropName: 'Maize', createdAt: new Date(NOW) },
      ], { now: NOW }),
      trends: { weekly: [], monthly: [] },
      topRegions: [], atRiskFarmers: [],
    });
    expect(csv).toContain('scan_evidence');
    expect(csv).toContain('total_scans');
    expect(csv).toContain('feedback_helpful');
    expect(csv).toContain('top_issue,Leaf blight,1');
  });

  it('CSV export handles metrics with no scan section (backward compatible)', () => {
    const csv = buildPilotMetricsCsv({
      organizationId: 'org-1', window: { days: 30 }, generatedAt: 'x',
      adoption: { total: 0, activeWeekly: 0, activeMonthly: 0, newThisPeriod: 0, adoptionRate: 0 },
      engagement: { tasksCompleted: 0, tasksCompletedPerWeek: 0, taskCompletionRate: null, onTime: 0, late: 0, notificationEngagement: null, source: 'audit_log' },
      performance: { averageScore: null, scoreBand: null, scoreDistribution: {}, trustDistribution: {} },
      outcomes: { estimatedYieldKg: 0, marketplaceListings: 0, marketplaceRequests: 0, acceptedRequests: 0 },
      trends: { weekly: [], monthly: [] }, topRegions: [], atRiskFarmers: [],
    });
    expect(csv).toContain('scan_evidence');
    expect(csv).toContain('total_scans,0');
  });
});
