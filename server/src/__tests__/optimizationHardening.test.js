/**
 * optimizationHardening.test.js — verifies every production
 * safety rail spec requirement L lists.
 *
 *   1. threshold safety          (low-signal = no change)
 *   2. hard caps                 (deltas never exceed bounds)
 *   3. guardrail priority        (locks win over positive signals)
 *   4. personal vs regional      (single user can't shift global)
 *   5. negative signal gating    (rejection alone doesn't downgrade)
 *   6. mode isolation            (backyard ≠ farm)
 *   7. explainability            (every adjustment gets audit text)
 *   8. recency weighting         (newer data matters more)
 */

import { describe, it, expect } from 'vitest';

import {
  createEligibilityConfig,
  getOptimizationEligibility,
  isLowSignalContext,
  summarizeEligibility,
  hasSufficientSignal,
  SCOPES,
  DEFAULT_PERSONAL_THRESHOLDS,
  DEFAULT_REGIONAL_THRESHOLDS,
} from '../services/optimization/optimizationEligibility.js';
import {
  filterSignalsByWindow,
  getWeightedSignalScore,
  getWeightedCounts,
  ageBreakdown,
} from '../services/optimization/recencyWeighting.js';
import {
  SCOPE,
  buildPersonalContextKey,
  parseScopeFromKey,
  regionalKeyFromPersonal,
  splitSignalsByScope,
  mergeOptimizationLayers,
} from '../services/optimization/personalVsRegional.js';
import {
  interpretNegativeSignals,
  getNegativeAdjustmentEligibility,
  applyNegativeEligibilityToDelta,
} from '../services/optimization/negativeSignalInterpreter.js';
import {
  enforceModeIsolation,
  stripListingDeltasForBackyard,
  validateModeAwareOptimization,
  summarizeModeCoverage,
} from '../services/optimization/modeIsolation.js';
import {
  getConfidenceAwareWording,
  resolveWording,
} from '../services/optimization/confidenceAwareWording.js';
import {
  buildOptimizationExplanation,
} from '../services/optimization/optimizationExplanation.js';
import {
  createInMemoryAuditStore,
  buildAuditSummary,
} from '../services/optimization/optimizationAuditService.js';
import {
  applyOptimizationPipeline,
} from '../services/optimization/applyOptimizationPipeline.js';
import {
  extractOptimizationSignals,
} from '../services/optimization/signalExtractors.js';
import {
  computeAdjustments,
} from '../services/optimization/optimizationEngine.js';
import {
  MAX_RECOMMENDATION_DELTA, MAX_CONFIDENCE_DELTA,
  MAX_URGENCY_DELTA, MAX_LISTING_QUALITY_DELTA,
} from '../services/optimization/optimizationThresholds.js';
import { DECISION_EVENT_TYPES } from '../services/analytics/decisionEventTypes.js';

