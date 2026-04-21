/**
 * impactReportingEngine.test.js — NGO impact reporting layer.
 *
 * Covers spec §13:
 *   1. active farmer count calculates correctly
 *   2. completion rate calculates safely (divide-by-zero)
 *   3. intervention success appears only above threshold
 *   4. region impact aggregation
 *   5. crop impact aggregation
 *   6. change detection compares windows correctly
 *   7. export returns valid rows
 *   8. empty-data safety
 *   9. program filter scopes results
 *  10. frozen output (i18n-safe labels preserved in reasonKey)
 */

import { describe, it, expect } from 'vitest';

import {
  getImpactReport,
  exportFarmerEvidenceCsv,
  exportRegionImpactCsv,
  exportInterventionCsv,
  _internal,
} from '../../../src/lib/ngo/impactReportingEngine.js';

const NOW = new Date(2026, 3, 20, 12, 0, 0).getTime();
const DAY = 24 * 3600 * 1000;

function farm(overrides = {}) {
  return {
    id:       overrides.id || `farm_${Math.random().toString(36).slice(2, 8)}`,
    farmerId: 'u1',
    crop:     'maize',
    stateCode: 'AS',
    program:  null,
    ...overrides,
  };
}
function issue(overrides = {}) {
  return {
    id: overrides.id || `iss_${Math.random().toString(36).slice(2, 8)}`,
    farmId: null, crop: 'maize', issueType: 'pest', severity: 'medium',
    status: 'open', region: 'AS', createdAt: NOW,
    ...overrides,
  };
}
const evt = (farmId, type = 'task_completed', offset = -DAY) => ({
  farmId, type, timestamp: NOW + offset, payload: {},
});
function outcome(overrides = {}) {
  return {
    action: 'weed_control', farmId: null, farmerId: 'u1',
    crop: 'maize', region: 'AS', success: true,
    timestamp: NOW - DAY, ...overrides,
  };
}

// ─── Summary + activity ──────────────────────────────────────────
describe('summary', () => {
  it('activeFarmers counts within 7 days', () => {
    const farms = [farm({ id: 'a' }), farm({ id: 'b' }), farm({ id: 'c' })];
    const events = [evt('a', 'task_completed', -2 * DAY),
                    evt('b', 'task_completed', -14 * DAY)]; // b is stale
    const r = getImpactReport({ farms, events, now: NOW });
    expect(r.summary.activeFarmers).toBe(1);
    expect(r.summary.inactiveFarmers).toBe(2);
    expect(r.summary.totalFarmers).toBe(3);
  });

  it('avgProgressScore + avgTaskCompletionRate safe on empty', () => {
    const r = getImpactReport({});
    expect(r.summary.totalFarmers).toBe(0);
    expect(r.summary.avgProgressScore).toBe(0);
    expect(r.summary.avgTaskCompletionRate).toBe(0);
    expect(Number.isNaN(r.summary.avgProgressScore)).toBe(false);
  });

  it('openIssues / resolvedIssues count by status', () => {
    const farms = [farm({ id: 'a' })];
    const issues = [
      issue({ farmId: 'a', status: 'open' }),
      issue({ farmId: 'a', status: 'in_progress' }),
      issue({ farmId: 'a', status: 'resolved' }),
    ];
    const r = getImpactReport({ farms, issues, now: NOW });
    expect(r.summary.openIssues).toBe(2);      // open + in_progress
    expect(r.summary.resolvedIssues).toBe(1);
  });

  it('highRiskFarmers merges severity + riskLevel signals', () => {
    const farms = [farm({ id: 'a' }), farm({ id: 'b' })];
    const issues = [
      issue({ farmId: 'a', severity: 'critical', status: 'open' }),
      issue({ farmId: 'b', severity: 'low', riskLevel: 'high', status: 'open' }),
    ];
    const r = getImpactReport({ farms, issues, now: NOW });
    expect(r.summary.highRiskFarmers).toBe(2);
  });
});

