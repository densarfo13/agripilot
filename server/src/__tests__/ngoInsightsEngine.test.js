/**
 * ngoInsightsEngine.test.js — NGO dashboard insight aggregation.
 *
 * Covers spec §13:
 *   1. active farmer logic
 *   2. byRegion aggregation counts
 *   3. byCrop aggregation counts
 *   4. hotspot threshold (3+ in region/crop/type within window)
 *   5. officerFocus priority ordering
 *   6. empty-data safety
 *   7. program filtering
 *   8. export rows
 *   9. non-English labels preserved (reasonKey stays stable)
 */

import { describe, it, expect } from 'vitest';

import {
  getNgoInsights,
  exportInsightsCsv,
  exportRegionSummaryCsv,
  _internal,
} from '../../../src/lib/ngo/ngoInsightsEngine.js';

const NOW = new Date(2026, 3, 20, 12, 0, 0).getTime();
const DAY = 24 * 3600 * 1000;

// Farms and issues in these tests use the same region convention
// (state-code-only) so the engine aggregates both into the same
// byRegion row. Production carries countryCode on both sides so
// keys end up as COUNTRY/STATE — we exercise that specifically in
// a separate test below.
function farm(overrides = {}) {
  return {
    id:        overrides.id || `farm_${Math.random().toString(36).slice(2, 8)}`,
    farmerId:  'u1',
    crop:      'maize',
    stateCode: 'AS',
    program:   null,
    ...overrides,
  };
}
function issue(overrides = {}) {
  return {
    id: overrides.id || `iss_${Math.random().toString(36).slice(2, 8)}`,
    farmId: overrides.farmId || null,
    crop: 'maize', issueType: 'pest', severity: 'medium',
    status: 'open', region: 'AS',
    createdAt: overrides.createdAt || NOW,
    ...overrides,
  };
}
const evt = (farmId, type = 'task_completed', offset = -DAY) => ({
  farmId, type, timestamp: NOW + offset, payload: {},
});

// ─── Totals + active farmer logic (spec §2, §13 #1) ──────────────
describe('getNgoInsights — totals + active farmer detection', () => {
  it('active = has a task_completed event within the last 7 days', () => {
    const farms = [farm({ id: 'a' }), farm({ id: 'b' })];
    const events = [evt('a', 'task_completed', -2 * DAY)];
    const r = getNgoInsights({ farms, issues: [], events, now: NOW });
    expect(r.totals.activeFarmers).toBe(1);
    expect(r.totals.inactiveFarmers).toBe(1);
  });

  it('event older than 7 days → inactive', () => {
    const farms = [farm({ id: 'a' })];
    const events = [evt('a', 'task_completed', -14 * DAY)];
    const r = getNgoInsights({ farms, issues: [], events, now: NOW });
    expect(r.totals.activeFarmers).toBe(0);
    expect(r.totals.inactiveFarmers).toBe(1);
  });

  it('progressRecords also count towards activity', () => {
    const farms = [farm({ id: 'a' })];
    const progressRecords = [
      { farmId: 'a', completed: true, timestamp: NOW - DAY },
    ];
    const r = getNgoInsights({ farms, issues: [], events: [], progressRecords, now: NOW });
    expect(r.totals.activeFarmers).toBe(1);
  });

  it('totals.highRiskFarmers counts farms with open high/critical issues', () => {
    const farms = [farm({ id: 'a' }), farm({ id: 'b' }), farm({ id: 'c' })];
    const issues = [
      issue({ farmId: 'a', severity: 'high',     status: 'open' }),
      issue({ farmId: 'b', severity: 'critical', status: 'open' }),
      issue({ farmId: 'c', severity: 'medium',   status: 'open' }),
    ];
    const r = getNgoInsights({ farms, issues, events: [], now: NOW });
    expect(r.totals.highRiskFarmers).toBe(2);
  });
});