const NOW = new Date('2026-04-19T00:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

function repeat(n, fn) { return Array.from({ length: n }).map((_, i) => fn(i)); }
function mkEvent(type, meta = {}, extras = {}) {
  return {
    type,
    timestamp: NOW - 1 * DAY,
    mode: extras.mode ?? 'farm',
    country: extras.country ?? 'GH',
    stateCode: extras.stateCode ?? null,
    userId: extras.userId,
    meta: { ...meta, ...(extras.meta || {}) },
  };
}

// ─── 1. THRESHOLDS — personal vs regional ─────────────────
describe('eligibility — personal vs regional thresholds', () => {
  it('personal threshold is LOWER than regional for each family', () => {
    expect(DEFAULT_PERSONAL_THRESHOLDS.recommendation)
      .toBeLessThan(DEFAULT_REGIONAL_THRESHOLDS.recommendation);
    expect(DEFAULT_PERSONAL_THRESHOLDS.harvest)
      .toBeLessThan(DEFAULT_REGIONAL_THRESHOLDS.harvest);
  });

  it('createEligibilityConfig allows overrides', () => {
    const cfg = createEligibilityConfig({
      personal: { recommendation: 2 },
      regional: { recommendation: 50 },
    });
    expect(cfg.personal.recommendation).toBe(2);
    expect(cfg.regional.recommendation).toBe(50);
    // defaults preserved for unspecified families
    expect(cfg.personal.harvest).toBe(DEFAULT_PERSONAL_THRESHOLDS.harvest);
  });

  it('hasSufficientSignal distinguishes personal from regional', () => {
    const bucket = { counts: { rec_accepted: 6, rec_rejected: 0 } };
    expect(hasSufficientSignal(bucket, 'recommendation', SCOPES.PERSONAL)).toBe(true);
    expect(hasSufficientSignal(bucket, 'recommendation', SCOPES.REGIONAL)).toBe(false);
  });

  it('low-signal context is correctly detected', () => {
    const bucket = { counts: { rec_accepted: 1 } };
    expect(isLowSignalContext(bucket, SCOPES.REGIONAL)).toBe(true);
  });

  it('summarizeEligibility rolls up per-family counts', () => {
    const byContext = {
      a: { counts: { rec_accepted: 20 } },
      b: { counts: { harvest_good: 8 } },
      c: { counts: { rec_accepted: 2 } },
    };
    const s = summarizeEligibility(byContext, SCOPES.REGIONAL);
    expect(s.total).toBe(3);
    expect(s.eligibleByFamily.recommendation).toBe(1);
    expect(s.eligibleByFamily.harvest).toBe(1);
    expect(s.lowSignal).toBe(1);
  });
});

// ─── 2. RECENCY WEIGHTING ────────────────────────────────
describe('recency weighting', () => {
  it('filterSignalsByWindow drops stale samples', () => {
    const samples = [
      { timestamp: NOW - 5 * DAY,   type: 'rec_accepted' },
      { timestamp: NOW - 120 * DAY, type: 'rec_accepted' },
    ];
    const out = filterSignalsByWindow(samples, { windowDays: 90, now: NOW });
    expect(out).toHaveLength(1);
  });

  it('decayed weight halves at the half-life', () => {
    const w1 = getWeightedSignalScore(
      [{ timestamp: NOW, type: 'rec_accepted' }],
      { halfLifeDays: 30, now: NOW });
    const w2 = getWeightedSignalScore(
      [{ timestamp: NOW - 30 * DAY, type: 'rec_accepted' }],
      { halfLifeDays: 30, now: NOW });
    expect(w1).toBeCloseTo(1, 2);
    expect(w2).toBeCloseTo(0.5, 2);
  });

  it('getWeightedCounts returns per-type decayed counts', () => {
    const samples = [
      { timestamp: NOW - 30 * DAY, type: 'rec_accepted' },
      { timestamp: NOW,            type: 'rec_accepted' },
      { timestamp: NOW,            type: 'rec_rejected' },
    ];
    const out = getWeightedCounts(samples, { halfLifeDays: 30, now: NOW });
    expect(out.rec_accepted).toBeCloseTo(1.5, 2);  // 0.5 + 1.0
    expect(out.rec_rejected).toBeCloseTo(1.0, 2);
  });

  it('newer data influences the weighted score more than older', () => {
    const recent = getWeightedSignalScore(
      [{ timestamp: NOW - 2 * DAY,  type: 'x' }],
      { halfLifeDays: 30, now: NOW });
    const old = getWeightedSignalScore(
      [{ timestamp: NOW - 60 * DAY, type: 'x' }],
      { halfLifeDays: 30, now: NOW });
    expect(recent).toBeGreaterThan(old);
  });

  it('ageBreakdown splits into recent/middle/old thirds', () => {
    const samples = [
      { timestamp: NOW - 5 * DAY },
      { timestamp: NOW - 45 * DAY },
      { timestamp: NOW - 80 * DAY },
      { timestamp: NOW - 100 * DAY },
    ];
    const b = ageBreakdown(samples, { windowDays: 90, now: NOW });
    expect(b.recent).toBe(1);
    expect(b.middle).toBe(1);
    expect(b.old).toBe(1);
    expect(b.beyondWindow).toBe(1);
  });
});

// ─── 3. HARD CAPS ─────────────────────────────────────────
describe('hard caps — deltas never exceed bounds', () => {
  it('even 1000 consecutive accepts can\'t exceed the recommendation cap', () => {
    const events = repeat(1000,
      () => mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED,
        { crop: 'maize' }, { country: 'GH', mode: 'farm' }));
    const extraction = extractOptimizationSignals(events, { now: NOW });
    const adj = computeAdjustments(extraction).byContext['maize|gh||farm|'];
    expect(Math.abs(adj.recommendationDelta)).toBeLessThanOrEqual(MAX_RECOMMENDATION_DELTA);
  });

  it('confidence delta stays within ±MAX_CONFIDENCE_DELTA', () => {
    const events = repeat(500,
      () => mkEvent(DECISION_EVENT_TYPES.HARVEST_SUBMITTED,
        { outcomeClass: 'bad', crop: 'maize' }));
    const extraction = extractOptimizationSignals(events, { now: NOW });
    const adj = computeAdjustments(extraction).byContext['maize|gh||farm|'];
    expect(Math.abs(adj.confidenceDelta)).toBeLessThanOrEqual(MAX_CONFIDENCE_DELTA);
  });

  it('urgency delta stays within ±MAX_URGENCY_DELTA', () => {
    const events = repeat(200,
      () => mkEvent(DECISION_EVENT_TYPES.TASK_REPEAT_SKIPPED, {}));
    const extraction = extractOptimizationSignals(events, { now: NOW });
    const adj = computeAdjustments(extraction).byContext['|||farm|'];
    expect(Math.abs(adj.urgencyDelta)).toBeLessThanOrEqual(MAX_URGENCY_DELTA);
  });

  it('listing quality delta stays non-negative within cap', () => {
    const events = repeat(100,
      () => mkEvent(DECISION_EVENT_TYPES.LISTING_EXPIRED, {},
        { country: 'GH', stateCode: 'AR' }));
    const extraction = extractOptimizationSignals(events, { now: NOW });
    const adj = computeAdjustments(extraction).byContext['|gh|ar||'];
    expect(adj.listingQualityDelta).toBeGreaterThanOrEqual(0);
    expect(adj.listingQualityDelta).toBeLessThanOrEqual(MAX_LISTING_QUALITY_DELTA);
  });
});

