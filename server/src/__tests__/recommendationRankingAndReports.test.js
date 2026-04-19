/**
 * recommendationRankingAndReports.test.js — covers the
 * recommendation ranking layer and the three top-level product
 * intelligence reports:
 *
 *   • buildOnboardingHealthReport
 *   • buildRecommendationHealthReport
 *   • buildTrustHealthReport
 *   • buildFullProductReport
 *
 * Tests focus on the *answers* the report produces — dashboards
 * will render whatever fields exist, but specific insights (e.g.
 * "top drop-off reason is X") have to surface.
 */

import { describe, it, expect } from 'vitest';
import {
  rankCropsByFeedback,
  getTopPerformers,
  getUnderPerformers,
  getContestedCrops,
  summarizeCountryPerformance,
  rankCountriesByFeedbackHealth,
} from '../services/recommendations/recommendationRankingService.js';
import {
  buildOnboardingHealthReport,
  buildRecommendationHealthReport,
  buildTrustHealthReport,
  buildFullProductReport,
} from '../services/analytics/productIntelligenceReports.js';
import {
  DECISION_EVENT_TYPES,
  FUNNEL_EVENT_TYPES,
  FUNNEL_STEPS,
} from '../services/analytics/decisionEventTypes.js';

const T0 = new Date('2026-04-19T08:00:00Z').getTime();
const at = (i) => T0 + i * 1000;

// ─── RANKING ──────────────────────────────────────────────
describe('rankCropsByFeedback + top/under performers', () => {
  const history = {
    'gh:maize':   { score: +0.75, n: 10, reasons: [] },
    'gh:cassava': { score: -0.5,  n: 6,  reasons: [] },
    'gh:tomato':  { score: +0.05, n: 7,  reasons: [] },
    'gh:yam':     { score: +0.3,  n: 3,  reasons: [] },
    'in:rice':    { score: +0.2,  n: 4,  reasons: [] },
  };

  it('ranks crops for a country in descending score order', () => {
    const ranked = rankCropsByFeedback(history, 'GH');
    expect(ranked.map((r) => r.crop)).toEqual(['maize', 'yam', 'tomato', 'cassava']);
    expect(ranked.find((r) => r.crop === 'maize').direction).toBe('positive');
    expect(ranked.find((r) => r.crop === 'cassava').direction).toBe('negative');
    expect(ranked.find((r) => r.crop === 'tomato').direction).toBe('neutral');
  });

  it('returns only positive-direction crops as top performers', () => {
    const top = getTopPerformers(history, 'GH', 5);
    expect(top.map((t) => t.crop)).toEqual(['maize', 'yam']);
  });

  it('returns only negative-direction crops as under performers', () => {
    const under = getUnderPerformers(history, 'GH', 5);
    expect(under.map((t) => t.crop)).toEqual(['cassava']);
  });

  it('flags contested crops (enough samples, near-zero score)', () => {
    const contested = getContestedCrops(history, 'GH');
    expect(contested.map((c) => c.crop)).toEqual(['tomato']);
  });

  it('does not leak crops from other countries into a country rank', () => {
    const ranked = rankCropsByFeedback(history, 'GH');
    expect(ranked.find((r) => r.crop === 'rice')).toBeUndefined();
  });

  it('summarizeCountryPerformance rolls up to winners / losers / contested', () => {
    const s = summarizeCountryPerformance(history, 'GH');
    expect(s.totalCrops).toBe(4);
    expect(s.winners).toContain('maize');
    expect(s.losers).toContain('cassava');
    expect(s.contested).toContain('tomato');
    expect(s.netDirection).toBe('positive');
    expect(s.averageScore).toBeGreaterThan(0);
  });

  it('rankCountriesByFeedbackHealth orders countries by weighted score', () => {
    const ranked = rankCountriesByFeedbackHealth(history);
    expect(ranked[0].country).toBeDefined();
    expect(ranked.length).toBeGreaterThanOrEqual(2);
    expect(ranked.every((r) => Number.isFinite(r.averageScore))).toBe(true);
  });
});

