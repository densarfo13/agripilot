/**
 * productionValidation.test.js — the failure classifier + Production Validation Report.
 * Vitest. Proves the 7-bucket classification and that the report NEVER promotes to GO
 * without real provider evidence (honest INSUFFICIENT_EVIDENCE / NO-GO).
 */
import { describe, it, expect } from 'vitest';
import { classifyProviderFailure, FAILURE_CATEGORY, recommendationFor } from '../services/scan/certification/providerFailure.js';
import { buildProductionValidationReport } from '../services/scan/certification/productionValidation.js';

describe('classifyProviderFailure — the 7 canonical buckets', () => {
  it('401/403 → AUTH', () => {
    expect(classifyProviderFailure({ httpStatus: 401 })).toBe('AUTH');
    expect(classifyProviderFailure({ httpStatus: 403 })).toBe('AUTH');
    expect(classifyProviderFailure({ reason: 'invalid api key' })).toBe('AUTH');
  });
  it('402 / quota → CREDITS', () => {
    expect(classifyProviderFailure({ httpStatus: 402 })).toBe('CREDITS');
    expect(classifyProviderFailure({ reason: 'insufficient credits' })).toBe('CREDITS');
  });
  it('429 → RATE_LIMIT', () => {
    expect(classifyProviderFailure({ httpStatus: 429 })).toBe('RATE_LIMIT');
    expect(classifyProviderFailure({ reason: 'rate limit exceeded' })).toBe('RATE_LIMIT');
  });
  it('timeout/abort → TIMEOUT', () => {
    expect(classifyProviderFailure({ reason: 'request timed out' })).toBe('TIMEOUT');
    expect(classifyProviderFailure({ reason: 'AbortError' })).toBe('TIMEOUT');
  });
  it('connection error / 5xx → NETWORK', () => {
    expect(classifyProviderFailure({ reason: 'ECONNREFUSED' })).toBe('NETWORK');
    expect(classifyProviderFailure({ reason: 'fetch failed' })).toBe('NETWORK');
    expect(classifyProviderFailure({ httpStatus: 503 })).toBe('NETWORK');
  });
  it('schema/parse → INVALID_RESPONSE', () => {
    expect(classifyProviderFailure({ reason: 'schema validation failed' })).toBe('INVALID_RESPONSE');
    expect(classifyProviderFailure({ reason: 'unexpected token in JSON' })).toBe('INVALID_RESPONSE');
  });
  it('unclassifiable → UNKNOWN, and every category has a recommendation', () => {
    expect(classifyProviderFailure({ reason: 'weird thing happened' })).toBe('UNKNOWN');
    expect(classifyProviderFailure({})).toBe('UNKNOWN');
    for (const c of Object.values(FAILURE_CATEGORY)) expect(recommendationFor(c).length).toBeGreaterThan(10);
  });
});

const ready = (provider, extra = {}) => ({
  provider, requestCount: 2, successRate: 100, latencyP50: 1100, latencyP95: 1800, latencyP99: 2200,
  avgConfidence: 82, healthStatus: 'HEALTHY', count401: 0, count403: 0, count429: 0, count500: 0, timeoutCount: 0, ...extra,
});

describe('buildProductionValidationReport — honesty (never promote without evidence)', () => {
  it('no rows at all → INSUFFICIENT_EVIDENCE, NO-GO', () => {
    const r = buildProductionValidationReport({ scorecard: { hasData: false, providers: [] } });
    expect(r.verdict).toBe('INSUFFICIENT_EVIDENCE');
    expect(/NO-GO/.test(r.readiness)).toBe(true);
    expect(r.successful.length).toBe(0);
  });

  it('all critical providers READY on real success → GO', () => {
    const r = buildProductionValidationReport({ scorecard: { hasData: true, windowHours: 24,
      providers: [ready('plant.id'), ready('crop.health'), ready('insect.id')] } });
    expect(r.verdict).toBe('GO');
    expect(r.successful).toEqual(expect.arrayContaining(['plant.id', 'crop.health', 'insect.id']));
    expect(r.failed.length).toBe(0);
  });

  it('a critical provider with zero traffic → NOT GO (no evidence)', () => {
    const r = buildProductionValidationReport({ scorecard: { hasData: true, windowHours: 24,
      providers: [ready('crop.health'), ready('insect.id')] } });   // plant.id absent
    expect(r.verdict).toBe('NO_GO');
    expect(r.providers.find((p) => p.provider === 'plant.id').status).toBe('NO_EVIDENCE');
  });

  it('a failed critical provider → NO_GO with a classified recommendation', () => {
    const r = buildProductionValidationReport({ scorecard: { hasData: true, windowHours: 24,
      providers: [
        ready('plant.id', { successRate: 0, count401: 2, healthStatus: 'CRITICAL' }),
        ready('crop.health'), ready('insect.id'),
      ] } });
    expect(r.verdict).toBe('NO_GO');
    expect(r.failed).toContain('plant.id');
    const rec = r.recommendations.find((x) => x.provider === 'plant.id');
    expect(rec.category).toBe('AUTH');
    expect(rec.recommendation.length).toBeGreaterThan(10);
  });

  it('credits exhausted on a critical provider → CREDITS failure, NO_GO', () => {
    const r = buildProductionValidationReport({
      scorecard: { hasData: true, windowHours: 24, providers: [ready('plant.id'), ready('crop.health'), ready('insect.id')] },
      credits: { providers: [{ provider: 'plant.id', remaining: 0, daysRemaining: 0 }] },
    });
    expect(r.verdict).toBe('NO_GO');
    expect(r.recommendations.find((x) => x.provider === 'plant.id').category).toBe('CREDITS');
  });

  it('the report markdown carries the verdict + a provider table', () => {
    const r = buildProductionValidationReport({ scorecard: { hasData: true, windowHours: 24,
      providers: [ready('plant.id'), ready('crop.health'), ready('insect.id')] } });
    expect(r.markdown).toContain('PRODUCTION VALIDATION REPORT');
    expect(r.markdown).toContain('Verdict: GO');
    expect(r.markdown).toContain('| Provider |');
  });
});
