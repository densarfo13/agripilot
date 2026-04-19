/**
 * hesitationAndTrustBreaks.test.js — behavioral contract for the
 * two inference layers that answer "where do users hesitate?"
 * and "where does trust break?".
 */

import { describe, it, expect } from 'vitest';
import {
  detectHesitation,
  aggregateHesitationCounts,
  _internal as hesInternal,
} from '../services/analytics/hesitationDetector.js';
import {
  detectTrustBreaks,
  aggregateTrustBreakCounts,
  TRUST_BREAK_PATTERNS,
} from '../services/analytics/trustBreakDetector.js';
import {
  DECISION_EVENT_TYPES,
  FUNNEL_EVENT_TYPES,
  FUNNEL_STEPS,
} from '../services/analytics/decisionEventTypes.js';

const T0 = new Date('2026-04-19T09:00:00Z').getTime();

function seq(events) {
  // fluent helper — each event is either a tuple [type, meta, offsetSec]
  // or an object already in final shape.
  return events.map((e, i) => {
    if (Array.isArray(e)) {
      const [type, meta = {}, offsetSec = (i + 1) * 10] = e;
      return { type, meta, timestamp: T0 + offsetSec * 1000 };
    }
    return { timestamp: T0 + (i + 1) * 10_000, ...e };
  });
}

// ─── HESITATION ────────────────────────────────────────────
describe('detectHesitation — dwell time', () => {
  it('flags long dwell when step takes longer than threshold', () => {
    const events = [
      { type: FUNNEL_EVENT_TYPES.STEP_VIEWED,   meta: { step: FUNNEL_STEPS.LOCATION }, timestamp: T0 },
      { type: FUNNEL_EVENT_TYPES.STEP_COMPLETED, meta: { step: FUNNEL_STEPS.LOCATION }, timestamp: T0 + 90_000 },
    ];
    const info = detectHesitation(events);
    expect(info.hesitated).toBe(true);
    expect(info.perStep[FUNNEL_STEPS.LOCATION].longDwell).toBe(true);
    expect(info.reasons.some((r) => r.kind === 'long_dwell' && r.stage === FUNNEL_STEPS.LOCATION))
      .toBe(true);
    expect(info.slowestStep).toBe(FUNNEL_STEPS.LOCATION);
  });

  it('does not flag short dwell', () => {
    const events = [
      { type: FUNNEL_EVENT_TYPES.STEP_VIEWED,   meta: { step: FUNNEL_STEPS.WELCOME }, timestamp: T0 },
      { type: FUNNEL_EVENT_TYPES.STEP_COMPLETED, meta: { step: FUNNEL_STEPS.WELCOME }, timestamp: T0 + 5_000 },
    ];
    const info = detectHesitation(events);
    expect(info.hesitated).toBe(false);
    expect(info.perStep[FUNNEL_STEPS.WELCOME].dwellMs).toBe(5000);
  });
});

describe('detectHesitation — retries & back-nav', () => {
  it('flags repeated location retries', () => {
    const events = seq([
      [FUNNEL_EVENT_TYPES.STEP_VIEWED,            { step: FUNNEL_STEPS.LOCATION }, 1],
      [DECISION_EVENT_TYPES.LOCATION_RETRY_CLICKED, {}, 2],
      [DECISION_EVENT_TYPES.LOCATION_RETRY_CLICKED, {}, 3],
      [FUNNEL_EVENT_TYPES.STEP_COMPLETED,         { step: FUNNEL_STEPS.LOCATION }, 4],
    ]);
    const info = detectHesitation(events);
    expect(info.perStep[FUNNEL_STEPS.LOCATION].retries).toBe(2);
    expect(info.reasons.some((r) => r.kind === 'multi_retry')).toBe(true);
  });

  it('flags back-navigation after a later step was completed', () => {
    const events = seq([
      [FUNNEL_EVENT_TYPES.STEP_VIEWED,   { step: FUNNEL_STEPS.WELCOME }, 1],
      [FUNNEL_EVENT_TYPES.STEP_COMPLETED, { step: FUNNEL_STEPS.WELCOME }, 2],
      [FUNNEL_EVENT_TYPES.STEP_VIEWED,   { step: FUNNEL_STEPS.LOCATION }, 3],
      [FUNNEL_EVENT_TYPES.STEP_COMPLETED, { step: FUNNEL_STEPS.LOCATION }, 4],
      [FUNNEL_EVENT_TYPES.STEP_VIEWED,   { step: FUNNEL_STEPS.WELCOME }, 5],
      [FUNNEL_EVENT_TYPES.STEP_VIEWED,   { step: FUNNEL_STEPS.WELCOME }, 6],
    ]);
    const info = detectHesitation(events);
    expect(info.perStep[FUNNEL_STEPS.WELCOME].backNavs).toBeGreaterThanOrEqual(2);
    expect(info.reasons.some((r) => r.kind === 'back_nav' && r.stage === FUNNEL_STEPS.WELCOME))
      .toBe(true);
  });
});

