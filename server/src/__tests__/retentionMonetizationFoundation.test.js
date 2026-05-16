/**
 * retentionMonetizationFoundation.test.js — Phase 8 + Phase 9.
 *
 * Phase 8 — retentionEngine: typed events, never-throws tracker,
 * PII-scrubbed payloads, read-only metrics view.
 * Phase 9 — entitlements: billing seam OFF by default → nothing
 * paywalled; FREE_FOREVER capabilities never gated; monetization
 * flags all false.
 */

import { describe, it, expect } from 'vitest';
import {
  RETENTION_EVENTS,
  trackRetention,
  computeRetentionMetrics,
  computeScanTrustMetrics,
  _internal,
} from '../../../src/core/retention/retentionEngine.js';
import {
  FREE_FOREVER,
  PREMIUM_CAPABILITIES,
  PLAN,
  hasEntitlement,
  getSubscriptionStatus,
} from '../../../src/core/billing/entitlements.js';
import { isFeatureEnabled, _internal as flagInternal } from '../../../src/utils/featureFlags.js';

// ─── Phase 8 — retention engine ────────────────────────────

describe('retentionEngine — event taxonomy', () => {
  it('declares the eleven spec-mandated retention events', () => {
    for (const e of [
      'app_opened', 'daily_briefing_viewed', 'scan_completed', 'scan_failed',
      'task_completed', 'journal_saved', 'notification_opened',
      'produce_listed', 'funding_saved', 'user_inactive_3_days',
      'user_inactive_7_days',
    ]) {
      expect(Object.values(RETENTION_EVENTS)).toContain(e);
    }
  });
});

describe('retentionEngine — trackRetention', () => {
  it('never throws and returns a boolean', () => {
    expect(typeof trackRetention('app_opened', { count: 1 })).toBe('boolean');
    expect(() => trackRetention(null)).not.toThrow();
    expect(trackRetention(null)).toBe(false);
    expect(() => trackRetention('x', 42)).not.toThrow();
  });

  it('scrubs PII / raw-data keys from the payload', () => {
    const scrubbed = _internal._scrub({
      crop: 'maize', count: 3, ok: true,
      imageBase64: 'AAAA', token: 'secret', lat: 5.6, lng: -0.2,
      email: 'a@b.com', nested: { x: 1 },
    });
    expect(scrubbed.crop).toBe('maize');
    expect(scrubbed.count).toBe(3);
    expect(scrubbed.ok).toBe(true);
    // PII / raw-data keys dropped
    expect('imageBase64' in scrubbed).toBe(false);
    expect('token' in scrubbed).toBe(false);
    expect('lat' in scrubbed).toBe(false);
    expect('email' in scrubbed).toBe(false);
    // nested objects dropped (keeps the log tiny)
    expect('nested' in scrubbed).toBe(false);
  });
});

describe('retentionEngine — metrics views', () => {
  it('computeRetentionMetrics returns the documented shape', () => {
    const m = computeRetentionMetrics();
    expect(typeof m.totalEvents).toBe('number');
    expect(typeof m.activeDays).toBe('number');
    expect(typeof m.weeklyActiveDays).toBe('number');
    expect(typeof m.scanCompleted).toBe('number');
    expect(m.byEvent).toBeTruthy();
  });

  it('computeScanTrustMetrics returns rates, never throws', () => {
    const s = computeScanTrustMetrics();
    expect(typeof s.scanTotal).toBe('number');
    expect(typeof s.failureRate).toBe('number');
    expect(typeof s.journalSaveRate).toBe('number');
  });
});

// ─── Phase 9 — monetization foundation ─────────────────────

describe('monetization flags — all OFF by default', () => {
  it('the five Phase 9 flags exist and default false', () => {
    for (const f of [
      'FEATURE_PREMIUM_INTELLIGENCE', 'FEATURE_NGO_SAAS',
      'FEATURE_MARKETPLACE_REVENUE', 'FEATURE_FUNDING_PARTNERS',
      'FEATURE_BILLING',
    ]) {
      expect(flagInternal.DEFAULTS[f]).toBe(false);
      expect(isFeatureEnabled(f)).toBe(false);
    }
  });
});

describe('entitlements — billing seam (placeholder)', () => {
  it('billing is off and nothing is paywalled by default', () => {
    const sub = getSubscriptionStatus();
    expect(sub.billingEnabled).toBe(false);
    expect(sub.status).toBe('none');
    // every premium capability is entitled while billing is off
    for (const cap of PREMIUM_CAPABILITIES) {
      expect(hasEntitlement(cap)).toBe(true);
    }
  });

  it('FREE_FOREVER capabilities are NEVER gated (trust rule §15)', () => {
    for (const cap of FREE_FOREVER) {
      // entitled even if a premium plan check were applied
      expect(hasEntitlement(cap, { plan: PLAN.FREE })).toBe(true);
    }
    expect(FREE_FOREVER).toContain('scan_result');
    expect(FREE_FOREVER).toContain('safety_guidance');
  });

  it('an unknown capability is entitled — never accidentally gated', () => {
    expect(hasEntitlement('some_future_feature')).toBe(true);
    expect(hasEntitlement('')).toBe(true);
  });

  it('never throws on garbage input', () => {
    expect(() => hasEntitlement(null)).not.toThrow();
    expect(() => hasEntitlement(42, 'x')).not.toThrow();
    expect(hasEntitlement(null)).toBe(true);
  });
});