// ─── Completion rate ─────────────────────────────────────────────
describe('farm completion rate', () => {
  it('no events → rate 0 (safe, no NaN)', () => {
    const farms = [farm({ id: 'a' })];
    const r = getImpactReport({ farms, events: [], now: NOW });
    expect(r.evidence[0].taskCompletionRate).toBe(0);
  });

  it('only completions → rate 1.0', () => {
    const farms = [farm({ id: 'a' })];
    const events = [
      evt('a', 'task_completed', -DAY),
      evt('a', 'task_completed', -2 * DAY),
    ];
    const r = getImpactReport({ farms, events, now: NOW });
    expect(r.evidence[0].taskCompletionRate).toBe(1);
  });

  it('mixed completion + skip → 0..1 ratio', () => {
    const farms = [farm({ id: 'a' })];
    const events = [
      evt('a', 'task_completed', -DAY),
      evt('a', 'task_completed', -2 * DAY),
      evt('a', 'task_skipped',   -3 * DAY),
    ];
    const r = getImpactReport({ farms, events, now: NOW });
    // 2 completed / 3 total → 0.666…
    expect(r.evidence[0].taskCompletionRate).toBeCloseTo(2 / 3, 3);
  });

  it('progressRecords array works alongside events', () => {
    const farms = [farm({ id: 'a' })];
    const progressRecords = [
      { farmId: 'a', completed: true,  timestamp: NOW - DAY },
      { farmId: 'a', completed: true,  timestamp: NOW - 2 * DAY },
      { farmId: 'a', completed: false, timestamp: NOW - 3 * DAY },
    ];
    const r = getImpactReport({ farms, progressRecords, now: NOW });
    expect(r.evidence[0].taskCompletionRate).toBeCloseTo(2 / 3, 3);
  });
});

// ─── Interventions ───────────────────────────────────────────────
describe('interventions', () => {
  it('below minSample (3) → not surfaced', () => {
    const outcomes = [
      outcome({ action: 'drainage_fix', success: true }),
      outcome({ action: 'drainage_fix', success: true }),
    ];
    const r = getImpactReport({ outcomes, now: NOW });
    expect(r.interventions).toHaveLength(0);
  });

  it('at threshold (3) → low confidence', () => {
    const outcomes = [
      outcome({ action: 'drainage_fix', success: true }),
      outcome({ action: 'drainage_fix', success: true }),
      outcome({ action: 'drainage_fix', success: false }),
    ];
    const r = getImpactReport({ outcomes, now: NOW });
    expect(r.interventions).toHaveLength(1);
    expect(r.interventions[0].action).toBe('drainage_fix');
    expect(r.interventions[0].sampleSize).toBe(3);
    expect(r.interventions[0].successRate).toBeCloseTo(2 / 3, 3);
    expect(r.interventions[0].confidenceLevel).toBe('low');
  });

  it('10+ samples → high confidence', () => {
    const outcomes = [];
    for (let k = 0; k < 10; k += 1) {
      outcomes.push(outcome({ action: 'weed_control',
                              success: k % 2 === 0 }));
    }
    const r = getImpactReport({ outcomes, now: NOW });
    const weed = r.interventions.find((i) => i.action === 'weed_control');
    expect(weed.confidenceLevel).toBe('high');
    expect(weed.successRate).toBeCloseTo(0.5, 3);
  });

  it('groups per (action, crop, region) — different crops stay separate', () => {
    const outcomes = [
      outcome({ action: 'weed_control', crop: 'maize',   success: true }),
      outcome({ action: 'weed_control', crop: 'maize',   success: true }),
      outcome({ action: 'weed_control', crop: 'maize',   success: true }),
      outcome({ action: 'weed_control', crop: 'cassava', success: true }),
      outcome({ action: 'weed_control', crop: 'cassava', success: true }),
    ];
    const r = getImpactReport({ outcomes, now: NOW });
    // Cassava group (2) below threshold → only maize surfaces.
    expect(r.interventions).toHaveLength(1);
    expect(r.interventions[0].crop).toBe('maize');
  });
});

