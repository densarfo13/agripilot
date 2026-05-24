/**
 * operatorConfigHardening.test.js — verifies the operator-config
 * hardening primitives:
 *   • envSchema.js          (centralised env validation)
 *   • providerTimeout.js    (callWithTimeout + createCircuitBreaker)
 *   • intelligenceLogger.js (structured per-engine logging)
 *
 * No integration tests against /api/system/status here — that
 * route is covered by the existing system-routes test suite.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ENV_SCHEMA, validateEnv, summariseEnv, isEnvVarSet, SEVERITY,
} from '../config/envSchema.js';
import {
  callWithTimeout, createCircuitBreaker, REASON,
} from '../lib/providerTimeout.js';
import {
  logIntelligenceCall, wrapIntelligenceCall,
} from '../lib/intelligenceLogger.js';

// ─── envSchema ───────────────────────────────────────────

describe('envSchema', () => {
  let snapshot;
  beforeEach(() => { snapshot = { ...process.env }; });
  const restore = () => { for (const k of Object.keys(process.env)) delete process.env[k]; Object.assign(process.env, snapshot); };

  it('ENV_SCHEMA is a non-empty frozen array of typed entries', () => {
    expect(Array.isArray(ENV_SCHEMA)).toBe(true);
    expect(ENV_SCHEMA.length).toBeGreaterThan(5);
    for (const e of ENV_SCHEMA) {
      expect(typeof e.name).toBe('string');
      expect(Array.isArray(e.aliases)).toBe(true);
      expect(Object.values(SEVERITY)).toContain(e.severity);
      expect(typeof e.feature).toBe('string');
      expect(typeof e.fallback).toBe('string');
    }
  });

  it('isEnvVarSet honours canonical name + every alias', () => {
    delete process.env.JWT_SECRET;
    delete process.env.AUTH_SECRET;
    expect(isEnvVarSet('JWT_SECRET', ['AUTH_SECRET'])).toBe(false);

    process.env.AUTH_SECRET = 'x';
    expect(isEnvVarSet('JWT_SECRET', ['AUTH_SECRET'])).toBe(true);

    delete process.env.AUTH_SECRET;
    process.env.JWT_SECRET = 'y';
    expect(isEnvVarSet('JWT_SECRET', ['AUTH_SECRET'])).toBe(true);

    restore();
  });

  it('validateEnv reports missingCritical when DATABASE_URL absent', () => {
    delete process.env.DATABASE_URL;
    const r = validateEnv();
    expect(r.missingCritical.find((m) => m.name === 'DATABASE_URL')).toBeTruthy();
    expect(r.ok).toBe(false);
    restore();
  });

  it('validateEnv ok=true when no critical missing', () => {
    process.env.DATABASE_URL = 'postgres://x';
    process.env.JWT_SECRET   = 'a'.repeat(40);
    const r = validateEnv();
    expect(r.missingCritical).toEqual([]);
    expect(r.ok).toBe(true);
    restore();
  });

  it('summariseEnv returns set + unset arrays with totals', () => {
    const s = summariseEnv();
    expect(s.totalTracked).toBe(ENV_SCHEMA.length);
    expect(Array.isArray(s.set)).toBe(true);
    expect(Array.isArray(s.unset)).toBe(true);
    expect(s.set.length + s.unset.length).toBe(s.totalTracked);
  });

  it('never throws on garbage input', () => {
    expect(() => isEnvVarSet(null)).not.toThrow();
    expect(() => validateEnv()).not.toThrow();
    expect(() => summariseEnv()).not.toThrow();
  });
});

// ─── providerTimeout ─────────────────────────────────────

describe('callWithTimeout', () => {
  it('resolves with { ok: true, value } on success', async () => {
    const r = await callWithTimeout(async () => 42);
    expect(r.ok).toBe(true);
    expect(r.value).toBe(42);
  });

  it('returns { ok: false, reason: timeout } past deadline', async () => {
    const r = await callWithTimeout(
      () => new Promise((resolve) => setTimeout(resolve, 200)),
      { timeoutMs: 30, label: 'slow' },
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(REASON.TIMEOUT);
    expect(r.label).toBe('slow');
  });

  it('returns { ok: false, reason: caller_throw } when fn throws', async () => {
    const r = await callWithTimeout(async () => { throw new Error('boom'); });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(REASON.CALLER_THROW);
    expect(r.error).toMatch(/boom/);
  });

  it('returns { ok: false, reason: invalid_args } for non-functions', async () => {
    const r = await callWithTimeout(null);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(REASON.INVALID_ARGS);
  });
});

describe('createCircuitBreaker', () => {
  it('passes through when CLOSED', async () => {
    const cb = createCircuitBreaker({ label: 'x', threshold: 3 });
    const r = await cb.call(async () => 1);
    expect(r.ok).toBe(true);
    expect(cb.snapshot().state).toBe('closed');
  });

  it('opens after `threshold` consecutive failures', async () => {
    const cb = createCircuitBreaker({ label: 'x', threshold: 2, cooldownMs: 1000 });
    await cb.call(async () => { throw new Error('a'); });
    await cb.call(async () => { throw new Error('b'); });
    expect(cb.snapshot().state).toBe('open');

    const r = await cb.call(async () => 99);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(REASON.CIRCUIT_OPEN);
  });

  it('reset() returns the breaker to CLOSED', async () => {
    const cb = createCircuitBreaker({ threshold: 1, cooldownMs: 1000 });
    await cb.call(async () => { throw new Error('a'); });
    expect(cb.snapshot().state).toBe('open');
    cb.reset();
    expect(cb.snapshot().state).toBe('closed');
    expect(cb.snapshot().consecutiveFailures).toBe(0);
  });

  it('snapshot returns the documented shape', () => {
    const cb = createCircuitBreaker({ label: 'y' });
    const s = cb.snapshot();
    expect(s.label).toBe('y');
    expect(['closed','open','half_open']).toContain(s.state);
    expect(typeof s.consecutiveFailures).toBe('number');
    expect(typeof s.threshold).toBe('number');
    expect(typeof s.cooldownMs).toBe('number');
    expect(typeof s.timeoutMs).toBe('number');
  });
});

// ─── intelligenceLogger ──────────────────────────────────

describe('intelligenceLogger', () => {
  it('logIntelligenceCall emits an [intelligence] line', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logIntelligenceCall('soil', { ok: true, durationMs: 10 });
    expect(spy).toHaveBeenCalled();
    const args = spy.mock.calls[0];
    expect(args[0]).toBe('[intelligence]');
    const payload = JSON.parse(args[1]);
    expect(payload.engine).toBe('soil');
    expect(payload.ok).toBe(true);
    expect(payload.durationMs).toBe(10);
    spy.mockRestore();
  });

  it('wrapIntelligenceCall logs success + returns the inner value', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await wrapIntelligenceCall('yield', async () => ({ kg: 100 }), {
      input: { crop: 'tomato', plantCount: 10 },
    });
    expect(result.kg).toBe(100);
    const last = spy.mock.calls.find((c) => c[0] === '[intelligence]');
    expect(last).toBeTruthy();
    const payload = JSON.parse(last[1]);
    expect(payload.engine).toBe('yield');
    expect(payload.ok).toBe(true);
    expect(payload.inputKeys).toContain('crop');
    expect(payload.inputKeys).toContain('plantCount');
    spy.mockRestore();
  });

  it('wrapIntelligenceCall logs caller_throw and returns { ok: false }', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await wrapIntelligenceCall('boom', async () => {
      throw new Error('boom!');
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('caller_throw');
    expect(result.error).toMatch(/boom/);
    const last = spy.mock.calls.find((c) => c[0] === '[intelligence]');
    const payload = JSON.parse(last[1]);
    expect(payload.outcome).toBe('caller_throw');
    spy.mockRestore();
  });

  it('never serialises argument VALUES (PII discipline)', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await wrapIntelligenceCall('soil', async () => 'ok', {
      input: { crop: 'tomato', secretName: 'should-not-leak', plantCount: 10 },
    });
    const last = spy.mock.calls.find((c) => c[0] === '[intelligence]');
    const text = last[1];
    expect(text).not.toContain('should-not-leak');
    expect(text).not.toContain('tomato');
    spy.mockRestore();
  });
});
