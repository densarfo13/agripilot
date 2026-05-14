/**
 * scanPipelineTimeoutAudit.test.js — Scan Pipeline Timeout
 * Audit fix.
 *
 *   Root cause: scanApiService awaited res.json() with NO
 *   timeout. A slow server response stream surfaced as the
 *   indefinite "scan is taking longer than expected" stall —
 *   the outer fetch timeout fired but the body-parse await
 *   never returned, so the caller never fell through to the
 *   rule-based fallback.
 *
 * Coverage:
 *   1. scanPipelineLogger - stage tags + safe payload sanitisation
 *   2. scanPipelineTimeouts.withScanTimeout - per-stage budgets
 *      that throw a tagged ScanTimeoutError when exceeded.
 *   3. scanPipelineTimeouts.safeScanRetry - retries timeouts +
 *      5xx + network errors, fails fast on 4xx.
 *   4. scanManualFallback.buildManualFallbackResult - calm
 *      ScanResult envelope with manual symptom list.
 *   5. scanApiService body-parse timeout (the regression fix).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  SCAN_STAGES,
  logScanStage,
  logScanPipelineError,
} from '../../../src/lib/scan/scanPipelineLogger.js';
import {
  SCAN_TIMEOUTS,
  ScanTimeoutError,
  withScanTimeout,
  safeScanRetry,
} from '../../../src/lib/scan/scanPipelineTimeouts.js';
import {
  buildManualFallbackResult,
  MANUAL_FALLBACK_SYMPTOMS,
} from '../../../src/lib/scan/scanManualFallback.js';

beforeEach(() => {
  vi.resetModules();
});

// ─── 1. Logger ───────────────────────────────────────────────

describe('scanPipelineLogger', () => {
  it('exposes the 8 spec-mandated stage tags', () => {
    expect(SCAN_STAGES.CAPTURED).toBe('SCAN_CAPTURED');
    expect(SCAN_STAGES.COMPRESSED).toBe('SCAN_COMPRESSED');
    expect(SCAN_STAGES.UPLOAD_STARTED).toBe('SCAN_UPLOAD_STARTED');
    expect(SCAN_STAGES.UPLOAD_SUCCESS).toBe('SCAN_UPLOAD_SUCCESS');
    expect(SCAN_STAGES.INFERENCE_STARTED).toBe('SCAN_INFERENCE_STARTED');
    expect(SCAN_STAGES.INFERENCE_RESPONSE).toBe('SCAN_INFERENCE_RESPONSE');
    expect(SCAN_STAGES.RENDER_SUCCESS).toBe('SCAN_RENDER_SUCCESS');
    expect(SCAN_STAGES.PIPELINE_ERROR).toBe('SCAN_PIPELINE_ERROR');
  });

  it('logScanStage returns a Date.now() timestamp for duration tracking', () => {
    const t = logScanStage(SCAN_STAGES.CAPTURED, { size: 1234 });
    expect(typeof t).toBe('number');
    expect(t).toBeGreaterThan(0);
  });

  it('logScanStage handles null / malformed payloads without throwing', () => {
    expect(() => logScanStage(SCAN_STAGES.CAPTURED, null)).not.toThrow();
    expect(() => logScanStage(SCAN_STAGES.CAPTURED, 'string')).not.toThrow();
    expect(() => logScanStage(null)).not.toThrow();
  });

  it('logScanPipelineError extracts a reason from Error / DOMException shapes', () => {
    expect(() => logScanPipelineError('inference', new Error('boom'))).not.toThrow();
    expect(() => logScanPipelineError('inference', { name: 'AbortError' })).not.toThrow();
    expect(() => logScanPipelineError('inference', null)).not.toThrow();
  });
});

// ─── 2. withScanTimeout ──────────────────────────────────────

describe('scanPipelineTimeouts.withScanTimeout', () => {
  it('resolves when the promise beats the timeout', async () => {
    const value = await withScanTimeout(Promise.resolve('ok'), 100, 'test');
    expect(value).toBe('ok');
  });

  it('throws ScanTimeoutError when the promise exceeds the budget', async () => {
    const slow = new Promise((resolve) => setTimeout(() => resolve('late'), 200));
    await expect(withScanTimeout(slow, 50, 'inference')).rejects.toMatchObject({
      name:  'ScanTimeoutError',
      stage: 'inference',
      kind:  'timeout',
    });
  });

  it('calls onTimeout when the budget fires (e.g. to abort a controller)', async () => {
    const slow = new Promise((resolve) => setTimeout(() => resolve('late'), 200));
    let aborted = false;
    await expect(
      withScanTimeout(slow, 50, 'inference', () => { aborted = true; }),
    ).rejects.toBeInstanceOf(ScanTimeoutError);
    expect(aborted).toBe(true);
  });

  it('treats ms <= 0 as "no timeout"', async () => {
    const slow = new Promise((resolve) => setTimeout(() => resolve('late'), 30));
    const value = await withScanTimeout(slow, 0, 'test');
    expect(value).toBe('late');
  });

  it('SCAN_TIMEOUTS exposes the spec-mandated per-stage budgets', () => {
    expect(SCAN_TIMEOUTS.compression).toBeGreaterThan(0);
    expect(SCAN_TIMEOUTS.upload).toBeGreaterThan(0);
    expect(SCAN_TIMEOUTS.inference).toBeGreaterThan(0);
    expect(SCAN_TIMEOUTS.parsing).toBeGreaterThan(0);
    expect(Object.isFrozen(SCAN_TIMEOUTS)).toBe(true);
  });
});

// ─── 3. safeScanRetry ────────────────────────────────────────

describe('scanPipelineTimeouts.safeScanRetry', () => {
  it('retries a timeout once and succeeds on attempt 2', async () => {
    let attempts = 0;
    const result = await safeScanRetry(
      async () => {
        attempts += 1;
        if (attempts === 1) {
          return new Promise((resolve) => setTimeout(() => resolve('late'), 200));
        }
        return 'ok_after_retry';
      },
      { attempts: 2, timeoutMs: 50, stage: 'inference' },
    );
    expect(result).toBe('ok_after_retry');
    expect(attempts).toBe(2);
  });

  it('exhausts retries on a permanent timeout and throws', async () => {
    let attempts = 0;
    await expect(safeScanRetry(
      async () => {
        attempts += 1;
        return new Promise((resolve) => setTimeout(() => resolve('late'), 200));
      },
      { attempts: 2, timeoutMs: 30, stage: 'inference' },
    )).rejects.toMatchObject({ name: 'ScanTimeoutError' });
    expect(attempts).toBe(2);
  });

  it('fails fast on a 4xx-shaped error (no retry)', async () => {
    let attempts = 0;
    const err = new Error('bad request');
    err.status = 404;
    await expect(safeScanRetry(
      async () => {
        attempts += 1;
        throw err;
      },
      { attempts: 3, timeoutMs: 100, stage: 'inference' },
    )).rejects.toBe(err);
    expect(attempts).toBe(1);
  });

  it('retries 5xx-shaped errors', async () => {
    let attempts = 0;
    const result = await safeScanRetry(
      async () => {
        attempts += 1;
        if (attempts < 2) {
          const e = new Error('server boom');
          e.status = 502;
          throw e;
        }
        return 'recovered';
      },
      { attempts: 3, timeoutMs: 100, stage: 'inference' },
    );
    expect(result).toBe('recovered');
    expect(attempts).toBe(2);
  });
});

// ─── 4. Manual fallback envelope ─────────────────────────────

describe('scanManualFallback.buildManualFallbackResult', () => {
  it('returns a frozen ScanResult-shaped envelope', () => {
    const out = buildManualFallbackResult({ crop: 'tomato', stage: 'inference' });
    expect(Object.isFrozen(out)).toBe(true);
    expect(typeof out.scanId).toBe('string');
    expect(out.confidence).toBe('low');
    expect(Array.isArray(out.recommendedActions)).toBe(true);
    expect(out.recommendedActions.length).toBeGreaterThan(0);
  });

  it('includes the manual symptom selection list', () => {
    const out = buildManualFallbackResult({ crop: 'tomato' });
    expect(Array.isArray(out.manualSymptoms)).toBe(true);
    expect(out.manualSymptoms.length).toBe(MANUAL_FALLBACK_SYMPTOMS.length);
    expect(out.manualSymptoms[0]).toHaveProperty('id');
    expect(out.manualSymptoms[0]).toHaveProperty('label');
  });

  it('normalises image quality score to [0,1]', () => {
    expect(buildManualFallbackResult({ imageQualityScore: 1.5 }).imageQualityScore).toBe(1);
    expect(buildManualFallbackResult({ imageQualityScore: -0.5 }).imageQualityScore).toBe(0);
    expect(buildManualFallbackResult({ imageQualityScore: 0.5 }).imageQualityScore).toBe(0.5);
    expect(buildManualFallbackResult({ imageQualityScore: 'high' }).imageQualityScore).toBeNull();
  });

  it('surfaces stage-specific copy', () => {
    const cmp = buildManualFallbackResult({ stage: 'compression', crop: 'tomato' });
    expect(cmp.possibleIssue.toLowerCase()).toContain('prepare');
    const inf = buildManualFallbackResult({ stage: 'inference', crop: 'tomato' });
    expect(inf.possibleIssue.toLowerCase()).toContain('analyzer');
    const net = buildManualFallbackResult({ stage: 'network', crop: 'tomato' });
    expect(net.possibleIssue.toLowerCase()).toContain('offline');
  });

  it('low confidence + no AI certainty leaked into copy', () => {
    const out = buildManualFallbackResult({ crop: 'tomato', stage: 'inference' });
    expect(out.confidence).toBe('low');
    const blob = JSON.stringify(out).toLowerCase();
    expect(blob).not.toMatch(/certified|guaranteed|definite/);
  });

  it('never throws on malformed input', () => {
    expect(() => buildManualFallbackResult(null)).not.toThrow();
    expect(() => buildManualFallbackResult(undefined)).not.toThrow();
    expect(() => buildManualFallbackResult('garbage')).not.toThrow();
    expect(() => buildManualFallbackResult({ crop: 42 })).not.toThrow();
  });
});

// ─── 5. scanApiService body-parse regression ─────────────────

describe('scanApiService — body-parse timeout (regression for the stall)', () => {
  async function loadServiceWithFetch(fetchImpl, featuresImpl) {
    vi.resetModules();
    // Seed a fake session so the api.js auth gate doesn't fire.
    // scanApiService imports the feature-flag module; stub the
    // flag to true.
    vi.doMock('../../../src/config/features.js', () => ({
      isFeatureEnabled: featuresImpl || ((flag) => flag === 'scanApiEnabled'),
    }));
    globalThis.fetch = fetchImpl;
    globalThis.window = globalThis.window || {};
    globalThis.window.fetch = fetchImpl;
    return import('../../../src/services/scanApiService.js');
  }

  it('returns null when the response body parse hangs past the parse budget', async () => {
    // Simulate a fetch that succeeds but whose .json() never
    // resolves — the exact shape that produced the indefinite
    // "taking longer than expected" stall pre-fix.
    const fetchImpl = async () => ({
      ok:     true,
      status: 200,
      json:   () => new Promise(() => { /* never resolves */ }),
      text:   async () => '',
    });
    const mod = await loadServiceWithFetch(fetchImpl);
    // The service has a 3s parse timeout. Fast-forward time so
    // the test doesn't actually wait 3s.
    vi.useFakeTimers();
    const promise = mod.requestScanAnalysis({ imageBase64: 'data:abc' });
    await vi.advanceTimersByTimeAsync(3100);
    const out = await promise;
    vi.useRealTimers();
    expect(out).toBeNull();
  });

  it('returns the parsed JSON when the response body resolves quickly', async () => {
    const fetchImpl = async () => ({
      ok:     true,
      status: 200,
      json:   async () => ({ possibleIssue: 'leaf yellowing', confidence: 'medium' }),
      text:   async () => '',
    });
    const mod = await loadServiceWithFetch(fetchImpl);
    const out = await mod.requestScanAnalysis({ imageBase64: 'data:abc' });
    expect(out).toBeTruthy();
    expect(out.possibleIssue).toBe('leaf yellowing');
  });

  it('returns null when scanApiEnabled flag is false (fail-fast)', async () => {
    const mod = await loadServiceWithFetch(
      async () => ({ ok: true, status: 200, json: async () => ({}) }),
      () => false, // every flag returns false
    );
    const out = await mod.requestScanAnalysis({});
    expect(out).toBeNull();
  });

  it('returns null on a non-2xx response', async () => {
    const fetchImpl = async () => ({
      ok:     false,
      status: 500,
      json:   async () => ({ error: 'boom' }),
      text:   async () => 'boom',
    });
    const mod = await loadServiceWithFetch(fetchImpl);
    const out = await mod.requestScanAnalysis({});
    expect(out).toBeNull();
  });
});
