/**
 * optimizationLoop.test.js — behavioral contract for the
 * auto-optimization loop.
 *
 * Covers every requirement from the spec:
 *   • signal extraction for all 10 signal types
 *   • context keys assembled correctly
 *   • bounded deltas (never exceed caps)
 *   • thresholds (below-minimum contexts → no change)
 *   • positive vs negative signals move output predictably
 *   • guardrail locks remain inviolate
 *   • low-signal contexts produce zero adjustments
 *   • debug/reporting surface exposes the right slices
 *   • base rules still win — optimization is additive, never override
 */

import { describe, it, expect } from 'vitest';

import {
  buildContextKey, buildRecommendationContextKey, buildRegionContextKey,
  parseContextKey, buildContextKeyFromEvent,
} from '../services/optimization/contextKey.js';
import {
  extractOptimizationSignals,
} from '../services/optimization/signalExtractors.js';
import {
  computeAdjustments, computeAdjustmentForContext, zeroAdjustment,
} from '../services/optimization/optimizationEngine.js';
import {
  applyRecommendationOptimization,
  applyTaskUrgencyOptimization,
  applyConfidenceOptimization,
  applyListingQualityOptimization,
} from '../services/optimization/applyOptimization.js';
import {
  buildOptimizationSnapshot,
  getTopAcceptedRecommendations,
  getMostRejectedRecommendations,
  getTaskSkipPatterns,
  getBestConvertingListingContexts,
} from '../services/optimization/optimizationReportingService.js';
import {
  MIN_RECOMMENDATION_SIGNALS, MIN_HARVEST_SIGNALS,
  MIN_TASK_SIGNALS, MIN_LISTING_SIGNALS,
  MAX_RECOMMENDATION_DELTA, MAX_CONFIDENCE_DELTA,
  MAX_URGENCY_DELTA, MAX_LISTING_QUALITY_DELTA,
} from '../services/optimization/optimizationThresholds.js';
import { DECISION_EVENT_TYPES } from '../services/analytics/decisionEventTypes.js';

