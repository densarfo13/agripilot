/**
 * v2AnalyticsRoutes.test.js — contract for the v2 ingest service,
 * reports service, router factory, and bias adapter. No HTTP —
 * we call the service functions directly and smoke-test the
 * Express router via its internal stack.
 */

import { describe, it, expect } from 'vitest';

import { createV2AnalyticsRouter } from '../modules/analytics/v2/routes.js';
import {
  inMemoryStore,
  generateOnboardingReport,
  generateRecommendationReport,
  generateTrustReport,
  generateFullProductReport,
} from '../modules/analytics/v2/reportsService.js';
import { ingestAnalyticsBatch }    from '../modules/analytics/v2/ingestService.js';
import {
  createBiasAdapter,
  wrapRecommendationEngine,
} from '../modules/recommendations/biasAdapter.js';

import {
  DECISION_EVENT_TYPES,
  FUNNEL_EVENT_TYPES,
  FUNNEL_STEPS,
} from '../services/analytics/decisionEventTypes.js';
import { PRODUCT_INTELLIGENCE_EVENT_TYPES } from '../services/analytics/productIntelligenceEventTypes.js';
import { applyOutcomeSignalToRecommendationHistory } from '../services/recommendations/recommendationFeedbackService.js';

const T0 = new Date('2026-04-19T09:00:00Z').getTime();
function ev(type, meta = {}, i = 0) {
  return {
    type,
    timestamp: T0 + i * 1000,
    sessionId: 'sess_test',
    mode: 'farm',
    language: 'en',
    country: 'GH',
    online: true,
    meta,
  };
}

// ─── ROUTER FACTORY ────────────────────────────────────────
describe('createV2AnalyticsRouter — factory', () => {
  it('throws when store.persistFn is missing', () => {
    expect(() => createV2AnalyticsRouter({ store: {} })).toThrow(/persistFn/);
  });

  it('constructs a router with expected routes', () => {
    const store = inMemoryStore();
    const router = createV2AnalyticsRouter({ store });
    // Express routers expose a `stack` array of layers. We only
    // need to confirm the router factory ran without error and the
    // health route is registered (smoke test).
    expect(router).toBeDefined();
    expect(Array.isArray(router.stack)).toBe(true);
    const paths = router.stack
      .map((l) => l.route?.path)
      .filter(Boolean);
    expect(paths).toContain('/health');
    expect(paths).toContain('/events');
    expect(paths).toContain('/reports/product-intelligence');
  });
});

// ─── INGEST ────────────────────────────────────────────────
describe('ingestAnalyticsBatch', () => {
  it('validates + persists a well-formed batch', async () => {
    const store = inMemoryStore();
    const res = await ingestAnalyticsBatch({
      events: [
        ev(FUNNEL_EVENT_TYPES.STEP_VIEWED,    { step: FUNNEL_STEPS.WELCOME }, 0),
        ev(FUNNEL_EVENT_TYPES.STEP_COMPLETED, { step: FUNNEL_STEPS.WELCOME }, 1),
        ev(DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED, { crop: 'maize' }, 2),
      ],
      userId: 'u-1',
      persistFn: store.persistFn,
    });
    expect(res.accepted).toBe(3);
    expect(res.persisted).toBe(true);
    expect(res.rejected).toEqual([]);
    const users = await store.loadUsers();
    expect(users[0].events.length).toBe(3);
  });

  it('returns rejection reasons for malformed events', async () => {
    const store = inMemoryStore();
    const res = await ingestAnalyticsBatch({
      events: [
        ev(DECISION_EVENT_TYPES.TASK_COMPLETED, {}, 0),
        { type: 'definitely_not_an_event', timestamp: T0 },
      ],
      userId: 'u-2',
      persistFn: store.persistFn,
    });
    expect(res.accepted).toBe(1);
    expect(res.rejected).toHaveLength(1);
    expect(res.rejected[0].reasons).toContain('unknown_type');
  });

  it('accepts hesitation_tick via the PI allowlist', async () => {
    const store = inMemoryStore();
    const res = await ingestAnalyticsBatch({
      events: [
        ev(PRODUCT_INTELLIGENCE_EVENT_TYPES.HESITATION_TICK,
           { step: 'location', dwellMs: 52000 }, 0),
      ],
      userId: 'u-3',
      persistFn: store.persistFn,
    });
    expect(res.accepted).toBe(1);
  });

  it('accepts onboarding_* events via the default allowlist extension', async () => {
    const store = inMemoryStore();
    const res = await ingestAnalyticsBatch({
      events: [
        ev('onboarding_location_detect_success', {}, 0),
        ev('onboarding_manual_country_selected', { country: 'GH' }, 1),
      ],
      userId: 'u-4',
      persistFn: store.persistFn,
    });
    expect(res.accepted).toBe(2);
  });

  it('runs in accept-only mode when no persistFn is given', async () => {
    const res = await ingestAnalyticsBatch({
      events: [ev(DECISION_EVENT_TYPES.TASK_COMPLETED, {}, 0)],
      userId: null,
    });
    expect(res.accepted).toBe(1);
    expect(res.persisted).toBe(false);
  });

  it('returns 0 accepted for a fully-invalid batch', async () => {
    const store = inMemoryStore();
    const res = await ingestAnalyticsBatch({
      events: [{ type: 'totally_made_up', timestamp: T0 }],
      userId: 'u-5',
      persistFn: store.persistFn,
    });
    expect(res.accepted).toBe(0);
    expect(res.persisted).toBe(false);
  });
});

