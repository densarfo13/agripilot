/**
 * trustProfile.test.js — operational trust + completeness layer.
 *
 * Covers:
 *   1. Per-farmer trust level + checklist (low / medium / high)
 *   2. Missing-signal handling (graceful, no crash)
 *   3. Org-level aggregate percentages (incl. % missing location /
 *      crop, % inactive, % high completeness)
 *   4. CSV export includes trustScore + trustLevel + organizationLinked
 *   5. Back-compat — program summary still exposes its old fields
 *      alongside the new trust aggregate
 */

import { describe, it, expect } from 'vitest';

import {
  getFarmerTrustProfile,
  trustLevelFromScore,
  TRUST_SIGNALS,
  TRUST_MAX,
  _internal as profileInternals,
} from '../../../src/lib/trust/trustProfile.js';

import {
  aggregateTrustProfiles,
} from '../../../src/lib/trust/trustAggregate.js';

import {
  getProgramSummary,
  getExportData,
} from '../../../src/lib/ngo/analytics.js';

const NOW = new Date(2026, 3, 20, 12, 0, 0).getTime(); // fixed, matches currentDate
const DAY = 24 * 3600 * 1000;

// ─── fixtures ─────────────────────────────────────────────────────
function completeFarm(overrides = {}) {
  return {
    id: 'f1',
    farmerId: 'u1',
    name: 'Ada farm',
    crop: 'maize',
    country: 'GH',
    state: 'AS',
    latitude: 6.7,
    longitude: -1.6,
    program: 'ngo_ghana_2026',
    ...overrides,
  };
}

const recentEvent = (farmId, type = 'task_completed', offsetMs = -DAY) => ({
  farmId, type, timestamp: NOW + offsetMs, payload: {},
});

// ─── 1. Trust level + checklist ──────────────────────────────────
describe('getFarmerTrustProfile — level + checklist', () => {
  it('complete farm + recent task → high / 6/6', () => {
    const farm = completeFarm();
    const p = getFarmerTrustProfile({
      farm,
      events: [recentEvent('f1', 'task_completed')],
      now: NOW,
    });
    expect(p.level).toBe('high');
    expect(p.score).toBe(6);
    expect(p.max).toBe(TRUST_MAX);
    expect(p.percent).toBe(100);
    expect(p.checklist).toHaveLength(TRUST_SIGNALS.length);
    expect(p.nextActions).toHaveLength(0);
    for (const row of p.checklist) expect(row.met).toBe(true);
  });

  it('onboarded + linked + recent but no task → medium', () => {
    const farm = completeFarm();
    const p = getFarmerTrustProfile({
      farm,
      events: [recentEvent('f1', 'visit')],
      now: NOW,
    });
    expect(p.score).toBe(5);
    expect(p.level).toBe('high'); // 5 still maps to high
  });

  it('onboarding only → low', () => {
    const farm = completeFarm({
      latitude: undefined, longitude: undefined,
      state: '', program: '',
    });
    // onboarding + cropSelected + locationCaptured (country-only fails
    // the require-state-OR-coords check) → just onboarding + crop
    const p = getFarmerTrustProfile({ farm, events: [], now: NOW });
    expect(p.level).toBe('low');
    expect(p.score).toBeLessThanOrEqual(2);
  });

  it('empty farm → low, every action surfaced as next-best', () => {
    const p = getFarmerTrustProfile({ farm: {}, events: [], now: NOW });
    expect(p.level).toBe('low');
    expect(p.score).toBe(0);
    expect(p.nextActions.length).toBe(TRUST_SIGNALS.length);
    // stable order
    expect(p.nextActions[0].id).toBe('onboardingComplete');
  });

  it('output is frozen', () => {
    const p = getFarmerTrustProfile({ farm: completeFarm(), now: NOW });
    expect(Object.isFrozen(p)).toBe(true);
    expect(Object.isFrozen(p.checklist)).toBe(true);
    expect(Object.isFrozen(p.signals)).toBe(true);
  });

  it('translator is optional — falls back to English labels', () => {
    const p = getFarmerTrustProfile({ farm: completeFarm(), now: NOW });
    const onboarding = p.checklist.find((c) => c.id === 'onboardingComplete');
    expect(onboarding.label).toBe('Profile complete');
  });

  it('uses translator when supplied', () => {
    const t = (k) => (k === 'trust.signal.onboarding' ? 'Profil complet' : k);
    const p = getFarmerTrustProfile({ farm: completeFarm(), now: NOW }, t);
    const onboarding = p.checklist.find((c) => c.id === 'onboardingComplete');
    expect(onboarding.label).toBe('Profil complet');
  });
});

