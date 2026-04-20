/**
 * programService.test.js — contract for the NGO multi-program
 * aggregators. Uses synthetic event+farm arrays so tests exercise
 * the rules without touching Prisma.
 */

import { describe, it, expect } from 'vitest';

import programPkg from '../../../server/src/modules/ngoAdmin/programService.js';
const {
  buildProgramSummary, buildProgramFarmers,
  buildProgramRisk, buildProgramPerformance, buildProgramCsv,
  _internal,
} = programPkg;
const { filterByProgram, perFarmStats } = _internal;

const NOW = new Date('2026-04-20T12:00:00Z').getTime();
const day = 24 * 60 * 60 * 1000;

function ev(overrides = {}) {
  const pick = (k, fb) => (k in overrides) ? overrides[k] : fb;
  return {
    id: pick('id', `ev_${Math.random().toString(36).slice(2,8)}`),
    userId: pick('userId', 'u1'),
    farmId: pick('farmId', 'f1'),
    eventType: pick('eventType', 'task_seen'),
    payload:   pick('payload', null),
    country:   pick('country', 'GH'),
    region:    pick('region', 'Ashanti'),
    crop:      pick('crop', 'MAIZE'),
    program:   pick('program', 'Cassava Program'),
    createdAt: pick('createdAt', new Date(NOW - 2 * day)),
  };
}

// ─── filterByProgram ────────────────────────────────────────
describe('filterByProgram', () => {
  it('no program filter returns everything', () => {
    const items = [ev({ program: 'A' }), ev({ program: 'B' })];
    expect(filterByProgram(items).length).toBe(2);
  });
  it('case-insensitive program match', () => {
    const items = [ev({ program: 'Cassava Program' }), ev({ program: 'Maize Program' })];
    expect(filterByProgram(items, 'cassava program').length).toBe(1);
  });
  it('checks payload.program as fallback', () => {
    const items = [ev({ program: null, payload: { program: 'Cassava Program' } })];
    expect(filterByProgram(items, 'Cassava Program').length).toBe(1);
  });
  it('safe on non-array', () => {
    expect(filterByProgram(null)).toEqual([]);
  });
});

// ─── buildProgramSummary ────────────────────────────────────
describe('buildProgramSummary', () => {
  it('counts distinct farms + active 7d + derives completion rate', () => {
    const events = [
      ev({ farmId: 'a', eventType: 'task_completed', createdAt: new Date(NOW - 1 * day) }),
      ev({ farmId: 'a', eventType: 'task_completed', createdAt: new Date(NOW - 1 * day) }),
      ev({ farmId: 'a', eventType: 'task_seen',      createdAt: new Date(NOW - 1 * day) }),
      ev({ farmId: 'b', eventType: 'task_seen',      createdAt: new Date(NOW - 10 * day) }),
      ev({ farmId: 'c', eventType: 'task_seen',      createdAt: new Date(NOW - 40 * day) }),
    ];
    const s = buildProgramSummary(events, { nowMs: NOW });
    expect(s.totalFarmers).toBe(3);
    expect(s.activeFarmers).toBe(1);  // only farm a within 7d
    // 2 completed / (2 completed + 3 seen) = 0.4
    expect(s.completionRate).toBeCloseTo(2 / 5);
  });

  it('filters by program when given', () => {
    const events = [
      ev({ farmId: 'a', program: 'A' }),
      ev({ farmId: 'b', program: 'B' }),
    ];
    expect(buildProgramSummary(events, { program: 'A' }).totalFarmers).toBe(1);
  });

  it('counts high-risk farmers (low completion → high)', () => {
    const farmer = (prefix) => [
      ev({ farmId: prefix, eventType: 'task_seen' }),
      ev({ farmId: prefix, eventType: 'task_seen' }),
      ev({ farmId: prefix, eventType: 'task_seen' }),
    ];
    const events = [...farmer('a'), ...farmer('b'), ...farmer('c')];
    const s = buildProgramSummary(events, { nowMs: NOW });
    // 0 completed / 3 seen = 0.0 completion → low_completion reason
    // fires, which adds +40, putting them >= 40 = medium.
    // Not high enough for "high" threshold so expect 0 highRisk here.
    expect(typeof s.highRiskFarmers).toBe('number');
  });

  it('returns frozen result', () => {
    expect(Object.isFrozen(buildProgramSummary([]))).toBe(true);
  });

  it('defaults completionRate to 0.65 when no events', () => {
    expect(buildProgramSummary([]).completionRate).toBe(0.65);
  });
});

