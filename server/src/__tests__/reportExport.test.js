/**
 * reportExport.test.js — verification signals + report filters +
 * aggregation + download helper.
 *
 * Spec §9 checklist:
 *   • verification signals (onboarding / location / crop / recent
 *     activity / task activity + composite score)
 *   • filterFarms by crop / region / status / date range
 *   • aggregateReport counts + distributions
 *   • downloadCsv safety in non-browser env
 *   • existing NGO CSV still exports (now with verification columns)
 */

import { describe, it, expect } from 'vitest';

import {
  getFarmerVerificationSignals, _internal as vInternals,
} from '../../../src/lib/ngo/verificationSignals.js';
import {
  filterFarms, aggregateReport, _internal as rfInternals,
} from '../../../src/lib/ngo/reportFilters.js';
import { downloadCsv, _internal as dlInternals } from '../../../src/lib/ngo/downloadCsv.js';
import { getExportData } from '../../../src/lib/ngo/analytics.js';

const DAY = 24 * 3600 * 1000;
const NOW = 1_713_600_000_000;

// ─── Fixtures ─────────────────────────────────────────────────────
const farmAComplete = {
  id: 'farm_a', name: 'River Plot', crop: 'maize',
  country: 'US', state: 'CA', latitude: 37.775, longitude: -122.419,
  stage: 'early_growth', createdAt: NOW - 5 * DAY, program: 'pilot',
};
const farmBNoCrop = {
  id: 'farm_b', name: 'North Field', crop: null,
  country: 'GH', state: null, createdAt: NOW - 50 * DAY, program: 'pilot',
};
const farmCNoLocation = {
  id: 'farm_c', name: 'Side Plot', crop: 'rice', country: null,
  createdAt: NOW - 2 * DAY, program: 'pilot',
};

const events = [
  // farm_a: recent task_completed
  { id: 'e1', farmId: 'farm_a', type: 'farm_created',   timestamp: NOW - 10 * DAY },
  { id: 'e2', farmId: 'farm_a', type: 'task_completed', timestamp: NOW - 2 * DAY,
    payload: { taskId: 't1' } },
  // farm_b: old login only
  { id: 'e3', farmId: 'farm_b', type: 'login',          timestamp: NOW - 30 * DAY },
];

// ─── Verification signals ────────────────────────────────────────
describe('getFarmerVerificationSignals', () => {
  it('all five flags set for a fully-engaged farm', () => {
    const v = getFarmerVerificationSignals({
      farm: farmAComplete, events, now: NOW,
    });
    expect(v.onboardingComplete).toBe(true);
    expect(v.locationCaptured).toBe(true);
    expect(v.cropSelected).toBe(true);
    expect(v.recentActivity).toBe(true);
    expect(v.taskActivity).toBe(true);
    expect(v.score).toBe(5);
    expect(v.lastActivityAt).toBe(NOW - 2 * DAY);
  });

  it('drops onboarding + crop flags when crop is missing', () => {
    const v = getFarmerVerificationSignals({
      farm: farmBNoCrop, events, now: NOW,
    });
    expect(v.cropSelected).toBe(false);
    expect(v.onboardingComplete).toBe(false);
    expect(v.score).toBeLessThan(5);
  });

  it('drops location flag when country is missing even with lat/lng', () => {
    const v = getFarmerVerificationSignals({
      farm: { ...farmCNoLocation, latitude: 1.0, longitude: 2.0 }, events, now: NOW,
    });
    expect(v.locationCaptured).toBe(false);
  });

  it('locationCaptured accepts country + coords without state', () => {
    const v = getFarmerVerificationSignals({
      farm: { id: 'x', name: 'x', crop: 'maize',
              country: 'BR', latitude: -23.5, longitude: -46.6 },
      events: [],
    });
    expect(v.locationCaptured).toBe(true);
  });

  it('falls back to completions when events are missing', () => {
    const v = getFarmerVerificationSignals({
      farm: farmAComplete,
      events: [],
      completions: [{ taskId: 't', farmId: 'farm_a', completed: true, timestamp: NOW - DAY }],
      now: NOW,
    });
    expect(v.completedCount).toBe(1);
    expect(v.taskActivity).toBe(true);
  });

  it('empty input → safe all-false signals, score 0', () => {
    const v = getFarmerVerificationSignals();
    expect(v.score).toBe(0);
    expect(v.lastActivityAt).toBeNull();
  });

  it('is frozen', () => {
    const v = getFarmerVerificationSignals({ farm: farmAComplete, events, now: NOW });
    expect(Object.isFrozen(v)).toBe(true);
  });

  it('default activity window is 7 days', () => {
    expect(vInternals.DEFAULT_WINDOW_DAYS).toBe(7);
  });
});

