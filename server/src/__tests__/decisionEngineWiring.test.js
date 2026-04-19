/**
 * decisionEngineWiring.test.js — contract for the wiring-layer
 * artifacts: signal extractor, reason store, engine adapters,
 * router factory.
 *
 * No HTTP (supertest isn't installed). The router is smoke-tested
 * by asserting the routes are registered; the underlying handlers
 * are exercised through the services they wrap.
 */

import { describe, it, expect } from 'vitest';

import {
  extractSignalsFromEvents,
  extractSignalsForUser,
  extractSignalsForAllUsers,
} from '../modules/decision/signalExtractor.js';
import {
  createInMemoryReasonStore,
} from '../modules/decision/reasonHistoryStore.js';
import {
  createRecommendationAdapter,
  createTaskAdapter,
  createListingAdapter,
} from '../modules/decision/engineAdapters.js';
import { createDecisionEngineRouter } from '../modules/decision/engine/routes.js';
import {
  DECISION_EVENT_TYPES,
  FUNNEL_EVENT_TYPES,
} from '../services/analytics/decisionEventTypes.js';

const T0 = new Date('2026-04-19T00:00:00Z').getTime();
function ev(type, meta = {}, i = 0, extras = {}) {
  return { type, meta, timestamp: T0 + i * 1000, ...extras };
}

// ─── Signal extractor ────────────────────────────────────
describe('extractSignalsFromEvents', () => {
  it('maps harvest_submitted to harvest_outcome in the right direction', () => {
    const { signalsByType } = extractSignalsFromEvents([
      ev(DECISION_EVENT_TYPES.HARVEST_SUBMITTED, { outcomeClass: 'good', crop: 'maize' }, 0, { country: 'GH' }),
      ev(DECISION_EVENT_TYPES.HARVEST_SUBMITTED, { outcomeClass: 'bad',  crop: 'cassava' }, 1, { country: 'GH' }),
    ]);
    expect(signalsByType.harvest_outcome).toHaveLength(2);
    expect(signalsByType.harvest_outcome[0].direction).toBe(+1);
    expect(signalsByType.harvest_outcome[1].direction).toBe(-1);
  });

  it('attributes crop signals to gh:crop contextKey', () => {
    const { signalsByContext } = extractSignalsFromEvents([
      ev(DECISION_EVENT_TYPES.HARVEST_SUBMITTED, { outcomeClass: 'good', crop: 'maize' }, 0, { country: 'GH' }),
    ]);
    expect(signalsByContext['gh:maize']).toBeDefined();
    expect(signalsByContext['gh:maize'][0].signalType).toBe('harvest_outcome');
  });

  it('emits repeated_issue_severity after 3 same-type reports', () => {
    const { signalsByType } = extractSignalsFromEvents([
      ev(DECISION_EVENT_TYPES.ISSUE_REPORTED, { type: 'pest', crop: 'maize' }, 1, { country: 'GH' }),
      ev(DECISION_EVENT_TYPES.ISSUE_REPORTED, { type: 'pest', crop: 'maize' }, 2, { country: 'GH' }),
      ev(DECISION_EVENT_TYPES.ISSUE_REPORTED, { type: 'pest', crop: 'maize' }, 3, { country: 'GH' }),
    ]);
    expect(signalsByType.issue_report).toHaveLength(3);
    expect(signalsByType.repeated_issue_severity).toHaveLength(1); // only on the 3rd
  });

  it('detects detect→manual override as a trust signal', () => {
    const { signalsByType } = extractSignalsFromEvents([
      ev(DECISION_EVENT_TYPES.LOCATION_CONFIRMED_YES, {}, 1),
      ev(DECISION_EVENT_TYPES.LOCATION_CONFIRMED_MANUAL, { country: 'GH' }, 100),
    ], { userId: 'u-1' });
    expect(signalsByType.detect_overridden_by_manual).toHaveLength(1);
  });

  it('falls back to user:<id> context when no crop present', () => {
    const { signalsByContext } = extractSignalsFromEvents([
      ev(DECISION_EVENT_TYPES.LOCATION_RETRY_CLICKED, {}, 1),
    ], { userId: 'u-42' });
    expect(signalsByContext['user:u-42']).toBeDefined();
  });

  it('emits weak_engagement for unknown event types', () => {
    const { signalsByType } = extractSignalsFromEvents([
      { type: 'some_unclassified_event', timestamp: T0, meta: {} },
    ]);
    expect(signalsByType.weak_engagement.length).toBeGreaterThan(0);
  });

  it('collapses per-context signals and recomputes confidence', () => {
    const { signalsByContext } = extractSignalsFromEvents([
      ev(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, { crop: 'maize' }, 1, { country: 'GH' }),
      ev(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, { crop: 'maize' }, 2, { country: 'GH' }),
      ev(DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED, { crop: 'maize' }, 3, { country: 'GH' }),
    ]);
    const rec = signalsByContext['gh:maize']
      .find((s) => s.signalType === 'recommendation_acceptance');
    expect(rec.sourceCount).toBe(3);
    expect(rec.confidenceScore).toBeGreaterThan(0);
  });

  it('handles empty / invalid input without throwing', () => {
    expect(extractSignalsFromEvents([]).signalsByType).toEqual({});
    expect(extractSignalsFromEvents(null).rollups.totalEvents).toBe(0);
  });
});

