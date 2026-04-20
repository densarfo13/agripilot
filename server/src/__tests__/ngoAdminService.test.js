/**
 * ngoAdminService.test.js — contract for the pure
 * farm-events aggregators. The HTTP adapter is trivially
 * thin so all behavior is covered here.
 */

import { describe, it, expect } from 'vitest';

// CommonJS module — dynamic require via createRequire is not
// available in ESM mode, so use default import equivalents.
import pkg from '../../../server/src/modules/ngoAdmin/farmEventsService.js';
const {
  buildSummary, buildFarmersList, buildRiskByRegion,
  buildCsvExport, escapeCsvField,
} = pkg;

const NOW = new Date('2026-04-20T12:00:00Z').getTime();
const day = 24 * 60 * 60 * 1000;

function ev(overrides = {}) {
  // `in` check so explicit nulls override defaults (??/|| would
  // coerce null back to the fallback — breaks "ignore without
  // farmId" style tests).
  const pick = (key, fallback) => ('key' in overrides || key in overrides)
    ? overrides[key] : fallback;
  return {
    id:        pick('id',        `ev_${Math.random().toString(36).slice(2, 8)}`),
    userId:    pick('userId',    'u1'),
    farmId:    pick('farmId',    'f1'),
    eventType: pick('eventType', 'task_seen'),
    payload:   pick('payload',   null),
    country:   pick('country',   'GH'),
    region:    pick('region',    'Ashanti'),
    crop:      pick('crop',      'MAIZE'),
    createdAt: pick('createdAt', new Date(NOW - 2 * day)),
  };
}

// ─── buildSummary ────────────────────────────────────────────
describe('buildSummary', () => {
  it('counts distinct users across totals / active / new', () => {
    const events = [
      ev({ userId: 'u1', createdAt: new Date(NOW - 2 * day) }),
      ev({ userId: 'u2', createdAt: new Date(NOW - 10 * day) }),
      ev({ userId: 'u3', createdAt: new Date(NOW - 40 * day) }),
    ];
    const s = buildSummary(events, { nowMs: NOW });
    expect(s.totalFarmers).toBe(3);
    expect(s.activeFarmers).toBe(1);   // only u1 is within 7d
    expect(s.newThisMonth).toBe(2);    // u1 + u2 within 30d
  });

  it('defaults completionRate to 0.65 when no task events', () => {
    expect(buildSummary([], { nowMs: NOW }).completionRate).toBe(0.65);
  });

  it('derives completionRate from task_completed / task_seen mix', () => {
    const events = [
      ev({ eventType: 'task_completed' }),
      ev({ eventType: 'task_completed' }),
      ev({ eventType: 'task_seen' }),
      ev({ eventType: 'task_seen' }),
    ];
    const s = buildSummary(events, { nowMs: NOW });
    // 2 completed / (2 completed + 2 seen) = 0.5
    expect(s.completionRate).toBe(0.5);
  });

  it('safe on empty / malformed input', () => {
    const s = buildSummary([], { nowMs: NOW });
    expect(s.totalFarmers).toBe(0);
    expect(s.activeFarmers).toBe(0);
    expect(buildSummary(null, { nowMs: NOW })).toBeTruthy();
  });
});

// ─── buildFarmersList ────────────────────────────────────────
describe('buildFarmersList', () => {
  it('returns one row per farmId, newest event wins', () => {
    const events = [
      ev({ farmId: 'A', crop: 'MAIZE',  createdAt: new Date(NOW - 5 * day) }),
      ev({ farmId: 'A', crop: 'RICE',   createdAt: new Date(NOW - 1 * day) }),
      ev({ farmId: 'B', crop: 'CASSAVA', createdAt: new Date(NOW - 3 * day) }),
    ];
    const list = buildFarmersList(events);
    expect(list.length).toBe(2);
    const farmA = list.find((x) => x.id === 'A');
    expect(farmA.crop).toBe('RICE');   // newer wins
  });

  it('extracts stage from payload when present', () => {
    const events = [
      ev({ farmId: 'A', payload: { stage: 'flowering' } }),
    ];
    expect(buildFarmersList(events)[0].stage).toBe('flowering');
  });

  it('sorts by most-recent event desc', () => {
    const events = [
      ev({ farmId: 'A', createdAt: new Date(NOW - 5 * day) }),
      ev({ farmId: 'B', createdAt: new Date(NOW - 1 * day) }),
      ev({ farmId: 'C', createdAt: new Date(NOW - 3 * day) }),
    ];
    const ids = buildFarmersList(events).map((x) => x.id);
    expect(ids).toEqual(['B', 'C', 'A']);
  });

  it('respects the limit', () => {
    const events = Array.from({ length: 300 }, (_, i) =>
      ev({ farmId: `f${i}`, createdAt: new Date(NOW - i * 1000) }));
    expect(buildFarmersList(events, { limit: 50 }).length).toBe(50);
  });

  it('ignores events without farmId', () => {
    const events = [ev({ farmId: null }), ev({ farmId: '' }), ev({ farmId: 'A' })];
    expect(buildFarmersList(events).length).toBe(1);
  });

  it('safe on null / non-array', () => {
    expect(buildFarmersList(null)).toEqual([]);
    expect(buildFarmersList('bad')).toEqual([]);
  });
});