describe('detectHesitation — repeat skips', () => {
  it('flags a task skipped multiple times', () => {
    const events = seq([
      [DECISION_EVENT_TYPES.TASK_SKIPPED, { taskId: 't1' }, 1],
      [DECISION_EVENT_TYPES.TASK_SKIPPED, { taskId: 't1' }, 2],
      [DECISION_EVENT_TYPES.TASK_REPEAT_SKIPPED, { taskId: 't1', skipCount: 2 }, 3],
    ]);
    const info = detectHesitation(events);
    expect(info.perTask.t1.skipCount).toBe(2);
    expect(info.perTask.t1.repeatSkipped).toBe(true);
    expect(info.reasons.some((r) => r.kind === 'repeat_skip')).toBe(true);
  });
});

describe('aggregateHesitationCounts', () => {
  it('rolls up hesitation metrics across users', () => {
    const users = [
      { userId: 'u1', events: seq([
        [FUNNEL_EVENT_TYPES.STEP_VIEWED,  { step: FUNNEL_STEPS.LOCATION }, 1],
        [FUNNEL_EVENT_TYPES.STEP_COMPLETED, { step: FUNNEL_STEPS.LOCATION }, 200], // 199s > threshold
      ]) },
      { userId: 'u2', events: seq([
        [FUNNEL_EVENT_TYPES.STEP_VIEWED,  { step: FUNNEL_STEPS.LOCATION }, 1],
        [FUNNEL_EVENT_TYPES.STEP_COMPLETED, { step: FUNNEL_STEPS.LOCATION }, 3],
      ]) },
      { userId: 'u3', events: seq([
        [FUNNEL_EVENT_TYPES.STEP_VIEWED,  { step: FUNNEL_STEPS.LOCATION }, 1],
        [DECISION_EVENT_TYPES.LOCATION_RETRY_CLICKED, {}, 2],
        [DECISION_EVENT_TYPES.LOCATION_RETRY_CLICKED, {}, 3],
      ]) },
    ];
    const agg = aggregateHesitationCounts(users);
    expect(agg.totalUsers).toBe(3);
    expect(agg.hesitatedUsers).toBeGreaterThanOrEqual(2);
    expect(agg.byStage[FUNNEL_STEPS.LOCATION]).toBeGreaterThanOrEqual(2);
    expect(Number.isFinite(agg.averageDwellMsByStep[FUNNEL_STEPS.LOCATION])).toBe(true);
  });

  it('handles empty / missing events safely', () => {
    const agg = aggregateHesitationCounts([{ userId: 'u1' }]);
    expect(agg.totalUsers).toBe(1);
    expect(agg.hesitatedUsers).toBe(0);
    expect(agg.hesitationRate).toBe(0);
  });
});