const NOW = new Date('2026-04-19T00:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

// ─── helpers ─────────────────────────────────────────────
function mkEvent(type, meta = {}, extras = {}) {
  return {
    type,
    timestamp: NOW - 1 * DAY,
    mode: extras.mode ?? 'farm',
    country: extras.country ?? 'GH',
    stateCode: extras.stateCode ?? null,
    meta: { ...meta, ...(extras.meta || {}) },
  };
}

function repeat(n, fn) { return Array.from({ length: n }).map((_, i) => fn(i)); }

// ─── 1. CONTEXT KEYS ─────────────────────────────────────
describe('contextKey', () => {
  it('buildContextKey preserves positional empty segments', () => {
    expect(buildContextKey({ crop: 'maize', country: 'GH', mode: 'farm' }))
      .toBe('maize|gh||farm|');
  });

  it('parseContextKey round-trips', () => {
    const key = buildContextKey({ crop: 'rice', country: 'IN', state: 'AP', mode: 'farm' });
    expect(parseContextKey(key)).toEqual({
      crop: 'rice', country: 'in', state: 'ap', mode: 'farm', month: '',
    });
  });

  it('buildRecommendationContextKey omits state axis', () => {
    expect(buildRecommendationContextKey({ crop: 'maize', country: 'GH', mode: 'farm' }))
      .toBe('maize|gh||farm|');
  });

  it('buildRegionContextKey is crop-agnostic', () => {
    expect(buildRegionContextKey({ country: 'US', state: 'MD' })).toBe('|us|md||');
  });

  it('normalizes case + trims whitespace', () => {
    expect(buildContextKey({ crop: ' Maize ', country: 'GH' }))
      .toBe('maize|gh|||');
  });

  it('buildContextKeyFromEvent uses event.country + meta.crop', () => {
    const ev = mkEvent('x', { crop: 'maize' }, { country: 'GH' });
    const key = buildContextKeyFromEvent(ev);
    // includes month derived from timestamp → 4 (April)
    expect(key).toMatch(/^maize\|gh\|\|farm\|\d+$/);
  });
});

// ─── 2. SIGNAL EXTRACTION ────────────────────────────────
describe('extractOptimizationSignals', () => {
  it('splits the 10 signal types into the right counters', () => {
    const events = [
      mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, { crop: 'maize' }),
      mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_REJECTED, { crop: 'maize' }),
      mkEvent(DECISION_EVENT_TYPES.TASK_COMPLETED, {}),
      mkEvent(DECISION_EVENT_TYPES.TASK_SKIPPED, {}),
      mkEvent(DECISION_EVENT_TYPES.TASK_REPEAT_SKIPPED, {}),
      mkEvent(DECISION_EVENT_TYPES.HARVEST_SUBMITTED, { outcomeClass: 'good', crop: 'maize' }),
      mkEvent(DECISION_EVENT_TYPES.HARVEST_SUBMITTED, { outcomeClass: 'bad',  crop: 'maize' }),
      mkEvent(DECISION_EVENT_TYPES.BUYER_INTEREST_SUBMITTED, {}),
      mkEvent(DECISION_EVENT_TYPES.LISTING_SOLD, {}),
      mkEvent(DECISION_EVENT_TYPES.LISTING_EXPIRED, {}),
    ];
    const out = extractOptimizationSignals(events, { now: NOW });
    expect(out.familyTotals.recommendation).toBe(2);
    expect(out.familyTotals.task).toBe(3);
    expect(out.familyTotals.harvest).toBe(2);
    expect(out.familyTotals.listing).toBe(3);
  });

  it('skips events older than MAX_SIGNAL_AGE_DAYS', () => {
    const stale = {
      ...mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, { crop: 'maize' }),
      timestamp: NOW - 200 * DAY,
    };
    const out = extractOptimizationSignals([stale], { now: NOW });
    expect(out.familyTotals.recommendation).toBe(0);
  });

  it('ignores harvest events with mixed or missing outcome', () => {
    const mixed = mkEvent(DECISION_EVENT_TYPES.HARVEST_SUBMITTED,
      { outcomeClass: 'mixed', crop: 'maize' });
    const none = mkEvent(DECISION_EVENT_TYPES.HARVEST_SUBMITTED,
      { crop: 'maize' });
    const out = extractOptimizationSignals([mixed, none], { now: NOW });
    expect(out.familyTotals.harvest).toBe(0);
  });

  it('ignores unknown event types (safe noop)', () => {
    const ev = mkEvent('totally_unknown_type', {});
    const out = extractOptimizationSignals([ev], { now: NOW });
    expect(out.totalEvents).toBe(1);
    expect(out.familyTotals.recommendation).toBe(0);
  });

  it('buckets recommendation signals by crop|country|mode', () => {
    const events = [
      mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED,
        { crop: 'maize' }, { country: 'GH' }),
      mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED,
        { crop: 'maize' }, { country: 'IN' }),
    ];
    const out = extractOptimizationSignals(events, { now: NOW });
    expect(out.byContext['maize|gh||farm|'].counts.rec_accepted).toBe(1);
    expect(out.byContext['maize|in||farm|'].counts.rec_accepted).toBe(1);
  });
});

// ─── 3. BOUNDED DELTAS ───────────────────────────────────
describe('bounded deltas — engine', () => {
  it('recommendationDelta never exceeds its cap', () => {
    // 100 accepts, 0 rejects — ratio = 1, delta = MAX/2
    const events = repeat(100,
      () => mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, { crop: 'maize' }));
    const extraction = extractOptimizationSignals(events, { now: NOW });
    const adj = computeAdjustments(extraction).byContext['maize|gh||farm|'];
    expect(Math.abs(adj.recommendationDelta)).toBeLessThanOrEqual(MAX_RECOMMENDATION_DELTA);
    expect(adj.recommendationDelta).toBeGreaterThan(0);
  });

  it('confidenceDelta reaches the cap only at 100% extremes', () => {
    const events = repeat(50,
      () => mkEvent(DECISION_EVENT_TYPES.HARVEST_SUBMITTED,
        { outcomeClass: 'good', crop: 'maize' }));
    const extraction = extractOptimizationSignals(events, { now: NOW });
    const adj = computeAdjustments(extraction).byContext['maize|gh||farm|'];
    expect(adj.confidenceDelta).toBeCloseTo(MAX_CONFIDENCE_DELTA, 2);
  });

  it('urgencyDelta is bounded to [-1, +1]', () => {
    // Massive completion bias
    const events = repeat(100,
      () => mkEvent(DECISION_EVENT_TYPES.TASK_COMPLETED, {}));
    const extraction = extractOptimizationSignals(events, { now: NOW });
    const adj = computeAdjustments(extraction).byContext['|||farm|'];
    expect(Math.abs(adj.urgencyDelta)).toBeLessThanOrEqual(MAX_URGENCY_DELTA);
  });

  it('listingQualityDelta is non-negative and bounded', () => {
    const events = repeat(30,
      () => mkEvent(DECISION_EVENT_TYPES.LISTING_EXPIRED, {},
        { country: 'GH', stateCode: 'AR' }));
    const extraction = extractOptimizationSignals(events, { now: NOW });
    const adj = computeAdjustments(extraction).byContext['|gh|ar||'];
    expect(adj.listingQualityDelta).toBeGreaterThanOrEqual(0);
    expect(adj.listingQualityDelta).toBeLessThanOrEqual(MAX_LISTING_QUALITY_DELTA);
  });
});

