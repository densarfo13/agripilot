/**
 * recommendationFeedback.test.js — behavioral contract for the
 * recommendation feedback loop. Locks the rule-based weighting so
 * a refactor can't silently change how past outcomes bias future
 * recommendations.
 *
 * Covers the spec items:
 *   • rec_accepted / rejected / switched recorded in signal
 *   • task-engagement tier mapping
 *   • harvest outcome dominates direction
 *   • applyOutcomeSignalToRecommendationHistory keeps running mean
 *     bounded in [-1, 1]
 *   • biasRecommendationScores nudges but never clips above 1
 */

import { describe, it, expect } from 'vitest';
import {
  buildRecommendationFeedbackSignal,
  applyOutcomeSignalToRecommendationHistory,
  applyManyOutcomeSignals,
  getRecommendationAcceptanceRate,
  getCropSwitchRateAfterRecommendation,
  biasRecommendationScores,
} from '../services/recommendations/recommendationFeedbackService.js';
import {
  DECISION_EVENT_TYPES,
} from '../services/analytics/decisionEventTypes.js';

const NOW = new Date('2026-04-19T00:00:00Z').getTime();

function ev(type, meta = {}, offset = 0) {
  return { type, timestamp: NOW + offset, meta };
}

describe('buildRecommendationFeedbackSignal', () => {
  it('marks positive when harvest is good', () => {
    const sig = buildRecommendationFeedbackSignal({
      crop: 'maize', country: 'GH',
      events: [
        ev(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, { crop: 'maize' }),
        ev(DECISION_EVENT_TYPES.TODAY_PRIMARY_TASK_VIEWED, {}),
        ev(DECISION_EVENT_TYPES.TASK_COMPLETED, {}),
        ev(DECISION_EVENT_TYPES.HARVEST_SUBMITTED, { outcomeClass: 'good' }),
      ],
      now: NOW,
    });
    expect(sig.direction).toBe('positive');
    expect(sig.outcomeClass).toBe('good');
    expect(sig.accepted).toBe(true);
    expect(sig.weight).toBeGreaterThan(0.5);
    expect(sig.reasons).toContain('harvest_good');
    expect(sig.reasons).toContain('high_task_engagement');
  });

  it('marks negative when harvest is bad', () => {
    const sig = buildRecommendationFeedbackSignal({
      crop: 'tomato', country: 'GH',
      events: [
        ev(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, { crop: 'tomato' }),
        ev(DECISION_EVENT_TYPES.ISSUE_REPORTED, { type: 'pest_detected' }, 1),
        ev(DECISION_EVENT_TYPES.ISSUE_REPORTED, { type: 'disease_detected' }, 2),
        ev(DECISION_EVENT_TYPES.ISSUE_REPORTED, { type: 'nutrient_deficiency' }, 3),
        ev(DECISION_EVENT_TYPES.HARVEST_SUBMITTED, { outcomeClass: 'bad' }, 4),
      ],
      now: NOW,
    });
    expect(sig.direction).toBe('negative');
    expect(sig.reasons).toContain('harvest_bad');
    expect(sig.reasons).toContain('many_issues');
    expect(sig.issueCount).toBe(3);
  });

  it('marks negative when the crop was switched and no harvest outcome', () => {
    const sig = buildRecommendationFeedbackSignal({
      crop: 'maize', country: 'GH',
      events: [
        ev(DECISION_EVENT_TYPES.RECOMMENDATION_REJECTED, { crop: 'maize' }),
        ev(DECISION_EVENT_TYPES.CROP_CHANGED_AFTER_RECOMMENDATION, { from: 'maize', to: 'cassava' }),
      ],
      now: NOW,
    });
    expect(sig.direction).toBe('negative');
    expect(sig.switched).toBe(true);
    expect(sig.rejected).toBe(true);
  });

  it('neutral when only accepted with no outcome or engagement', () => {
    const sig = buildRecommendationFeedbackSignal({
      crop: 'maize', country: 'GH',
      events: [
        ev(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, { crop: 'maize' }),
      ],
      now: NOW,
    });
    expect(sig.direction).toBe('neutral');
    expect(sig.weight).toBeLessThan(0.3);
  });

  it('clamps weight to [0, 1]', () => {
    const sig = buildRecommendationFeedbackSignal({
      crop: 'maize', country: 'GH',
      events: [
        ev(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, {}),
        ev(DECISION_EVENT_TYPES.RECOMMENDATION_REJECTED, {}),
        ev(DECISION_EVENT_TYPES.CROP_CHANGED_AFTER_RECOMMENDATION, {}),
        ev(DECISION_EVENT_TYPES.TODAY_PRIMARY_TASK_VIEWED, {}),
        ev(DECISION_EVENT_TYPES.TASK_COMPLETED, {}),
        ev(DECISION_EVENT_TYPES.ISSUE_REPORTED, {}, 1),
        ev(DECISION_EVENT_TYPES.ISSUE_REPORTED, {}, 2),
        ev(DECISION_EVENT_TYPES.ISSUE_REPORTED, {}, 3),
        ev(DECISION_EVENT_TYPES.HARVEST_SUBMITTED, { outcomeClass: 'bad' }, 4),
      ],
      now: NOW,
    });
    expect(sig.weight).toBeGreaterThan(0);
    expect(sig.weight).toBeLessThanOrEqual(1);
  });
});