// ─── TRUST BREAKS ──────────────────────────────────────────
describe('detectTrustBreaks — LOW_CONF_ABANDONED', () => {
  it('flags a low-confidence step the user abandoned', () => {
    const events = [
      {
        type: FUNNEL_EVENT_TYPES.STEP_VIEWED,
        meta: { step: FUNNEL_STEPS.RECOMMENDATIONS },
        confidence: { level: 'low', score: 35 },
        timestamp: T0,
      },
      {
        type: FUNNEL_EVENT_TYPES.STEP_ABANDONED,
        meta: { step: FUNNEL_STEPS.RECOMMENDATIONS },
        timestamp: T0 + 20_000,
      },
    ];
    const info = detectTrustBreaks(events);
    expect(info.broken).toBe(true);
    expect(info.patterns[TRUST_BREAK_PATTERNS.LOW_CONF_ABANDONED]).toBe(1);
  });

  it('does not flag medium/high confidence', () => {
    const events = [
      {
        type: FUNNEL_EVENT_TYPES.STEP_VIEWED,
        meta: { step: FUNNEL_STEPS.RECOMMENDATIONS },
        confidence: { level: 'high', score: 85 },
        timestamp: T0,
      },
      {
        type: FUNNEL_EVENT_TYPES.STEP_ABANDONED,
        meta: { step: FUNNEL_STEPS.RECOMMENDATIONS },
        timestamp: T0 + 20_000,
      },
    ];
    const info = detectTrustBreaks(events);
    expect(info.patterns[TRUST_BREAK_PATTERNS.LOW_CONF_ABANDONED] || 0).toBe(0);
  });
});

describe('detectTrustBreaks — DETECT_OVERRIDDEN_BY_MANUAL', () => {
  it('flags a confirmed detect that was later manually overridden', () => {
    const events = seq([
      [DECISION_EVENT_TYPES.LOCATION_CONFIRMED_YES, {}, 1],
      [DECISION_EVENT_TYPES.LOCATION_CONFIRMED_MANUAL, { country: 'GH' }, 120],
    ]);
    const info = detectTrustBreaks(events);
    expect(info.patterns[TRUST_BREAK_PATTERNS.DETECT_OVERRIDDEN_BY_MANUAL]).toBe(1);
  });

  it('does not flag a confirm without a later override', () => {
    const events = seq([
      [DECISION_EVENT_TYPES.LOCATION_CONFIRMED_YES, {}, 1],
    ]);
    const info = detectTrustBreaks(events);
    expect(info.count).toBe(0);
  });
});

describe('detectTrustBreaks — PERMISSION_DENIED_EXIT', () => {
  it('flags when permission denied and the user went silent', () => {
    const events = [
      { type: 'onboarding_location_permission_denied', meta: {}, timestamp: T0 },
    ];
    const info = detectTrustBreaks(events, { now: T0 + 30 * 60 * 1000 });
    expect(info.patterns[TRUST_BREAK_PATTERNS.PERMISSION_DENIED_EXIT]).toBe(1);
  });

  it('does not flag when user continued manually', () => {
    const events = [
      { type: 'onboarding_location_permission_denied', meta: {}, timestamp: T0 },
      { type: DECISION_EVENT_TYPES.LOCATION_CONFIRMED_MANUAL, meta: { country: 'GH' }, timestamp: T0 + 30_000 },
    ];
    const info = detectTrustBreaks(events, { now: T0 + 30 * 60 * 1000 });
    expect(info.patterns[TRUST_BREAK_PATTERNS.PERMISSION_DENIED_EXIT] || 0).toBe(0);
  });
});

describe('detectTrustBreaks — HIGH_CONF_REC_REJECTED', () => {
  it('flags high-confidence recommendations that were rejected', () => {
    const events = [
      {
        type: DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED,
        meta: { crop: 'maize' },
        confidence: { level: 'high', score: 90 },
        timestamp: T0,
      },
      {
        type: DECISION_EVENT_TYPES.RECOMMENDATION_REJECTED,
        meta: { crop: 'maize' },
        timestamp: T0 + 1000,
      },
    ];
    const info = detectTrustBreaks(events);
    expect(info.patterns[TRUST_BREAK_PATTERNS.HIGH_CONF_REC_REJECTED]).toBe(1);
  });
});

