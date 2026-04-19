/**
 * analyticsContractAndBehavior.test.js — ties everything together
 * with the acceptance-criteria scenarios from the spec:
 *
 *   1. client + server event-type tables stay in sync
 *   2. detect → confirm yes → funnel completes with correct
 *      decision-event sequence
 *   3. detect fail → manual → correct sequence
 *   4. recommendation shown → different crop selected → rejection
 *      + switch signals stored
 *   5. task skipped twice → repeat-skip urgency tagged
 *   6. bad harvest → feedback signal flips direction to negative
 *      and biases next-cycle recommendation
 */

import { describe, it, expect } from 'vitest';

// Client constants
import { DECISION_EVENT_TYPES as CLIENT_DECISION }  from '../../../src/utils/decisionEventTypes.js';
import {
  FUNNEL_EVENT_TYPES as CLIENT_FUNNEL_EVENTS,
  FUNNEL_STEPS as CLIENT_FUNNEL_STEPS,
} from '../../../src/utils/funnelEventTypes.js';

// Server constants + services
import {
  DECISION_EVENT_TYPES,
  FUNNEL_EVENT_TYPES,
  FUNNEL_STEPS,
  ALL_DECISION_EVENT_VALUES,
} from '../services/analytics/decisionEventTypes.js';
import { validateBatch } from '../services/analytics/analyticsValidationService.js';
import {
  summarizeJourneyEvents,
} from '../services/analytics/journeySnapshotService.js';
import {
  getLikelyDropOffStage,
} from '../services/analytics/dropOffDetectionService.js';
import {
  buildRecommendationFeedbackSignal,
  applyOutcomeSignalToRecommendationHistory,
  biasRecommendationScores,
} from '../services/recommendations/recommendationFeedbackService.js';

const NOW = new Date('2026-04-19T08:00:00Z').getTime();
let clock = 0;
function t() { clock += 1000; return NOW + clock; }
function ev(type, meta = {}) { return { type, timestamp: t(), meta }; }

// ─── 1. CLIENT ↔ SERVER ALIGNMENT ─────────────────────────────
describe('client/server decision-event alignment', () => {
  it('every server DECISION_EVENT_TYPES value exists on the client', () => {
    for (const v of Object.values(DECISION_EVENT_TYPES)) {
      expect(Object.values(CLIENT_DECISION)).toContain(v);
    }
  });
  it('every server FUNNEL_EVENT_TYPES value exists on the client', () => {
    for (const v of Object.values(FUNNEL_EVENT_TYPES)) {
      expect(Object.values(CLIENT_FUNNEL_EVENTS)).toContain(v);
    }
  });
  it('every server FUNNEL_STEPS value exists on the client', () => {
    for (const v of Object.values(FUNNEL_STEPS)) {
      expect(Object.values(CLIENT_FUNNEL_STEPS)).toContain(v);
    }
  });
});

// ─── 2. DETECT + CONFIRM YES ─────────────────────────────────
describe('scenario — detect success + confirm yes', () => {
  it('emits a valid sequence and completes onboarding with detect method', () => {
    clock = 0;
    const seq = [
      ev(FUNNEL_EVENT_TYPES.STEP_VIEWED,    { step: FUNNEL_STEPS.WELCOME }),
      ev(FUNNEL_EVENT_TYPES.STEP_COMPLETED, { step: FUNNEL_STEPS.WELCOME }),
      ev(FUNNEL_EVENT_TYPES.STEP_VIEWED,    { step: FUNNEL_STEPS.LOCATION }),
      ev('onboarding_location_detect_clicked', {}),
      ev('onboarding_location_detect_success', {}),
      ev(DECISION_EVENT_TYPES.LOCATION_CONFIRMED_YES, {}),
      ev(FUNNEL_EVENT_TYPES.STEP_COMPLETED, { step: FUNNEL_STEPS.LOCATION }),
      ev(FUNNEL_EVENT_TYPES.STEP_COMPLETED, { step: FUNNEL_STEPS.ONBOARDING_COMPLETED }),
    ];
    const enveloped = seq.map((e) => ({
      ...e, sessionId: 'sess_1', mode: 'farm', language: 'en', country: 'GH', online: true, meta: e.meta,
    }));
    const { accepted, rejected } = validateBatch(enveloped, {
      now: NOW + 60_000,
      allowlist: new Set(['onboarding_location_detect_clicked', 'onboarding_location_detect_success']),
    });
    expect(rejected).toEqual([]);
    expect(accepted.length).toBe(seq.length);

    const journey = summarizeJourneyEvents(seq);
    expect(journey.onboarding.locationMethod).toBe('detect');
    expect(journey.onboarding.completed).toBe(true);

    const drop = getLikelyDropOffStage(seq, NOW + 60_000);
    // finished onboarding but never visited Today → drop = today
    expect(drop.bucket).toBe('today');
  });
});

