/**
 * runtimeStabilityPrimitives.test.js — pins the three Runtime
 * Stability Hardening spec primitives:
 *
 *   • validateEnvironment (§7)
 *   • safeApiBase (§1)
 *   • dedupeRequest (§9)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { validateEnvironment, getDefaultEnvSchema } from '../../../src/lib/validateEnvironment.js';
import { safeApiBase, _resetSafeApiBaseCache }      from '../../../src/lib/safeApiBase.js';
import { dedupeRequest, isInflight, getInflightCount, _resetDedupeState }
  from '../../../src/lib/requestDeduplicator.js';

// ─── validateEnvironment ──────────────────────────────────────

describe('validateEnvironment', () => {
  it('returns ok:true when nothing required is missing (defaults)', () => {
    const r = validateEnvironment({ env: {} });
    expect(r.ok).toBe(true);
    // recommended env absent → reported but not a failure
    expect(r.diagnostics.missingRecommended.length).toBeGreaterThan(0);
    expect(r.diagnostics.missingRequired).toEqual([]);
  });

  it('returns ok:false when an explicit required key is missing', () => {
    const r = validateEnvironment({
      env: {},
      required: [{ key: 'DB_URL', kind: 'string' }],
    });
    expect(r.ok).toBe(false);
    expect(r.diagnostics.missingRequired).toEqual([
      { key: 'DB_URL', reason: 'missing' },
    ]);
  });

  it('flags invalid URLs in recommended tier', () => {
    const r = validateEnvironment({
      env: { VITE_API_BASE_URL: 'not a url' },
    });
    expect(r.ok).toBe(false);
    expect(r.diagnostics.invalidEntries.some((e) => e.key === 'VITE_API_BASE_URL')).toBe(true);
  });

  it('accepts relative paths + https URLs + empty string as valid URLs', () => {
    for (const v of ['', '/api', '/api/v2', 'https://farroway.app', 'http://localhost:3000']) {
      const r = validateEnvironment({
        env: { VITE_API_BASE_URL: v },
      });
      expect(r.diagnostics.invalidEntries.find((e) => e.key === 'VITE_API_BASE_URL')).toBeUndefined();
    }
  });

  it('treats empty / whitespace / "undefined" string as missing', () => {
    for (const v of ['', '   ', 'undefined']) {
      const r = validateEnvironment({
        env: { VITE_API_BASE_URL: v },
      });
      expect(r.diagnostics.missingRecommended).toContain('VITE_API_BASE_URL');
    }
  });

  it('validates boolean shape on optional flag entries', () => {
    const r = validateEnvironment({
      env: { VITE_FEATURE_SOIL_CONTEXT: 'definitely_not_a_bool' },
    });
    expect(r.diagnostics.invalidEntries.some((e) => e.key === 'VITE_FEATURE_SOIL_CONTEXT')).toBe(true);
  });

  it('accepts true/false/1/0/on/off as valid boolean values', () => {
    for (const v of ['true', 'false', '1', '0', 'on', 'off', 'TRUE']) {
      const r = validateEnvironment({
        env: { VITE_FEATURE_SOIL_CONTEXT: v },
      });
      expect(r.diagnostics.invalidEntries.find((e) => e.key === 'VITE_FEATURE_SOIL_CONTEXT')).toBeUndefined();
    }
  });

  it('output is frozen', () => {
    const r = validateEnvironment({ env: {} });
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.diagnostics)).toBe(true);
    expect(Object.isFrozen(r.diagnostics.missingRequired)).toBe(true);
  });

  it('NEVER throws on null / garbage input', () => {
    expect(() => validateEnvironment(null)).not.toThrow();
    expect(() => validateEnvironment('not an object')).not.toThrow();
    expect(() => validateEnvironment({ required: 'not an array' })).not.toThrow();
  });

  it('getDefaultEnvSchema exposes recommended + optional sets', () => {
    const schema = getDefaultEnvSchema();
    expect(Array.isArray(schema.recommended)).toBe(true);
    expect(Array.isArray(schema.optional)).toBe(true);
    expect(schema.recommended.find((e) => e.key === 'VITE_API_BASE_URL')).toBeDefined();
  });
});

// ─── safeApiBase ─────────────────────────────────────────────

describe('safeApiBase', () => {
  beforeEach(() => {
    _resetSafeApiBaseCache();
  });

  it('returns a string (never undefined / null)', () => {
    const base = safeApiBase();
    expect(typeof base).toBe('string');
  });

  it('appends paths with proper leading slash', () => {
    // Note: real resolveApiBase reads import.meta.env; in test env
    // it usually returns '' (same-origin). Path appends without
    // double-slashing in either case.
    const r = safeApiBase('/api/v2/users/me');
    expect(r.includes('/api/v2/users/me')).toBe(true);
    expect(r.includes('//api')).toBe(false);
  });

  it('auto-prepends leading slash to bare paths', () => {
    const r = safeApiBase('api/v2/x');
    expect(r.endsWith('/api/v2/x')).toBe(true);
  });

  it('returns base alone when no path supplied', () => {
    const base = safeApiBase();
    expect(safeApiBase()).toBe(base);
  });

  it('handles empty path same as no path', () => {
    expect(safeApiBase('')).toBe(safeApiBase());
  });

  it('NEVER throws on garbage path', () => {
    expect(() => safeApiBase(null)).not.toThrow();
    expect(() => safeApiBase(undefined)).not.toThrow();
  });
});

// ─── dedupeRequest ────────────────────────────────────────────

describe('requestDeduplicator', () => {
  beforeEach(() => {
    _resetDedupeState();
  });

  it('two concurrent calls with the same key share one underlying request', async () => {
    let calls = 0;
    const factory = () => new Promise((res) => {
      calls += 1;
      setTimeout(() => res('value'), 20);
    });
    const [a, b] = await Promise.all([
      dedupeRequest('k1', factory),
      dedupeRequest('k1', factory),
    ]);
    expect(a).toBe('value');
    expect(b).toBe('value');
    expect(calls).toBe(1);
  });

  it('different keys fire independent requests', async () => {
    let calls = 0;
    const factory = () => new Promise((res) => { calls += 1; res('v'); });
    await Promise.all([
      dedupeRequest('k1', factory),
      dedupeRequest('k2', factory),
    ]);
    expect(calls).toBe(2);
  });

  it('failure is NOT cached — retry triggers a fresh request', async () => {
    let calls = 0;
    const failingFactory = () => { calls += 1; return Promise.reject(new Error('first fail')); };
    await dedupeRequest('k1', failingFactory).catch(() => null);
    await dedupeRequest('k1', failingFactory).catch(() => null);
    expect(calls).toBe(2);
  });

  it('successful result is dropped after resolution (next call refetches)', async () => {
    let calls = 0;
    const factory = () => { calls += 1; return Promise.resolve('value'); };
    await dedupeRequest('k1', factory);
    await dedupeRequest('k1', factory);
    expect(calls).toBe(2);
  });

  it('isInflight reflects active state', async () => {
    expect(isInflight('k1')).toBe(false);
    const p = dedupeRequest('k1', () => new Promise((r) => setTimeout(() => r('v'), 20)));
    expect(isInflight('k1')).toBe(true);
    await p;
    expect(isInflight('k1')).toBe(false);
  });

  it('getInflightCount reflects active state', async () => {
    expect(getInflightCount()).toBe(0);
    const p = dedupeRequest('k1', () => new Promise((r) => setTimeout(() => r('v'), 20)));
    expect(getInflightCount()).toBe(1);
    await p;
    expect(getInflightCount()).toBe(0);
  });

  it('rejects on invalid key', async () => {
    await expect(dedupeRequest('', () => Promise.resolve())).rejects.toThrow(/invalid_key/);
    await expect(dedupeRequest(null, () => Promise.resolve())).rejects.toThrow(/invalid_key/);
  });

  it('rejects on invalid factory', async () => {
    await expect(dedupeRequest('k', null)).rejects.toThrow(/invalid_factory/);
  });

  it('supports per-caller AbortSignal — other waiters still resolve', async () => {
    const factory = () => new Promise((r) => setTimeout(() => r('shared'), 30));
    const ctrl = new AbortController();
    const aborted = dedupeRequest('k1', factory, { signal: ctrl.signal });
    const survives = dedupeRequest('k1', factory);
    ctrl.abort();
    await expect(aborted).rejects.toThrow(/aborted/);
    await expect(survives).resolves.toBe('shared');
  });

  it('respects timeoutMs', async () => {
    const factory = () => new Promise((r) => setTimeout(() => r('late'), 100));
    await expect(
      dedupeRequest('k1', factory, { timeoutMs: 20 })
    ).rejects.toThrow(/request_timeout/);
  });

  it('factory sync throw rejects without crashing', async () => {
    await expect(
      dedupeRequest('k1', () => { throw new Error('sync boom'); })
    ).rejects.toThrow(/sync boom/);
  });
});