// ─── 4. GUARDRAIL PRIORITY ───────────────────────────────
describe('guardrail priority — bad crops stay excluded', () => {
  it('pipeline cannot promote a guardrail-locked crop from positive signal alone', () => {
    const events = repeat(50,
      () => mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED,
        { crop: 'mango' }, { country: 'GH', mode: 'farm' }));

    const out = applyOptimizationPipeline({
      events,
      mode: 'farm', country: 'GH',
      locks: { 'crop:mango': { lockedBy: 'guardrails', reason: 'climate' } },
      baseRecommendationScores: { mango: 0 },    // locked at 0 upstream
      now: NOW,
    });
    expect(out.finalRecommendationScores.mango).toBe(0);
  });

  it('unlocked crops in the same run still benefit normally', () => {
    const events = repeat(50,
      () => mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED,
        { crop: 'maize' }, { country: 'GH', mode: 'farm' }));
    const out = applyOptimizationPipeline({
      events,
      mode: 'farm', country: 'GH',
      locks: {},
      baseRecommendationScores: { maize: 0.5 },
      now: NOW,
    });
    expect(out.finalRecommendationScores.maize).toBeGreaterThan(0.5);
  });
});

// ─── 5. PERSONAL vs REGIONAL SEPARATION ───────────────────
describe('personal vs regional separation', () => {
  it('buildPersonalContextKey prefixes with u:<userId>', () => {
    const k = buildPersonalContextKey({
      userId: 'u-7', crop: 'tomato', country: 'US', mode: 'backyard', month: '4',
    });
    expect(k.startsWith('u:u-7|')).toBe(true);
    expect(parseScopeFromKey(k)).toBe('personal');
  });

  it('regionalKeyFromPersonal strips the userId prefix', () => {
    const k = buildPersonalContextKey({
      userId: 'u-7', crop: 'tomato', country: 'US', mode: 'backyard',
    });
    const reg = regionalKeyFromPersonal(k);
    expect(reg.startsWith('u:')).toBe(false);
    expect(reg).toBe('tomato|us||backyard|');
  });

  it('splitSignalsByScope emits regional + per-user extractions', () => {
    const events = [
      mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED,
        { crop: 'maize' }, { userId: 'u1', country: 'GH' }),
      mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_REJECTED,
        { crop: 'maize' }, { userId: 'u2', country: 'GH' }),
    ];
    const { regional, personalByUser } = splitSignalsByScope(events, { now: NOW });
    expect(regional.totalEvents).toBe(2);
    expect(Object.keys(personalByUser)).toHaveLength(2);
    expect(Object.keys(personalByUser.u1.byContext)[0].startsWith('u:u1|')).toBe(true);
  });

  it('single user\'s rejections (below regional threshold) does NOT change global ranking', () => {
    // 6 rejections from one user — below MIN_RECOMMENDATION_SIGNALS=15
    const events = repeat(6,
      () => mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_REJECTED,
        { crop: 'maize' }, { userId: 'u1', country: 'GH', mode: 'farm' }));
    const out = applyOptimizationPipeline({
      events,
      userId: 'u1', mode: 'farm', country: 'GH',
      baseRecommendationScores: { maize: 0.5 },
      primaryCrop: 'maize',
      now: NOW,
    });
    // Regional threshold not met → regional adj stays 0; maize score unchanged.
    // Personal delta is bounded to ±0.05, so the worst case is maize: 0.45.
    // The key point: it's NOT the full regional cap of 0.15.
    expect(out.finalRecommendationScores.maize).toBeGreaterThanOrEqual(0.45);
  });

  it('mergeOptimizationLayers never flips a regionally negative signal to positive', () => {
    const regional = {
      byContext: {
        'maize|gh||farm|': {
          contextKey: 'maize|gh||farm|',
          recommendationDelta: -0.08,
          confidenceDelta: 0,
          urgencyDelta: 0,
          listingQualityDelta: 0,
          reasons: ['regional_reject'],
        },
      },
    };
    const personal = {
      byContext: {
        'u:u1|maize|gh||farm|': {
          contextKey: 'u:u1|maize|gh||farm|',
          recommendationDelta: +0.1,   // personal wants to boost
          confidenceDelta: 0,
          urgencyDelta: 0,
          listingQualityDelta: 0,
          reasons: ['personal_accept'],
          meetsThreshold: {},
          counts: {},
        },
      },
    };
    const merged = mergeOptimizationLayers(regional, personal).byContext;
    // Must not flip negative → positive
    expect(merged['u:u1|maize|gh||farm|'].recommendationDelta).toBeLessThanOrEqual(0);
  });

  it('personal urgency adjustment is kept (that\'s the primary personal dial)', () => {
    const regional = { byContext: {} };
    const personal = {
      byContext: {
        'u:u1|||farm|': {
          contextKey: 'u:u1|||farm|',
          recommendationDelta: 0, confidenceDelta: 0,
          urgencyDelta: 0.7, listingQualityDelta: 0,
          reasons: [], meetsThreshold: {}, counts: {},
        },
      },
    };
    const merged = mergeOptimizationLayers(regional, personal).byContext;
    expect(merged['u:u1|||farm|'].urgencyDelta).toBe(0.7);
  });
});