describe('extractSignalsForUser / extractSignalsForAllUsers', () => {
  it('aggregates multiple users into a global slice', () => {
    const users = [
      { userId: 'u1', events: [ev(DECISION_EVENT_TYPES.TASK_COMPLETED, {}, 0)] },
      { userId: 'u2', events: [ev(DECISION_EVENT_TYPES.TASK_SKIPPED, {}, 0)] },
    ];
    const out = extractSignalsForAllUsers(users);
    expect(out.byUser.u1.signalsByType.task_completion).toBeDefined();
    expect(out.byUser.u2.signalsByType.task_skip).toBeDefined();
    expect(out.global.signalsByType.task_completion).toHaveLength(1);
    expect(out.global.signalsByType.task_skip).toHaveLength(1);
  });

  it('single user wrapper flows through', () => {
    const out = extractSignalsForUser({
      userId: 'u-3',
      events: [ev(DECISION_EVENT_TYPES.HARVEST_SUBMITTED, { outcomeClass: 'good', crop: 'rice' }, 0, { country: 'IN' })],
    });
    expect(out.signalsByContext['in:rice']).toBeDefined();
  });
});

// ─── Reason store ────────────────────────────────────────
describe('createInMemoryReasonStore', () => {
  it('append + loadFor round-trips', async () => {
    const store = createInMemoryReasonStore();
    await store.append({
      contextKey: 'gh:maize', reason: 'harvest_good',
      signalType: 'harvest_outcome', direction: 'positive',
      weight: 0.8, confidence: 0.9, timestamp: T0,
    });
    const rows = await store.loadFor('gh:maize');
    expect(rows).toHaveLength(1);
    expect(rows[0].reason).toBe('harvest_good');
    expect(rows[0].direction).toBe('positive');
  });

  it('filters by contextKey when provided', async () => {
    const store = createInMemoryReasonStore();
    await store.appendMany([
      { contextKey: 'gh:maize', reason: 'harvest_good', signalType: 'harvest_outcome', timestamp: T0 - 1000 },
      { contextKey: 'gh:rice',  reason: 'harvest_bad',  signalType: 'harvest_outcome', timestamp: T0 - 500 },
    ]);
    const maize = await store.loadFor('gh:maize');
    expect(maize).toHaveLength(1);
    expect(maize[0].reason).toBe('harvest_good');
  });

  it('respects lookbackMs window', async () => {
    const store = createInMemoryReasonStore();
    await store.append({ reason: 'old_reason', signalType: 'harvest_outcome', timestamp: T0 - (200 * 24 * 60 * 60 * 1000) });
    const rows = await store.loadFor(null, { lookbackMs: 30 * 24 * 60 * 60 * 1000, since: undefined });
    // `since` defaults to now - lookback; fake now = Date.now() so
    // a 200-day-old entry is dropped.
    expect(rows).toHaveLength(0);
  });

  it('drops snapshots missing a reason', async () => {
    const store = createInMemoryReasonStore();
    await store.append({ reason: '', signalType: 'x' });
    await store.append({ /* no reason */ signalType: 'x' });
    const rows = await store.loadFor();
    expect(rows).toHaveLength(0);
  });
});

// ─── Engine adapters ─────────────────────────────────────
describe('createRecommendationAdapter', () => {
  it('runs the full pipeline around the provided baseEngine', async () => {
    const recommend = createRecommendationAdapter({
      guardrails: () => ['mango'],
      commodities: () => ['maize'],
      supportTier: () => 'partial',
      confidence: () => ({ level: 'high', score: 85 }),
    });
    const result = await recommend(
      { country: 'GH', mode: 'backyard' },
      () => ({ maize: 0.9, tomato: 0.6, mango: 0.8 }),
    );
    expect(result.value.mango).toBeUndefined();   // guardrailed
    expect(result.value.maize).toBeUndefined();   // backyard commodity lock
    expect(result.value.tomato).toBeGreaterThan(0);
    expect(result.wordingKeys.header).toBe('recommendations.header.high');
  });

  it('throws if baseEngine is not a function', async () => {
    const recommend = createRecommendationAdapter();
    await expect(recommend({}, null)).rejects.toThrow(/baseEngine/);
  });
});

describe('createTaskAdapter', () => {
  it('applies guardrails + wording', async () => {
    const selectTask = createTaskAdapter({
      guardrails: () => ['plant'],
      confidence: () => ({ level: 'low', score: 30 }),
    });
    const result = await selectTask({ mode: 'farm' }, [
      { intent: 'plant', titleKey: 'task.plant' },
      { intent: 'weed',  titleKey: 'task.weed'  },
    ]);
    expect(result.value.map((t) => t.intent)).toEqual(['weed']);
    expect(result.wordingKeys.title).toBe('task.weed.low');
  });
});

describe('createListingAdapter', () => {
  it('honors expiration guardrail and attaches wording', () => {
    const resolve = createListingAdapter({
      confidence: () => ({ level: 'medium' }),
    });
    const result = resolve({}, { state: 'open', expiresAt: Date.now() - 1000 });
    expect(result.value.state).toBe('expired');
    expect(result.wordingKeys.freshness).toBe('listing.freshness.medium');
  });
});

// ─── Router factory ──────────────────────────────────────
describe('createDecisionEngineRouter', () => {
  it('constructs a router with the expected paths', () => {
    const router = createDecisionEngineRouter({
      reasonStore: createInMemoryReasonStore(),
    });
    const paths = router.stack.map((l) => l.route?.path).filter(Boolean);
    expect(paths).toContain('/health');
    expect(paths).toContain('/rules');
    expect(paths).toContain('/extract-signals');
    expect(paths).toContain('/snapshot');
    expect(paths).toContain('/journey');
    expect(paths).toContain('/pipeline/recommend');
    expect(paths).toContain('/reasons/append');
    expect(paths).toContain('/reasons');
  });

  it('router works without a reason store (endpoints return 501)', () => {
    const router = createDecisionEngineRouter();
    expect(router).toBeDefined();
    const paths = router.stack.map((l) => l.route?.path).filter(Boolean);
    expect(paths).toContain('/snapshot');
  });
});