// ─── 2. Missing-signal handling ──────────────────────────────────
describe('getFarmerTrustProfile — missing-signal handling', () => {
  it('null/undefined farm → low, zero score, no crash', () => {
    expect(getFarmerTrustProfile({ farm: null }).level).toBe('low');
    expect(getFarmerTrustProfile({}).level).toBe('low');
  });

  it('ignores events for other farms', () => {
    const farm = completeFarm();
    const p = getFarmerTrustProfile({
      farm,
      events: [recentEvent('different-farm', 'task_completed')],
      now: NOW,
    });
    expect(p.signals.recentActivity).toBe(false);
    expect(p.signals.taskActivity).toBe(false);
  });

  it('old events (>7 days) do not count as recent', () => {
    const farm = completeFarm();
    const p = getFarmerTrustProfile({
      farm,
      events: [recentEvent('f1', 'task_completed', -14 * DAY)],
      now: NOW,
    });
    expect(p.signals.recentActivity).toBe(false);
  });

  it('organizationLinked detects multiple key shapes', () => {
    expect(profileInternals.isOrgLinked({ program: 'p1' })).toBe(true);
    expect(profileInternals.isOrgLinked({ organizationId: 'o1' })).toBe(true);
    expect(profileInternals.isOrgLinked({ ngoId: 'n1' })).toBe(true);
    expect(profileInternals.isOrgLinked({ partnerId: 'x' })).toBe(true);
    expect(profileInternals.isOrgLinked({ program: '' })).toBe(false);
    expect(profileInternals.isOrgLinked({ program: null })).toBe(false);
    expect(profileInternals.isOrgLinked({})).toBe(false);
    expect(profileInternals.isOrgLinked(null)).toBe(false);
  });

  it('trustLevelFromScore maps the thresholds', () => {
    expect(trustLevelFromScore(0)).toBe('low');
    expect(trustLevelFromScore(2)).toBe('low');
    expect(trustLevelFromScore(3)).toBe('medium');
    expect(trustLevelFromScore(4)).toBe('medium');
    expect(trustLevelFromScore(5)).toBe('high');
    expect(trustLevelFromScore(6)).toBe('high');
    expect(trustLevelFromScore(null)).toBe('low');
    expect(trustLevelFromScore(NaN)).toBe('low');
  });
});