// ─── ONBOARDING REPORT ───────────────────────────────────
describe('buildOnboardingHealthReport', () => {
  it('surfaces overall conversion, biggest drop-off, mode + method breakdowns', () => {
    const users = [
      { userId: 'u1', events: [
        { type: FUNNEL_EVENT_TYPES.STEP_VIEWED,    meta: { step: FUNNEL_STEPS.WELCOME, mode: 'farm' }, timestamp: at(1) },
        { type: FUNNEL_EVENT_TYPES.STEP_COMPLETED, meta: { step: FUNNEL_STEPS.WELCOME, mode: 'farm' }, timestamp: at(2) },
        { type: FUNNEL_EVENT_TYPES.STEP_VIEWED,    meta: { step: FUNNEL_STEPS.LOCATION, mode: 'farm' }, timestamp: at(3) },
        { type: 'onboarding_location_detect_success', meta: { mode: 'farm' }, timestamp: at(4) },
        { type: FUNNEL_EVENT_TYPES.STEP_COMPLETED, meta: { step: FUNNEL_STEPS.ONBOARDING_COMPLETED, mode: 'farm' }, timestamp: at(5) },
      ]},
      { userId: 'u2', events: [
        { type: FUNNEL_EVENT_TYPES.STEP_VIEWED,    meta: { step: FUNNEL_STEPS.WELCOME, mode: 'backyard' }, timestamp: at(1) },
        { type: FUNNEL_EVENT_TYPES.STEP_VIEWED,    meta: { step: FUNNEL_STEPS.LOCATION, mode: 'backyard' }, timestamp: at(2) },
        { type: FUNNEL_EVENT_TYPES.STEP_ABANDONED, meta: { step: FUNNEL_STEPS.LOCATION, mode: 'backyard' }, timestamp: at(3) },
      ]},
      { userId: 'u3', events: [
        { type: FUNNEL_EVENT_TYPES.STEP_VIEWED,    meta: { step: FUNNEL_STEPS.WELCOME, mode: 'farm' }, timestamp: at(1) },
        { type: DECISION_EVENT_TYPES.LOCATION_CONFIRMED_MANUAL, meta: { country: 'GH', mode: 'farm' }, timestamp: at(2) },
      ]},
    ];
    const report = buildOnboardingHealthReport(users);
    expect(report.totalUsers).toBe(3);
    expect(Array.isArray(report.funnel)).toBe(true);
    expect(report.byMode.farm?.count).toBe(2);
    expect(report.byMode.backyard?.count).toBe(1);
    expect(report.byLocationMethod.detect?.count).toBe(1);
    expect(report.byLocationMethod.manual?.count).toBe(1);
    expect(Array.isArray(report.insights)).toBe(true);
    expect(report.insights.some((s) => s.toLowerCase().includes('conversion'))).toBe(true);
  });

  it('does not crash on empty input', () => {
    const r = buildOnboardingHealthReport([]);
    expect(r.totalUsers).toBe(0);
    expect(r.funnel.length).toBeGreaterThan(0);
  });
});

// ─── RECOMMENDATION REPORT ───────────────────────────────
describe('buildRecommendationHealthReport', () => {
  it('returns acceptance + switch + decisionFunnel + country health', () => {
    const users = [
      { userId: 'u1', events: [
        { type: DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED,   meta: { crop: 'maize' }, timestamp: at(1) },
        { type: DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, meta: { crop: 'maize' }, timestamp: at(2) },
        { type: DECISION_EVENT_TYPES.TASK_COMPLETED,          meta: {}, timestamp: at(3) },
        { type: DECISION_EVENT_TYPES.HARVEST_SUBMITTED,       meta: { outcomeClass: 'good' }, timestamp: at(4) },
      ]},
      { userId: 'u2', events: [
        { type: DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED,   meta: { crop: 'maize' }, timestamp: at(1) },
        { type: DECISION_EVENT_TYPES.RECOMMENDATION_REJECTED, meta: { crop: 'maize' }, timestamp: at(2) },
      ]},
    ];
    const history = {
      'gh:maize': { score: +0.6, n: 5, reasons: [] },
      'gh:rice':  { score: -0.4, n: 3, reasons: [] },
    };
    const report = buildRecommendationHealthReport(users, history);
    expect(report.acceptance.acceptanceRate).toBeCloseTo(0.5, 2);
    expect(report.decisionFunnel.rates.viewedToHarvest).toBeCloseTo(0.5, 2);
    expect(report.countryHealth[0].country).toBe('gh');
    expect(report.perCountry.gh.winners).toContain('maize');
    expect(report.insights.some((s) => s.toLowerCase().includes('acceptance'))).toBe(true);
  });
});

// ─── TRUST REPORT ────────────────────────────────────────
describe('buildTrustHealthReport', () => {
  it('surfaces the top trust-break pattern', () => {
    const users = [
      { userId: 'u1', events: [
        { type: DECISION_EVENT_TYPES.LOCATION_CONFIRMED_YES, meta: {}, timestamp: at(1) },
        { type: DECISION_EVENT_TYPES.LOCATION_CONFIRMED_MANUAL, meta: {}, timestamp: at(2) },
      ]},
      { userId: 'u2', events: [
        { type: DECISION_EVENT_TYPES.LOCATION_CONFIRMED_YES, meta: {}, timestamp: at(1) },
        { type: DECISION_EVENT_TYPES.LOCATION_CONFIRMED_MANUAL, meta: {}, timestamp: at(2) },
      ]},
      { userId: 'u3', events: [
        { type: DECISION_EVENT_TYPES.TASK_REPEAT_SKIPPED, meta: { taskId: 't1' }, timestamp: at(1) },
      ]},
    ];
    const report = buildTrustHealthReport(users);
    expect(report.totalUsers).toBe(3);
    expect(report.sortedPatterns[0].count).toBeGreaterThan(0);
    expect(report.trustBreakRate).toBeGreaterThan(0);
    expect(report.insights.some((s) => s.toLowerCase().includes('trust'))).toBe(true);
  });
});

// ─── FULL REPORT ─────────────────────────────────────────
describe('buildFullProductReport', () => {
  it('combines all three sub-reports without errors', () => {
    const r = buildFullProductReport([{ userId: 'u1', events: [] }], {});
    expect(r.onboarding).toBeDefined();
    expect(r.recommendation).toBeDefined();
    expect(r.trust).toBeDefined();
  });
});
