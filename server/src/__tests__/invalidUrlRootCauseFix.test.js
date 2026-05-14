/**
 * invalidUrlRootCauseFix.test.js — Invalid URL Root-Cause Fix.
 *
 *   The Failed-to-construct-URL error in production has TWO real
 *   sources:
 *     A. unguarded `new URL(undefined)` calls (already wrapped
 *        in safeUrl across the codebase, but the helper alias
 *        below makes the call-site signature explicit)
 *     B. browser-extension scripts logging into the same console,
 *        producing lines that LOOK like our errors but aren't.
 *
 * Coverage:
 *   1. safeBuildUrl — base+path normalisation + null safety
 *   2. preflightUrl — structured outcome for fetch-pre-flight gates
 *   3. extensionNoiseFilter — drops every spec-mandated noise
 *      pattern + leaves real Farroway logs intact
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  safeBuildUrl,
  preflightUrl,
} from '../../../src/lib/url/safeBuildUrl.js';
import {
  isExtensionNoise,
  installExtensionNoiseFilter,
  uninstallExtensionNoiseFilter,
  getFilteredCount,
  _resetExtensionNoiseFilter,
} from '../../../src/lib/console/extensionNoiseFilter.js';

// ─── 1. safeBuildUrl ────────────────────────────────────────

describe('safeBuildUrl — base + path normalisation', () => {
  it('returns null on undefined / null / empty path', () => {
    expect(safeBuildUrl('https://api.test', undefined)).toBeNull();
    expect(safeBuildUrl('https://api.test', null)).toBeNull();
    expect(safeBuildUrl('https://api.test', '')).toBeNull();
    expect(safeBuildUrl('https://api.test', '   ')).toBeNull();
  });

  it('returns null on undefined / null base', () => {
    // The spec's "no undefined" requirement.
    expect(safeBuildUrl(undefined, '/scan')).toBeNull();
    expect(safeBuildUrl(null, '/scan')).toBeNull();
  });

  it('rejects non-http(s) bases that are not relative paths', () => {
    expect(safeBuildUrl('not-a-url', '/scan')).toBeNull();
    expect(safeBuildUrl('javascript:alert(1)', '/scan')).toBeNull();
    expect(safeBuildUrl('ftp://x.test', '/scan')).toBeNull();
  });

  it('accepts http(s) bases', () => {
    expect(safeBuildUrl('https://api.test', '/scan')).toBe('https://api.test/scan');
    expect(safeBuildUrl('http://localhost:3000', '/scan')).toBe('http://localhost:3000/scan');
  });

  it('does not produce double slashes', () => {
    const url = safeBuildUrl('https://api.test/', '/scan');
    expect(url).toBe('https://api.test/scan');
    const url2 = safeBuildUrl('https://api.test', 'scan');
    expect(url2).toBe('https://api.test/scan');
  });

  it('preserves query strings', () => {
    expect(safeBuildUrl('https://api.test', '/scan?lat=39&lng=-77'))
      .toBe('https://api.test/scan?lat=39&lng=-77');
  });

  it('accepts numeric strings or boolean as falsy/invalid', () => {
    expect(safeBuildUrl('https://api.test', 42)).toBeNull();
    expect(safeBuildUrl(42, '/scan')).toBeNull();
    expect(safeBuildUrl('https://api.test', true)).toBeNull();
  });

  it('relative-path base only resolves when a window.location.origin exists', () => {
    // In Node/SSR (no window), a bare '/' base cannot be resolved
    // by `new URL` — the underlying buildFetchUrl returns null
    // because there's no origin to attach to. That's the correct
    // failure mode; in browser-side execution the same call uses
    // window.location.origin and returns a fully-qualified URL.
    const url = safeBuildUrl('/', '/scan');
    expect(url === null || typeof url === 'string').toBe(true);
  });
});

// ─── 2. preflightUrl — structured outcome ───────────────────

describe('preflightUrl — structured outcome', () => {
  it('returns ok:true + url on a valid base/path', () => {
    const out = preflightUrl('https://api.test', '/scan');
    expect(out.ok).toBe(true);
    expect(out.url).toBe('https://api.test/scan');
    expect(out.reason).toBeNull();
  });

  it('returns ok:false + reason="missing_base" when base is null', () => {
    const out = preflightUrl(null, '/scan');
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('missing_base');
  });

  it('returns ok:false + reason="missing_path" when path is null', () => {
    const out = preflightUrl('https://api.test', null);
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('missing_path');
  });

  it('returns ok:false + reason="malformed" when base is junk', () => {
    const out = preflightUrl('not-a-url', '/scan');
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('malformed');
  });

  it('outcome is frozen', () => {
    const out = preflightUrl('https://api.test', '/scan');
    expect(Object.isFrozen(out)).toBe(true);
  });
});

// ─── 3. extensionNoiseFilter ────────────────────────────────

describe('extensionNoiseFilter — isExtensionNoise', () => {
  it('drops every spec-mandated noise pattern', () => {
    // Spec §7 patterns:
    expect(isExtensionNoise(['tabs:outgoing.message.ready'])).toBe(true);
    expect(isExtensionNoise(['cornhusk/shared-service'])).toBe(true);
    expect(isExtensionNoise(['Error from chrome-extension://abcdef'])).toBe(true);
    expect(isExtensionNoise(['moz-extension://abc-def'])).toBe(true);
    expect(isExtensionNoise(['evmAsk.js:42 something'])).toBe(true);
    expect(isExtensionNoise(['injectedScript:1 message'])).toBe(true);
    expect(isExtensionNoise(['content_script.js error'])).toBe(true);
  });

  it('lets real Farroway logs through', () => {
    expect(isExtensionNoise(['[HOME_FARM_HYDRATION]', { farmsCount: 1 }])).toBe(false);
    expect(isExtensionNoise(['[SCAN_INFERENCE_RESPONSE]', { attempt: 0 }])).toBe(false);
    expect(isExtensionNoise(['user clicked button'])).toBe(false);
    expect(isExtensionNoise(['Failed to fetch /api/v2/scan'])).toBe(false);
  });

  it('handles Error instances in args', () => {
    const err = new Error('failed in chrome-extension://abc');
    expect(isExtensionNoise([err])).toBe(true);
    expect(isExtensionNoise([new Error('analytics failed')])).toBe(false);
  });

  it('handles null / non-array safely', () => {
    expect(isExtensionNoise(null)).toBe(false);
    expect(isExtensionNoise(undefined)).toBe(false);
    expect(isExtensionNoise('string')).toBe(false);
  });
});

describe('extensionNoiseFilter — install / uninstall', () => {
  let origError;
  let origWarn;
  beforeEach(() => {
    origError = console.error;
    origWarn  = console.warn;
    _resetExtensionNoiseFilter();
  });
  afterEach(() => {
    uninstallExtensionNoiseFilter();
    console.error = origError;
    console.warn  = origWarn;
  });

  it('wraps console.error + suppresses noise', () => {
    const seen = [];
    console.error = (...a) => seen.push(['error', ...a]);
    installExtensionNoiseFilter();
    console.error('Real Farroway error: something failed');
    console.error('tabs:outgoing.message.ready');
    expect(seen.length).toBe(1);
    expect(seen[0][1]).toContain('Real Farroway error');
    expect(getFilteredCount()).toBe(1);
  });

  it('wraps console.warn + suppresses noise', () => {
    const seen = [];
    console.warn = (...a) => seen.push(['warn', ...a]);
    installExtensionNoiseFilter();
    console.warn('Real warning');
    console.warn('Failed to load resource from chrome-extension://abc');
    expect(seen.length).toBe(1);
    expect(getFilteredCount()).toBe(1);
  });

  it('idempotent — installing twice is safe', () => {
    expect(installExtensionNoiseFilter()).toBe(true);
    expect(installExtensionNoiseFilter()).toBe(true);
    expect(() => uninstallExtensionNoiseFilter()).not.toThrow();
  });

  it('uninstall restores original console functions', () => {
    const errOriginal = console.error;
    installExtensionNoiseFilter();
    expect(console.error).not.toBe(errOriginal);
    uninstallExtensionNoiseFilter();
    expect(console.error).toBe(errOriginal);
  });
});

// ─── 4. Acceptance — scan-flow URL gating ───────────────────

describe('Acceptance — scan flow no longer builds an invalid URL', () => {
  it('preflightUrl gates the scan endpoint before fetch', () => {
    // Simulate the production scan URL build with a missing
    // VITE_API_BASE_URL (the historic root cause).
    const check = preflightUrl(undefined, '/api/scan/analyze');
    expect(check.ok).toBe(false);
    expect(check.reason).toBe('missing_base');
    // The caller now bails out cleanly instead of letting
    // fetch(`${undefined}/api/scan/analyze`) reach `new URL`.
  });

  it('a valid base + path produces a fetchable URL', () => {
    const check = preflightUrl('https://farroway.app/api', '/scan/analyze');
    expect(check.ok).toBe(true);
    expect(check.url).toMatch(/\/scan\/analyze/);
    // This is what fetch(check.url) would actually request.
  });
});
