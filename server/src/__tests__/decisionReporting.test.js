/**
 * decisionReporting.test.js — end-to-end sanity check for the
 * reporting service that the dev panel consumes. Builds the
 * snapshot from live helpers and asserts it includes each key
 * required by the dashboard.
 */

import { describe, it, expect } from 'vitest';
import {
  buildDecisionEngineSnapshot,
  buildPipelineTraceReport,
} from '../services/decision/decisionReportingService.js';
import { applyRecommendationDecisionPipeline } from '../services/decision/decisionPipeline.js';
import {
  DECISION_EVENT_TYPES,
  FUNNEL_EVENT_TYPES,
  FUNNEL_STEPS,
} from '../services/analytics/decisionEventTypes.js';

const NOW = new Date('2026-04-19T00:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

function ev(type, meta = {}, i = 0, extras = {}) {
  return { type, meta, timestamp: NOW + i * 1000, ...extras };
}

describe('buildDecisionEngineSnapshot', () => {
  it('assembles every section expected by the dev panel', () => {
    const events = [
      ev(FUNNEL_EVENT_TYPES.STEP_VIEWED,    { step: FUNNEL_STEPS.LOCATION }, 1),
      ev(FUNNEL_EVENT_TYPES.STEP_COMPLETED, { step: FUNNEL_STEPS.LOCATION }, 2),
      ev(DECISION_EVENT_TYPES.LOCATION_RETRY_CLICKED, {}, 3),
      ev(DECISION_EVENT_TYPES.LOCATION_RETRY_CLICKED, {}, 4),
    ];
    const signalsByContext = {
      'gh:maize': [
        { signalType: 'harvest_outcome', confidenceScore: 0.85, direction: +1, sourceCount: 10 },
        { signalType: 'recommendation_acceptance', confidenceScore: 0.5, direction: -1, sourceCount: 5 },
      ],
    };
    const signalsByType = {
      harvest_outcome: [
        { timestamp: NOW - 1 * DAY, direction: +1, weight: 1 },
        { timestamp: NOW - 2 * DAY, direction: +1, weight: 1 },
        { timestamp: NOW - 3 * DAY, direction: +1, weight: 1 },
      ],
      recommendation_acceptance: [
        { timestamp: NOW - 10 * DAY, direction: -1, weight: 1 },
      ],
    };
    const reasonHistory = [
      { reason: 'harvest_good',  timestamp: NOW - 1 * DAY, weight: 1, signalType: 'harvest_outcome', direction: 'positive', confidence: 0.8 },
      { reason: 'rec_rejected',  timestamp: NOW - 2 * DAY, weight: 1, signalType: 'recommendation_rejection', direction: 'negative', confidence: 0.5 },
    ];
    const snap = buildDecisionEngineSnapshot({
      events, signalsByType, signalsByContext, reasonHistory,
      confidences: {
        location: { level: 'low', score: 30 },
        recommendation: { level: 'medium', score: 55 },
      },
      now: NOW,
      contextKey: 'u-1',
    });

    expect(snap.pipeline.stageOrder[0]).toBe('guardrails');
    expect(snap.confidenceSummary.rows.length).toBe(2);
    expect(snap.confidenceSummary.strongest.signalType).toBe('harvest_outcome');
    expect(Array.isArray(snap.arbitration)).toBe(true);
    expect(snap.arbitration[0].contextKey).toBe('gh:maize');
    expect(snap.journey.frictionScore).toBeGreaterThanOrEqual(0);
    expect(snap.actionability.surfaces).toBeDefined();
    expect(snap.responses.meta).toBeDefined();
    expect(snap.reasons.length).toBeGreaterThan(0);
    expect(snap.generatedAt).toBe(NOW);
  });

  it('surfaces the manual-location action from retries', () => {
    const events = [
      ev(DECISION_EVENT_TYPES.LOCATION_RETRY_CLICKED, {}, 1),
      ev(DECISION_EVENT_TYPES.LOCATION_RETRY_CLICKED, {}, 2),
    ];
    const snap = buildDecisionEngineSnapshot({ events, now: NOW });
    expect(snap.actionability.surfaces.onboarding?.actionKey).toBe('show_manual_location_shortcut');
  });

  it('no events → low-risk, no actions, no top reasons', () => {
    const snap = buildDecisionEngineSnapshot({ events: [], reasonHistory: [], now: NOW });
    expect(snap.actionability.hasAnyAction).toBe(false);
    expect(snap.journey.riskLevel).toBe('low');
    expect(snap.reasons).toEqual([]);
  });
});

describe('buildPipelineTraceReport', () => {
  it('returns an empty report for null input', () => {
    expect(buildPipelineTraceReport(null)).toBeNull();
  });

  it('extracts stage trace, locks, wording from a pipeline result', async () => {
    const result = await applyRecommendationDecisionPipeline({
      excludedCrops: ['mango'],
      baseEngine: () => ({ maize: 0.8, mango: 0.9 }),
      confidence: { level: 'high', score: 85 },
    });
    const report = buildPipelineTraceReport(result);
    expect(report.kind).toBe('recommendation');
    expect(report.trace.length).toBeGreaterThan(0);
    expect(report.locks.some((l) => l.path === 'crop:mango')).toBe(true);
    expect(report.finalWording.header).toBe('recommendations.header.high');
  });
});
