/**
 * intelligenceV2.test.js — V2 risk + recommendations + learning log.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { computeFarmRisk }
  from '../modules/intelligenceV2/riskModel.js';
import { getRecommendations }
  from '../modules/intelligenceV2/recommendationEngine.js';
import {
  logPrediction, logActionTaken, logOutcome,
  getLearningTrail, _drainMemoryBuffer,
} from '../modules/intelligenceV2/learningLogger.js';

const NOW = new Date(2026, 3, 20, 12, 0, 0).getTime();
const DAY = 24 * 3600 * 1000;

function makePrisma() {
  const rows = [];
  return {
    _rows: rows,
    actionLog: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `log_${rows.length + 1}`, createdAt: new Date(), ...data };
        rows.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where, take }) => {
        return rows
          .filter((r) => r.targetId === where.targetId)
          .slice(-Math.min(take || 50, rows.length))
          .reverse();
      }),
    },
  };
}

beforeEach(() => {
  _drainMemoryBuffer();
});

// ─── riskModel ───────────────────────────────────────────────────
describe('computeFarmRisk', () => {
  it('empty input → score 0 level low', () => {
    const r = computeFarmRisk({});
    expect(r.score).toBe(0);
    expect(r.level).toBe('low');
    expect(r.factors).toEqual([]);
  });

  it('open critical issue → at least high', () => {
    const r = computeFarmRisk({
      farm: { id: 'f1', crop: 'maize' },
      issues: [{ severity: 'critical', status: 'open', createdAt: NOW - 2 * DAY }],
      now: NOW,
    });
    expect(['high', 'critical']).toContain(r.level);
    expect(r.factors.some((f) => f.source === 'issues')).toBe(true);
  });

  it('disease detection on staple crop adds bump', () => {
    const r = computeFarmRisk({
      farm: { id: 'f1', crop: 'maize' },
      disease: { riskLevel: 'high', likelyIssue: 'rust', confidenceScore: 0.85 },
      now: NOW,
    });
    expect(r.score).toBeGreaterThan(20);
    const rules = r.factors.map((f) => f.rule);
    expect(rules).toContain('disease_high');
    expect(rules).toContain('disease_on_staple');
    expect(rules).toContain('disease_high_confidence');
  });

  it('low-confidence disease pulls back the score', () => {
    const hi = computeFarmRisk({
      farm: { crop: 'maize' },
      disease: { riskLevel: 'medium', confidenceScore: 0.9 },
      now: NOW,
    });
    const lo = computeFarmRisk({
      farm: { crop: 'maize' },
      disease: { riskLevel: 'medium', confidenceScore: 0.2 },
      now: NOW,
    });
    expect(lo.score).toBeLessThan(hi.score);
    expect(lo.factors.some((f) => f.rule === 'disease_low_confidence')).toBe(true);
  });

  it('weather excessive_heat contributes', () => {
    const r = computeFarmRisk({
      weather: { status: 'excessive_heat' }, now: NOW,
    });
    expect(r.factors.some((f) => f.rule === 'weather_excessive_heat')).toBe(true);
  });

  it('inactivity bumps the score and level', () => {
    const low = computeFarmRisk({ activity: { lastActivityAt: NOW - 2 * DAY }, now: NOW });
    const hi  = computeFarmRisk({ activity: { lastActivityAt: NOW - 30 * DAY }, now: NOW });
    expect(hi.score).toBeGreaterThan(low.score);
    expect(hi.factors.some((f) => f.rule === 'inactive_21d_plus')).toBe(true);
  });

  it('audience.farmer is short + action-framed', () => {
    const r = computeFarmRisk({
      issues: [{ severity: 'high', status: 'open', createdAt: NOW - DAY }], now: NOW,
    });
    expect(typeof r.audience.farmer).toBe('string');
    expect(r.audience.farmer.length).toBeGreaterThan(10);
    expect(r.audience.farmer.length).toBeLessThan(200);
  });

  it('audience.admin lists top factors with weights', () => {
    const r = computeFarmRisk({
      issues: [{ severity: 'high', status: 'open', createdAt: NOW - 20 * DAY }], now: NOW,
    });
    expect(r.audience.admin).toMatch(/\+/);
    expect(r.audience.admin).toMatch(/Risk/);
  });

  it('resolved issues do not contribute', () => {
    const r = computeFarmRisk({
      issues: [{ severity: 'critical', status: 'resolved', createdAt: NOW - DAY }],
      now: NOW,
    });
    expect(r.score).toBe(0);
  });

  it('output is frozen end-to-end', () => {
    const r = computeFarmRisk({ farm: { crop: 'rice' }, now: NOW });
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.factors)).toBe(true);
    expect(Object.isFrozen(r.audience)).toBe(true);
  });
});

// ─── recommendationEngine ────────────────────────────────────────
describe('getRecommendations', () => {
  it('no risk → empty list', () => {
    expect(getRecommendations({})).toEqual([]);
  });

  it('low-risk stable farm → reassure_stable line for farmer', () => {
    const risk = computeFarmRisk({ farm: { crop: 'maize' }, now: NOW });
    const recs = getRecommendations({ risk, farm: { crop: 'maize' }, now: NOW });
    expect(recs.some((r) => r.id === 'reassure_stable')).toBe(true);
    expect(recs.every((r) => r.safe === true || r.audience !== 'farmer')).toBe(true);
  });

  it('critical risk fires schedule_visit + request_scan', () => {
    const risk = computeFarmRisk({
      farm: { crop: 'maize' },
      disease: { riskLevel: 'critical', confidenceScore: 0.95 },
      issues: [{ severity: 'critical', status: 'open', createdAt: NOW - 15 * DAY }],
      now: NOW,
    });
    const recs = getRecommendations({ risk, farm: { crop: 'maize' }, now: NOW });
    const ids = recs.map((r) => r.id);
    expect(ids).toContain('schedule_visit_critical');
    expect(ids).toContain('request_scan_critical');
    // schedule_visit should be flagged unsafe (admin-confirm required).
    const visit = recs.find((r) => r.id === 'schedule_visit_critical');
    expect(visit.safe).toBe(false);
  });

  it('disease + high risk → self_inspect (safe) + assign_officer (unsafe)', () => {
    const risk = computeFarmRisk({
      farm: { crop: 'maize' },
      disease: { riskLevel: 'high', likelyIssue: 'blight', confidenceScore: 0.8 },
      now: NOW,
    });
    const recs = getRecommendations({ risk, farm: { crop: 'maize' }, now: NOW });
    const selfInspect = recs.find((r) => r.id === 'self_inspect_disease');
    const assign      = recs.find((r) => r.id === 'assign_officer_disease');
    expect(selfInspect).toBeTruthy();
    expect(selfInspect.safe).toBe(true);
    expect(assign).toBeTruthy();
    expect(assign.safe).toBe(false);
  });

  it('weather excessive_heat → farmer SMS with specific text', () => {
    const risk = computeFarmRisk({
      weather: { status: 'excessive_heat' },
      activity: { lastActivityAt: NOW - DAY },
      now: NOW,
    });
    const recs = getRecommendations({ risk, farm: { crop: 'tomato' }, now: NOW });
    const sms = recs.find((r) => r.id === 'send_sms_weather_excessive_heat');
    expect(sms).toBeTruthy();
    expect(sms.audience).toBe('farmer');
    expect(sms.safe).toBe(true);
    expect(sms.rationale).toMatch(/heat/i);
  });

  it('stale open issue → assign_officer_stale_issue', () => {
    const risk = computeFarmRisk({
      issues: [{ severity: 'high', status: 'open', createdAt: NOW - 10 * DAY }],
      now: NOW,
    });
    const recs = getRecommendations({ risk, now: NOW });
    expect(recs.some((r) => r.id === 'assign_officer_stale_issue')).toBe(true);
  });

  it('inactive farmer → safe SMS nudge', () => {
    const risk = computeFarmRisk({
      activity: { lastActivityAt: NOW - 18 * DAY }, now: NOW,
    });
    const recs = getRecommendations({ risk, now: NOW });
    const nudge = recs.find((r) => r.id === 'send_sms_inactive');
    expect(nudge).toBeTruthy();
    expect(nudge.safe).toBe(true);
  });

  it('dedupes by id', () => {
    const risk = computeFarmRisk({
      farm: { crop: 'maize' },
      disease: { riskLevel: 'critical', confidenceScore: 0.9 },
      now: NOW,
    });
    const recs = getRecommendations({ risk, farm: { crop: 'maize' }, now: NOW });
    const ids = recs.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── learningLogger ──────────────────────────────────────────────
describe('learningLogger', () => {
  it('logPrediction writes a prediction row via prisma when available', async () => {
    const prisma = makePrisma();
    const risk = computeFarmRisk({
      farm: { crop: 'maize' },
      issues: [{ severity: 'high', status: 'open', createdAt: NOW - DAY }],
      now: NOW,
    });
    const r = await logPrediction({ risk, farmId: 'f_1', prisma, now: NOW });
    expect(r.id).toBeTruthy();
    expect(prisma._rows).toHaveLength(1);
    expect(prisma._rows[0].actionType).toBe('prediction');
    expect(prisma._rows[0].priorityScore).toBe(risk.score);
    expect(prisma._rows[0].metadata.level).toBe(risk.level);
  });

  it('logPrediction falls back to memory buffer when no prisma', async () => {
    const risk = computeFarmRisk({ farm: { crop: 'maize' }, now: NOW });
    const r = await logPrediction({ risk, farmId: 'f_1', prisma: null, now: NOW });
    expect(r.id).toBeNull();
    const snap = _drainMemoryBuffer();
    expect(snap).toHaveLength(1);
    expect(snap[0].actionType).toBe('prediction');
  });

  it('logActionTaken links to predictionId via metadata', async () => {
    const prisma = makePrisma();
    const r = await logActionTaken({
      predictionId: 'pred_123', action: 'send_sms',
      audience: 'farmer', rationale: 'inactive',
      farmId: 'f_1', channel: 'sms', prisma, now: NOW,
    });
    expect(r.id).toBeTruthy();
    expect(prisma._rows[0].actionType).toBe('action_send_sms');
    expect(prisma._rows[0].metadata.predictionId).toBe('pred_123');
    expect(prisma._rows[0].channel).toBe('sms');
  });

  it('logOutcome writes an outcome row', async () => {
    const prisma = makePrisma();
    const r = await logOutcome({
      predictionId: 'pred_123', outcome: 'resolved',
      farmId: 'f_1', prisma, now: NOW,
    });
    expect(r.id).toBeTruthy();
    expect(prisma._rows[0].actionType).toBe('outcome');
    expect(prisma._rows[0].outcome).toBe('resolved');
  });

  it('missing action / outcome → skipped', async () => {
    expect((await logPrediction({ risk: null })).skipped).toBe(true);
    expect((await logActionTaken({})).skipped).toBe(true);
    expect((await logOutcome({})).skipped).toBe(true);
  });

  it('getLearningTrail returns rows for the farm in desc order', async () => {
    const prisma = makePrisma();
    const risk = computeFarmRisk({ farm: { crop: 'maize' }, now: NOW });
    await logPrediction({ risk, farmId: 'f_1', prisma, now: NOW });
    await logActionTaken({
      predictionId: 'pred_1', action: 'send_sms', farmId: 'f_1',
      prisma, now: NOW + 1000,
    });
    await logOutcome({
      predictionId: 'pred_1', outcome: 'resolved', farmId: 'f_1',
      prisma, now: NOW + 2000,
    });
    const trail = await getLearningTrail({ farmId: 'f_1', prisma });
    expect(trail).toHaveLength(3);
    // Newest first.
    expect(trail[0].actionType).toBe('outcome');
  });

  it('metadata sanitizer strips non-serializable fields', async () => {
    const prisma = makePrisma();
    const circular = {};
    circular.self = circular;
    const r = await logActionTaken({
      action: 'send_sms', farmId: 'f_1',
      metadata: { ok: 'yes', bad: circular }, prisma, now: NOW,
    });
    expect(r.id).toBeTruthy();
    expect(prisma._rows[0].metadata).toBeNull(); // circular → null
  });
});