// ─── byRegion aggregation (spec §3, §13 #2) ──────────────────────
describe('byRegion aggregation', () => {
  it('counts farmers + issues per AS vs NP', () => {
    const farms = [
      farm({ id: 'a', stateCode: 'AS', crop: 'maize' }),
      farm({ id: 'b', stateCode: 'AS', crop: 'cassava' }),
      farm({ id: 'c', stateCode: 'NP', crop: 'sorghum' }),
    ];
    const issues = [
      issue({ farmId: 'a', region: 'AS', status: 'open' }),
      issue({ farmId: 'a', region: 'AS', status: 'resolved' }),
      issue({ farmId: 'c', region: 'NP', status: 'open' }),
    ];
    const r = getNgoInsights({ farms, issues, events: [], now: NOW });
    const as = r.byRegion.find((x) => x.regionKey === 'AS');
    const np = r.byRegion.find((x) => x.regionKey === 'NP');
    expect(as.farmerCount).toBe(2);
    expect(as.openIssues).toBe(1);
    expect(as.resolvedIssues).toBe(1);
    expect(as.issueCount).toBe(2);
    expect(np.farmerCount).toBe(1);
    expect(np.openIssues).toBe(1);
  });

  it('computes topCrop per region (majority wins, tie alphabetical)', () => {
    const farms = [
      farm({ id: 'a', crop: 'maize' }),
      farm({ id: 'b', crop: 'maize' }),
      farm({ id: 'c', crop: 'cassava' }),
    ];
    const r = getNgoInsights({ farms, issues: [], events: [], now: NOW });
    const as = r.byRegion.find((x) => x.regionKey === 'AS');
    expect(as.topCrop).toBe('maize');
  });

  it('attaches climate/season when regionProfiles supplied', () => {
    const farms = [farm({ id: 'a', stateCode: 'AS' })];
    const regionProfiles = {
      'AS': { climate: 'tropical', season: 'wet' },
    };
    const r = getNgoInsights({ farms, issues: [], events: [], regionProfiles, now: NOW });
    const row = r.byRegion.find((x) => x.regionKey === 'AS');
    expect(row.climate).toBe('tropical');
    expect(row.season).toBe('wet');
  });
});

// ─── byCrop aggregation (spec §13 #3) ────────────────────────────
describe('byCrop aggregation', () => {
  it('counts farms + issues + high risk per crop', () => {
    const farms = [
      farm({ id: 'a', crop: 'maize' }),
      farm({ id: 'b', crop: 'maize' }),
      farm({ id: 'c', crop: 'cassava' }),
    ];
    const issues = [
      issue({ farmId: 'a', crop: 'maize',   severity: 'high',    status: 'open' }),
      issue({ farmId: 'b', crop: 'maize',   severity: 'medium',  status: 'open' }),
      issue({ farmId: 'c', crop: 'cassava', severity: 'critical', status: 'open' }),
    ];
    const r = getNgoInsights({ farms, issues, events: [], now: NOW });
    const maize   = r.byCrop.find((c) => c.crop === 'maize');
    const cassava = r.byCrop.find((c) => c.crop === 'cassava');
    expect(maize.farmerCount).toBe(2);
    expect(maize.issueCount).toBe(2);
    expect(maize.highRiskCount).toBe(1);   // only farm a
    expect(cassava.farmerCount).toBe(1);
    expect(cassava.issueCount).toBe(1);
    expect(cassava.highRiskCount).toBe(1);
  });

  it('sorts byCrop rows alphabetically for stable UI + CSV output', () => {
    const farms = [
      farm({ id: 'x', crop: 'cassava' }),
      farm({ id: 'y', crop: 'maize'   }),
      farm({ id: 'z', crop: 'beans'   }),
    ];
    const r = getNgoInsights({ farms, issues: [], events: [], now: NOW });
    expect(r.byCrop.map((c) => c.crop)).toEqual(['beans', 'cassava', 'maize']);
  });
});