// ─── buildRiskByRegion ───────────────────────────────────────
describe('buildRiskByRegion', () => {
  function rows(n, region, prefix) {
    return Array.from({ length: n }, (_, i) =>
      ev({ region, farmId: `${prefix}${i}` }));
  }

  it('classifies high / medium / low by farm count', () => {
    const events = [
      ...rows(120, 'North',  'n'),  // 120 → high
      ...rows(75,  'South',  's'),  // 75  → medium
      ...rows(20,  'East',   'e'),  // 20  → low
    ];
    const risk = buildRiskByRegion(events);
    const byRegion = Object.fromEntries(risk.map((r) => [r.region, r]));
    expect(byRegion.North.risk).toBe('high');
    expect(byRegion.South.risk).toBe('medium');
    expect(byRegion.East.risk).toBe('low');
  });

  it('sorts regions by farm count desc', () => {
    const events = [
      ...rows(10, 'East',  'e'),
      ...rows(40, 'North', 'n'),
      ...rows(25, 'South', 's'),
    ];
    const risk = buildRiskByRegion(events);
    expect(risk.map((r) => r.region)).toEqual(['North', 'South', 'East']);
  });

  it('ignores events without a region', () => {
    const events = [ev({ region: null }), ev({ region: 'X' })];
    expect(buildRiskByRegion(events).length).toBe(1);
  });

  it('safe on bad input', () => {
    expect(buildRiskByRegion(null)).toEqual([]);
  });
});

// ─── escapeCsvField ──────────────────────────────────────────
describe('escapeCsvField', () => {
  it('plain value unchanged', () => {
    expect(escapeCsvField('abc')).toBe('abc');
  });
  it('wraps values with commas', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
  });
  it('wraps and escapes quotes', () => {
    expect(escapeCsvField('a"b')).toBe('"a""b"');
  });
  it('wraps newlines', () => {
    expect(escapeCsvField('a\nb')).toBe('"a\nb"');
  });
  it('null/undefined → empty string', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });
});

// ─── buildCsvExport ──────────────────────────────────────────
describe('buildCsvExport', () => {
  it('header + rows in spec order', () => {
    const events = [ev({
      userId: 'u1', farmId: 'f1', crop: 'MAIZE', region: 'N',
      createdAt: new Date('2026-04-01T00:00:00Z'),
    })];
    const csv = buildCsvExport(events);
    expect(csv.split('\n')[0]).toBe('user_id,farm_id,crop,region,created_at');
    expect(csv).toContain('u1,f1,MAIZE,N,2026-04-01T00:00:00.000Z');
  });

  it('escapes commas in region names', () => {
    const events = [ev({ region: 'North, Ashanti' })];
    const csv = buildCsvExport(events);
    expect(csv).toContain('"North, Ashanti"');
  });

  it('caps at the limit', () => {
    const events = Array.from({ length: 50 }, () => ev({}));
    const csv = buildCsvExport(events, { limit: 10 });
    const rows = csv.split('\n').filter(Boolean);
    // header + 10 rows
    expect(rows.length).toBe(11);
  });

  it('empty events → header only', () => {
    const csv = buildCsvExport([]);
    expect(csv).toBe('user_id,farm_id,crop,region,created_at\n');
  });

  it('null / non-array safe', () => {
    expect(buildCsvExport(null)).toContain('user_id,farm_id');
  });
});
