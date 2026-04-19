/**
 * analyticsBufferAndConfidence.test.js — client-side utilities
 * that still run cleanly under Node/Vitest (no React mount needed).
 *
 * Covers:
 *   • analyticsBuffer FIFO + dedup + size cap
 *   • getLocationConfidence tiers
 *   • getListingConfidence freshness tiers
 *   • confidenceWording key mapping
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// jsdom isn't needed — we polyfill a tiny localStorage so the
// buffer's storage path runs in-process.
function installLocalStorage() {
  const store = new Map();
  const fake = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  globalThis.window = { localStorage: fake, addEventListener() {}, removeEventListener() {} };
  globalThis.localStorage = fake;
  return store;
}

describe('analyticsBuffer', () => {
  let store;
  beforeEach(() => { store = installLocalStorage(); });

  it('enqueue + peek + count work', async () => {
    const mod = await import('../../../src/utils/analyticsBuffer.js');
    mod.clearAnalyticsBuffer();
    mod.enqueueAnalyticsEvent({ type: 'task_completed', timestamp: 1 });
    mod.enqueueAnalyticsEvent({ type: 'task_skipped',   timestamp: 2 });
    expect(mod.bufferedAnalyticsCount()).toBe(2);
    expect(mod.peekAnalyticsBuffer().map((e) => e.type))
      .toEqual(['task_completed', 'task_skipped']);
  });

  it('flush drains successfully, dedup prevents re-send', async () => {
    const mod = await import('../../../src/utils/analyticsBuffer.js');
    mod.clearAnalyticsBuffer();
    mod.enqueueAnalyticsEvent({ type: 'task_completed', timestamp: 1 });

    const sent = vi.fn(async () => true);
    const res = await mod.flushAnalyticsBuffer(sent);
    expect(res.sent).toBe(1);
    expect(mod.bufferedAnalyticsCount()).toBe(0);

    // Simulating a duplicate enqueue of the same key shouldn't re-send.
    const key = mod._internal.loadAcked().at(-1);
    mod.enqueueAnalyticsEvent({ type: 'task_completed', timestamp: 1, clientKey: key });
    const res2 = await mod.flushAnalyticsBuffer(sent);
    expect(res2.sent).toBe(0);
    expect(res2.skipped).toBe(1);
    expect(sent).toHaveBeenCalledTimes(1);
  });

  it('failed sends leave the event in the buffer', async () => {
    const mod = await import('../../../src/utils/analyticsBuffer.js');
    mod.clearAnalyticsBuffer();
    mod.enqueueAnalyticsEvent({ type: 'task_completed', timestamp: 1 });
    const sent = vi.fn(async () => false);
    const res = await mod.flushAnalyticsBuffer(sent);
    expect(res.sent).toBe(0);
    expect(res.failed).toBe(1);
    expect(mod.bufferedAnalyticsCount()).toBe(1);
  });

  it('hard-caps at MAX_BUFFER entries', async () => {
    const mod = await import('../../../src/utils/analyticsBuffer.js');
    mod.clearAnalyticsBuffer();
    for (let i = 0; i < mod._internal.MAX_BUFFER + 50; i++) {
      mod.enqueueAnalyticsEvent({ type: 'task_completed', timestamp: i });
    }
    expect(mod.bufferedAnalyticsCount()).toBe(mod._internal.MAX_BUFFER);
  });
});

describe('getLocationConfidence', () => {
  it('high when detect + confirmed + tight GPS + full support', async () => {
    const { getLocationConfidence } = await import('../../../src/utils/getLocationConfidence.js');
    const c = getLocationConfidence({
      source: 'detect', confirmed: true, accuracyM: 30,
      countryCode: 'GH', stateCode: 'AR', supportTier: 'full',
      staleHours: 1,
    });
    expect(c.level).toBe('high');
    expect(c.reasons).toContain('gps_tight');
  });

  it('medium for manual + confirmed + full support', async () => {
    const { getLocationConfidence } = await import('../../../src/utils/getLocationConfidence.js');
    const c = getLocationConfidence({
      source: 'manual', confirmed: true, countryCode: 'IN', supportTier: 'full',
    });
    expect(['medium', 'high']).toContain(c.level);
  });

  it('low when source unknown + no country', async () => {
    const { getLocationConfidence } = await import('../../../src/utils/getLocationConfidence.js');
    const c = getLocationConfidence({});
    expect(c.level).toBe('low');
    expect(c.reasons).toContain('location_source_unknown');
    expect(c.reasons).toContain('country_missing');
  });
});

describe('getListingConfidence', () => {
  it('high when fresh + complete + verified', async () => {
    const { getListingConfidence } = await import('../../../src/utils/getListingConfidence.js');
    const now = Date.now();
    const c = getListingConfidence({
      updatedAt: now - 1000 * 60 * 60, // 1h ago
      completenessScore: 0.95,
      sellerVerified: true,
      quantityRemaining: 100,
    }, now);
    expect(c.level).toBe('high');
  });

  it('low when expired', async () => {
    const { getListingConfidence } = await import('../../../src/utils/getListingConfidence.js');
    const now = Date.now();
    const c = getListingConfidence({
      updatedAt: now - 1000 * 60 * 60,
      expiresAt: now - 1000 * 60,
    }, now);
    expect(c.level).toBe('low');
    expect(c.reasons).toContain('listing_expired');
  });

  it('low when out of stock', async () => {
    const { getListingConfidence } = await import('../../../src/utils/getListingConfidence.js');
    const now = Date.now();
    const c = getListingConfidence({
      updatedAt: now - 1000 * 60 * 60,
      quantityRemaining: 0,
    }, now);
    expect(c.level).toBe('low');
    expect(c.reasons).toContain('listing_no_stock');
  });
});

describe('confidenceWording', () => {
  it('recommendation header scales by level', async () => {
    const w = await import('../../../src/utils/confidenceWording.js');
    expect(w.recommendationHeaderKey({ level: 'high' }).key).toBe('recommendations.header.high');
    expect(w.recommendationHeaderKey({ level: 'medium' }).key).toBe('recommendations.header.medium');
    expect(w.recommendationHeaderKey({ level: 'low' }).key).toBe('recommendations.header.low');
  });

  it('returns medium when confidence is missing', async () => {
    const w = await import('../../../src/utils/confidenceWording.js');
    expect(w.recommendationHeaderKey(null).key).toBe('recommendations.header.medium');
  });

  it('wordingForConfidence builds variant keys', async () => {
    const w = await import('../../../src/utils/confidenceWording.js');
    expect(w.wordingForConfidence('task.plant', { level: 'low' }))
      .toBe('task.plant.low');
  });
});

describe('client-side getLikelyDropOffStage mirrors server', () => {
  it('returns the same inference for an identical event list', async () => {
    const client = await import('../../../src/utils/getLikelyDropOffStage.js');
    const server = await import('../services/analytics/dropOffDetectionService.js');
    const events = [
      { type: 'funnel_step_viewed', timestamp: 1, meta: { step: 'welcome' } },
      { type: 'funnel_step_viewed', timestamp: 2, meta: { step: 'location' } },
      { type: 'onboarding_location_permission_denied', timestamp: 3, meta: {} },
    ];
    const a = client.getLikelyDropOffStage(events, 10);
    const b = server.getLikelyDropOffStage(events, 10);
    expect(a.stage).toBe(b.stage);
    expect(a.reason).toBe(b.reason);
  });
});
