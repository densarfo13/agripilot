/**
 * ngoAnalytics.test.js — deterministic contract for spec §5 + §6.
 *
 * Covers:
 *   • getProgramSummary aggregates across matching program farms
 *   • isActiveFarmer respects 7-day window
 *   • getExportData returns a valid CSV (header + one row per farm)
 *   • empty inputs → zeroed summary, header-only CSV, no throws
 */

import { describe, it, expect } from 'vitest';

import {
  isActiveFarmer,
  getProgramSummary,
  getExportData,
  getLastActivity,
  _internal,
} from '../../../src/lib/ngo/analytics.js';

const DAY = 24 * 3600 * 1000;
const NOW = 1_713_600_000_000;
const ago = (days) => NOW - days * DAY;

// ─── Fixtures ──────────────────────────────────────────────────────
const farms = [
  { id: 'farm_a', name: 'A', crop: 'maize',   program: 'p1', farmerId: 'u1' },
  { id: 'farm_b', name: 'B', crop: 'cassava', program: 'p1', farmerId: 'u2' },
  { id: 'farm_c', name: 'C', crop: 'rice',    program: 'p2', farmerId: 'u3' },
  { id: 'farm_d', name: 'D', crop: 'wheat',   program: null, farmerId: 'u4' },
];
const events = [
  // farm_a: active (2 completions in last week)
  { id: 'e1', farmId: 'farm_a', type: 'farm_created',   timestamp: ago(14), payload: null },
  { id: 'e2', farmId: 'farm_a', type: 'task_completed', timestamp: ago(3),  payload: { taskId: 't1' } },
  { id: 'e3', farmId: 'farm_a', type: 'task_completed', timestamp: ago(1),  payload: { taskId: 't2' } },
  // farm_b: inactive (last event 30 days ago)
  { id: 'e4', farmId: 'farm_b', type: 'farm_created',   timestamp: ago(60), payload: null },
  { id: 'e5', farmId: 'farm_b', type: 'task_completed', timestamp: ago(30), payload: { taskId: 't3' } },
  // farm_c: active but different program
  { id: 'e6', farmId: 'farm_c', type: 'task_completed', timestamp: ago(2),  payload: { taskId: 't4' } },
  // farm_d: no program, recent login
  { id: 'e7', farmId: 'farm_d', type: 'login',          timestamp: ago(1),  payload: null },
];

// ─── isActiveFarmer (spec §3) ─────────────────────────────────────
describe('isActiveFarmer', () => {
  it('true when event within the 7-day window', () => {
    // Use the analytics surface which delegates to eventLogger — we
    // pipe events via getProgramSummary overrides instead, so isActiveFarmer
    // is tested indirectly here. A direct test would require the
    // localStorage mock, which is covered in eventLogger.test.js.
    // Here we assert that analytics respects the spec's definition.
    const s = getProgramSummary('p1', { now: NOW, farms, events });
    expect(s.totalFarmers).toBe(2);
    expect(s.activeFarmers).toBe(1); // only farm_a
  });
});

// ─── getProgramSummary (spec §5) ──────────────────────────────────
describe('getProgramSummary', () => {
  it('aggregates totals for one program', () => {
    const s = getProgramSummary('p1', { now: NOW, farms, events });
    expect(s.program).toBe('p1');
    expect(s.totalFarmers).toBe(2);
    expect(s.activeFarmers).toBe(1);
    expect(s.totalTasksCompleted).toBe(3); // 2 on farm_a + 1 on farm_b
    expect(typeof s.avgProgressScore).toBe('number');
    expect(s.avgProgressScore).toBeGreaterThanOrEqual(0);
    expect(s.avgProgressScore).toBeLessThanOrEqual(100);
  });

  it('program=null aggregates across every farm', () => {
    const s = getProgramSummary(null, { now: NOW, farms, events });
    expect(s.totalFarmers).toBe(4);
    expect(s.activeFarmers).toBe(3); // farms a, c, d are active
  });

  it('unknown program → zeros, no throw', () => {
    const s = getProgramSummary('does_not_exist', { now: NOW, farms, events });
    expect(s.totalFarmers).toBe(0);
    expect(s.activeFarmers).toBe(0);
    expect(s.avgProgressScore).toBe(0);
    expect(s.totalTasksCompleted).toBe(0);
  });

  it('empty farms → zeros', () => {
    const s = getProgramSummary('p1', { now: NOW, farms: [], events: [] });
    expect(s.totalFarmers).toBe(0);
    expect(s.activeFarmers).toBe(0);
  });

  it('output is frozen', () => {
    const s = getProgramSummary('p1', { now: NOW, farms, events });
    expect(Object.isFrozen(s)).toBe(true);
  });
});

// ─── getExportData (spec §6) ──────────────────────────────────────
describe('getExportData — CSV', () => {
  it('returns a header line + one row per matching farm', () => {
    const csv = getExportData('p1', { now: NOW, farms, events, streak: 5 });
    const lines = csv.trim().split('\n');
    expect(lines.length).toBe(1 + 2); // header + 2 farms in p1
    expect(lines[0]).toBe(
      'farmerId,farmId,crop,progressScore,streak,lastActivity,tasksCompleted,'
      + 'onboardingComplete,locationCaptured,cropSelected,recentActivity,taskActivity,verificationScore'
    );
    // Row columns in declared order.
    const cols = lines[1].split(',');
    expect(cols[0]).toBe('u1');    // farmerId
    expect(cols[1]).toBe('farm_a');
    expect(cols[2]).toBe('maize');
    // progressScore is numeric (engine-derived)
    expect(Number.isFinite(Number(cols[3]))).toBe(true);
    expect(cols[4]).toBe('5');      // streak (global, passed in)
    expect(cols[5]).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO lastActivity
    expect(cols[6]).toBe('2');      // tasksCompleted
  });

  it('program=null exports every farm', () => {
    const csv = getExportData(null, { now: NOW, farms, events });
    const lines = csv.trim().split('\n');
    expect(lines.length).toBe(1 + 4);
  });

  it('no farms → header only', () => {
    const csv = getExportData('ghost', { now: NOW, farms, events });
    const lines = csv.trim().split('\n');
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain('farmerId');
  });

  it('escapes commas and quotes in fields', () => {
    const odd = [{ id: 'x', name: 'X', crop: 'a, "special"', program: 'p1', farmerId: 'u' }];
    const csv = getExportData('p1', { now: NOW, farms: odd, events: [] });
    const lines = csv.trim().split('\n');
    expect(lines[1]).toContain('"a, ""special"""');
  });
});

// ─── getLastActivity helper ───────────────────────────────────────
describe('getLastActivity', () => {
  it('returns the max timestamp across events for a farm', () => {
    expect(getLastActivity('farm_a', { events })).toBe(ago(1));
  });
  it('returns 0 when unknown', () => {
    expect(getLastActivity('ghost', { events })).toBe(0);
    expect(getLastActivity(null, { events })).toBe(0);
  });
});

// ─── Internals ─────────────────────────────────────────────────────
describe('analytics — internals', () => {
  it('EXPORT_HEADERS order is stable', () => {
    expect(_internal.EXPORT_HEADERS).toEqual([
      'farmerId','farmId','crop','progressScore','streak','lastActivity','tasksCompleted',
      'onboardingComplete','locationCaptured','cropSelected','recentActivity','taskActivity','verificationScore',
    ]);
  });
});