// ─── 6. NEGATIVE SIGNAL INTERPRETATION ───────────────────
describe('negative signal interpretation', () => {
  it('rejection alone is WEAK, not enough to downgrade', () => {
    const info = interpretNegativeSignals({ rec_rejected: 10 });
    expect(info.strength).toBe('weak');
    const elig = getNegativeAdjustmentEligibility({ rec_rejected: 10 });
    expect(elig.allowNegativeDelta).toBe(false);
    expect(elig.multiplier).toBe(0);
  });

  it('rejection + repeated skip = MODERATE, allows half-force downgrade', () => {
    const elig = getNegativeAdjustmentEligibility({
      rec_rejected: 5, task_repeat_skipped: 3,
    });
    expect(elig.strength).toBe('moderate');
    expect(elig.allowNegativeDelta).toBe(true);
    expect(elig.multiplier).toBe(0.5);
  });

  it('rejection + bad harvest + expired listings = STRONG, full downgrade', () => {
    const elig = getNegativeAdjustmentEligibility({
      rec_rejected: 5, harvest_bad: 4, listing_expired_unsold: 8,
    });
    expect(elig.strength).toBe('strong');
    expect(elig.multiplier).toBe(1.0);
  });

  it('applyNegativeEligibilityToDelta leaves positive deltas untouched', () => {
    expect(applyNegativeEligibilityToDelta(+0.2, { multiplier: 0 })).toBe(0.2);
  });

  it('applyNegativeEligibilityToDelta scales negative deltas by the multiplier', () => {
    expect(applyNegativeEligibilityToDelta(-0.1, { multiplier: 0.5 }))
      .toBeCloseTo(-0.05, 3);
    expect(applyNegativeEligibilityToDelta(-0.1, { multiplier: 0 }))
      .toBe(0);
  });

  it('combined negative evidence downgrades only slightly and predictably', () => {
    // rejection + repeat skip + bad harvest → moderate → half-force
    const rawNegative = -0.1;
    const elig = getNegativeAdjustmentEligibility({
      rec_rejected: 5, task_repeat_skipped: 2, harvest_bad: 3,
    });
    const result = applyNegativeEligibilityToDelta(rawNegative, elig);
    expect(Math.abs(result)).toBeLessThanOrEqual(Math.abs(rawNegative));
    expect(result).toBeLessThan(0);
  });
});

