/**
 * intelligenceAdminError.test.js — the admin auth-status classifier (2026-07-05 fix).
 * The whole point: 401 (session) and 403 (access) are DISTINCT — a valid admin who
 * lacks a role must see "Access denied", never "Session expired".
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  classifyAdminApiError, isAdminErrorRetryable, ADMIN_ERROR_COPY,
} from '../intelligenceAdminError.js';

describe('classifyAdminApiError — 401 vs 403 must not be conflated', () => {
  it('401 → SESSION_EXPIRED', () => expect(classifyAdminApiError(401)).toBe('SESSION_EXPIRED'));
  it('403 → ACCESS_DENIED (not session expired)', () => expect(classifyAdminApiError(403)).toBe('ACCESS_DENIED'));
  it('0 / no response → NETWORK_ERROR', () => { expect(classifyAdminApiError(0)).toBe('NETWORK_ERROR'); expect(classifyAdminApiError(undefined)).toBe('NETWORK_ERROR'); });
  it('500 → API_ERROR', () => expect(classifyAdminApiError(500)).toBe('API_ERROR'));
  it('404 → API_ERROR', () => expect(classifyAdminApiError(404)).toBe('API_ERROR'));
});

describe('copy + retryability', () => {
  it('ACCESS_DENIED copy says permission, not re-login', () => {
    expect(ADMIN_ERROR_COPY.ACCESS_DENIED.title).toBe('Access denied');
    expect(ADMIN_ERROR_COPY.SESSION_EXPIRED.title).toBe('Session expired');
  });
  it('session/access errors are NOT retryable; network/api are', () => {
    expect(isAdminErrorRetryable('SESSION_EXPIRED')).toBe(false);
    expect(isAdminErrorRetryable('ACCESS_DENIED')).toBe(false);
    expect(isAdminErrorRetryable('NETWORK_ERROR')).toBe(true);
    expect(isAdminErrorRetryable('API_ERROR')).toBe(true);
  });
});

describe('intelligenceAdminApi.request — sends bearer + propagates status', () => {
  const src = readFileSync(new URL('../intelligenceAdminApi.js', import.meta.url), 'utf8');
  it('attaches the canonical Bearer token (was cookie-only)', () => {
    expect(src.includes('farroway_token')).toBe(true);
    expect(src.includes("Authorization: 'Bearer '")).toBe(true);
  });
  it('propagates the real HTTP status on failure (no text-guessing)', () => {
    expect(src.includes('err.status = res.status')).toBe(true);
    expect(src.includes('classifyAdminApiError(res.status)')).toBe(true);
  });
});

describe('adminTokens — tokens exist, no farmer-palette overload', () => {
  const src = readFileSync(new URL('../../admin/theme/adminTokens.ts', import.meta.url), 'utf8');
  it('exposes all required token groups', () => {
    // present either as an object key (`group:`), a shorthand key (`group,`),
    // or a named export — all valid.
    for (const g of ['colors', 'spacing', 'radius', 'shadow', 'typography', 'zIndex', 'motion', 'statusColors']) {
      const ok = src.includes(g + ':') || src.includes(g + ',') || src.includes('const ' + g)
        || src.includes('const admin' + g[0].toUpperCase() + g.slice(1));
      expect(ok, `token group "${g}" present`).toBe(true);
    }
  });
  it('defines the spec palette (navy base, emerald, gold)', () => {
    expect(src.includes('#0B1220')).toBe(true); // dark navy base
    expect(src.includes('emerald')).toBe(true);
    expect(src.includes('gold')).toBe(true);
  });
});