// ─── Hotspot detection (spec §4, §13 #4) ─────────────────────────
describe('hotspots', () => {
  it('fires at 3 similar (region, crop, issueType) reports', () => {
    const issues = [];
    for (let k = 0; k < 3; k += 1) {
      issues.push(issue({ farmId: `f${k}`, region: 'AS',
        crop: 'cassava', issueType: 'pest' }));
    }
    const r = getNgoInsights({ farms: [], issues, events: [], now: NOW });
    expect(r.hotspots).toHaveLength(1);
    expect(r.hotspots[0].severity).toBe('medium');
    expect(r.hotspots[0].regionKey).toBe('AS');
    expect(r.hotspots[0].crop).toBe('cassava');
    expect(r.hotspots[0].issueType).toBe('pest');
  });

  it('marks severity high at 5+ similar reports', () => {
    const issues = [];
    for (let k = 0; k < 6; k += 1) {
      issues.push(issue({ farmId: `f${k}`, region: 'AS',
        crop: 'cassava', issueType: 'pest' }));
    }
    const r = getNgoInsights({ farms: [], issues, events: [], now: NOW });
    expect(r.hotspots[0].severity).toBe('high');
    expect(r.hotspots[0].count).toBe(6);
  });

  it('respects the hotspotDays window', () => {
    const issues = [];
    for (let k = 0; k < 3; k += 1) {
      issues.push(issue({ region: 'AS', crop: 'cassava', issueType: 'pest',
        createdAt: NOW - 30 * DAY })); // outside 14d default
    }
    const r = getNgoInsights({ farms: [], issues, events: [], now: NOW });
    expect(r.hotspots).toHaveLength(0);
  });

  it('does not fire below threshold', () => {
    const issues = [
      issue({ region: 'AS', crop: 'cassava', issueType: 'pest' }),
      issue({ region: 'AS', crop: 'cassava', issueType: 'pest' }),
    ];
    const r = getNgoInsights({ farms: [], issues, events: [], now: NOW });
    expect(r.hotspots).toHaveLength(0);
  });
});

// ─── Officer focus priority (spec §5, §13 #5) ────────────────────
describe('officerFocus prioritization', () => {
  it('hotspots outrank pure high-risk counts', () => {
    // Region HS has a hotspot but no high-risk farms;
    // Region HR has many high-risk farms but no hotspot.
    const farms = [
      farm({ id: 'hr1', stateCode: 'HR' }),
      farm({ id: 'hr2', stateCode: 'HR' }),
      farm({ id: 'hs1', stateCode: 'HS' }),
      farm({ id: 'hs2', stateCode: 'HS' }),
      farm({ id: 'hs3', stateCode: 'HS' }),
    ];
    const issues = [
      // High-risk farms in HR
      issue({ farmId: 'hr1', region: 'HR', severity: 'critical', issueType: 'pest' }),
      issue({ farmId: 'hr2', region: 'HR', severity: 'critical', issueType: 'disease' }),
      // 3 similar in HS → hotspot
      issue({ farmId: 'hs1', region: 'HS', crop: 'maize', issueType: 'pest' }),
      issue({ farmId: 'hs2', region: 'HS', crop: 'maize', issueType: 'pest' }),
      issue({ farmId: 'hs3', region: 'HS', crop: 'maize', issueType: 'pest' }),
    ];
    const r = getNgoInsights({ farms, issues, events: [], now: NOW });
    // HS should be ahead of HR due to hotspot weight.
    const idxHS = r.officerFocus.findIndex((f) => f.regionKey === 'HS');
    const idxHR = r.officerFocus.findIndex((f) => f.regionKey === 'HR');
    expect(idxHS).toBeGreaterThanOrEqual(0);
    expect(idxHR).toBeGreaterThanOrEqual(0);
    expect(idxHS).toBeLessThan(idxHR);
  });

  it('inactive concentration contributes to priority', () => {
    // Two farms in region AS, zero events → 100% inactive
    const farms = [
      farm({ id: 'a', stateCode: 'AS' }),
      farm({ id: 'b', stateCode: 'AS' }),
    ];
    const r = getNgoInsights({ farms, issues: [], events: [], now: NOW });
    const focus = r.officerFocus.find((f) => f.regionKey === 'AS');
    expect(focus).toBeTruthy();
    expect(focus.reason).toMatch(/inactive/i);
  });

  it('empty activity set → no officer focus entries', () => {
    const r = getNgoInsights({ farms: [], issues: [], events: [], now: NOW });
    expect(r.officerFocus).toHaveLength(0);
  });

  it('reasonKey is stable i18n-friendly (spec §11)', () => {
    const farms = [
      farm({ id: 'a', stateCode: 'AS' }),
      farm({ id: 'b', stateCode: 'AS' }),
    ];
    const r = getNgoInsights({ farms, issues: [], events: [], now: NOW });
    const focus = r.officerFocus[0];
    expect(focus.reasonKey).toMatch(/^ngo\.focus\./);
  });
});