// ─── REPORTS ──────────────────────────────────────────────
describe('reports', () => {
  async function primeStore() {
    const store = inMemoryStore();
    await ingestAnalyticsBatch({
      events: [
        ev(FUNNEL_EVENT_TYPES.STEP_VIEWED,    { step: FUNNEL_STEPS.WELCOME }, 0),
        ev(FUNNEL_EVENT_TYPES.STEP_COMPLETED, { step: FUNNEL_STEPS.WELCOME }, 1),
        ev(FUNNEL_EVENT_TYPES.STEP_VIEWED,    { step: FUNNEL_STEPS.LOCATION }, 2),
        ev(DECISION_EVENT_TYPES.LOCATION_CONFIRMED_MANUAL, { country: 'GH' }, 3),
        ev(DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED, { crop: 'maize' }, 4),
        ev(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, { crop: 'maize' }, 5),
      ],
      userId: 'u-1',
      persistFn: store.persistFn,
    });
    return store;
  }

  it('generateOnboardingReport returns a shaped report', async () => {
    const store = await primeStore();
    const r = await generateOnboardingReport({ loadUsers: store.loadUsers });
    expect(r.totalUsers).toBe(1);
    expect(Array.isArray(r.funnel)).toBe(true);
    expect(Array.isArray(r.insights)).toBe(true);
  });

  it('generateRecommendationReport includes acceptance + funnel', async () => {
    const store = await primeStore();
    const r = await generateRecommendationReport({
      loadUsers: store.loadUsers,
      loadFeedbackHistory: store.loadFeedbackHistory,
    });
    expect(r.acceptance).toBeDefined();
    expect(r.decisionFunnel).toBeDefined();
  });

  it('generateTrustReport returns sortedPatterns', async () => {
    const store = await primeStore();
    const r = await generateTrustReport({ loadUsers: store.loadUsers });
    expect(Array.isArray(r.sortedPatterns)).toBe(true);
  });

  it('generateFullProductReport stitches all three', async () => {
    const store = await primeStore();
    const r = await generateFullProductReport({
      loadUsers: store.loadUsers,
      loadFeedbackHistory: store.loadFeedbackHistory,
    });
    expect(r.onboarding).toBeDefined();
    expect(r.recommendation).toBeDefined();
    expect(r.trust).toBeDefined();
  });

  it('throws if loadUsers is not a function', async () => {
    await expect(generateOnboardingReport({ loadUsers: null })).rejects.toThrow();
  });
});

// ─── BIAS ADAPTER ─────────────────────────────────────────
describe('biasAdapter', () => {
  it('applies feedback history to base scores', async () => {
    const store = inMemoryStore();
    const h = applyOutcomeSignalToRecommendationHistory({}, {
      crop: 'maize', country: 'GH', direction: 'positive', weight: 0.8,
      reasons: ['harvest_good'], generatedAt: Date.now(),
    });
    Object.assign(store._debug.history, h);

    const adapter = createBiasAdapter({ store, ttlMs: 0 });
    const base = { maize: 0.5, cassava: 0.6 };
    const biased = await adapter.apply(base, { country: 'GH' });
    expect(biased.maize).toBeGreaterThan(0.5);
    expect(biased.cassava).toBeCloseTo(0.6, 4);
  });

  it('wraps an engine and post-processes its scores', async () => {
    const store = inMemoryStore();
    const h = applyOutcomeSignalToRecommendationHistory({}, {
      crop: 'maize', country: 'GH', direction: 'negative', weight: 0.5,
      reasons: ['harvest_bad'], generatedAt: Date.now(),
    });
    Object.assign(store._debug.history, h);

    const adapter = createBiasAdapter({ store, ttlMs: 0 });
    const engineFn = async () => ({ maize: 0.7, rice: 0.5 });
    const biased = wrapRecommendationEngine(engineFn, adapter, { country: 'GH' });
    const out = await biased({ country: 'GH' });
    expect(out.maize).toBeLessThan(0.7);
    expect(out.rice).toBeCloseTo(0.5, 4);
  });

  it('leaves non-score-map outputs alone', async () => {
    const store = inMemoryStore();
    const adapter = createBiasAdapter({ store });
    const engineFn = async () => ({ recommendations: [{ crop: 'maize' }] });
    const biased = wrapRecommendationEngine(engineFn, adapter);
    const out = await biased({});
    expect(out.recommendations).toEqual([{ crop: 'maize' }]);
  });

  it('caches feedback history for subsequent calls', async () => {
    const store = inMemoryStore();
    let calls = 0;
    const wrapped = {
      ...store,
      loadFeedbackHistory: async () => { calls += 1; return store._debug.history; },
    };
    const adapter = createBiasAdapter({ store: wrapped, ttlMs: 5000 });
    await adapter.apply({ maize: 0.5 }, { country: 'GH' });
    await adapter.apply({ maize: 0.5 }, { country: 'GH' });
    expect(calls).toBe(1);
    adapter.invalidate();
    await adapter.apply({ maize: 0.5 }, { country: 'GH' });
    expect(calls).toBe(2);
  });

  it('rejects construction without loadFeedbackHistory', () => {
    expect(() => createBiasAdapter({ store: {} })).toThrow(/loadFeedbackHistory/);
  });
});