// ─── 4. THRESHOLDS (low signal → no change) ──────────────
describe('thresholds — low-signal contexts produce no change', () => {
  it('below MIN_RECOMMENDATION_SIGNALS → zero delta', () => {
    const events = repeat(MIN_RECOMMENDATION_SIGNALS - 1,
      () => mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, { crop: 'maize' }));
    const extraction = extractOptimizationSignals(events, { now: NOW });
    const adj = computeAdjustments(extraction).byContext['maize|gh||farm|'];
    expect(adj.recommendationDelta).toBe(0);
    expect(adj.meetsThreshold.recommendation).toBe(false);
  });

  it('below MIN_HARVEST_SIGNALS → zero confidenceDelta', () => {
    const events = repeat(MIN_HARVEST_SIGNALS - 1,
      () => mkEvent(DECISION_EVENT_TYPES.HARVEST_SUBMITTED,
        { outcomeClass: 'good', crop: 'maize' }));
    const extraction = extractOptimizationSignals(events, { now: NOW });
    const adj = computeAdjustments(extraction).byContext['maize|gh||farm|'];
    expect(adj.confidenceDelta).toBe(0);
    expect(adj.meetsThreshold.harvest).toBe(false);
  });

  it('below MIN_TASK_SIGNALS → zero urgencyDelta', () => {
    const events = repeat(MIN_TASK_SIGNALS - 1,
      () => mkEvent(DECISION_EVENT_TYPES.TASK_COMPLETED, {}));
    const extraction = extractOptimizationSignals(events, { now: NOW });
    const adj = computeAdjustments(extraction).byContext['|||farm|'];
    expect(adj.urgencyDelta).toBe(0);
    expect(adj.meetsThreshold.task).toBe(false);
  });

  it('below MIN_LISTING_SIGNALS → zero listingQualityDelta', () => {
    const events = repeat(MIN_LISTING_SIGNALS - 1,
      () => mkEvent(DECISION_EVENT_TYPES.LISTING_EXPIRED, {},
        { country: 'GH', stateCode: 'AR' }));
    const extraction = extractOptimizationSignals(events, { now: NOW });
    const adj = computeAdjustments(extraction).byContext['|gh|ar||'];
    expect(adj.listingQualityDelta).toBe(0);
    expect(adj.meetsThreshold.listing).toBe(false);
  });

  it('no events at all → no adjustments emitted', () => {
    const { byContext, totals } = computeAdjustments({ byContext: {} });
    expect(byContext).toEqual({});
    expect(totals.contexts).toBe(0);
    expect(totals.adjusted).toBe(0);
  });
});

