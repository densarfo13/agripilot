/**
 * sentinelHubService.test.js — locks the Sentinel Hub OAuth + NDVI retry
 * hardening (2026-07-09). All network is mocked (global fetch); no live
 * Sentinel Hub call is made. Covers: happy path, retry-once on an expired
 * token (401), invalid credentials, invalid coordinates, and a permanent
 * 401 (proves the retry does not loop).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchNDVI, invalidateToken } from '../services/satellite/sentinelHubService.js';

const meanBody = (mean) => ({
  data: [{ outputs: { default: { bands: { B0: { stats: { mean } } } } } }],
});
const resp = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

let tokenCalls = 0;
let statsCalls = 0;
let statsQueue = [];

beforeEach(() => {
  process.env.SENTINEL_HUB_CLIENT_ID = 'test-client-id';
  process.env.SENTINEL_HUB_CLIENT_SECRET = 'test-client-secret';
  invalidateToken();              // reset the module-level token cache
  tokenCalls = 0;
  statsCalls = 0;
  statsQueue = [];
  globalThis.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('/oauth/token')) {
      tokenCalls += 1;
      return resp(200, { access_token: 'tok-' + tokenCalls, expires_in: 3600 });
    }
    if (u.includes('/api/v1/statistics')) {
      statsCalls += 1;
      return statsQueue.shift() || resp(200, meanBody(0.5));
    }
    return resp(404, {});
  });
});

describe('fetchNDVI — happy path', () => {
  it('returns the mean NDVI from a single token + stats call', async () => {
    statsQueue = [resp(200, meanBody(0.62))];
    const out = await fetchNDVI({ latitude: 6.2, longitude: -1.1 });
    expect(out.data).toEqual([0.62]);
    expect(tokenCalls).toBe(1);
    expect(statsCalls).toBe(1);
  });
});

describe('fetchNDVI — AUTH retry once on expiration', () => {
  it('on a 401, invalidates the token, refetches, and retries the stats call exactly once', async () => {
    statsQueue = [resp(401, { error: 'token_expired' }), resp(200, meanBody(0.55))];
    const out = await fetchNDVI({ latitude: 6.2, longitude: -1.1 });
    expect(out.data).toEqual([0.55]);
    expect(statsCalls).toBe(2);   // first 401 + one retry
    expect(tokenCalls).toBe(2);   // initial token + one refresh after invalidate
  });

  it('does NOT loop — a permanent 401 fails after exactly one retry', async () => {
    statsQueue = [resp(401, {}), resp(401, {})];
    await expect(fetchNDVI({ latitude: 6.2, longitude: -1.1 }))
      .rejects.toThrow('Sentinel NDVI request failed');
    expect(statsCalls).toBe(2);
  });
});

describe('fetchNDVI — graceful failure (never silent, never fabricated)', () => {
  it('throws on missing credentials without hitting the stats API', async () => {
    delete process.env.SENTINEL_HUB_CLIENT_ID;
    delete process.env.SENTINEL_HUB_CLIENT_SECRET;
    await expect(fetchNDVI({ latitude: 6.2, longitude: -1.1 }))
      .rejects.toThrow('Missing Sentinel Hub OAuth credentials');
    expect(statsCalls).toBe(0);
  });

  it('rejects invalid coordinates before any network call', async () => {
    await expect(fetchNDVI({ latitude: 'not-a-number', longitude: -1.1 }))
      .rejects.toThrow('Invalid latitude or longitude');
    expect(tokenCalls).toBe(0);
    expect(statsCalls).toBe(0);
  });

  it('returns empty data (never a fabricated value) when the stats mean is absent', async () => {
    statsQueue = [resp(200, { data: [{ outputs: { default: { bands: { B0: { stats: {} } } } } }] })];
    const out = await fetchNDVI({ latitude: 6.2, longitude: -1.1 });
    expect(out.data).toEqual([]);
  });
});