// ─── Region + crop aggregation ───────────────────────────────────
describe('byRegion + byCrop', () => {
  it('byRegion aggregates farms + issues + averages', () => {
    const farms = [
      farm({ id: 'a', stateCode: 'AS', crop: 'maize' }),
      farm({ id: 'b', stateCode: 'AS', crop: 'maize' }),
      farm({ id: 'c', stateCode: 'NP', crop: 'sorghum' }),
    ];
    const events = [evt('a'), evt('b')];
    const issues = [issue({ farmId: 'c', region: 'NP' })];
    const r = getImpactReport({ farms, events, issues, now: NOW });
    const as = r.byRegion.find((x) => x.regionKey === 'AS');
    const np = r.byRegion.find((x) => x.regionKey === 'NP');
    expect(as.farmerCount).toBe(2);
    expect(as.topCrop).toBe('maize');
    expect(np.farmerCount).toBe(1);
    expect(np.issueCount).toBe(1);
  });

  it('byCrop aggregates per-crop metrics + intervention sample', () => {
    const farms = [
      farm({ id: 'a', crop: 'maize' }),
      farm({ id: 'b', crop: 'maize' }),
      farm({ id: 'c', crop: 'cassava' }),
    ];
    const outcomes = [
      outcome({ crop: 'maize', success: true }),
      outcome({ crop: 'maize', success: true }),
      outcome({ crop: 'maize', success: false }),
    ];
    const r = getImpactReport({ farms, outcomes, now: NOW });
    const maize = r.byCrop.find((x) => x.crop === 'maize');
    expect(maize.farmerCount).toBe(2);
    expect(maize.sampleSize).toBe(3);
    expect(maize.successRate).toBeCloseTo(2 / 3, 3);
  });

  it('byCrop successRate = 0 when no outcome samples', () => {
    const farms = [farm({ id: 'a', crop: 'tomato' })];
    const r = getImpactReport({ farms, now: NOW });
    const t = r.byCrop.find((x) => x.crop === 'tomato');
    expect(t.successRate).toBe(0);
    expect(t.sampleSize).toBe(0);
  });
});

// ─── Change detection ────────────────────────────────────────────
describe('change detection', () => {
  it('improving region = more completions in recent vs prior', () => {
    const farms = [farm({ id: 'a', stateCode: 'AS' })];
    const events = [
      // Prior window: 1 completion
      evt('a', 'task_completed', -10 * DAY),
      // Recent window: 3 completions
      evt('a', 'task_completed', -DAY),
      evt('a', 'task_completed', -2 * DAY),
      evt('a', 'task_completed', -3 * DAY),
    ];
    const r = getImpactReport({ farms, events, now: NOW });
    expect(r.changes.improvingRegions.some((x) => x.key === 'AS')).toBe(true);
  });

  it('declining region = more issues recent than prior', () => {
    const farms = [farm({ id: 'a', stateCode: 'AS' })];
    const issues = [
      issue({ farmId: 'a', region: 'AS', createdAt: NOW - DAY }),
      issue({ farmId: 'a', region: 'AS', createdAt: NOW - 2 * DAY }),
      issue({ farmId: 'a', region: 'AS', createdAt: NOW - 3 * DAY }),
    ];
    const r = getImpactReport({ farms, issues, now: NOW });
    expect(r.changes.decliningRegions.some((x) => x.key === 'AS')).toBe(true);
  });

  it('no activity in either window → no entries', () => {
    const r = getImpactReport({ farms: [farm({ id: 'a' })], now: NOW });
    expect(r.changes.improvingRegions).toEqual([]);
    expect(r.changes.decliningRegions).toEqual([]);
    expect(r.changes.improvingCrops).toEqual([]);
    expect(r.changes.decliningCrops).toEqual([]);
  });
});

// ─── Evidence layer ──────────────────────────────────────────────
describe('evidence rows', () => {
  it('emits one row per farm with required donor-reporting fields', () => {
    const farms = [farm({ id: 'a', farmerId: 'u1', program: 'p1', crop: 'maize' })];
    const events = [evt('a', 'task_completed', -DAY)];
    const outcomes = [outcome({ farmId: 'a', action: 'weed_control', success: true })];
    const r = getImpactReport({ farms, events, outcomes, now: NOW });
    expect(r.evidence).toHaveLength(1);
    const e = r.evidence[0];
    expect(e.farmerId).toBe('u1');
    expect(e.farmId).toBe('a');
    expect(e.program).toBe('p1');
    expect(e.crop).toBe('maize');
    expect(e.region).toBe('AS');
    expect(e.progressScore).toBeGreaterThanOrEqual(0);
    expect(e.taskCompletionRate).toBe(1);
    expect(e.streak).toBe(1);
    expect(e.lastActivity).toBeGreaterThan(0);
    expect(e.recentOutcome.action).toBe('weed_control');
    expect(e.recentOutcome.success).toBe(true);
  });

  it('progressScore falls with many open issues', () => {
    const farms = [farm({ id: 'a' })];
    const events = [evt('a', 'task_completed', -DAY)];
    const issues = [
      issue({ farmId: 'a', status: 'open' }),
      issue({ farmId: 'a', status: 'open' }),
    ];
    const r = getImpactReport({ farms, events, issues, now: NOW });
    // Base 100 (rate 1) minus 5 × 2 = 90.
    expect(r.evidence[0].progressScore).toBe(90);
  });
});