describe('applyOutcomeSignalToRecommendationHistory', () => {
  it('runs a bounded weighted mean across samples', () => {
    let history = {};
    history = applyOutcomeSignalToRecommendationHistory(history, {
      crop: 'maize', country: 'GH', direction: 'positive', weight: 0.8,
      reasons: ['harvest_good'], generatedAt: NOW,
    });
    history = applyOutcomeSignalToRecommendationHistory(history, {
      crop: 'maize', country: 'GH', direction: 'negative', weight: 0.4,
      reasons: ['harvest_bad'], generatedAt: NOW + 1,
    });
    const entry = history['gh:maize'];
    expect(entry.n).toBe(2);
    expect(entry.score).toBeGreaterThanOrEqual(-1);
    expect(entry.score).toBeLessThanOrEqual(1);
    // mean of (+0.8, -0.4) / 2 = 0.2
    expect(entry.score).toBeCloseTo(0.2, 2);
    expect(entry.reasons).toHaveLength(2);
  });

  it('ignores signals with no crop/country', () => {
    const before = { 'gh:maize': { score: 0.1, n: 1, reasons: [] } };
    const after = applyOutcomeSignalToRecommendationHistory(before, { direction: 'positive', weight: 0.5 });
    expect(after).toBe(before);
  });

  it('keeps at most 10 reason snapshots per pair', () => {
    let history = {};
    for (let i = 0; i < 15; i++) {
      history = applyOutcomeSignalToRecommendationHistory(history, {
        crop: 'maize', country: 'GH', direction: 'positive', weight: 0.1,
        reasons: [`tag_${i}`], generatedAt: NOW + i,
      });
    }
    expect(history['gh:maize'].reasons.length).toBe(10);
    expect(history['gh:maize'].reasons.at(-1).tags).toEqual(['tag_14']);
  });
});

describe('applyManyOutcomeSignals', () => {
  it('processes a batch in order', () => {
    const signals = [
      { crop: 'maize', country: 'GH', direction: 'positive', weight: 0.5, reasons: [], generatedAt: 1 },
      { crop: 'rice',  country: 'IN', direction: 'negative', weight: 0.3, reasons: [], generatedAt: 2 },
    ];
    const history = applyManyOutcomeSignals({}, signals);
    expect(history['gh:maize'].score).toBeCloseTo(0.5, 2);
    expect(history['in:rice'].score).toBeCloseTo(-0.3, 2);
  });
});

describe('acceptance + switch-rate ratios', () => {
  it('computes viewed/selected/rejected ratios', () => {
    const events = [
      ev(DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED, {}),
      ev(DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED, {}),
      ev(DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED, {}),
      ev(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, {}),
      ev(DECISION_EVENT_TYPES.RECOMMENDATION_REJECTED, {}),
    ];
    const r = getRecommendationAcceptanceRate(events);
    expect(r.viewed).toBe(3);
    expect(r.selected).toBe(1);
    expect(r.rejected).toBe(1);
    expect(r.acceptanceRate).toBeCloseTo(0.333, 2);
  });

  it('computes switch rate after selection', () => {
    const events = [
      ev(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, {}),
      ev(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, {}),
      ev(DECISION_EVENT_TYPES.CROP_CHANGED_AFTER_RECOMMENDATION, {}),
    ];
    const r = getCropSwitchRateAfterRecommendation(events);
    expect(r.switchRate).toBe(0.5);
  });
});

describe('biasRecommendationScores', () => {
  it('pushes a score up when history says positive, down when negative', () => {
    const base = { maize: 0.6, rice: 0.5, cassava: 0.4 };
    const history = {
      'gh:maize':   { score: +0.9, n: 5, reasons: [] },
      'gh:cassava': { score: -0.8, n: 5, reasons: [] },
    };
    const biased = biasRecommendationScores(base, history, { country: 'GH', influence: 0.3 });
    expect(biased.maize).toBeGreaterThan(base.maize);
    expect(biased.cassava).toBeLessThan(base.cassava);
    expect(biased.rice).toBeCloseTo(base.rice, 4); // no entry → unchanged
  });

  it('never pushes above 1 or below 0', () => {
    const base = { maize: 0.95 };
    const history = { 'gh:maize': { score: +1, n: 10, reasons: [] } };
    const biased = biasRecommendationScores(base, history, { country: 'GH', influence: 1 });
    expect(biased.maize).toBeLessThanOrEqual(1);
    expect(biased.maize).toBeGreaterThanOrEqual(0);
  });
});