// ─── 7. MODE ISOLATION ───────────────────────────────────
describe('mode isolation', () => {
  it('enforceModeIsolation drops mode-mismatched adjustments', () => {
    const adjustments = {
      byContext: {
        'maize|gh||farm|':     { contextKey: 'maize|gh||farm|',     recommendationDelta: 0.05 },
        'maize|gh||backyard|': { contextKey: 'maize|gh||backyard|', recommendationDelta: 0.05 },
      },
    };
    const out = enforceModeIsolation(adjustments, { mode: 'farm' });
    expect(Object.keys(out.byContext)).toEqual(['maize|gh||farm|']);
    expect(out.dropped).toHaveLength(1);
  });

  it('stripListingDeltasForBackyard zeroes listing deltas in backyard mode', () => {
    const adj = {
      contextKey: '|us|md||', recommendationDelta: 0,
      confidenceDelta: 0, urgencyDelta: 0, listingQualityDelta: 0.15,
    };
    const out = stripListingDeltasForBackyard(adj, 'backyard');
    expect(out.listingQualityDelta).toBe(0);
  });

  it('stripListingDeltasForBackyard preserves listing deltas in farm mode', () => {
    const adj = { listingQualityDelta: 0.15 };
    const out = stripListingDeltasForBackyard(adj, 'farm');
    expect(out.listingQualityDelta).toBe(0.15);
  });

  it('validateModeAwareOptimization flags mismatches', () => {
    const bad = validateModeAwareOptimization(
      { contextKey: 'maize|gh||backyard|' }, 'farm');
    expect(bad.valid).toBe(false);
    expect(bad.reason).toBe('mode_mismatch');

    const good = validateModeAwareOptimization(
      { contextKey: 'maize|gh||farm|' }, 'farm');
    expect(good.valid).toBe(true);
  });

  it('backyard behavior does not affect farm optimization outputs', () => {
    const events = [
      ...repeat(30, () => mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED,
        { crop: 'tomato' }, { country: 'US', mode: 'backyard' })),
    ];
    const out = applyOptimizationPipeline({
      events, mode: 'farm', country: 'US',
      baseRecommendationScores: { tomato: 0.5 }, primaryCrop: 'tomato',
      now: NOW,
    });
    // Backyard-tomato signals must not touch the farm-tomato score.
    expect(out.finalRecommendationScores.tomato).toBe(0.5);
  });

  it('summarizeModeCoverage counts per-mode adjustments', () => {
    const s = summarizeModeCoverage({
      byContext: {
        'maize|gh||farm|':     {},
        'tomato|gh||backyard|': {},
        '|gh|ar||':            {},
      },
    });
    expect(s.farm).toBe(1);
    expect(s.backyard).toBe(1);
    expect(s.unspecified).toBe(1);
  });
});