// ─── 3. DETECT FAIL + MANUAL ─────────────────────────────────
describe('scenario — detect fail + retry + manual', () => {
  it('records retry, abandons detect, and manual completes location', () => {
    clock = 0;
    const seq = [
      ev(FUNNEL_EVENT_TYPES.STEP_VIEWED, { step: FUNNEL_STEPS.WELCOME }),
      ev(FUNNEL_EVENT_TYPES.STEP_VIEWED, { step: FUNNEL_STEPS.LOCATION }),
      ev('onboarding_location_detect_clicked', {}),
      ev('onboarding_location_detect_failed',  {}),
      ev(DECISION_EVENT_TYPES.LOCATION_RETRY_CLICKED, {}),
      ev('onboarding_location_detect_failed',  {}),
      ev(DECISION_EVENT_TYPES.LOCATION_DETECTION_ABANDONED, {}),
      ev(DECISION_EVENT_TYPES.LOCATION_CONFIRMED_MANUAL, { country: 'GH' }),
      ev(FUNNEL_EVENT_TYPES.STEP_COMPLETED, { step: FUNNEL_STEPS.LOCATION }),
    ];
    const journey = summarizeJourneyEvents(seq);
    expect(journey.onboarding.locationMethod).toBe('manual');
    expect(journey.onboarding.stepsCompleted).toContain(FUNNEL_STEPS.LOCATION);
  });
});

// ─── 4. RECOMMENDATION REJECTION + CROP SWITCH ────────────────
describe('scenario — recommendation rejected, different crop picked', () => {
  it('records rejection and switch in cycle snapshot and signal', () => {
    clock = 0;
    const events = [
      ev(DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED,   { crop: 'maize' }),
      ev(DECISION_EVENT_TYPES.RECOMMENDATION_REJECTED, { crop: 'maize' }),
      ev(DECISION_EVENT_TYPES.CROP_CHANGED_AFTER_RECOMMENDATION, { from: 'maize', to: 'cassava' }),
      ev(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, { crop: 'cassava' }),
    ];
    const cycle = summarizeJourneyEvents(events, { country: 'GH' }).cropCycle;
    expect(cycle.switched).toBe(true);
    expect(cycle.rejected).toBe(true);
    expect(cycle.crop).toBe('cassava');

    const sig = buildRecommendationFeedbackSignal({
      crop: 'maize', country: 'GH',
      events, now: NOW,
    });
    expect(sig.direction).toBe('negative');
    expect(sig.reasons).toContain('rec_switched');
  });
});

// ─── 5. REPEAT SKIP ESCALATION ────────────────────────────────
describe('scenario — repeated task skips', () => {
  it('distinguishes a single skip from a repeat skip via TASK_REPEAT_SKIPPED', () => {
    clock = 0;
    const events = [
      ev(DECISION_EVENT_TYPES.TODAY_PRIMARY_TASK_VIEWED, { taskId: 't1' }),
      ev(DECISION_EVENT_TYPES.TASK_SKIPPED,              { taskId: 't1' }),
      ev(DECISION_EVENT_TYPES.TODAY_PRIMARY_TASK_VIEWED, { taskId: 't1' }),
      ev(DECISION_EVENT_TYPES.TASK_SKIPPED,              { taskId: 't1' }),
      ev(DECISION_EVENT_TYPES.TASK_REPEAT_SKIPPED,       { taskId: 't1', skipCount: 2 }),
    ];
    const journey = summarizeJourneyEvents(events);
    expect(journey.cropCycle.skippedTasks).toBe(2);
    expect(journey.cropCycle.repeatSkippedTasks).toBe(1);
  });
});

// ─── 6. BAD HARVEST → NEXT-CYCLE BIAS ────────────────────────
describe('scenario — bad harvest flips next-cycle recommendation', () => {
  it('signals negative and pulls the base score down when biased', () => {
    clock = 0;
    const events = [
      ev(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, { crop: 'maize' }),
      ev(DECISION_EVENT_TYPES.TODAY_PRIMARY_TASK_VIEWED, {}),
      ev(DECISION_EVENT_TYPES.TASK_SKIPPED, {}),
      ev(DECISION_EVENT_TYPES.ISSUE_REPORTED, { type: 'disease_detected' }),
      ev(DECISION_EVENT_TYPES.HARVEST_SUBMITTED, { outcomeClass: 'bad' }),
    ];
    const sig = buildRecommendationFeedbackSignal({
      crop: 'maize', country: 'GH', events, now: NOW,
    });
    expect(sig.direction).toBe('negative');

    let history = applyOutcomeSignalToRecommendationHistory({}, sig);
    expect(history['gh:maize'].score).toBeLessThan(0);

    const baseScores = { maize: 0.8, rice: 0.7 };
    const biased = biasRecommendationScores(baseScores, history, { country: 'GH' });
    expect(biased.maize).toBeLessThan(0.8);
    expect(biased.rice).toBeCloseTo(0.7, 4);
  });
});

// ─── 7. ALLOWLIST HYGIENE ─────────────────────────────────────
describe('ALL_DECISION_EVENT_VALUES coverage', () => {
  it('includes every value from DECISION_EVENT_TYPES and FUNNEL_EVENT_TYPES', () => {
    for (const v of Object.values(DECISION_EVENT_TYPES)) expect(ALL_DECISION_EVENT_VALUES.has(v)).toBe(true);
    for (const v of Object.values(FUNNEL_EVENT_TYPES))   expect(ALL_DECISION_EVENT_VALUES.has(v)).toBe(true);
  });
});