// ─── filterFarms ─────────────────────────────────────────────────
describe('filterFarms', () => {
  const farms = [farmAComplete, farmBNoCrop, farmCNoLocation];

  it('no filters → every farm', () => {
    expect(filterFarms(farms)).toEqual(farms);
  });

  it('crop filter matches case-insensitively', () => {
    expect(filterFarms(farms, { crop: 'MAIZE' })
      .map((f) => f.id)).toEqual(['farm_a']);
  });

  it('region filter matches on state/stateCode', () => {
    expect(filterFarms(farms, { region: 'CA' }).map((f) => f.id)).toEqual(['farm_a']);
  });

  it('status=active requires a recent event', () => {
    const active = filterFarms(farms, { status: 'active', events, now: NOW });
    expect(active.map((f) => f.id)).toEqual(['farm_a']);
    const inactive = filterFarms(farms, { status: 'inactive', events, now: NOW });
    expect(inactive.map((f) => f.id).sort()).toEqual(['farm_b', 'farm_c']);
  });

  it('date range clips on createdAt', () => {
    const from = NOW - 7 * DAY;
    const to   = NOW;
    const out  = filterFarms(farms, { from, to });
    expect(out.map((f) => f.id).sort()).toEqual(['farm_a', 'farm_c']);
  });

  it('composes multiple filters', () => {
    expect(filterFarms(farms, { crop: 'maize', status: 'active', events, now: NOW })
      .map((f) => f.id)).toEqual(['farm_a']);
  });

  it('non-array input → []', () => {
    expect(filterFarms(null)).toEqual([]);
    expect(filterFarms(undefined)).toEqual([]);
  });
});

// ─── aggregateReport ─────────────────────────────────────────────
describe('aggregateReport', () => {
  it('totals + distributions + recent signups', () => {
    const r = aggregateReport({
      farms: [farmAComplete, farmBNoCrop, farmCNoLocation],
      events,
      now: NOW,
    });
    expect(r.totals.total).toBe(3);
    expect(r.totals.active).toBe(1);          // only farm_a
    expect(r.totals.inactive).toBe(2);
    expect(r.recentSignups).toBe(2);           // farm_a + farm_c within 30d
    expect(r.tasksCompleted).toBe(1);
    expect(r.crops[0].count).toBeGreaterThan(0);
    expect(r.regions.length).toBeGreaterThan(0);
    expect(r.stages.length).toBeGreaterThan(0);
  });

  it('empty farms → zeroed totals', () => {
    const r = aggregateReport({ farms: [], events: [], now: NOW });
    expect(r.totals.total).toBe(0);
    expect(r.totals.active).toBe(0);
    expect(r.recentSignups).toBe(0);
  });

  it('result + nested collections are frozen', () => {
    const r = aggregateReport({ farms: [farmAComplete], events, now: NOW });
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.totals)).toBe(true);
    expect(Object.isFrozen(r.crops)).toBe(true);
  });

  it('lastActivityFor helper behaves correctly', () => {
    expect(rfInternals.lastActivityFor('farm_a', events)).toBe(NOW - 2 * DAY);
    expect(rfInternals.lastActivityFor('ghost', events)).toBe(0);
    expect(rfInternals.lastActivityFor(null, events)).toBe(0);
  });
});

// ─── downloadCsv safety ──────────────────────────────────────────
describe('downloadCsv', () => {
  it('returns false in non-browser env (no window / document)', () => {
    expect(downloadCsv({ filename: 'x.csv', csv: 'a,b\n1,2' })).toBe(false);
  });

  it('returns false with empty / missing csv', () => {
    globalThis.window = { URL: { createObjectURL: () => '' } };
    globalThis.document = {
      createElement: () => ({ click: () => {}, style: {} }),
      body: { appendChild: () => {}, removeChild: () => {} },
    };
    expect(downloadCsv({})).toBe(false);
    expect(downloadCsv({ csv: '' })).toBe(false);
    delete globalThis.window;
    delete globalThis.document;
  });

  it('safeName strips illegal chars + adds .csv', () => {
    expect(dlInternals.safeName('hello world?.csv')).toBe('hello_world_.csv');
    expect(dlInternals.safeName('plain')).toBe('plain.csv');
    expect(dlInternals.safeName(null)).toBe('farroway-report.csv');
  });
});

// ─── Existing NGO CSV still exports (now includes verification) ──
describe('getExportData — verification columns', () => {
  it('header + row include the five flag columns + score', () => {
    // Use a localStorage mock so getExportData's default readers fall
    // through to the override arguments we pass directly.
    const farms = [farmAComplete];
    const csv = getExportData(null, {
      now: NOW, farms, events, completions: [],
    });
    const [header, row] = csv.trim().split('\n');
    expect(header.endsWith(
      'tasksCompleted,onboardingComplete,locationCaptured,cropSelected,'
      + 'recentActivity,taskActivity,verificationScore',
    )).toBe(true);
    const cols = row.split(',');
    // Last six columns are the new flag + score columns.
    const tail = cols.slice(-6);
    expect(tail).toEqual(['yes', 'yes', 'yes', 'yes', 'yes', '5']);
  });
});
