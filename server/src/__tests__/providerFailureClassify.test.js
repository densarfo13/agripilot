/**
 * providerFailureClassify.test.js — locks the provider-failure classification fix. Vitest.
 *
 * Bug: providers report failures as reason:'http_NNN' / reason:'exception' + message, and
 * plant.id's detail lives in consensus.sources[].error — but classifyProviderFailure only
 * read numeric httpStatus + reason/status and never parsed 'http_NNN' or saw message. So
 * real AUTH/CREDITS/RATE_LIMIT/TIMEOUT/NETWORK failures all bucketed as UNKNOWN, defeating
 * the operator reliability dashboard. The fix combines all text signals + recovers the
 * status from an 'http_NNN' token.
 */
import { describe, it, expect } from 'vitest';
import { classifyProviderFailure, FAILURE_CATEGORY } from '../services/scan/certification/providerFailure.js';

describe('classifyProviderFailure — every provider failure shape', () => {
  it('THE FIX: http_NNN encoded in reason/error is recovered to a status', () => {
    expect(classifyProviderFailure({ reason: 'http_401' })).toBe(FAILURE_CATEGORY.AUTH);
    expect(classifyProviderFailure({ error:  'http_402' })).toBe(FAILURE_CATEGORY.CREDITS);
    expect(classifyProviderFailure({ reason: 'http_429' })).toBe(FAILURE_CATEGORY.RATE_LIMIT);
    expect(classifyProviderFailure({ reason: 'http_500' })).toBe(FAILURE_CATEGORY.NETWORK);
    expect(classifyProviderFailure({ reason: 'http_503' })).toBe(FAILURE_CATEGORY.NETWORK);
  });

  it('THE FIX: a timeout/abort in message is classified TIMEOUT (was UNKNOWN)', () => {
    expect(classifyProviderFailure({ reason: 'exception', message: 'The operation was aborted' })).toBe(FAILURE_CATEGORY.TIMEOUT);
    expect(classifyProviderFailure({ reason: 'exception', message: 'request timed out' })).toBe(FAILURE_CATEGORY.TIMEOUT);
  });

  it('THE FIX: a network error in message is classified NETWORK', () => {
    expect(classifyProviderFailure({ reason: 'exception', message: 'fetch failed' })).toBe(FAILURE_CATEGORY.NETWORK);
    expect(classifyProviderFailure({ reason: 'exception', message: 'getaddrinfo ENOTFOUND api.plant.id' })).toBe(FAILURE_CATEGORY.NETWORK);
    expect(classifyProviderFailure({ reason: 'http_no_response' })).toBe(FAILURE_CATEGORY.NETWORK);
  });

  it('plant.id: per-source error (consensus.sources[].error) flows in via message', () => {
    // app.js joins sources[].error into message for the plant.id metric.
    expect(classifyProviderFailure({ reason: undefined, message: 'http_401' })).toBe(FAILURE_CATEGORY.AUTH);
  });

  it('explicit numeric httpStatus still works (no regression)', () => {
    expect(classifyProviderFailure({ httpStatus: 401 })).toBe(FAILURE_CATEGORY.AUTH);
    expect(classifyProviderFailure({ httpStatus: 402 })).toBe(FAILURE_CATEGORY.CREDITS);
    expect(classifyProviderFailure({ httpStatus: 429 })).toBe(FAILURE_CATEGORY.RATE_LIMIT);
    expect(classifyProviderFailure({ httpStatus: 500 })).toBe(FAILURE_CATEGORY.NETWORK);
    expect(classifyProviderFailure({ httpStatus: 200 })).toBe(FAILURE_CATEGORY.INVALID_RESPONSE);
  });

  it('THE FIX: 400/404/408/502/504 classify (were UNKNOWN)', () => {
    expect(classifyProviderFailure({ httpStatus: 408 })).toBe(FAILURE_CATEGORY.TIMEOUT);   // request timeout — retriable
    expect(classifyProviderFailure({ httpStatus: 504 })).toBe(FAILURE_CATEGORY.TIMEOUT);   // gateway timeout — retriable
    expect(classifyProviderFailure({ httpStatus: 400 })).toBe(FAILURE_CATEGORY.INVALID_RESPONSE); // bad request — terminal
    expect(classifyProviderFailure({ httpStatus: 404 })).toBe(FAILURE_CATEGORY.INVALID_RESPONSE); // not found — terminal
    expect(classifyProviderFailure({ httpStatus: 502 })).toBe(FAILURE_CATEGORY.NETWORK);   // bad gateway
    expect(classifyProviderFailure({ httpStatus: 503 })).toBe(FAILURE_CATEGORY.NETWORK);   // unavailable
    expect(classifyProviderFailure({ reason: 'http_408' })).toBe(FAILURE_CATEGORY.TIMEOUT); // recovered from token
    expect(classifyProviderFailure({ reason: 'http_400' })).toBe(FAILURE_CATEGORY.INVALID_RESPONSE);
  });

  it('text reasons still classify (auth / credits / rate-limit / parse)', () => {
    expect(classifyProviderFailure({ reason: 'invalid api key' })).toBe(FAILURE_CATEGORY.AUTH);
    expect(classifyProviderFailure({ reason: 'quota exhausted' })).toBe(FAILURE_CATEGORY.CREDITS);
    expect(classifyProviderFailure({ reason: 'rate limit exceeded' })).toBe(FAILURE_CATEGORY.RATE_LIMIT);
    expect(classifyProviderFailure({ reason: 'unexpected token in JSON' })).toBe(FAILURE_CATEGORY.INVALID_RESPONSE);
  });

  it('genuinely unclassifiable stays UNKNOWN; never throws', () => {
    expect(classifyProviderFailure({ reason: 'exception' })).toBe(FAILURE_CATEGORY.UNKNOWN);
    expect(classifyProviderFailure({})).toBe(FAILURE_CATEGORY.UNKNOWN);
    expect(() => classifyProviderFailure(null)).not.toThrow();
  });
});