describe('detectTrustBreaks — ISSUE_AFTER_TASK_COMPLETED', () => {
  it('flags an issue reported within 24h of completing a task', () => {
    const events = [
      { type: DECISION_EVENT_TYPES.TASK_COMPLETED, meta: { taskId: 't1' }, timestamp: T0 },
      { type: DECISION_EVENT_TYPES.ISSUE_REPORTED, meta: { taskId: 't1', type: 'disease_detected' }, timestamp: T0 + 6 * 60 * 60 * 1000 },
    ];
    const info = detectTrustBreaks(events);
    expect(info.patterns[TRUST_BREAK_PATTERNS.ISSUE_AFTER_TASK_COMPLETED]).toBe(1);
  });

  it('does not flag an issue unrelated to the task (different taskId)', () => {
    const events = [
      { type: DECISION_EVENT_TYPES.TASK_COMPLETED, meta: { taskId: 't1' }, timestamp: T0 },
      { type: DECISION_EVENT_TYPES.ISSUE_REPORTED, meta: { taskId: 't2', type: 'disease_detected' }, timestamp: T0 + 1_000 },
    ];
    const info = detectTrustBreaks(events);
    expect(info.patterns[TRUST_BREAK_PATTERNS.ISSUE_AFTER_TASK_COMPLETED] || 0).toBe(0);
  });
});

describe('detectTrustBreaks — REPEAT_SKIP_THEN_ABANDONED', () => {
  it('flags a repeat-skip that had no subsequent task activity', () => {
    const events = [
      { type: DECISION_EVENT_TYPES.TASK_REPEAT_SKIPPED, meta: { taskId: 't1' }, timestamp: T0 },
    ];
    const info = detectTrustBreaks(events);
    expect(info.patterns[TRUST_BREAK_PATTERNS.REPEAT_SKIP_THEN_ABANDONED]).toBe(1);
  });

  it('does not flag when the user came back', () => {
    const events = [
      { type: DECISION_EVENT_TYPES.TASK_REPEAT_SKIPPED, meta: { taskId: 't1' }, timestamp: T0 },
      { type: DECISION_EVENT_TYPES.TASK_COMPLETED,       meta: { taskId: 't1' }, timestamp: T0 + 5_000 },
    ];
    const info = detectTrustBreaks(events);
    expect(info.count).toBe(0);
  });
});

describe('aggregateTrustBreakCounts', () => {
  it('computes pattern rates across multiple users', () => {
    const users = [
      { userId: 'u1', events: [
        { type: DECISION_EVENT_TYPES.LOCATION_CONFIRMED_YES, meta: {}, timestamp: 1 },
        { type: DECISION_EVENT_TYPES.LOCATION_CONFIRMED_MANUAL, meta: {}, timestamp: 2 },
      ]},
      { userId: 'u2', events: [
        { type: 'onboarding_location_permission_denied', meta: {}, timestamp: 1 },
      ]},
      { userId: 'u3', events: [] },
    ];
    const agg = aggregateTrustBreakCounts(users);
    expect(agg.totalUsers).toBe(3);
    expect(agg.byPattern[TRUST_BREAK_PATTERNS.DETECT_OVERRIDDEN_BY_MANUAL]).toBe(1);
    expect(agg.trustBreakRate).toBeGreaterThan(0);
  });
});

describe('internal thresholds are exposed for tuning', () => {
  it('dwell thresholds are defined per funnel step', () => {
    expect(hesInternal.DEFAULT_DWELL_THRESHOLD_MS[FUNNEL_STEPS.LOCATION]).toBeGreaterThan(10_000);
    expect(hesInternal.DEFAULT_DWELL_THRESHOLD_MS[FUNNEL_STEPS.ONBOARDING_COMPLETED]).toBeLessThan(30_000);
  });
});