// ─── Program filter ──────────────────────────────────────────────
describe('program filter', () => {
  const farms = [
    farm({ id: 'a', program: 'p1' }),
    farm({ id: 'b', program: 'p2' }),
  ];
  const issues = [
    issue({ farmId: 'a', program: 'p1' }),
    issue({ farmId: 'b', program: 'p2' }),
  ];
  const outcomes = [
    outcome({ farmId: 'a', program: 'p1' }),
    outcome({ farmId: 'b', program: 'p2' }),
  ];

  it('scopes summary + evidence + interventions to the program', () => {
    const r = getImpactReport({ farms, issues, outcomes, program: 'p1', now: NOW });
    expect(r.summary.totalFarmers).toBe(1);
    expect(r.evidence).toHaveLength(1);
    expect(r.evidence[0].program).toBe('p1');
    expect(r.filteredBy.program).toBe('p1');
  });

  it('no filter → all data', () => {
    const r = getImpactReport({ farms, issues, outcomes, now: NOW });
    expect(r.summary.totalFarmers).toBe(2);
    expect(r.filteredBy.program).toBeNull();
  });
});

// ─── CSV exports ─────────────────────────────────────────────────
describe('CSV exports', () => {
  const farms = [
    farm({ id: 'a', farmerId: 'u1', crop: 'maize' }),
    farm({ id: 'b', farmerId: 'u2', crop: 'cassava' }),
  ];
  const events = [evt('a', 'task_completed', -DAY)];
  const outcomes = [
    outcome({ action: 'weed_control', success: true }),
    outcome({ action: 'weed_control', success: true }),
    outcome({ action: 'weed_control', success: false }),
  ];

  it('farmer evidence CSV has required headers + rows', () => {
    const r = getImpactReport({ farms, events, outcomes, now: NOW });
    const csv = exportFarmerEvidenceCsv(r);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe(
      'farmerId,farmId,program,crop,region,progressScore,' +
      'taskCompletionRate,streak,lastActivity,recentOutcome',
    );
    expect(lines).toHaveLength(1 + farms.length);
  });

  it('region impact CSV has required headers', () => {
    const r = getImpactReport({ farms, events, outcomes, now: NOW });
    const csv = exportRegionImpactCsv(r);
    const header = csv.trim().split('\n')[0];
    expect(header).toBe(
      'region,farmerCount,avgProgressScore,completionRate,' +
      'issueCount,resolvedIssueCount,highRiskCount,topCrop',
    );
  });

  it('intervention CSV has required headers + body', () => {
    const r = getImpactReport({ farms, events, outcomes, now: NOW });
    const csv = exportInterventionCsv(r);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('action,crop,region,sampleSize,successRate,confidenceLevel');
    expect(lines.length).toBeGreaterThan(1);
  });
});

// ─── Empty data + frozen outputs ─────────────────────────────────
describe('robustness', () => {
  it('empty everything → structured zeros, no NaN', () => {
    const r = getImpactReport({});
    expect(r.summary.totalFarmers).toBe(0);
    expect(r.byRegion).toEqual([]);
    expect(r.byCrop).toEqual([]);
    expect(r.interventions).toEqual([]);
    expect(r.evidence).toEqual([]);
  });

  it('frozen top-level + nested arrays + evidence rows', () => {
    const r = getImpactReport({
      farms: [farm({ id: 'a' })],
      events: [evt('a', 'task_completed', -DAY)],
      now: NOW,
    });
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.summary)).toBe(true);
    expect(Object.isFrozen(r.evidence)).toBe(true);
    expect(Object.isFrozen(r.evidence[0])).toBe(true);
    expect(Object.isFrozen(r.changes)).toBe(true);
  });
});
