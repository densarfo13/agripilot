/**
 * ambeeSoilService.test.js — pins the Ambee Soil integration contract:
 *
 *   1. Normalises real-shape responses to the calm 4-field shape.
 *   2. Raw API fields NEVER surface in the output.
 *   3. 6-hour cache: repeat calls inside TTL skip the fetcher.
 *   4. Cache miss after TTL expiry hits the fetcher again.
 *   5. Per-coord rounding: nearby coords share a cache key.
 *   6. Missing API key → null silently.
 *   7. Bad coordinates → null silently.
 *   8. Network error → null silently.
 *   9. Non-2xx response → null silently.
 *  10. Malformed response → null silently.
 *  11. Moisture risk derivation matches the documented bands.
 *  12. Service NEVER throws.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchSoilFromAmbee,
  normalizeAmbeeResponse,
  _clearAmbeeCache,
  CACHE_TTL_MS,
} from '../services/soil/ambeeSoilService.js';

const VALID_API_KEY = 'test-key';

function _okResponse(body) {
  return {
    ok:     true,
    status: 200,
    json:   async () => body,
  };
}

function _failResponse(status) {
  return {
    ok:     false,
    status,
    json:   async () => ({ error: 'soil api error' }),
  };
}

const _AMBEE_REAL_SHAPE = (overrides = {}) => ({
  message: 'success',
  data: [{
    lat:                    5.6037,
    lng:                   -0.1870,
    soilWaterLevel:         0.25,
    soilTemperatureLevel:   27.5,
    createdAt:              '2026-05-12T10:00:00Z',
    updatedAt:              '2026-05-12T10:00:00Z',
    ...overrides,
  }],
});

beforeEach(() => {
  _clearAmbeeCache();
});

// ─── Normaliser ───────────────────────────────────────────────

describe('normalizeAmbeeResponse — shape + safety', () => {
  it('extracts moisture + temperature from the real Ambee envelope', () => {
    const r = normalizeAmbeeResponse(_AMBEE_REAL_SHAPE());
    expect(r).not.toBeNull();
    expect(r.soilMoisture).toBe(0.25);
    expect(r.soilTemperature).toBe(27.5);
    expect(r.moistureRisk).toBe('low');
    expect(r.farmingHint).toMatch(/stable/i);
  });

  it('accepts data as a single object (defensive)', () => {
    const r = normalizeAmbeeResponse({
      data: { soilWaterLevel: 0.30, soilTemperatureLevel: 25.0 },
    });
    expect(r.soilMoisture).toBe(0.30);
  });

  it('accepts a stripped envelope (no `data` wrapper)', () => {
    const r = normalizeAmbeeResponse({ soilWaterLevel: 0.20, soilTemperatureLevel: 25.0 });
    expect(r.soilMoisture).toBe(0.20);
  });

  it('returns null on null / non-object / missing fields', () => {
    expect(normalizeAmbeeResponse(null)).toBeNull();
    expect(normalizeAmbeeResponse('string')).toBeNull();
    expect(normalizeAmbeeResponse({})).toBeNull();
    expect(normalizeAmbeeResponse({ data: [] })).toBeNull();
    expect(normalizeAmbeeResponse({ data: [{ unrelated: 'field' }] })).toBeNull();
  });

  it('output contains ONLY the 4 canonical fields (raw response never leaks)', () => {
    const r = normalizeAmbeeResponse(_AMBEE_REAL_SHAPE({
      createdAt: 'SHOULD_NOT_LEAK',
      lat: 999,
      lng: 999,
    }));
    expect(Object.keys(r).sort()).toEqual([
      'farmingHint', 'moistureRisk', 'soilMoisture', 'soilTemperature',
    ]);
    expect(r.createdAt).toBeUndefined();
    expect(r.lat).toBeUndefined();
    expect(r.lng).toBeUndefined();
  });

  it('result is frozen — callers cannot mutate canonical values', () => {
    const r = normalizeAmbeeResponse(_AMBEE_REAL_SHAPE());
    expect(Object.isFrozen(r)).toBe(true);
  });

  it('rounds soilMoisture to 3 decimals + soilTemperature to 1 decimal', () => {
    const r = normalizeAmbeeResponse({
      data: [{ soilWaterLevel: 0.234567, soilTemperatureLevel: 27.456 }],
    });
    expect(r.soilMoisture).toBe(0.235);
    expect(r.soilTemperature).toBe(27.5);
  });
});

// ─── Moisture risk bands ──────────────────────────────────────

describe('moisture risk derivation bands', () => {
  it('< 0.10 → high (drought risk)', () => {
    const r = normalizeAmbeeResponse({ data: [{ soilWaterLevel: 0.05, soilTemperatureLevel: 25 }] });
    expect(r.moistureRisk).toBe('high');
  });

  it('0.10–0.20 → medium', () => {
    const r = normalizeAmbeeResponse({ data: [{ soilWaterLevel: 0.15, soilTemperatureLevel: 25 }] });
    expect(r.moistureRisk).toBe('medium');
  });

  it('0.20–0.35 → low (balanced)', () => {
    const r = normalizeAmbeeResponse({ data: [{ soilWaterLevel: 0.25, soilTemperatureLevel: 25 }] });
    expect(r.moistureRisk).toBe('low');
  });

  it('> 0.35 → high (waterlogging risk)', () => {
    const r = normalizeAmbeeResponse({ data: [{ soilWaterLevel: 0.40, soilTemperatureLevel: 25 }] });
    expect(r.moistureRisk).toBe('high');
  });

  it('drought + heat composes the "may dry quickly" hint', () => {
    const r = normalizeAmbeeResponse({ data: [{ soilWaterLevel: 0.05, soilTemperatureLevel: 32 }] });
    expect(r.farmingHint.toLowerCase()).toMatch(/dry quickly/);
  });

  it('drought without heat → "check soil before watering"', () => {
    const r = normalizeAmbeeResponse({ data: [{ soilWaterLevel: 0.05, soilTemperatureLevel: 18 }] });
    expect(r.farmingHint.toLowerCase()).toMatch(/check soil before watering/);
  });

  it('waterlogging → "ease back on irrigation"', () => {
    const r = normalizeAmbeeResponse({ data: [{ soilWaterLevel: 0.40, soilTemperatureLevel: 25 }] });
    expect(r.farmingHint.toLowerCase()).toMatch(/ease back/);
  });
});

// ─── fetchSoilFromAmbee — happy path ──────────────────────────

describe('fetchSoilFromAmbee — happy path', () => {
  it('returns normalized soil context on a successful API call', async () => {
    const fetcher = vi.fn(async () => _okResponse(_AMBEE_REAL_SHAPE()));
    const r = await fetchSoilFromAmbee(5.6, -0.18, {
      apiKey: VALID_API_KEY,
      fetcher,
    });
    expect(r).not.toBeNull();
    expect(r.soilMoisture).toBe(0.25);
    expect(r.farmingHint).toBeTruthy();
  });

  it('forwards the API key as x-api-key header', async () => {
    let capturedInit = null;
    const fetcher = vi.fn(async (_url, init) => {
      capturedInit = init;
      return _okResponse(_AMBEE_REAL_SHAPE());
    });
    await fetchSoilFromAmbee(5.6, -0.18, { apiKey: VALID_API_KEY, fetcher });
    expect(capturedInit.headers['x-api-key']).toBe(VALID_API_KEY);
    expect(capturedInit.method).toBe('GET');
  });

  it('passes lat + lng in the query string', async () => {
    let capturedUrl = null;
    const fetcher = vi.fn(async (url) => {
      capturedUrl = url;
      return _okResponse(_AMBEE_REAL_SHAPE());
    });
    await fetchSoilFromAmbee(5.6, -0.18, { apiKey: VALID_API_KEY, fetcher });
    expect(capturedUrl).toContain('lat=5.6');
    expect(capturedUrl).toContain('lng=-0.18');
  });
});

// ─── Cache behaviour ──────────────────────────────────────────

describe('fetchSoilFromAmbee — 6-hour cache', () => {
  it('repeat call inside TTL skips the fetcher', async () => {
    const fetcher = vi.fn(async () => _okResponse(_AMBEE_REAL_SHAPE()));
    const t0 = 1_000_000;
    await fetchSoilFromAmbee(5.6, -0.18, { apiKey: VALID_API_KEY, fetcher, nowMs: t0 });
    await fetchSoilFromAmbee(5.6, -0.18, { apiKey: VALID_API_KEY, fetcher, nowMs: t0 + 1000 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('cache miss after TTL expiry hits the fetcher again', async () => {
    const fetcher = vi.fn(async () => _okResponse(_AMBEE_REAL_SHAPE()));
    const t0 = 1_000_000;
    await fetchSoilFromAmbee(5.6, -0.18, { apiKey: VALID_API_KEY, fetcher, nowMs: t0 });
    // Past TTL.
    await fetchSoilFromAmbee(5.6, -0.18, {
      apiKey: VALID_API_KEY, fetcher, nowMs: t0 + CACHE_TTL_MS + 1,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('nearby coords share a cache key (rounded to ~1km)', async () => {
    const fetcher = vi.fn(async () => _okResponse(_AMBEE_REAL_SHAPE()));
    // Both coords round to "5.60,-0.18" at 2-decimal precision.
    await fetchSoilFromAmbee(5.6012, -0.1812, { apiKey: VALID_API_KEY, fetcher });
    await fetchSoilFromAmbee(5.6045, -0.1841, { apiKey: VALID_API_KEY, fetcher });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('far-apart coords use separate cache keys', async () => {
    const fetcher = vi.fn(async () => _okResponse(_AMBEE_REAL_SHAPE()));
    await fetchSoilFromAmbee(5.6, -0.18, { apiKey: VALID_API_KEY, fetcher });
    await fetchSoilFromAmbee(9.0, -2.0, { apiKey: VALID_API_KEY, fetcher });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('bypassCache option forces a fresh fetch', async () => {
    const fetcher = vi.fn(async () => _okResponse(_AMBEE_REAL_SHAPE()));
    await fetchSoilFromAmbee(5.6, -0.18, { apiKey: VALID_API_KEY, fetcher });
    await fetchSoilFromAmbee(5.6, -0.18, {
      apiKey: VALID_API_KEY, fetcher, bypassCache: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

// ─── Failure paths — all return null silently ─────────────────

describe('fetchSoilFromAmbee — graceful null fallback', () => {
  it('returns null when API key is missing', async () => {
    const fetcher = vi.fn();
    const r = await fetchSoilFromAmbee(5.6, -0.18, { apiKey: '', fetcher });
    expect(r).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('returns null on bad coordinates', async () => {
    const fetcher = vi.fn();
    expect(await fetchSoilFromAmbee(NaN, -0.18, { apiKey: VALID_API_KEY, fetcher })).toBeNull();
    expect(await fetchSoilFromAmbee(5.6, undefined, { apiKey: VALID_API_KEY, fetcher })).toBeNull();
    expect(await fetchSoilFromAmbee(200, -0.18, { apiKey: VALID_API_KEY, fetcher })).toBeNull();
    expect(await fetchSoilFromAmbee(5.6, 200, { apiKey: VALID_API_KEY, fetcher })).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('returns null when fetcher rejects (network error)', async () => {
    const fetcher = vi.fn(() => Promise.reject(new Error('ECONNRESET')));
    const r = await fetchSoilFromAmbee(5.6, -0.18, { apiKey: VALID_API_KEY, fetcher });
    expect(r).toBeNull();
  });

  it('returns null when fetcher throws synchronously', async () => {
    const fetcher = vi.fn(() => { throw new Error('sync boom'); });
    const r = await fetchSoilFromAmbee(5.6, -0.18, { apiKey: VALID_API_KEY, fetcher });
    expect(r).toBeNull();
  });

  it('returns null on non-2xx HTTP response', async () => {
    const fetcher = vi.fn(async () => _failResponse(403));
    const r = await fetchSoilFromAmbee(5.6, -0.18, { apiKey: VALID_API_KEY, fetcher });
    expect(r).toBeNull();
  });

  it('returns null when JSON parsing throws', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true, status: 200, json: async () => { throw new Error('bad json'); },
    }));
    const r = await fetchSoilFromAmbee(5.6, -0.18, { apiKey: VALID_API_KEY, fetcher });
    expect(r).toBeNull();
  });

  it('returns null on a malformed (empty data array) response', async () => {
    const fetcher = vi.fn(async () => _okResponse({ message: 'success', data: [] }));
    const r = await fetchSoilFromAmbee(5.6, -0.18, { apiKey: VALID_API_KEY, fetcher });
    expect(r).toBeNull();
  });

  it('NEVER throws on any failure path', async () => {
    // Stack the worst-case combinations.
    const cases = [
      { apiKey: null, fetcher: null },
      { apiKey: VALID_API_KEY, fetcher: () => { throw 0; } },
      { apiKey: VALID_API_KEY, fetcher: async () => null },
      { apiKey: VALID_API_KEY, fetcher: async () => ({ ok: true, json: () => Promise.reject(0) }) },
    ];
    for (const { apiKey, fetcher } of cases) {
      await expect(fetchSoilFromAmbee(5.6, -0.18, { apiKey, fetcher })).resolves.toBeDefined();
    }
  });
});

// ─── API key resolution from env ─────────────────────────────

describe('fetchSoilFromAmbee — reads AMBEE_API_KEY from env when no override', () => {
  it('uses process.env.AMBEE_API_KEY when no apiKey option', async () => {
    const original = process.env.AMBEE_API_KEY;
    process.env.AMBEE_API_KEY = 'env-key';
    let captured = null;
    const fetcher = vi.fn(async (_url, init) => {
      captured = init;
      return _okResponse(_AMBEE_REAL_SHAPE());
    });
    await fetchSoilFromAmbee(5.6, -0.18, { fetcher });
    expect(captured.headers['x-api-key']).toBe('env-key');
    if (original === undefined) delete process.env.AMBEE_API_KEY;
    else process.env.AMBEE_API_KEY = original;
  });

  it('returns null when AMBEE_API_KEY is not set anywhere', async () => {
    const original = process.env.AMBEE_API_KEY;
    delete process.env.AMBEE_API_KEY;
    const fetcher = vi.fn();
    const r = await fetchSoilFromAmbee(5.6, -0.18, { fetcher });
    expect(r).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
    if (original !== undefined) process.env.AMBEE_API_KEY = original;
  });
});