// ─── 8. EXPLAINABILITY ───────────────────────────────────
describe('explainability — every adjustment is auditable', () => {
  it('buildOptimizationExplanation produces human-readable text', () => {
    const record = buildOptimizationExplanation(
      {
        contextKey: 'tomato|us|md|backyard|4',
        scope: 'regional',
        recommendationDelta: 0.08,
        confidenceDelta: 6.2,
        urgencyDelta: 0,
        listingQualityDelta: 0,
        reasons: ['recommendation_up_ratio:0.64'],
        counts: { rec_accepted: 18, rec_rejected: 4, harvest_good: 7, harvest_bad: 1 },
      },
      { counts: { rec_accepted: 18, rec_rejected: 4, harvest_good: 7, harvest_bad: 1 } },
      { now: NOW },
    );
    expect(record.explanation).toMatch(/Tomato boosted \+0\.08/);
    expect(record.explanation).toMatch(/18 acceptances vs 4 rejections/);
    expect(record.explanation).toMatch(/confidence up 6\.2/);
    expect(record.explanation).toMatch(/7 good \/ 1 bad harvest/);
    expect(record.explanation).toMatch(/in MD, US/);
    expect(record.explanation).toMatch(/backyard mode/);
    expect(record.explanation).toMatch(/month 4/);
  });

  it('no-op adjustment produces a clear "no change" message', () => {
    const record = buildOptimizationExplanation(
      { contextKey: 'maize|gh||farm|', recommendationDelta: 0,
        confidenceDelta: 0, urgencyDelta: 0, listingQualityDelta: 0,
        reasons: [], counts: {} },
      { counts: {} },
    );
    expect(record.explanation).toMatch(/no meaningful adjustment|below threshold/i);
  });

  it('every pipeline adjustment lands in the audit store', () => {
    const auditStore = createInMemoryAuditStore();
    const events = repeat(20,
      () => mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED,
        { crop: 'maize' }, { country: 'GH', mode: 'farm' }));
    applyOptimizationPipeline({
      events, mode: 'farm', country: 'GH',
      baseRecommendationScores: { maize: 0.5 },
      primaryCrop: 'maize',
      auditStore,
      now: NOW,
    });
    expect(auditStore.size()).toBeGreaterThan(0);
    const trail = auditStore.getOptimizationAuditTrail({ limit: 100 });
    expect(trail[0]).toHaveProperty('explanation');
    expect(trail[0]).toHaveProperty('deltas');
    expect(trail[0]).toHaveProperty('createdAt');
    expect(trail[0]).toHaveProperty('scope');
  });

  it('audit store supports scope + contextKey filtering', () => {
    const store = createInMemoryAuditStore();
    store.append({ contextKey: 'k1', scope: 'regional', createdAt: NOW });
    store.append({ contextKey: 'k2', scope: 'personal', createdAt: NOW });
    store.append({ contextKey: 'k1', scope: 'regional', createdAt: NOW });
    const personal = store.getOptimizationAuditTrail({ scope: 'personal' });
    expect(personal).toHaveLength(1);
    const k1 = store.getOptimizationAuditTrail({ contextKey: 'k1' });
    expect(k1).toHaveLength(2);
  });

  it('audit store cap is enforced', () => {
    const store = createInMemoryAuditStore({ cap: 3 });
    for (let i = 0; i < 10; i++) store.append({ contextKey: `k${i}`, createdAt: NOW + i });
    expect(store.size()).toBe(3);
  });

  it('buildAuditSummary rolls up per-scope + per-family', () => {
    const store = createInMemoryAuditStore();
    store.append({
      contextKey: 'k1', scope: 'regional', createdAt: NOW,
      deltas: { recommendation: 0.1, confidence: 0, urgency: 0, listingQuality: 0 },
    });
    store.append({
      contextKey: 'k2', scope: 'personal', createdAt: NOW,
      deltas: { recommendation: 0, confidence: 0, urgency: 0.7, listingQuality: 0 },
    });
    const summary = buildAuditSummary(store);
    expect(summary.total).toBe(2);
    expect(summary.byScope.regional).toBe(1);
    expect(summary.byScope.personal).toBe(1);
    expect(summary.byFamily.recommendation).toBe(1);
    expect(summary.byFamily.urgency).toBe(1);
  });
});

