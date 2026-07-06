/**
 * farmerLoadState.test.js — pure-logic coverage for the admin farmer-detail loader
 * (2026-07-05 fix). Covers the spec's 404 / 401-403 / 500 / malformed intents and the
 * admin diagnostic envelope. Node env, no React (repo convention).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  classifyFarmerLoadError, isFarmerShapeValid, isRetryable, safeSnippet, buildFarmerDiagnostic,
} from '../farmerLoadState.js';

describe('classifyFarmerLoadError', () => {
  it('404 → NOT_FOUND', () => expect(classifyFarmerLoadError(404)).toBe('NOT_FOUND'));
  it('401 → UNAUTHORIZED', () => expect(classifyFarmerLoadError(401)).toBe('UNAUTHORIZED'));
  it('403 → UNAUTHORIZED', () => expect(classifyFarmerLoadError(403)).toBe('UNAUTHORIZED'));
  it('500 → SERVER_ERROR', () => expect(classifyFarmerLoadError(500)).toBe('SERVER_ERROR'));
  it('502 → SERVER_ERROR', () => expect(classifyFarmerLoadError(502)).toBe('SERVER_ERROR'));
  it('0 (no response) → NETWORK_ERROR', () => expect(classifyFarmerLoadError(0)).toBe('NETWORK_ERROR'));
  it('undefined → NETWORK_ERROR', () => expect(classifyFarmerLoadError(undefined)).toBe('NETWORK_ERROR'));
  it('400/422 → SERVER_ERROR (reported failure, not a crash)', () => {
    expect(classifyFarmerLoadError(400)).toBe('SERVER_ERROR');
    expect(classifyFarmerLoadError(422)).toBe('SERVER_ERROR');
  });
});

describe('isFarmerShapeValid — malformed 200 does not become a "farmer"', () => {
  it('accepts a real farmer object', () => expect(isFarmerShapeValid({ id: 'x', fullName: 'A' })).toBe(true));
  it('rejects null / undefined', () => { expect(isFarmerShapeValid(null)).toBe(false); expect(isFarmerShapeValid(undefined)).toBe(false); });
  it('rejects an HTML string (proxy error page)', () => expect(isFarmerShapeValid('<!doctype html>')).toBe(false));
  it('rejects an array', () => expect(isFarmerShapeValid([{ id: 'x' }])).toBe(false));
  it('rejects an object without id', () => expect(isFarmerShapeValid({ fullName: 'A' })).toBe(false));
});

describe('isRetryable — retry only for transient failures', () => {
  it('server/network/bad-shape are retryable', () => {
    expect(isRetryable('SERVER_ERROR')).toBe(true);
    expect(isRetryable('NETWORK_ERROR')).toBe(true);
    expect(isRetryable('BAD_SHAPE')).toBe(true);
  });
  it('not-found and unauthorized are NOT retryable', () => {
    expect(isRetryable('NOT_FOUND')).toBe(false);
    expect(isRetryable('UNAUTHORIZED')).toBe(false);
  });
});

describe('safeSnippet — bounded, never throws', () => {
  it('caps long strings at 500 chars', () => expect(safeSnippet('x'.repeat(5000)).length).toBe(500));
  it('stringifies objects', () => expect(safeSnippet({ a: 1 })).toBe('{"a":1}'));
  it('null → null', () => expect(safeSnippet(null)).toBe(null));
  it('circular object does not throw', () => {
    const o = {}; o.self = o;
    expect(() => safeSnippet(o)).not.toThrow();
  });
});

describe('buildFarmerDiagnostic — admin export envelope', () => {
  it('carries state/farmerId/status/message/commit and schema', () => {
    const d = buildFarmerDiagnostic({
      state: 'SERVER_ERROR', farmerId: '7f45f6b9', status: 500,
      message: 'boom', body: { e: 1 }, route: '/farmers/7f45f6b9', commit: 'abc123', at: '2026-07-05T00:00:00Z',
    });
    expect(d.schema).toBe('farmer-detail-error/v1');
    expect(d.farmerId).toBe('7f45f6b9');
    expect(d.status).toBe(500);
    expect(d.message).toBe('boom');
    expect(d.commit).toBe('abc123');
    expect(d.body).toBe('{"e":1}');
  });
});

// Regression guard: the file-level eslint-disable that hid the hook-order crash
// must never come back. If it does, the hooks gate is blindfolded again.
describe('FarmerDetailPage hooks-gate protection', () => {
  it('does NOT disable react-hooks/rules-of-hooks at file level', () => {
    const src = readFileSync(new URL('../../FarmerDetailPage.jsx', import.meta.url), 'utf8');
    expect(src.includes('eslint-disable react-hooks/rules-of-hooks')).toBe(false);
    expect(src.match(/eslint-disable\b(?!-next-line)/)).toBe(null); // no blanket file-level disable
  });
});
