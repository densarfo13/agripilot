/**
 * realWorldReliability.test.js — Real-World Reliability +
 * Operational Usefulness gap fix. Covers the recommendation
 * ranking extension, regional review seam, offline queue,
 * feedback facade, and notification telemetry counters.
 */

// localStorage / window shim for offlineStore-backed tests
const _s = new Map();
const _ls = {
  getItem:    (k) => (_s.has(k) ? _s.get(k) : null),
  setItem:    (k, v) => { _s.set(k, String(v)); },
  removeItem: (k) => { _s.delete(k); },
  clear:      () => { _s.clear(); },
};
if (typeof globalThis.window === 'undefined') globalThis.window = { localStorage: _ls };
else if (!globalThis.window.localStorage) globalThis.window.localStorage = _ls;
if (typeof globalThis.localStorage === 'undefined') globalThis.localStorage = _ls;

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RECOMMENDATION_PRIORITY, rankRecommendations, pickPrimaryRecommendation,
  isStaleRecommendation, explainRecommendation, scoreRecommendation,
} from '../../../src/core/recommendations/recommendationRankingEngine.js';
import {
  REGION_KEYS, getRegionalReviewStatus, isRegionExpertReviewed,
} from '../../../src/core/agronomy/regionalGuidanceReview.js';
import {
  QUEUE_KIND, enqueue, peek, drain, markSynced, getPending, pendingCount, clearQueue,
} from '../../../src/core/offline/offlineQueue.js';
import {
  FEEDBACK_CONTEXT,
  saveScanFeedback, saveTaskFeedback, saveNotificationFeedback,
  getFeedbackSummary,
} from '../../../src/core/feedback/feedbackStore.js';
import {
  NOTIF_OUTCOME,
  recordNotificationOutcome, getNotificationTelemetry, resetNotificationTelemetry,
} from '../../../src/core/notifications/notificationTelemetry.js';

// ─── §2 — recommendation ranking extension ─────────────────

describe('recommendationRankingEngine — v3 extensions', () => {
  it('watering is between overdue_task and crop_stage_task', () => {
    expect(RECOMMENDATION_PRIORITY.overdue_task).toBeLessThan(RECOMMENDATION_PRIORITY.watering);
    expect(RECOMMENDATION_PRIORITY.watering).toBeLessThan(RECOMMENDATION_PRIORITY.crop_stage_task);
  });

  it('rankRecommendations places watering above crop-stage', () => {
    const ranked = rankRecommendations([
      { type: 'crop_stage_task', id: 'c1' },
      { type: 'watering', id: 'w1' },
      { type: 'overdue_task', id: 'o1' },
    ]);
    expect(ranked[0].type).toBe('overdue_task');
    expect(ranked[1].type).toBe('watering');
    expect(ranked[2].type).toBe('crop_stage_task');
  });

  it('dropStale opt-in filters out aged recommendations', () => {
    const now = Date.UTC(2026, 4, 21, 12, 0);
    const fresh = { type: 'watering', id: 'f', createdAt: now - 1000 };
    const stale = { type: 'watering', id: 's', createdAt: now - 50 * 3600 * 1000 };
    const r = rankRecommendations([fresh, stale], {
      dropStale: true, maxAgeMs: 12 * 3600 * 1000, nowMs: now,
    });
    expect(r.length).toBe(1);
    expect(r[0].id).toBe('f');
  });

  it('withExplanation enriches each result with score + explanation', () => {
    const r = rankRecommendations([{ type: 'urgent_scan_followup', id: 'a' }], {
      withExplanation: true,
    });
    expect(r[0].score).toBeGreaterThan(0.9);
    expect(typeof r[0].explanation).toBe('string');
    expect(r[0].explanation.length).toBeGreaterThan(0);
  });

  it('isStaleRecommendation defaults to not-stale when there is no timestamp', () => {
    expect(isStaleRecommendation({ type: 'watering' })).toBe(false);
  });

  it('explainRecommendation returns a calm sentence for known types', () => {
    expect(explainRecommendation({ type: 'watering' })).toMatch(/watering|soil/i);
    expect(explainRecommendation(null)).toMatch(/check/i);
  });

  it('scoreRecommendation: rank 1 → near 1.0, rank 7 → near 0', () => {
    expect(scoreRecommendation({ type: 'urgent_scan_followup' })).toBeGreaterThan(0.9);
    expect(scoreRecommendation({ type: 'market_opportunity' })).toBeLessThan(0.2);
    expect(scoreRecommendation({ type: 'unknown' })).toBe(0);
  });

  it('pickPrimaryRecommendation still returns the top', () => {
    const top = pickPrimaryRecommendation([
      { type: 'market_opportunity', id: 'm' },
      { type: 'urgent_scan_followup', id: 'u' },
    ]);
    expect(top.type).toBe('urgent_scan_followup');
  });
});

// ─── §3 — regional guidance review seam ────────────────────

describe('regionalGuidanceReview — honest unreviewed default', () => {
  it('no region has any category formally reviewed yet', () => {
    for (const region of REGION_KEYS) {
      expect(isRegionExpertReviewed(region, 'fungal')).toBe(false);
      const s = getRegionalReviewStatus(region, 'fungal');
      expect(s.reviewed).toBe(false);
      expect(s.source).toBe('community-pattern');
    }
  });

  it('normalises a country name into a regional key', () => {
    expect(getRegionalReviewStatus('Ghana', 'fungal').region).toBe('west_africa');
    expect(getRegionalReviewStatus('kenya', 'pest').region).toBe('east_africa');
  });

  it('never throws on garbage input', () => {
    expect(() => getRegionalReviewStatus(null, null)).not.toThrow();
    expect(getRegionalReviewStatus(null, null).reviewed).toBe(false);
  });
});