// ─── 9. CONFIDENCE-AWARE WORDING ─────────────────────────
describe('confidence-aware wording', () => {
  it('low-signal eligibility → "Recommendations are limited"', () => {
    const pick = getConfidenceAwareWording({
      eligibility: null, confidenceLevel: 'high',
    });
    expect(pick.tier).toBe('low');
    expect(pick.fallbackHeader).toMatch(/limited/i);
    expect(pick.isLowSignal).toBe(true);
  });

  it('limited support tier overrides confidence level → low wording', () => {
    const pick = getConfidenceAwareWording({
      eligibility: { recommendation: true }, confidenceLevel: 'high',
      supportTier: 'limited',
    });
    expect(pick.tier).toBe('low');
  });

  it('eligible + high confidence → "Best crops"', () => {
    const pick = getConfidenceAwareWording({
      eligibility: { recommendation: true, harvest: true, task: true, listing: true },
      confidenceLevel: 'high',
    });
    expect(pick.tier).toBe('high');
    expect(pick.fallbackHeader).toMatch(/best/i);
  });

  it('eligible + medium → "Suggested"', () => {
    const pick = getConfidenceAwareWording({
      eligibility: { recommendation: true, harvest: false, task: false, listing: false },
      confidenceLevel: 'medium',
    });
    expect(pick.tier).toBe('medium');
    expect(pick.fallbackHeader).toMatch(/suggested/i);
  });

  it('resolveWording uses t() when available, falls back otherwise', () => {
    const pick = getConfidenceAwareWording({
      eligibility: { recommendation: true }, confidenceLevel: 'high',
    });
    const t = (k) => (k === 'recommendations.header.high' ? 'MEJORES' : null);
    const out = resolveWording(pick, t);
    expect(out.header).toBe('MEJORES');
    const noT = resolveWording(pick);
    expect(noT.header).toMatch(/best/i);
  });
});

