/**
 * safeUrl.test.js — pins the exception-free URL construction contract.
 *
 * The helper exists because `new URL(value)` throws on undefined /
 * null / empty / malformed input, and the resulting console line
 * ("Failed to construct 'URL': Invalid URL") is indistinguishable
 * from real app errors at a glance. safeUrl wraps every dangerous
 * construction in one place and returns null on any failure.
 */

import { describe, it, expect, vi } from 'vitest';

vi.setConfig({ testTimeout: 10000 });

describe('safeUrl', () => {
  it('parses a valid absolute URL', async () => {
    const { safeUrl } = await import('../../../src/lib/safeUrl.js');
    const u = safeUrl('https://example.com/path?x=1');
    expect(u).not.toBeNull();
    expect(u.hostname).toBe('example.com');
    expect(u.pathname).toBe('/path');
  });

  it('parses a relative URL when a base is supplied', async () => {
    const { safeUrl } = await import('../../../src/lib/safeUrl.js');
    const u = safeUrl('/api/v2/me', 'https://farroway.app');
    expect(u).not.toBeNull();
    expect(u.toString()).toBe('https://farroway.app/api/v2/me');
  });

  it('returns null on undefined / null / empty string', async () => {
    const { safeUrl } = await import('../../../src/lib/safeUrl.js');
    expect(safeUrl(undefined)).toBeNull();
    expect(safeUrl(null)).toBeNull();
    expect(safeUrl('')).toBeNull();
    expect(safeUrl('   ')).toBeNull();
  });

  it('returns null on non-string input (number / object / boolean / array)', async () => {
    const { safeUrl } = await import('../../../src/lib/safeUrl.js');
    expect(safeUrl(42)).toBeNull();
    expect(safeUrl({})).toBeNull();
    expect(safeUrl(false)).toBeNull();
    expect(safeUrl([])).toBeNull();
  });

  it('returns null on malformed URL strings', async () => {
    const { safeUrl } = await import('../../../src/lib/safeUrl.js');
    expect(safeUrl('not a url')).toBeNull();
    expect(safeUrl('http://')).toBeNull();
    expect(safeUrl('://no-protocol')).toBeNull();
  });

  it('never throws — every conceivable bad input returns null', async () => {
    const { safeUrl } = await import('../../../src/lib/safeUrl.js');
    expect(() => safeUrl(undefined)).not.toThrow();
    expect(() => safeUrl({ toString() { throw new Error('boom'); } })).not.toThrow();
    expect(() => safeUrl(NaN)).not.toThrow();
  });

  it('safeUrlOr returns the parsed input when valid', async () => {
    const { safeUrlOr } = await import('../../../src/lib/safeUrl.js');
    const u = safeUrlOr('https://example.com', '/fallback', 'https://farroway.app');
    expect(u.hostname).toBe('example.com');
  });

  it('safeUrlOr returns the fallback URL when input is bad', async () => {
    const { safeUrlOr } = await import('../../../src/lib/safeUrl.js');
    const u = safeUrlOr(undefined, '/login', 'https://farroway.app');
    expect(u).not.toBeNull();
    expect(u.toString()).toBe('https://farroway.app/login');
  });

  it('safeUrlOr returns null when both input AND fallback are bad', async () => {
    const { safeUrlOr } = await import('../../../src/lib/safeUrl.js');
    expect(safeUrlOr(undefined, undefined)).toBeNull();
    expect(safeUrlOr(undefined, '')).toBeNull();
    expect(safeUrlOr('garbage', 'also-garbage')).toBeNull();
  });

  it('isValidUrl is a clean boolean — no exception leaks', async () => {
    const { isValidUrl } = await import('../../../src/lib/safeUrl.js');
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl(undefined)).toBe(false);
    expect(isValidUrl('')).toBe(false);
    expect(isValidUrl('not a url')).toBe(false);
    expect(isValidUrl('/path', 'https://example.com')).toBe(true);
  });
});