// ─── §5 — offline queue ────────────────────────────────────

describe('offlineQueue — durable pending actions', () => {
  beforeEach(() => { _s.clear(); clearQueue(); });

  it('enqueue → peek → markSynced removes the entry', () => {
    const e = enqueue({ kind: QUEUE_KIND.SCAN, payload: { id: 's1' } });
    expect(e.kind).toBe('scan');
    expect(pendingCount()).toBe(1);
    expect(peek().id).toBe(e.id);
    markSynced(e.id);
    expect(pendingCount()).toBe(0);
  });

  it('dedupes by (kind, payload.id) — retries do not queue twice', () => {
    enqueue({ kind: QUEUE_KIND.TASK_COMPLETE, payload: { id: 't1' } });
    enqueue({ kind: QUEUE_KIND.TASK_COMPLETE, payload: { id: 't1' } });
    expect(pendingCount()).toBe(1);
  });

  it('different kinds with same payload.id stay separate', () => {
    enqueue({ kind: QUEUE_KIND.SCAN, payload: { id: 'x' } });
    enqueue({ kind: QUEUE_KIND.JOURNAL, payload: { id: 'x' } });
    expect(pendingCount()).toBe(2);
  });

  it('drain handler success removes entries; failure preserves them', async () => {
    enqueue({ kind: QUEUE_KIND.WATERING, payload: { id: 'w1' } });
    enqueue({ kind: QUEUE_KIND.WATERING, payload: { id: 'w2' } });
    const result = await drain(async (e) => e.payload.id === 'w1');
    expect(result.synced).toBe(1);
    expect(result.failed).toBe(1);
    expect(pendingCount()).toBe(1);
    expect(peek().payload.id).toBe('w2');
  });

  it('a throwing handler is treated as failure — never breaks the loop', async () => {
    enqueue({ kind: QUEUE_KIND.FEEDBACK, payload: { id: 'f1' } });
    const result = await drain(() => { throw new Error('boom'); });
    expect(result.failed).toBe(1);
    expect(pendingCount()).toBe(1);
    expect(peek().attempts).toBe(1);
  });

  it('preserves timestamps across the queue lifecycle', () => {
    const created = 1_700_000_000_000;
    const e = enqueue({ kind: QUEUE_KIND.JOURNAL, payload: {}, createdAt: created });
    expect(e.createdAt).toBe(created);
    expect(getPending()[0].createdAt).toBe(created);
  });

  it('never throws on garbage input', () => {
    expect(() => enqueue(null)).not.toThrow();
    expect(enqueue(null)).toBe(null);
  });
});

// ─── §4 — feedback facade ──────────────────────────────────

describe('feedbackStore — typed pilot feedback facade', () => {
  beforeEach(() => { _s.clear(); });

  it('saveScanFeedback writes scan-typed entries', () => {
    expect(saveScanFeedback({
      scanId: 's1', helpful: true, didRetake: false, didManualPick: false,
    })).toBe(true);
    const sum = getFeedbackSummary();
    expect(sum.total).toBeGreaterThan(0);
    expect(sum.byContext[FEEDBACK_CONTEXT.SCAN]).toBeGreaterThanOrEqual(1);
  });

  it('saveTaskFeedback + saveNotificationFeedback each write a typed entry', () => {
    saveTaskFeedback({ taskId: 't1', useful: true, completed: true });
    saveNotificationFeedback({ notificationId: 'n1', helpful: true, actioned: true });
    const sum = getFeedbackSummary();
    expect(sum.byContext[FEEDBACK_CONTEXT.TASK]).toBeGreaterThanOrEqual(1);
    expect(sum.byContext[FEEDBACK_CONTEXT.NOTIFICATION]).toBeGreaterThanOrEqual(1);
  });

  it('never throws on garbage input', () => {
    expect(() => saveScanFeedback(null)).not.toThrow();
    expect(saveScanFeedback(null)).toBe(true);
  });
});

// ─── §6 — notification telemetry ───────────────────────────

describe('notificationTelemetry — outcome counters + rates', () => {
  beforeEach(() => resetNotificationTelemetry());

  it('counts outcomes and computes open/action/ignore rates', () => {
    for (const _ of [0, 0, 0, 0]) recordNotificationOutcome(NOTIF_OUTCOME.GENERATED);
    for (const _ of [0, 0, 0]) recordNotificationOutcome(NOTIF_OUTCOME.DELIVERED);
    recordNotificationOutcome(NOTIF_OUTCOME.OPENED);
    recordNotificationOutcome(NOTIF_OUTCOME.ACTION_TAKEN);
    recordNotificationOutcome(NOTIF_OUTCOME.IGNORED);
    recordNotificationOutcome(NOTIF_OUTCOME.SUPPRESSED);

    const t = getNotificationTelemetry();
    expect(t.counts.generated).toBe(4);
    expect(t.counts.delivered).toBe(3);
    expect(t.openRate).toBeGreaterThan(0);
    expect(t.actionRate).toBeGreaterThan(0);
    expect(t.ignoreRate).toBeGreaterThan(0);
    expect(t.suppressRate).toBeGreaterThan(0);
  });

  it('rates are 0 with no data — no division-by-zero', () => {
    const t = getNotificationTelemetry();
    expect(t.openRate).toBe(0);
    expect(t.actionRate).toBe(0);
    expect(t.suppressRate).toBe(0);
  });

  it('never throws on bogus input', () => {
    expect(() => recordNotificationOutcome(null)).not.toThrow();
    expect(recordNotificationOutcome(undefined)).toBe(false);
  });
});