// ─── 5. POSITIVE vs NEGATIVE SIGNAL DIRECTION ────────────
describe('direction — positive vs negative signals', () => {
  it('more accepts than rejects → positive recommendationDelta', () => {
    const events = [
      ...repeat(20, () => mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED,
        { crop: 'maize' })),
      ...repeat(5,  () => mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_REJECTED,
        { crop: 'maize' })),
    ];
    const extraction = extractOptimizationSignals(events, { now: NOW });
    const adj = computeAdjustments(extraction).byContext['maize|gh||farm|'];
    expect(adj.recommendationDelta).toBeGreaterThan(0);
  });

  it('more rejects than accepts → negative recommendationDelta', () => {
    const events = [
      ...repeat(4,  () => mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED,
        { crop: 'maize' })),
      ...repeat(18, () => mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_REJECTED,
        { crop: 'maize' })),
    ];
    const extraction = extractOptimizationSignals(events, { now: NOW });
    const adj = computeAdjustments(extraction).byContext['maize|gh||farm|'];
    expect(adj.recommendationDelta).toBeLessThan(0);
  });

  it('more bad harvests than good → negative confidenceDelta', () => {
    const events = [
      ...repeat(2,  () => mkEvent(DECISION_EVENT_TYPES.HARVEST_SUBMITTED,
        { outcomeClass: 'good', crop: 'maize' })),
      ...repeat(8,  () => mkEvent(DECISION_EVENT_TYPES.HARVEST_SUBMITTED,
        { outcomeClass: 'bad',  crop: 'maize' })),
    ];
    const extraction = extractOptimizationSignals(events, { now: NOW });
    const adj = computeAdjustments(extraction).byContext['maize|gh||farm|'];
    expect(adj.confidenceDelta).toBeLessThan(0);
  });

  it('repeat-skips dominate → negative urgencyDelta', () => {
    const events = [
      ...repeat(4, () => mkEvent(DECISION_EVENT_TYPES.TASK_COMPLETED, {})),
      ...repeat(4, () => mkEvent(DECISION_EVENT_TYPES.TASK_SKIPPED, {})),
      ...repeat(6, () => mkEvent(DECISION_EVENT_TYPES.TASK_REPEAT_SKIPPED, {})),
    ];
    const extraction = extractOptimizationSignals(events, { now: NOW });
    const adj = computeAdjustments(extraction).byContext['|||farm|'];
    expect(adj.urgencyDelta).toBeLessThan(0);
  });

  it('high completion + low skip → positive urgencyDelta', () => {
    const events = [
      ...repeat(20, () => mkEvent(DECISION_EVENT_TYPES.TASK_COMPLETED, {})),
      ...repeat(2,  () => mkEvent(DECISION_EVENT_TYPES.TASK_SKIPPED, {})),
    ];
    const extraction = extractOptimizationSignals(events, { now: NOW });
    const adj = computeAdjustments(extraction).byContext['|||farm|'];
    expect(adj.urgencyDelta).toBeGreaterThan(0);
  });

  it('listing expiry dominates → positive listingQualityDelta', () => {
    const events = [
      ...repeat(3,  () => mkEvent(DECISION_EVENT_TYPES.LISTING_SOLD, {},
        { country: 'GH', stateCode: 'AR' })),
      ...repeat(15, () => mkEvent(DECISION_EVENT_TYPES.LISTING_EXPIRED, {},
        { country: 'GH', stateCode: 'AR' })),
    ];
    const extraction = extractOptimizationSignals(events, { now: NOW });
    const adj = computeAdjustments(extraction).byContext['|gh|ar||'];
    expect(adj.listingQualityDelta).toBeGreaterThan(0);
  });
});

// ─── 6. GUARDRAIL RESPECT AT RUNTIME ─────────────────────
describe('applyRecommendationOptimization — guardrails win', () => {
  it('locked crops are NOT nudged, even with a positive delta', () => {
    const events = repeat(20,
      () => mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, { crop: 'mango' }));
    const extraction = extractOptimizationSignals(events, { now: NOW });
    const adjustments = computeAdjustments(extraction);

    const out = applyRecommendationOptimization(
      { mango: 0.0, maize: 0.5 },
      adjustments,
      { country: 'GH', mode: 'farm',
        locks: { 'crop:mango': { lockedBy: 'guardrails', reason: 'climate' } } },
    );
    // Mango stays zero because it's locked
    expect(out.mango).toBe(0);
    // Maize isn't affected (no signals for it)
    expect(out.maize).toBe(0.5);
  });

  it('scores remain clamped to [0, 1]', () => {
    const events = repeat(30,
      () => mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, { crop: 'maize' }));
    const extraction = extractOptimizationSignals(events, { now: NOW });
    const adjustments = computeAdjustments(extraction);

    const out = applyRecommendationOptimization(
      { maize: 0.99 },
      adjustments,
      { country: 'GH', mode: 'farm' },
    );
    expect(out.maize).toBeLessThanOrEqual(1);
    expect(out.maize).toBeGreaterThanOrEqual(0);
  });

  it('returns zero-entries map for empty baseScores', () => {
    const out = applyRecommendationOptimization({}, { byContext: {} },
      { country: 'GH' });
    expect(out).toEqual({});
  });

  it('never mutates the input', () => {
    const base = { maize: 0.5 };
    applyRecommendationOptimization(base, { byContext: {} }, { country: 'GH' });
    expect(base).toEqual({ maize: 0.5 });
  });
});

