/**
 * urlBuilder.test.js — verifies the canonical URL construction
 * helper enforces the spec contract:
 *   • undefined / null / empty / non-string → null + [INVALID_URL] log
 *   • valid absolute / relative paths → URL object (or string)
 *   • silent option suppresses the [INVALID_URL] log
 *   • [INVALID_URL] log fires ONCE per unique bad input
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => {
  // Pin the API base so the same-origin fallback doesn't change
  // the URL prefix between test runs.
  process.env.VITE_API_URL = 'https://api.example.test';
  vi.resetModules();
});

describe('urlBuilder', () => {
  it('returns a URL for a valid absolute path', async () => {
    const { buildUrl } = await import('../../../src/lib/urlBuilder.ts');
    const u = buildUrl('https://example.com/path');
    expect(u).toBeInstanceOf(URL);
    expect(u.href).toBe('https://example.com/path');
  });

  it('returns a URL for a relative path resolved against a supplied base', async () => {
    // In the Vite browser runtime API_BASE_URL is populated from
    // VITE_API_BASE_URL / window.location.origin; in the Node
    // test runner neither exists, so the same-origin fallback
    // produces an empty base. Pass an explicit base for the test
    // to verify the relative-resolution path.
    const { buildApiUrl } = await import('../../../src/lib/urlBuilder.ts');
    const u = buildApiUrl('/api/v2/auth/me', { base: 'https://api.example.test' });
    expect(u).toBeInstanceOf(URL);
    expect(u.pathname).toBe('/api/v2/auth/me');
    expect(u.origin).toBe('https://api.example.test');
  });

  it('returns null AND logs [INVALID_URL] for undefined', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { buildUrl, _resetInvalidUrlMemo } = await import('../../../src/lib/urlBuilder.ts');
    _resetInvalidUrlMemo();
    const u = buildUrl(undefined);
    expect(u).toBeNull();
    const invalidCalls = errSpy.mock.calls.filter(
      (c) => String(c[0]) === '[INVALID_URL]',
    );
    expect(invalidCalls.length).toBe(1);
    errSpy.mockRestore();
  });

  it('returns null AND logs [INVALID_URL] for empty string', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { buildUrl, _resetInvalidUrlMemo } = await import('../../../src/lib/urlBuilder.ts');
    _resetInvalidUrlMemo();
    const u = buildUrl('');
    expect(u).toBeNull();
    expect(errSpy).toHaveBeenCalledWith('[INVALID_URL]', '');
    errSpy.mockRestore();
  });

  it('returns null AND logs [INVALID_URL] for non-string (number)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { buildUrl, _resetInvalidUrlMemo } = await import('../../../src/lib/urlBuilder.ts');
    _resetInvalidUrlMemo();
    const u = buildUrl(42);
    expect(u).toBeNull();
    expect(errSpy).toHaveBeenCalledWith('[INVALID_URL]', 42);
    errSpy.mockRestore();
  });

  it('silent option suppresses the [INVALID_URL] log', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { buildUrl, _resetInvalidUrlMemo } = await import('../../../src/lib/urlBuilder.ts');
    _resetInvalidUrlMemo();
    const u = buildUrl(undefined, { silent: true });
    expect(u).toBeNull();
    const invalidCalls = errSpy.mock.calls.filter(
      (c) => String(c[0]) === '[INVALID_URL]',
    );
    expect(invalidCalls.length).toBe(0);
    errSpy.mockRestore();
  });

  it('[INVALID_URL] log fires only ONCE per unique bad input', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { buildUrl, _resetInvalidUrlMemo } = await import('../../../src/lib/urlBuilder.ts');
    _resetInvalidUrlMemo();
    buildUrl(undefined);
    buildUrl(undefined);
    buildUrl(undefined);
    const invalidCalls = errSpy.mock.calls.filter(
      (c) => String(c[0]) === '[INVALID_URL]',
    );
    expect(invalidCalls.length).toBe(1);
    errSpy.mockRestore();
  });

  it('buildFetchUrl returns a string suitable for fetch()', async () => {
    const { buildFetchUrl } = await import('../../../src/lib/urlBuilder.ts');
    const u = buildFetchUrl('/api/v2/auth/me', { base: 'https://api.example.test' });
    expect(typeof u).toBe('string');
    expect(u).toContain('/api/v2/auth/me');
  });

  it('buildFetchUrl returns null for undefined', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { buildFetchUrl, _resetInvalidUrlMemo } = await import('../../../src/lib/urlBuilder.ts');
    _resetInvalidUrlMemo();
    expect(buildFetchUrl(undefined)).toBeNull();
    errSpy.mockRestore();
  });

  it('isBuildable returns boolean without firing [INVALID_URL]', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { isBuildable, _resetInvalidUrlMemo } = await import('../../../src/lib/urlBuilder.ts');
    _resetInvalidUrlMemo();
    expect(isBuildable(undefined)).toBe(false);
    expect(isBuildable('/api/v2/auth/me', { base: 'https://api.example.test' })).toBe(true);
    const invalidCalls = errSpy.mock.calls.filter(
      (c) => String(c[0]) === '[INVALID_URL]',
    );
    // Boolean guard NEVER logs.
    expect(invalidCalls.length).toBe(0);
    errSpy.mockRestore();
  });

  it('buildUrl with custom base resolves against that base', async () => {
    const { buildUrl } = await import('../../../src/lib/urlBuilder.ts');
    const u = buildUrl('/forecast', { base: 'https://api.open-meteo.com/v1' });
    expect(u).toBeInstanceOf(URL);
    expect(u.origin).toBe('https://api.open-meteo.com');
    expect(u.pathname).toBe('/forecast');
  });

  it('buildUrlOr returns fallback when primary fails', async () => {
    const { buildUrlOr } = await import('../../../src/lib/urlBuilder.ts');
    const u = buildUrlOr(undefined, '/safe-default', { base: 'https://x.test' });
    expect(u).toBeInstanceOf(URL);
    expect(u.pathname).toBe('/safe-default');
  });
});