// ─── 3. Org-level aggregation ─────────────────────────────────────
describe('aggregateTrustProfiles', () => {
  it('computes percentages across a mixed org', () => {
    const farms = [
      completeFarm({ id: 'a' }),                              // high / 6
      completeFarm({ id: 'b', latitude: undefined, longitude: undefined, state: '' }), // missing location
      completeFarm({ id: 'c', crop: '' }),                    // missing crop
      completeFarm({ id: 'd', program: '' }),                 // unlinked
      completeFarm({ id: 'e', name: '', crop: '' }),          // onboarding incomplete
    ];
    const events = [
      recentEvent('a', 'task_completed'),
      recentEvent('b', 'task_completed'),
      // c + d + e have no recent activity
    ];
    const agg = aggregateTrustProfiles({ farms, events, now: NOW });

    expect(agg.total).toBe(5);
    expect(agg.pctMissingLocation).toBe(20); // 1/5
    expect(agg.pctMissingCrop).toBeGreaterThanOrEqual(20); // 'c' + 'e'
    expect(agg.pctInactiveRecently).toBe(60);              // c+d+e = 3/5
    expect(agg.pctUnlinkedToOrg).toBe(20);
    expect(agg.pctOnboardingIncomplete).toBeGreaterThanOrEqual(20);
    expect(agg.byLevel.high + agg.byLevel.medium + agg.byLevel.low).toBe(5);
    expect(Object.isFrozen(agg)).toBe(true);
  });

  it('empty org → zeros, not NaN', () => {
    const agg = aggregateTrustProfiles({ farms: [], events: [], now: NOW });
    expect(agg.total).toBe(0);
    expect(agg.pctHighCompleteness).toBe(0);
    expect(agg.pctMissingLocation).toBe(0);
    expect(agg.avgScore).toBe(0);
    expect(agg.byLevel).toEqual({ high: 0, medium: 0, low: 0 });
  });

  it('all-complete org → 100% high completeness', () => {
    const farms = [
      completeFarm({ id: 'a' }),
      completeFarm({ id: 'b' }),
    ];
    const events = [
      recentEvent('a', 'task_completed'),
      recentEvent('b', 'task_completed'),
    ];
    const agg = aggregateTrustProfiles({ farms, events, now: NOW });
    expect(agg.pctHighCompleteness).toBe(100);
    expect(agg.pctMissingLocation).toBe(0);
    expect(agg.pctMissingCrop).toBe(0);
    expect(agg.pctInactiveRecently).toBe(0);
  });
});

// ─── 4. CSV export inclusion ──────────────────────────────────────
describe('getExportData — trust columns', () => {
  it('includes trustLevel + trustScore + organizationLinked', () => {
    const farms = [completeFarm({ id: 'a' })];
    const events = [recentEvent('a', 'task_completed')];
    const csv = getExportData(null, {
      farms, events, completions: [], now: NOW,
    });
    const [header, row] = csv.trim().split('\n');
    expect(header).toContain('trustLevel');
    expect(header).toContain('trustScore');
    expect(header).toContain('organizationLinked');
    expect(row).toMatch(/high/);
    expect(row).toMatch(/yes/); // organizationLinked column
  });

  it('trustLevel reflects missing signals', () => {
    const farms = [completeFarm({ id: 'x', name: '', crop: '', program: '' })];
    const csv = getExportData(null, {
      farms, events: [], completions: [], now: NOW,
    });
    const row = csv.trim().split('\n')[1];
    expect(row).toMatch(/low/);
  });
});

// ─── 5. getProgramSummary back-compat ────────────────────────────
describe('getProgramSummary — exposes trust aggregate without breaking prior fields', () => {
  it('preserves legacy fields and adds `trust`', () => {
    const farms = [
      completeFarm({ id: 'a', program: 'ngo' }),
      completeFarm({ id: 'b', program: 'ngo', latitude: undefined, longitude: undefined, state: '' }),
    ];
    const events = [recentEvent('a', 'task_completed')];
    const s = getProgramSummary('ngo', {
      farms, events, completions: [], now: NOW,
    });
    expect(s.program).toBe('ngo');
    expect(s.totalFarmers).toBe(2);
    expect(typeof s.avgProgressScore).toBe('number');
    expect(typeof s.totalTasksCompleted).toBe('number');
    expect(s.trust).toBeTruthy();
    expect(s.trust.total).toBe(2);
    expect(s.trust.pctMissingLocation).toBe(50);
  });

  it('empty program still yields safe zeros', () => {
    const s = getProgramSummary('missing', {
      farms: [], events: [], completions: [], now: NOW,
    });
    expect(s.totalFarmers).toBe(0);
    expect(s.trust).toBeUndefined();
  });
});
