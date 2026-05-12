/**
 * safeTrack.test.js — pins the URL-runtime-elimination spec §2
 * contract for the analytics tracker.
 *
 *   1. resolveAnalyticsEndpoint returns null when nothing usable.
 *   2. safeTrack returns { skipped, reason } for empty event.
 *   3. safeTrack returns { skipped, reason: 'no_endpoint' } when
 *      no base AND no window.location.
 *   4. safeTrack returns { skipped, reason: 'no_fetch' } when
 *      fetch isn't available.
 *   5. safeTrack swallows fetch failures.
 *   6. safeTrack NEVER throws.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_WINDOW = globalThis.window;

beforeEach(() => {
  globalThis.fetch = vi.fn(async () => ({ ok: true }));
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  globalThis.window = ORIGINAL_WINDOW;
});

describe('safeTrack — URL safety + silent failure', () => {
  it('skips empty event names', async () => {
    const { safeTrack } = await import('../../../src/lib/analytics/safeTrack.js');
    expect(await safeTrack('')).toEqual({ skipped: true, reason: 'invalid_event' });
    expect(await safeTrack(null)).toEqual({ skipped: true, reason: 'invalid_event' });
    expect(await safeTrack(undefined)).toEqual({ skipped: true, reason: 'invalid_event' });
  });

  it('skips when no endpoint can be resolved (no env + no window)', async () => {
    globalThis.window = undefined;
    const { safeTrack } = await import('../../../src/lib/analytics/safeTrack.js');
    const r = await safeTrack('boot');
    expect(r.skipped).toBe(true);
    expect(r.reason).toBe('no_endpoint');
  });

  it('skips when fetch is unavailable', async () => {
    globalThis.window = { location: { origin: 'https://farroway.app' } };
    globalThis.fetch = undefined;
    const { safeTrack } = await import('../../../src/lib/analytics/safeTrack.js');
    const r = await safeTrack('boot');
    expect(r.skipped).toBe(true);
    expect(r.reason).toBe('no_fetch');
  });

  it('sends through fetch when endpoint resolves + fetch present', async () => {
    globalThis.window = { location: { origin: 'https://farroway.app' } };
    const calls = [];
    globalThis.fetch = vi.fn(async (url, opts) => {
      calls.push({ url, opts });
      return { ok: true };
    });
    const { safeTrack } = await import('../../../src/lib/analytics/safeTrack.js');
    const r = await safeTrack('boot', { x: 1 });
    expect(r).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/api\/v2\/analytics\/track$/);
    expect(calls[0].opts.method).toBe('POST');
  });

  it('NEVER throws when fetch rejects', async () => {
    globalThis.window = { location: { origin: 'https://farroway.app' } };
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('network down')));
    const { safeTrack } = await import('../../../src/lib/analytics/safeTrack.js');
    // .catch(() => {}) inside safeTrack swallows the rejection, so
    // the call returns { ok: true } not error — that's the spec's
    // "never throws / fail silently" contract.
    await expect(safeTrack('boot')).resolves.toBeDefined();
  });

  it('NEVER throws when fetch throws synchronously', async () => {
    globalThis.window = { location: { origin: 'https://farroway.app' } };
    globalThis.fetch = vi.fn(() => { throw new Error('sync boom'); });
    const { safeTrack } = await import('../../../src/lib/analytics/safeTrack.js');
    await expect(safeTrack('boot')).resolves.toBeDefined();
  });
});

describe('resolveAnalyticsEndpoint', () => {
  it('returns null when window + env are both missing', async () => {
    globalThis.window = undefined;
    const { resolveAnalyticsEndpoint } = await import('../../../src/lib/analytics/safeTrack.js');
    expect(resolveAnalyticsEndpoint()).toBeNull();
  });

  it('returns a URL when window.location.origin is present', async () => {
    globalThis.window = { location: { origin: 'https://farroway.app' } };
    const { resolveAnalyticsEndpoint } = await import('../../../src/lib/analytics/safeTrack.js');
    const url = resolveAnalyticsEndpoint();
    expect(url).not.toBeNull();
    expect(url.pathname).toBe('/api/v2/analytics/track');
  });
});
