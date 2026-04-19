/**
 * flowOutcomeAndCohorts.test.js — contract for the classifier
 * that labels each session ("action" / "hesitation" / "drop_off"
 * / "confused" / "idle") and for the cohort grouper + conversion
 * service they all plug into.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyFlowOutcome,
  aggregateFlowOutcomes,
} from '../services/analytics/flowOutcomeClassifier.js';
import {
  extractCohortKeys,
  groupByMode,
  groupByLocationMethod,
  groupByConfidenceTier,
  compareCohorts,
} from '../services/analytics/cohortGrouper.js';
import {
  computeFunnelConversions,
  computeStepConversion,
  computeDecisionFunnel,
} from '../services/analytics/funnelConversionService.js';
import {
  DECISION_EVENT_TYPES,
  FUNNEL_EVENT_TYPES,
  FUNNEL_STEPS,
} from '../services/analytics/decisionEventTypes.js';

const T0 = new Date('2026-04-19T10:00:00Z').getTime();
const at = (i) => T0 + i * 1000;

// ─── Flow outcome ─────────────────────────────────────────
describe('classifyFlowOutcome', () => {
  it('returns "idle" for near-empty streams', () => {
    expect(classifyFlowOutcome([]).outcome).toBe('idle');
    expect(classifyFlowOutcome([{ type: FUNNEL_EVENT_TYPES.STEP_VIEWED, meta: { step: FUNNEL_STEPS.WELCOME }, timestamp: at(1) }]).outcome)
      .toBe('idle');
  });

  it('returns "action" when user completes a task directly', () => {
    const out = classifyFlowOutcome([
      { type: FUNNEL_EVENT_TYPES.STEP_VIEWED,  meta: { step: FUNNEL_STEPS.WELCOME }, timestamp: at(1) },
      { type: FUNNEL_EVENT_TYPES.STEP_COMPLETED, meta: { step: FUNNEL_STEPS.WELCOME }, timestamp: at(2) },
      { type: DECISION_EVENT_TYPES.TASK_COMPLETED, meta: { taskId: 't1' }, timestamp: at(3) },
    ]);
    expect(out.outcome).toBe('action');
  });

  it('returns "hesitation" when user finishes after long dwell', () => {
    const out = classifyFlowOutcome([
      { type: FUNNEL_EVENT_TYPES.STEP_VIEWED,  meta: { step: FUNNEL_STEPS.LOCATION }, timestamp: T0 },
      { type: FUNNEL_EVENT_TYPES.STEP_COMPLETED, meta: { step: FUNNEL_STEPS.LOCATION }, timestamp: T0 + 120_000 },
      { type: DECISION_EVENT_TYPES.TASK_COMPLETED, meta: { taskId: 't1' }, timestamp: T0 + 120_100 },
    ]);
    expect(out.outcome).toBe('hesitation');
  });

  it('returns "confused" when retries + rejects + no commit', () => {
    const out = classifyFlowOutcome([
      { type: DECISION_EVENT_TYPES.LOCATION_RETRY_CLICKED, meta: {}, timestamp: at(1) },
      { type: DECISION_EVENT_TYPES.LOCATION_RETRY_CLICKED, meta: {}, timestamp: at(2) },
      { type: DECISION_EVENT_TYPES.RECOMMENDATION_REJECTED, meta: { crop: 'maize' }, timestamp: at(3) },
    ]);
    expect(out.outcome).toBe('confused');
  });

  it('returns "drop_off" on explicit abandon', () => {
    const out = classifyFlowOutcome([
      { type: FUNNEL_EVENT_TYPES.STEP_VIEWED,  meta: { step: FUNNEL_STEPS.LOCATION }, timestamp: at(1) },
      { type: FUNNEL_EVENT_TYPES.STEP_ABANDONED, meta: { step: FUNNEL_STEPS.LOCATION }, timestamp: at(2) },
    ]);
    expect(out.outcome).toBe('drop_off');
  });
});

describe('aggregateFlowOutcomes', () => {
  it('computes outcome rates across users', () => {
    const users = [
      { userId: 'a', events: [
        { type: FUNNEL_EVENT_TYPES.STEP_VIEWED,  meta: { step: FUNNEL_STEPS.WELCOME }, timestamp: at(1) },
        { type: DECISION_EVENT_TYPES.TASK_COMPLETED, meta: {}, timestamp: at(2) },
      ]},
      { userId: 'b', events: [
        { type: FUNNEL_EVENT_TYPES.STEP_VIEWED,  meta: { step: FUNNEL_STEPS.WELCOME }, timestamp: at(1) },
        { type: FUNNEL_EVENT_TYPES.STEP_ABANDONED, meta: { step: FUNNEL_STEPS.WELCOME }, timestamp: at(2) },
      ]},
      { userId: 'c', events: [] },
    ];
    const agg = aggregateFlowOutcomes(users);
    expect(agg.totalUsers).toBe(3);
    expect(agg.byOutcome.action).toBe(1);
    expect(agg.byOutcome.drop_off).toBe(1);
    expect(agg.byOutcome.idle).toBe(1);
    expect(agg.rates.actionRate).toBeCloseTo(0.333, 2);
  });
});

// ─── Cohort grouper ──────────────────────────────────────
describe('extractCohortKeys', () => {
  it('derives mode, locationMethod, confidenceTier from events', () => {
    const keys = extractCohortKeys({
      userId: 'u1',
      events: [
        { type: FUNNEL_EVENT_TYPES.STEP_VIEWED,           meta: { step: 'welcome', mode: 'farm' }, timestamp: at(1) },
        { type: 'onboarding_location_detect_success',    meta: {}, timestamp: at(2) },
        {
          type: DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED,
          meta: { crop: 'maize' },
          confidence: { level: 'high', score: 85 },
          timestamp: at(3),
        },
      ],
    });
    expect(keys.mode).toBe('farm');
    expect(keys.locationMethod).toBe('detect');
    expect(keys.confidenceTier).toBe('high');
  });

  it('falls back to unknown when data is missing', () => {
    const keys = extractCohortKeys({});
    expect(keys.mode).toBe('unknown');
    expect(keys.locationMethod).toBe('unknown');
    expect(keys.confidenceTier).toBe('unknown');
  });

  it('profile overrides events', () => {
    const keys = extractCohortKeys({
      profile: { mode: 'backyard' },
      events: [
        { type: FUNNEL_EVENT_TYPES.STEP_VIEWED, meta: { mode: 'farm' }, timestamp: at(1) },
      ],
    });
    expect(keys.mode).toBe('backyard');
  });
});

describe('groupBy helpers', () => {
  const users = [
    { userId: 'a', events: [{ type: FUNNEL_EVENT_TYPES.STEP_VIEWED, meta: { mode: 'farm' }, timestamp: at(1) }] },
    { userId: 'b', events: [{ type: FUNNEL_EVENT_TYPES.STEP_VIEWED, meta: { mode: 'backyard' }, timestamp: at(1) }] },
    { userId: 'c', events: [{ type: FUNNEL_EVENT_TYPES.STEP_VIEWED, meta: { mode: 'backyard' }, timestamp: at(1) }] },
    { userId: 'd', events: [{ type: 'onboarding_location_detect_success', meta: {}, timestamp: at(1) }] },
    { userId: 'e', events: [{ type: DECISION_EVENT_TYPES.LOCATION_CONFIRMED_MANUAL, meta: {}, timestamp: at(1) }] },
  ];
  it('groups by mode', () => {
    const g = groupByMode(users);
    expect(g.farm.count).toBe(1);
    expect(g.backyard.count).toBe(2);
    expect(g.unknown.count).toBe(2);
  });
  it('groups by location method', () => {
    const g = groupByLocationMethod(users);
    expect(g.detect.count).toBe(1);
    expect(g.manual.count).toBe(1);
    expect(g.unknown.count).toBe(3);
  });
  it('groups by confidence tier', () => {
    const withConfidence = [
      { userId: 'h', events: [{ type: DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED, confidence: { level: 'high', score: 85 }, timestamp: at(1), meta: {} }] },
      { userId: 'l', events: [{ type: DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED, confidence: { level: 'low',  score: 30 }, timestamp: at(1), meta: {} }] },
    ];
    const g = groupByConfidenceTier(withConfidence);
    expect(g.high.count).toBe(1);
    expect(g.low.count).toBe(1);
  });
});

describe('compareCohorts', () => {
  it('diffs two cohorts using a metric function', () => {
    const a = [{ userId: '1' }, { userId: '2' }];
    const b = [{ userId: '3' }];
    const metric = (users) => users.length;
    const cmp = compareCohorts(a, b, metric, { labelA: 'a', labelB: 'b' });
    expect(cmp.a).toBe(2);
    expect(cmp.b).toBe(1);
    expect(cmp.diff).toBe(1);
  });
});

// ─── Funnel conversion ───────────────────────────────────
describe('computeFunnelConversions', () => {
  it('returns per-step viewed/completed counts + biggest drop-off', () => {
    const users = [
      { userId: 'u1', events: [
        { type: FUNNEL_EVENT_TYPES.STEP_VIEWED,    meta: { step: FUNNEL_STEPS.WELCOME }, timestamp: at(1) },
        { type: FUNNEL_EVENT_TYPES.STEP_COMPLETED, meta: { step: FUNNEL_STEPS.WELCOME }, timestamp: at(2) },
        { type: FUNNEL_EVENT_TYPES.STEP_VIEWED,    meta: { step: FUNNEL_STEPS.LOCATION }, timestamp: at(3) },
      ]},
      { userId: 'u2', events: [
        { type: FUNNEL_EVENT_TYPES.STEP_VIEWED,    meta: { step: FUNNEL_STEPS.WELCOME }, timestamp: at(1) },
        { type: FUNNEL_EVENT_TYPES.STEP_COMPLETED, meta: { step: FUNNEL_STEPS.WELCOME }, timestamp: at(2) },
        { type: FUNNEL_EVENT_TYPES.STEP_VIEWED,    meta: { step: FUNNEL_STEPS.LOCATION }, timestamp: at(3) },
        { type: FUNNEL_EVENT_TYPES.STEP_COMPLETED, meta: { step: FUNNEL_STEPS.LOCATION }, timestamp: at(4) },
      ]},
    ];
    const f = computeFunnelConversions(users);
    const welcome  = f.perStep.find((s) => s.step === FUNNEL_STEPS.WELCOME);
    const location = f.perStep.find((s) => s.step === FUNNEL_STEPS.LOCATION);
    expect(welcome.viewed).toBe(2);
    expect(welcome.completed).toBe(2);
    expect(location.viewed).toBe(2);
    expect(location.completed).toBe(1);
    expect(location.completionRate).toBe(0.5);
    expect(f.overall.biggestDropOff).toBeTruthy();
  });
});

describe('computeStepConversion', () => {
  it('computes rate between two specified steps', () => {
    const users = [
      { userId: 'u1', events: [
        { type: FUNNEL_EVENT_TYPES.STEP_VIEWED,    meta: { step: FUNNEL_STEPS.RECOMMENDATIONS }, timestamp: at(1) },
        { type: FUNNEL_EVENT_TYPES.STEP_COMPLETED, meta: { step: FUNNEL_STEPS.CROP_SELECTED }, timestamp: at(2) },
      ]},
      { userId: 'u2', events: [
        { type: FUNNEL_EVENT_TYPES.STEP_VIEWED,    meta: { step: FUNNEL_STEPS.RECOMMENDATIONS }, timestamp: at(1) },
      ]},
    ];
    const r = computeStepConversion(users, FUNNEL_STEPS.RECOMMENDATIONS, FUNNEL_STEPS.CROP_SELECTED);
    expect(r.fromCount).toBe(2);
    expect(r.toCount).toBe(1);
    expect(r.rate).toBe(0.5);
  });
});

describe('computeDecisionFunnel', () => {
  it('returns the full pipeline of rec→select→task→harvest', () => {
    const users = [
      { userId: 'u1', events: [
        { type: DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED,   meta: {}, timestamp: at(1) },
        { type: DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, meta: {}, timestamp: at(2) },
        { type: DECISION_EVENT_TYPES.TASK_COMPLETED,          meta: {}, timestamp: at(3) },
        { type: DECISION_EVENT_TYPES.HARVEST_SUBMITTED,       meta: { outcomeClass: 'good' }, timestamp: at(4) },
      ]},
      { userId: 'u2', events: [
        { type: DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED,   meta: {}, timestamp: at(1) },
        { type: DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, meta: {}, timestamp: at(2) },
      ]},
      { userId: 'u3', events: [
        { type: DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED,   meta: {}, timestamp: at(1) },
      ]},
    ];
    const f = computeDecisionFunnel(users);
    expect(f.recViewed).toBe(3);
    expect(f.recSelected).toBe(2);
    expect(f.taskCompleted).toBe(1);
    expect(f.harvested).toBe(1);
    expect(f.rates.viewedToSelected).toBeCloseTo(0.667, 2);
    expect(f.rates.viewedToHarvest).toBeCloseTo(0.333, 2);
  });
});