// ─── 10. END-TO-END PIPELINE INTEGRATION ─────────────────
describe('applyOptimizationPipeline — integration', () => {
  function primeEvents() {
    return [
      ...repeat(20, () => mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED,
        { crop: 'maize' }, { country: 'GH', mode: 'farm', userId: 'u-7' })),
      ...repeat(8,  () => mkEvent(DECISION_EVENT_TYPES.HARVEST_SUBMITTED,
        { outcomeClass: 'good', crop: 'maize' },
        { country: 'GH', mode: 'farm', userId: 'u-7' })),
    ];
  }

  it('returns a bounded final score above the base', () => {
    const out = applyOptimizationPipeline({
      events: primeEvents(),
      userId: 'u-7', mode: 'farm', country: 'GH',
      baseRecommendationScores: { maize: 0.5 },
      baseConfidence: { level: 'medium', score: 55, reasons: [] },
      primaryCrop: 'maize',
      now: NOW,
    });
    expect(out.finalRecommendationScores.maize).toBeGreaterThan(0.5);
    expect(out.finalRecommendationScores.maize).toBeLessThanOrEqual(0.5 + MAX_RECOMMENDATION_DELTA);
  });

  it('attaches wording pick that reflects eligibility', () => {
    const out = applyOptimizationPipeline({
      events: primeEvents(),
      userId: 'u-7', mode: 'farm', country: 'GH',
      baseRecommendationScores: { maize: 0.5 },
      baseConfidence: { level: 'high', score: 85 },
      primaryCrop: 'maize',
      now: NOW,
    });
    expect(out.wording).toBeTruthy();
    expect(['high', 'medium', 'low']).toContain(out.wording.tier);
  });

  it('empty events → low-signal wording, no deltas', () => {
    const out = applyOptimizationPipeline({
      events: [],
      userId: 'u-7', mode: 'farm', country: 'GH',
      baseRecommendationScores: { maize: 0.5 },
      baseConfidence: { level: 'medium', score: 55 },
      primaryCrop: 'maize',
      now: NOW,
    });
    expect(out.finalRecommendationScores.maize).toBe(0.5);
    expect(out.wording.tier).toBe('low');
  });

  it('extraction is pre-filtered by the configurable window', () => {
    const events = [
      ...repeat(20, () => ({
        ...mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, { crop: 'maize' },
          { country: 'GH', mode: 'farm', userId: 'u-7' }),
        timestamp: NOW - 200 * DAY,          // ancient
      })),
      ...repeat(5, () => mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED,
        { crop: 'maize' }, { country: 'GH', mode: 'farm', userId: 'u-7' })),
    ];
    const out = applyOptimizationPipeline({
      events,
      userId: 'u-7', mode: 'farm', country: 'GH',
      baseRecommendationScores: { maize: 0.5 },
      primaryCrop: 'maize',
      windowDays: 90, halfLifeDays: 30,
      now: NOW,
    });
    // 5 recent events is below regional threshold (15) → no regional delta.
    // Personal threshold (5) is met → bounded small delta at most.
    expect(out.finalRecommendationScores.maize).toBeLessThanOrEqual(0.5 + 0.05);
  });

  it('deterministic for identical input', () => {
    const events = primeEvents();
    const a = applyOptimizationPipeline({
      events, userId: 'u-7', mode: 'farm', country: 'GH',
      baseRecommendationScores: { maize: 0.5 }, primaryCrop: 'maize', now: NOW,
    });
    const b = applyOptimizationPipeline({
      events, userId: 'u-7', mode: 'farm', country: 'GH',
      baseRecommendationScores: { maize: 0.5 }, primaryCrop: 'maize', now: NOW,
    });
    expect(a.finalRecommendationScores).toEqual(b.finalRecommendationScores);
    expect(a.wording.tier).toBe(b.wording.tier);
  });

  it('mode isolation: backyard events never leak into farm pipeline output', () => {
    const events = [
      ...repeat(30, () => mkEvent(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED,
        { crop: 'maize' }, { country: 'GH', mode: 'backyard', userId: 'u-7' })),
    ];
    const out = applyOptimizationPipeline({
      events, userId: 'u-7', mode: 'farm', country: 'GH',
      baseRecommendationScores: { maize: 0.5 }, primaryCrop: 'maize', now: NOW,
    });
    expect(out.finalRecommendationScores.maize).toBe(0.5);
  });
});
