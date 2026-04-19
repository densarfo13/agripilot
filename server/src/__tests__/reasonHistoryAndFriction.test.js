/**
 * reasonHistoryAndFriction.test.js — covers:
 *   • weighted reason history + top-reason ranking
 *   • journey health synthesis (friction / trust / hesitation)
 *   • correct risk level + suggested focus classification
 *   • stability: low-signal contexts produce calm outputs
 */

import { describe, it, expect } from 'vitest';

import {
  addReasonSnapshot,
  getWeightedReasonHistory,
  summarizeTopReasons,
  getReasonFrequencyOverTime,
} from '../services/decision/reasonHistoryService.js';
import {
  buildUserFrictionScore,
  buildTrustScore,
  buildHesitationScore,
  buildJourneyHealthSnapshot,
} from '../services/decision/journeyHealthService.js';
import {
  DECISION_EVENT_TYPES,
  FUNNEL_EVENT_TYPES,
  FUNNEL_STEPS,
} from '../services/analytics/decisionEventTypes.js';

const NOW = new Date('2026-04-19T00:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

// ─── reason history ──────────────────────────────────────
describe('reasonHistoryService', () => {
  it('addReasonSnapshot validates + caps', () => {
    let history = [];
    for (let i = 0; i < 5; i++) {
      history = addReasonSnapshot(history, {
        reason: 'harvest_good', timestamp: NOW - i * DAY,
        weight: 1, signalType: 'harvest_outcome', direction: 'positive',
      });
    }
    expect(history).toHaveLength(5);
    history = addReasonSnapshot(history, { reason: '' });   // no reason → dropped
    expect(history).toHaveLength(5);
  });

  it('getWeightedReasonHistory adds decayedWeight + ageDays', () => {
    const history = [
      { reason: 'x', timestamp: NOW - 14 * DAY, weight: 1, signalType: 'harvest_outcome', direction: 'positive' },
    ];
    const annotated = getWeightedReasonHistory(history, { now: NOW, halfLifeDays: 14 });
    expect(annotated[0].decayedWeight).toBeGreaterThan(0.49);
    expect(annotated[0].decayedWeight).toBeLessThan(0.51);
    expect(annotated[0].ageDays).toBeCloseTo(14, 1);
  });

  it('summarizeTopReasons ranks recent + frequent + high-confidence', () => {
    const history = [
      // recent + high confidence + harvest → should win
      { reason: 'harvest_good', timestamp: NOW - 1 * DAY, weight: 1, signalType: 'harvest_outcome', direction: 'positive', confidence: 0.9 },
      { reason: 'harvest_good', timestamp: NOW - 2 * DAY, weight: 1, signalType: 'harvest_outcome', direction: 'positive', confidence: 0.85 },
      { reason: 'harvest_good', timestamp: NOW - 3 * DAY, weight: 1, signalType: 'harvest_outcome', direction: 'positive', confidence: 0.85 },
      // older weak engagement
      { reason: 'rec_accepted', timestamp: NOW - 30 * DAY, weight: 1, signalType: 'recommendation_acceptance', direction: 'positive', confidence: 0.4 },
      { reason: 'rec_accepted', timestamp: NOW - 45 * DAY, weight: 1, signalType: 'recommendation_acceptance', direction: 'positive', confidence: 0.4 },
    ];
    const top = summarizeTopReasons(history, { topN: 5, now: NOW });
    expect(top[0].reason).toBe('harvest_good');
    expect(top[0].sources).toContain('harvest_outcome');
    expect(top[0].dominantDirection).toBe('positive');
  });

  it('getReasonFrequencyOverTime buckets recent events', () => {
    const history = [
      { reason: 'harvest_good',   timestamp: NOW - 2 * DAY },
      { reason: 'harvest_good',   timestamp: NOW - 3 * DAY },
      { reason: 'rec_rejected',   timestamp: NOW - 12 * DAY },
    ];
    const buckets = getReasonFrequencyOverTime(history, { windowDays: 30, bucketDays: 7, now: NOW });
    expect(Object.keys(buckets).length).toBeGreaterThan(0);
  });
});

// ─── journey health ──────────────────────────────────────
function ev(type, meta = {}, offsetSec = 0, extras = {}) {
  return { type, meta, timestamp: NOW + offsetSec * 1000, ...extras };
}

describe('buildHesitationScore', () => {
  it('returns zero when nothing hesitant happened', () => {
    const out = buildHesitationScore([]);
    expect(out.score).toBe(0);
    expect(out.drivers).toEqual([]);
  });

  it('long dwell + back-nav produce a non-zero score', () => {
    const events = [
      { type: FUNNEL_EVENT_TYPES.STEP_VIEWED,    meta: { step: FUNNEL_STEPS.LOCATION }, timestamp: NOW },
      { type: FUNNEL_EVENT_TYPES.STEP_COMPLETED, meta: { step: FUNNEL_STEPS.LOCATION }, timestamp: NOW + 90_000 },
    ];
    const out = buildHesitationScore(events);
    expect(out.score).toBeGreaterThan(0);
    expect(out.drivers).toContain('long_dwell');
  });
});

describe('buildTrustScore', () => {
  it('starts at 1.0 with no breaks', () => {
    expect(buildTrustScore([]).score).toBe(1);
  });

  it('drops when detect is overridden by manual', () => {
    const events = [
      ev(DECISION_EVENT_TYPES.LOCATION_CONFIRMED_YES, {}, 1),
      ev(DECISION_EVENT_TYPES.LOCATION_CONFIRMED_MANUAL, { country: 'GH' }, 120),
    ];
    const out = buildTrustScore(events);
    expect(out.score).toBeLessThan(1);
    expect(out.drivers).toContain('detect_overridden_by_manual');
  });

  it('drops more when multiple high-impact patterns fire', () => {
    const events = [
      ev(DECISION_EVENT_TYPES.TASK_COMPLETED, { taskId: 't1' }, 1),
      ev(DECISION_EVENT_TYPES.ISSUE_REPORTED, { taskId: 't1', type: 'disease_detected' }, 2),
      ev(DECISION_EVENT_TYPES.LOCATION_CONFIRMED_YES, {}, 3),
      ev(DECISION_EVENT_TYPES.LOCATION_CONFIRMED_MANUAL, {}, 4),
    ];
    const out = buildTrustScore(events);
    expect(out.score).toBeLessThan(0.6);
  });
});

describe('buildUserFrictionScore', () => {
  it('returns zero for an empty user', () => {
    expect(buildUserFrictionScore([]).score).toBe(0);
  });

  it('adds across hesitation + trust breaks', () => {
    const events = [
      { type: FUNNEL_EVENT_TYPES.STEP_VIEWED,    meta: { step: FUNNEL_STEPS.LOCATION }, timestamp: NOW },
      { type: FUNNEL_EVENT_TYPES.STEP_COMPLETED, meta: { step: FUNNEL_STEPS.LOCATION }, timestamp: NOW + 90_000 },
      ev(DECISION_EVENT_TYPES.LOCATION_CONFIRMED_YES, {}, 100),
      ev(DECISION_EVENT_TYPES.LOCATION_CONFIRMED_MANUAL, {}, 200),
    ];
    const out = buildUserFrictionScore(events);
    expect(out.score).toBeGreaterThan(0.3);
    expect(out.drivers.length).toBeGreaterThan(0);
  });

  it('never exceeds 1', () => {
    const events = [
      ev(DECISION_EVENT_TYPES.LOCATION_RETRY_CLICKED, {}, 1),
      ev(DECISION_EVENT_TYPES.LOCATION_RETRY_CLICKED, {}, 2),
      ev(DECISION_EVENT_TYPES.LOCATION_CONFIRMED_YES, {}, 3),
      ev(DECISION_EVENT_TYPES.LOCATION_CONFIRMED_MANUAL, {}, 4),
      ev(DECISION_EVENT_TYPES.TASK_REPEAT_SKIPPED, { taskId: 't1' }, 5),
      ev(DECISION_EVENT_TYPES.TASK_COMPLETED, { taskId: 't2' }, 6),
      ev(DECISION_EVENT_TYPES.ISSUE_REPORTED, { taskId: 't2' }, 7),
      ev(FUNNEL_EVENT_TYPES.STEP_ABANDONED, { step: FUNNEL_STEPS.RECOMMENDATIONS }, 8),
    ];
    const out = buildUserFrictionScore(events);
    expect(out.score).toBeLessThanOrEqual(1);
    expect(out.score).toBeGreaterThan(0.5);
  });
});

describe('buildJourneyHealthSnapshot — risk + focus', () => {
  it('low-signal context returns calm outputs', () => {
    const snap = buildJourneyHealthSnapshot([
      { type: FUNNEL_EVENT_TYPES.STEP_VIEWED,    meta: { step: FUNNEL_STEPS.WELCOME }, timestamp: NOW },
      { type: FUNNEL_EVENT_TYPES.STEP_COMPLETED, meta: { step: FUNNEL_STEPS.WELCOME }, timestamp: NOW + 5_000 },
    ]);
    expect(snap.frictionScore).toBe(0);
    expect(snap.trustScore).toBe(1);
    expect(snap.riskLevel).toBe('low');
    expect(snap.suggestedFocus).toBe('hold_steady');
  });

  it('trust break drops trust and suggests trust_recovery', () => {
    const events = [
      ev(DECISION_EVENT_TYPES.TASK_COMPLETED, { taskId: 't1' }, 1),
      ev(DECISION_EVENT_TYPES.ISSUE_REPORTED, { taskId: 't1' }, 2),
      ev(DECISION_EVENT_TYPES.LOCATION_CONFIRMED_YES, {}, 3),
      ev(DECISION_EVENT_TYPES.LOCATION_CONFIRMED_MANUAL, {}, 4),
    ];
    const snap = buildJourneyHealthSnapshot(events);
    expect(snap.trustScore).toBeLessThan(0.7);
    expect(['trust_recovery', 'reduce_friction']).toContain(snap.suggestedFocus);
  });

  it('topDrivers are deduplicated and capped', () => {
    const events = [
      ev(DECISION_EVENT_TYPES.LOCATION_RETRY_CLICKED, {}, 1),
      ev(DECISION_EVENT_TYPES.LOCATION_RETRY_CLICKED, {}, 2),
      ev(DECISION_EVENT_TYPES.TASK_REPEAT_SKIPPED, { taskId: 't1' }, 3),
    ];
    const snap = buildJourneyHealthSnapshot(events);
    expect(snap.topDrivers.length).toBeLessThanOrEqual(5);
    expect(new Set(snap.topDrivers).size).toBe(snap.topDrivers.length);
  });
});
