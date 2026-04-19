/**
 * analyticsValidation.test.js — guardrails on the ingest path.
 * Every event that flows through the analytics endpoint passes
 * analyticsValidationService. These tests lock the contract:
 *
 *   • known types accepted
 *   • unknown types rejected
 *   • funnel events require a step
 *   • banned meta keys rejected
 *   • timestamps must be within ±1h future / 1yr past
 *   • normalized shape is stable
 */

import { describe, it, expect } from 'vitest';
import {
  validateAnalyticsEvent,
  validateBatch,
  _internal,
} from '../services/analytics/analyticsValidationService.js';
import {
  DECISION_EVENT_TYPES,
  FUNNEL_EVENT_TYPES,
  FUNNEL_STEPS,
} from '../services/analytics/decisionEventTypes.js';

const NOW = new Date('2026-04-19T12:00:00Z').getTime();

function baseEvent(type, overrides = {}) {
  return {
    type,
    timestamp: NOW,
    sessionId: 'sess_abc',
    mode: 'farm',
    language: 'en',
    country: 'GH',
    online: true,
    confidence: { level: 'high', score: 88 },
    meta: {},
    ...overrides,
  };
}

describe('validateAnalyticsEvent — happy path', () => {
  it('accepts a well-formed decision event', () => {
    const res = validateAnalyticsEvent(
      baseEvent(DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED, { meta: { crop: 'maize' } }),
      { now: NOW },
    );
    expect(res.valid).toBe(true);
    expect(res.reasons).toEqual([]);
    expect(res.normalized.type).toBe('recommendation_viewed');
    expect(res.normalized.meta).toEqual({ crop: 'maize' });
  });

  it('accepts a funnel step_viewed when step is present', () => {
    const res = validateAnalyticsEvent(
      baseEvent(FUNNEL_EVENT_TYPES.STEP_VIEWED, { meta: { step: FUNNEL_STEPS.LOCATION } }),
      { now: NOW },
    );
    expect(res.valid).toBe(true);
  });

  it('allows online=false', () => {
    const res = validateAnalyticsEvent(
      baseEvent(DECISION_EVENT_TYPES.TASK_COMPLETED, { online: false }),
      { now: NOW },
    );
    expect(res.valid).toBe(true);
    expect(res.normalized.online).toBe(false);
  });
});

describe('validateAnalyticsEvent — rejection paths', () => {
  it('rejects unknown event types', () => {
    const res = validateAnalyticsEvent(baseEvent('totally_made_up'), { now: NOW });
    expect(res.valid).toBe(false);
    expect(res.reasons).toContain('unknown_type');
  });

  it('rejects missing timestamp', () => {
    const res = validateAnalyticsEvent(
      { ...baseEvent(DECISION_EVENT_TYPES.TASK_COMPLETED), timestamp: undefined },
      { now: NOW },
    );
    expect(res.valid).toBe(false);
    expect(res.reasons).toContain('missing_timestamp');
  });

  it('rejects timestamps far in the future', () => {
    const res = validateAnalyticsEvent(
      baseEvent(DECISION_EVENT_TYPES.TASK_COMPLETED, { timestamp: NOW + 3 * 60 * 60 * 1000 }),
      { now: NOW },
    );
    expect(res.valid).toBe(false);
    expect(res.reasons).toContain('timestamp_too_far_future');
  });

  it('rejects ancient timestamps', () => {
    const res = validateAnalyticsEvent(
      baseEvent(DECISION_EVENT_TYPES.TASK_COMPLETED, { timestamp: NOW - 400 * 24 * 60 * 60 * 1000 }),
      { now: NOW },
    );
    expect(res.valid).toBe(false);
    expect(res.reasons).toContain('timestamp_too_old');
  });

  it('rejects funnel event without step', () => {
    const res = validateAnalyticsEvent(
      baseEvent(FUNNEL_EVENT_TYPES.STEP_COMPLETED, { meta: {} }),
      { now: NOW },
    );
    expect(res.valid).toBe(false);
    expect(res.reasons).toContain('funnel_event_missing_step');
  });

  it('rejects funnel event with unknown step', () => {
    const res = validateAnalyticsEvent(
      baseEvent(FUNNEL_EVENT_TYPES.STEP_COMPLETED, { meta: { step: 'made_up_step' } }),
      { now: NOW },
    );
    expect(res.valid).toBe(false);
    expect(res.reasons).toContain('funnel_event_unknown_step');
  });

  it('rejects invalid confidence level', () => {
    const res = validateAnalyticsEvent(
      baseEvent(DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED, {
        confidence: { level: 'maybe', score: 50 },
      }),
      { now: NOW },
    );
    expect(res.valid).toBe(false);
    expect(res.reasons).toContain('invalid_confidence_level');
  });

  it('rejects banned meta keys (PII)', () => {
    const res = validateAnalyticsEvent(
      baseEvent(DECISION_EVENT_TYPES.TASK_COMPLETED, { meta: { email: 'a@b.c', phone: '123' } }),
      { now: NOW },
    );
    expect(res.valid).toBe(false);
    expect(res.reasons.some((r) => r.startsWith('banned_meta_key:'))).toBe(true);
  });

  it('rejects oversized meta', () => {
    const big = 'x'.repeat(_internal.MAX_META_BYTES + 10);
    const res = validateAnalyticsEvent(
      baseEvent(DECISION_EVENT_TYPES.TASK_COMPLETED, { meta: { blob: big } }),
      { now: NOW },
    );
    expect(res.valid).toBe(false);
    expect(res.reasons).toContain('meta_too_large');
  });
});

describe('validateBatch', () => {
  it('splits a mixed batch into accepted / rejected', () => {
    const batch = [
      baseEvent(DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED),
      baseEvent('totally_made_up'),
      baseEvent(FUNNEL_EVENT_TYPES.STEP_COMPLETED, { meta: { step: FUNNEL_STEPS.LOCATION } }),
      baseEvent(FUNNEL_EVENT_TYPES.STEP_COMPLETED, { meta: {} }),
    ];
    const { accepted, rejected } = validateBatch(batch, { now: NOW });
    expect(accepted).toHaveLength(2);
    expect(rejected).toHaveLength(2);
    expect(rejected[0]).toEqual({ index: 1, reasons: ['unknown_type'] });
    expect(rejected[1].index).toBe(3);
  });

  it('handles non-array input', () => {
    const { accepted, rejected } = validateBatch({ nope: true });
    expect(accepted).toEqual([]);
    expect(rejected[0].reasons).toContain('body_not_array');
  });
});

describe('validateAnalyticsEvent — allowlist extension', () => {
  it('accepts caller-supplied extra event types via allowlist', () => {
    const res = validateAnalyticsEvent(
      baseEvent('onboarding_resumed'),
      { now: NOW, allowlist: new Set(['onboarding_resumed']) },
    );
    expect(res.valid).toBe(true);
  });
});