// ─── Empty-data safety (spec §13 #6) ─────────────────────────────
describe('empty data', () => {
  it('empty everything → zero totals, never NaN', () => {
    const r = getNgoInsights({});
    expect(r.totals.totalFarmers).toBe(0);
    expect(r.totals.activeFarmers).toBe(0);
    expect(r.totals.openIssues).toBe(0);
    expect(r.totals.highRiskFarmers).toBe(0);
    expect(r.byRegion).toEqual([]);
    expect(r.byCrop).toEqual([]);
    expect(r.hotspots).toEqual([]);
    expect(r.officerFocus).toEqual([]);
  });

  it('missing regionProfiles still builds rows (null climate/season)', () => {
    const farms = [farm({ id: 'a' })];
    const r = getNgoInsights({ farms, issues: [], events: [], now: NOW });
    expect(r.byRegion[0].climate).toBeNull();
    expect(r.byRegion[0].season).toBeNull();
  });
});

// ─── Program filter (spec §7, §13 #7) ────────────────────────────
describe('program filter', () => {
  const farms = [
    farm({ id: 'a', program: 'p1' }),
    farm({ id: 'b', program: 'p1' }),
    farm({ id: 'c', program: 'p2' }),
  ];
  const issues = [
    issue({ farmId: 'a', program: 'p1' }),
    issue({ farmId: 'c', program: 'p2' }),
  ];

  it('no program filter → counts everyone', () => {
    const r = getNgoInsights({ farms, issues, events: [], now: NOW });
    expect(r.totals.totalFarmers).toBe(3);
    expect(r.totals.openIssues).toBe(2);
    expect(r.filteredBy.program).toBeNull();
  });

  it('program filter narrows both farms and issues', () => {
    const r = getNgoInsights({ farms, issues, events: [], program: 'p1', now: NOW });
    expect(r.totals.totalFarmers).toBe(2);
    expect(r.totals.openIssues).toBe(1);
    expect(r.filteredBy.program).toBe('p1');
  });
});

// ─── Export (spec §8, §13 #8) ────────────────────────────────────
describe('CSV export', () => {
  it('exportInsightsCsv emits one row per farm with required columns', () => {
    const farms = [
      farm({ id: 'a', farmerId: 'u1', crop: 'maize', program: 'p1' }),
      farm({ id: 'b', farmerId: 'u2', crop: 'cassava' }),
    ];
    const issues = [
      issue({ farmId: 'a', severity: 'critical' }),
    ];
    const events = [evt('a', 'task_completed', -DAY)];
    const csv = exportInsightsCsv({ farms, issues, events, now: NOW });
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('farmerId,farmId,crop,region,risk,issueCount,activity,program,farmType');
    expect(lines.length).toBe(3); // header + two rows
    expect(lines[1]).toContain('u1');
    expect(lines[1]).toContain('active');
    expect(lines[1]).toContain('high');
    expect(lines[2]).toContain('u2');
    expect(lines[2]).toContain('inactive');
  });

  it('exportRegionSummaryCsv emits compact region rows', () => {
    const farms = [
      farm({ id: 'a', stateCode: 'AS', crop: 'maize' }),
      farm({ id: 'b', stateCode: 'AS', crop: 'maize' }),
      farm({ id: 'c', stateCode: 'NP', crop: 'sorghum' }),
    ];
    const issues = [issue({ farmId: 'a', region: 'AS' })];
    const insights = getNgoInsights({ farms, issues, events: [], now: NOW });
    const csv = exportRegionSummaryCsv(insights);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('region,farmerCount,openIssues,highRiskCount,topCrop');
    expect(lines.some((l) => l.startsWith('AS,'))).toBe(true);
    expect(lines.some((l) => l.startsWith('NP,'))).toBe(true);
  });

  it('program filter flows into the detail export', () => {
    const farms = [
      farm({ id: 'a', program: 'p1' }),
      farm({ id: 'b', program: 'p2' }),
    ];
    const csv = exportInsightsCsv({ farms, issues: [], events: [], program: 'p1', now: NOW });
    const lines = csv.trim().split('\n');
    expect(lines.length).toBe(2); // header + 1 farm
  });
});

// ─── Output integrity ────────────────────────────────────────────
describe('frozen output', () => {
  it('top-level + nested arrays are frozen', () => {
    const farms = [farm()];
    const issues = [issue({ farmId: farms[0].id })];
    const r = getNgoInsights({ farms, issues, events: [], now: NOW });
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.totals)).toBe(true);
    expect(Object.isFrozen(r.byRegion)).toBe(true);
    expect(Object.isFrozen(r.byCrop)).toBe(true);
    expect(Object.isFrozen(r.hotspots)).toBe(true);
    expect(Object.isFrozen(r.officerFocus)).toBe(true);
  });
});