describe('applyTaskUrgencyOptimization', () => {
  it('delta > 0.5 steps urgency up', () => {
    const out = applyTaskUrgencyOptimization(
      { id: 't1', urgency: 'medium' },
      { urgencyDelta: 0.8 },
    );
    expect(out.urgency).toBe('high');
  });

  it('delta < -0.5 steps urgency down', () => {
    const out = applyTaskUrgencyOptimization(
      { id: 't1', urgency: 'high' },
      { urgencyDelta: -0.8 },
    );
    expect(out.urgency).toBe('medium');
  });

  it('small deltas leave urgency unchanged', () => {
    const out = applyTaskUrgencyOptimization(
      { id: 't1', urgency: 'medium' },
      { urgencyDelta: 0.1 },
    );
    expect(out.urgency).toBe('medium');
  });

  it('never pushes urgency past high', () => {
    const out = applyTaskUrgencyOptimization(
      { id: 't1', urgency: 'high' },
      { urgencyDelta: 1 },
    );
    expect(out.urgency).toBe('high');
  });
});

describe('applyConfidenceOptimization', () => {
  it('adds the delta and re-classifies level', () => {
    const out = applyConfidenceOptimization(
      { level: 'medium', score: 60, reasons: [] },
      { confidenceDelta: +10 },
    );
    expect(out.score).toBeCloseTo(70, 2);
    expect(out.level).toBe('medium');  // 70 is still medium
  });

  it('promotes to high when the delta crosses the threshold', () => {
    const out = applyConfidenceOptimization(
      { level: 'medium', score: 70, reasons: [] },
      { confidenceDelta: +10 },
    );
    expect(out.level).toBe('high');
  });

  it('demotes to low when the delta drops below 45', () => {
    const out = applyConfidenceOptimization(
      { level: 'medium', score: 50, reasons: [] },
      { confidenceDelta: -10 },
    );
    expect(out.level).toBe('low');
  });

  it('keeps the score clamped to [0, 100]', () => {
    const high = applyConfidenceOptimization({ level: 'high', score: 95 },
      { confidenceDelta: 20 });
    expect(high.score).toBeLessThanOrEqual(100);
    const low = applyConfidenceOptimization({ level: 'low', score: 5 },
      { confidenceDelta: -20 });
    expect(low.score).toBeGreaterThanOrEqual(0);
  });

  it('returns the input unchanged when confidence is missing', () => {
    expect(applyConfidenceOptimization(null, { confidenceDelta: 10 })).toBeNull();
  });
});

describe('applyListingQualityOptimization', () => {
  it('raises the completeness floor when delta > 0', () => {
    const out = applyListingQualityOptimization(
      { id: 'L1', completenessScore: 0.7 },
      { listingQualityDelta: 0.1 },
      { baseFloor: 0.6 },
    );
    expect(out.completenessFloor).toBeCloseTo(0.7, 3);
    expect(out.stricterQuality).toBe(true);
  });

  it('never lowers the floor — negative deltas treated as 0', () => {
    const out = applyListingQualityOptimization(
      { id: 'L1' },
      { listingQualityDelta: -0.5 },
      { baseFloor: 0.6 },
    );
    expect(out.completenessFloor).toBe(0.6);
    expect(out.stricterQuality).toBe(false);
  });

  it('caps the floor at 1', () => {
    const out = applyListingQualityOptimization(
      { id: 'L1' },
      { listingQualityDelta: 0.5 },
      { baseFloor: 0.9 },
    );
    expect(out.completenessFloor).toBeLessThanOrEqual(1);
  });
});