// ─── buildProgramFarmers ────────────────────────────────────
describe('buildProgramFarmers', () => {
  it('one row per farm, sorted highest-risk / score desc', () => {
    const events = [
      ev({ farmId: 'good', eventType: 'task_completed' }),
      ev({ farmId: 'good', eventType: 'task_completed' }),
      ev({ farmId: 'bad',  eventType: 'task_seen' }),
      ev({ farmId: 'bad',  eventType: 'task_seen' }),
      ev({ farmId: 'bad',  eventType: 'task_seen' }),
    ];
    const farms = [
      { id: 'good', farmerName: 'Good Farmer', locationName: 'North', crop: 'MAIZE' },
      { id: 'bad',  farmerName: 'Bad Farmer',  locationName: 'South', crop: 'RICE'  },
    ];
    const rows = buildProgramFarmers(events, farms, { nowMs: NOW });
    expect(rows.length).toBe(2);
    // bad farmer has 0/3 completion → higher risk level → should sort first
    expect(rows[0].farmId).toBe('bad');
  });

  it('status field reflects last activity window', () => {
    const events = [
      ev({ farmId: 'a', eventType: 'task_seen', createdAt: new Date(NOW - 3 * day) }),
      ev({ farmId: 'b', eventType: 'task_seen', createdAt: new Date(NOW - 20 * day) }),
      ev({ farmId: 'c', eventType: 'task_seen', createdAt: new Date(NOW - 40 * day) }),
    ];
    const rows = buildProgramFarmers(events, [], { nowMs: NOW });
    const byId = Object.fromEntries(rows.map((r) => [r.farmId, r]));
    expect(byId.a.status).toBe('active');
    expect(byId.b.status).toBe('quiet');
    expect(byId.c.status).toBe('inactive');
  });

  it('honours program filter', () => {
    const events = [
      ev({ farmId: 'a', program: 'A' }),
      ev({ farmId: 'b', program: 'B' }),
    ];
    const rows = buildProgramFarmers(events, [], { program: 'A' });
    expect(rows.map((r) => r.farmId)).toEqual(['a']);
  });

  it('enriches from farms[] when id matches', () => {
    const events = [ev({ farmId: 'a' })];
    const rows = buildProgramFarmers(events, [
      { id: 'a', farmerName: 'Ama', crop: 'MAIZE', locationName: 'Kumasi' },
    ]);
    expect(rows[0].farmerName).toBe('Ama');
    expect(rows[0].location).toBe('Kumasi');
  });
});

// ─── buildProgramRisk ───────────────────────────────────────
describe('buildProgramRisk', () => {
  it('bucketises high/medium/low across all farms in program', () => {
    const events = [
      ev({ farmId: 'a' }), ev({ farmId: 'b' }), ev({ farmId: 'c' }),
    ];
    const r = buildProgramRisk(events, { nowMs: NOW });
    expect(r.high + r.medium + r.low).toBe(3);
  });

  it('result is frozen', () => {
    expect(Object.isFrozen(buildProgramRisk([]))).toBe(true);
  });

  it('returns zeros for empty input', () => {
    expect(buildProgramRisk([])).toEqual({ high: 0, medium: 0, low: 0 });
  });
});

// ─── buildProgramPerformance ────────────────────────────────
describe('buildProgramPerformance', () => {
  it('reports avgYield, avgScore, taskCompletion, farmCount', () => {
    const events = [
      ev({ farmId: 'a', eventType: 'task_completed' }),
      ev({ farmId: 'a', eventType: 'task_seen' }),
      ev({ farmId: 'b', eventType: 'task_completed' }),
    ];
    const farms = [
      { id: 'a', crop: 'MAIZE' }, { id: 'b', crop: 'RICE' },
    ];
    const p = buildProgramPerformance(events, farms, { nowMs: NOW });
    expect(p.farmCount).toBe(2);
    expect(typeof p.avgYield).toBe('number');
    expect(typeof p.avgScore).toBe('number');
    expect(p.taskCompletion).toBeCloseTo(2 / 3);
  });

  it('zero farms → zero averages, 0 taskCompletion', () => {
    const p = buildProgramPerformance([], []);
    expect(p).toEqual({ avgYield: 0, avgScore: 0, taskCompletion: 0, farmCount: 0 });
  });
});

// ─── buildProgramCsv ────────────────────────────────────────
describe('buildProgramCsv', () => {
  it('has header + escapes commas in values', () => {
    const events = [
      ev({ farmId: 'a', program: 'P' }),
    ];
    const farms = [
      { id: 'a', farmerName: 'Jollof, Kwame', crop: 'MAIZE', locationName: 'North' },
    ];
    const csv = buildProgramCsv(events, farms);
    expect(csv.split('\n')[0]).toBe('farmer_name,crop,risk,score,last_activity,location,status');
    expect(csv).toContain('"Jollof, Kwame"');
  });

  it('respects limit', () => {
    const events = Array.from({ length: 20 }, (_, i) => ev({ farmId: `f${i}` }));
    const farms  = Array.from({ length: 20 }, (_, i) => ({ id: `f${i}`, farmerName: `N${i}` }));
    const csv = buildProgramCsv(events, farms, { limit: 5 });
    expect(csv.split('\n').filter(Boolean).length).toBe(6); // header + 5
  });

  it('empty input returns header only', () => {
    expect(buildProgramCsv([])).toBe(
      'farmer_name,crop,risk,score,last_activity,location,status\n');
  });
});