// ─── 7. REPORTING ─────────────────────────────────────────
describe('reporting — dev/debug surface', () => {
  function primeExtraction() {
    const events = [
      ...repeat(20, () => mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED,
        { crop: 'maize' })),
      ...repeat(12, () => mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_REJECTED,
        { crop: 'cassava' })),
      ...repeat(10, () => mkEvent(DECISION_EVENT_TYPES.TASK_REPEAT_SKIPPED, {})),
      ...repeat(18, () => mkEvent(DECISION_EVENT_TYPES.LISTING_SOLD, {},
        { country: 'GH', stateCode: 'AR' })),
      ...repeat(3,  () => mkEvent(DECISION_EVENT_TYPES.LISTING_EXPIRED, {},
        { country: 'GH', stateCode: 'AR' })),
    ];
    return extractOptimizationSignals(events, { now: NOW });
  }

  it('getTopAcceptedRecommendations surfaces the right context', () => {
    const rows = getTopAcceptedRecommendations(primeExtraction(), 5);
    expect(rows[0].crop).toBe('maize');
    expect(rows[0].accepted).toBe(20);
  });

  it('getMostRejectedRecommendations surfaces the right context', () => {
    const rows = getMostRejectedRecommendations(primeExtraction(), 5);
    expect(rows[0].crop).toBe('cassava');
    expect(rows[0].rejected).toBe(12);
  });

  it('getTaskSkipPatterns highlights high-repeat-skip contexts', () => {
    const rows = getTaskSkipPatterns(primeExtraction(), 5);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].repeatSkipped).toBe(10);
  });

  it('getBestConvertingListingContexts ranks by sold / total', () => {
    const rows = getBestConvertingListingContexts(primeExtraction(), 5);
    expect(rows[0].country).toBe('gh');
    expect(rows[0].sold).toBe(18);
    expect(rows[0].conversionRate).toBeGreaterThan(0.5);
  });

  it('buildOptimizationSnapshot exposes the full dashboard payload', () => {
    const extraction = primeExtraction();
    const adjustments = computeAdjustments(extraction);
    const snap = buildOptimizationSnapshot({ extraction, adjustments, now: NOW });
    expect(snap.extraction.totalEvents).toBeGreaterThan(0);
    expect(snap.topAccepted.length).toBeGreaterThan(0);
    expect(snap.topRejected.length).toBeGreaterThan(0);
    expect(snap.bestConverts.length).toBeGreaterThan(0);
    expect(snap.activeByContext.length).toBeGreaterThan(0);
    expect(snap.activeAdjustments.recommendation).toBeGreaterThanOrEqual(0);
  });
});

// ─── 8. ZERO ADJUSTMENT FALLBACK + STABILITY ─────────────
describe('stability', () => {
  it('zeroAdjustment always returns a safe no-op shape', () => {
    const z = zeroAdjustment('x|y||z|');
    expect(z.recommendationDelta).toBe(0);
    expect(z.confidenceDelta).toBe(0);
    expect(z.urgencyDelta).toBe(0);
    expect(z.listingQualityDelta).toBe(0);
    expect(z.meetsThreshold.recommendation).toBe(false);
  });

  it('running computeAdjustmentForContext directly on an empty bucket is safe', () => {
    const adj = computeAdjustmentForContext('k', { counts: {} });
    expect(adj.recommendationDelta).toBe(0);
    expect(adj.reasons).toEqual([]);
  });

  it('identical input produces identical output (deterministic)', () => {
    const events = repeat(30,
      () => mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, { crop: 'maize' }));
    const a = computeAdjustments(extractOptimizationSignals(events, { now: NOW }));
    const b = computeAdjustments(extractOptimizationSignals(events, { now: NOW }));
    expect(a.byContext).toEqual(b.byContext);
  });
});

// ─── 9. ADDITIVE CONTRACT — BASE RULES STILL WIN ─────────
describe('optimization is additive, never override', () => {
  it('a crop with score 0 never emerges above threshold from a delta alone', () => {
    // Base score is 0, max delta is 0.15 — so the result is 0.15, NOT 1.0.
    // The optimization layer cannot take a guardrail-zeroed crop and
    // promote it into the shortlist.
    const events = repeat(30,
      () => mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, { crop: 'maize' }));
    const extraction = extractOptimizationSignals(events, { now: NOW });
    const out = applyRecommendationOptimization(
      { maize: 0 },
      computeAdjustments(extraction),
      { country: 'GH', mode: 'farm' },
    );
    expect(out.maize).toBeLessThanOrEqual(MAX_RECOMMENDATION_DELTA);
  });

  it('confidence delta cannot push above 100 or below 0', () => {
    const events = repeat(50,
      () => mkEvent(DECISION_EVENT_TYPES.HARVEST_SUBMITTED,
        { outcomeClass: 'good', crop: 'maize' }));
    const extraction = extractOptimizationSignals(events, { now: NOW });
    const adj = computeAdjustments(extraction).byContext['maize|gh||farm|'];
    const out = applyConfidenceOptimization(
      { level: 'high', score: 95 }, adj,
    );
    expect(out.score).toBeLessThanOrEqual(100);
  });
});
