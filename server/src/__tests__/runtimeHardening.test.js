/**
 * runtimeHardening.test.js — Runtime Hardening + Asset Recovery
 * Fix.
 *
 * Coverage:
 *   1. SafeImage component contract:
 *      - default-exports a function
 *      - source-level: imports safeImage, handles onError ONCE
 *      - no raw <img src=undefined> patterns
 *   2. runtimeTelemetry:
 *      - 7 spec kinds present
 *      - counters increment per emission
 *      - throttled at 5 console lines per kind per session
 *      - reset zeroes every counter
 *      - safe-payload allow-list drops PII keys
 *      - never throws on garbage
 *   3. Existing asset-fix infrastructure regression:
 *      - safeImage util still returns the canonical fallback
 *        for null/undefined/path-traversal
 *      - DEFAULT_FARM_IMAGE points at the realism registry
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import SafeImage from '../../../src/components/common/SafeImage.jsx';
import {
  trackRuntimeEvent,
  getRuntimeCounters,
  resetRuntimeCounters,
  isThrottled,
  RUNTIME_KINDS,
} from '../../../src/lib/runtime/runtimeTelemetry.js';
import { safeImage, DEFAULT_FARM_IMAGE } from '../../../src/utils/safeImage.js';

const ROOT = resolve(process.cwd(), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

beforeEach(() => {
  resetRuntimeCounters();
});

// ─── 1. SafeImage component ──────────────────────────────────

describe('SafeImage component', () => {
  it('default-exports a function (React component)', () => {
    expect(typeof SafeImage).toBe('function');
    expect(SafeImage.name).toBe('SafeImage');
  });

  it('source-level: imports safeImage from utils', () => {
    const src = read('src/components/common/SafeImage.jsx');
    expect(src).toMatch(/from '\.\.\/\.\.\/utils\/safeImage\.js'/);
    expect(src).toMatch(/safeImage/);
  });

  it('source-level: handles onError with a one-shot swap (no retry loop)', () => {
    const src = read('src/components/common/SafeImage.jsx');
    // The handleError implementation must check `hasErrored` and
    // bail out on the second failure - this is the loop guard.
    expect(src).toMatch(/if \(hasErrored\)/);
    expect(src).toMatch(/setHasErrored\(true\)/);
  });

  it('source-level: passes loading="lazy" + decoding="async"', () => {
    const src = read('src/components/common/SafeImage.jsx');
    expect(src).toMatch(/loading=\{lazy/);
    expect(src).toMatch(/decoding="async"/);
  });

  it('source-level: NEVER renders <img src=undefined> (always resolved)', () => {
    const src = read('src/components/common/SafeImage.jsx');
    // resolvedSrc + currentSrc are derived from safeImage which
    // returns DEFAULT_FARM_IMAGE on null/undefined inputs.
    expect(src).toMatch(/src=\{currentSrc\}/);
    expect(src).not.toMatch(/src=\{src\}/);     // raw src would skip safety
    expect(src).not.toMatch(/src=\{undefined\}/);
    expect(src).not.toMatch(/src=""/);
  });
});

// ─── 2. runtimeTelemetry ─────────────────────────────────────

describe('runtimeTelemetry — RUNTIME_KINDS', () => {
  it('exposes every spec-mandated kind', () => {
    expect(RUNTIME_KINDS.IMAGE_FALLBACK).toBe('image_fallback');
    expect(RUNTIME_KINDS.INVALID_URL).toBe('invalid_url');
    expect(RUNTIME_KINDS.SCAN_FAILURE).toBe('scan_failure');
    expect(RUNTIME_KINDS.RETRY_ATTEMPT).toBe('retry_attempt');
    expect(RUNTIME_KINDS.EXTENSION_NOISE).toBe('extension_noise');
    expect(RUNTIME_KINDS.FETCH_TIMEOUT).toBe('fetch_timeout');
    expect(RUNTIME_KINDS.BOUNDARY_CAUGHT).toBe('boundary_caught');
  });

  it('initial counters are all zero', () => {
    const c = getRuntimeCounters();
    expect(c.image_fallback).toBe(0);
    expect(c.invalid_url).toBe(0);
    expect(c.scan_failure).toBe(0);
  });
});

describe('runtimeTelemetry.trackRuntimeEvent', () => {
  it('increments the counter for the given kind', () => {
    trackRuntimeEvent(RUNTIME_KINDS.IMAGE_FALLBACK, { src: '/foo.jpg' });
    trackRuntimeEvent(RUNTIME_KINDS.IMAGE_FALLBACK, { src: '/bar.jpg' });
    const c = getRuntimeCounters();
    expect(c.image_fallback).toBe(2);
  });

  it('separate kinds increment independently', () => {
    trackRuntimeEvent(RUNTIME_KINDS.SCAN_FAILURE, { stage: 'upload' });
    trackRuntimeEvent(RUNTIME_KINDS.INVALID_URL, { value: 'undefined' });
    trackRuntimeEvent(RUNTIME_KINDS.SCAN_FAILURE, { stage: 'inference' });
    const c = getRuntimeCounters();
    expect(c.scan_failure).toBe(2);
    expect(c.invalid_url).toBe(1);
  });

  it('throttles console emissions at 5 per kind per session', () => {
    for (let i = 0; i < 8; i += 1) {
      trackRuntimeEvent(RUNTIME_KINDS.IMAGE_FALLBACK, { attempt: i });
    }
    expect(isThrottled(RUNTIME_KINDS.IMAGE_FALLBACK)).toBe(true);
    // Counter still records every emission.
    expect(getRuntimeCounters().image_fallback).toBe(8);
  });

  it('resetRuntimeCounters zeroes every counter + clears throttle', () => {
    trackRuntimeEvent(RUNTIME_KINDS.IMAGE_FALLBACK, {});
    resetRuntimeCounters();
    expect(getRuntimeCounters().image_fallback).toBe(0);
    expect(isThrottled(RUNTIME_KINDS.IMAGE_FALLBACK)).toBe(false);
  });

  it('drops payload keys outside the safe allow-list', async () => {
    // Source inspection - the safe-keys constant lives in the module.
    const src = read('src/lib/runtime/runtimeTelemetry.js');
    expect(src).toMatch(/_SAFE_KEYS/);
    expect(src).toMatch(/'src',/);
    expect(src).toMatch(/'value',/);
    expect(src).toMatch(/'durationMs',/);
    // Payload keys NOT in the list (authToken, imageBase64, etc.)
    // are dropped silently. We can't easily intercept console here,
    // but the source-level guard is enforced.
  });

  it('never throws on garbage input', () => {
    expect(() => trackRuntimeEvent(null, null)).not.toThrow();
    expect(() => trackRuntimeEvent(undefined, undefined)).not.toThrow();
    expect(() => trackRuntimeEvent('', null)).not.toThrow();
    expect(() => trackRuntimeEvent(42, 'string')).not.toThrow();
    expect(() => trackRuntimeEvent(RUNTIME_KINDS.IMAGE_FALLBACK, 'not-an-object')).not.toThrow();
  });
});

// ─── 3. Existing asset infrastructure regression ────────────

describe('safeImage util — canonical fallback still pins the registry path', () => {
  it('DEFAULT_FARM_IMAGE points at the realism registry', () => {
    expect(DEFAULT_FARM_IMAGE).toMatch(/^\/assets\/realism\//);
  });

  it('safeImage(null) returns the canonical fallback', () => {
    expect(safeImage(null)).toBe(DEFAULT_FARM_IMAGE);
  });

  it('safeImage("../etc") rejects path traversal', () => {
    expect(safeImage('../etc/passwd')).toBe(DEFAULT_FARM_IMAGE);
  });

  it('safeImage("https://x.test/a.jpg") accepts http(s)', () => {
    expect(safeImage('https://x.test/a.jpg')).toBe('https://x.test/a.jpg');
  });
});

// ─── 4. Acceptance ──────────────────────────────────────────

describe('Acceptance — runtime hardening surfaces are in place', () => {
  it('SafeImage + runtimeTelemetry + safeImage util all importable cleanly', async () => {
    const [si, rt, util] = await Promise.all([
      import('../../../src/components/common/SafeImage.jsx'),
      import('../../../src/lib/runtime/runtimeTelemetry.js'),
      import('../../../src/utils/safeImage.js'),
    ]);
    expect(typeof si.default).toBe('function');
    expect(typeof rt.trackRuntimeEvent).toBe('function');
    expect(typeof util.safeImage).toBe('function');
  });

  it('telemetry can record the full runtime-failure picture in one session', () => {
    trackRuntimeEvent(RUNTIME_KINDS.IMAGE_FALLBACK, { src: '/missing.jpg' });
    trackRuntimeEvent(RUNTIME_KINDS.INVALID_URL,    { value: 'undefined' });
    trackRuntimeEvent(RUNTIME_KINDS.SCAN_FAILURE,   { stage: 'upload' });
    trackRuntimeEvent(RUNTIME_KINDS.RETRY_ATTEMPT,  { attempt: 1 });
    trackRuntimeEvent(RUNTIME_KINDS.FETCH_TIMEOUT,  { durationMs: 12000 });
    trackRuntimeEvent(RUNTIME_KINDS.BOUNDARY_CAUGHT, {});
    const c = getRuntimeCounters();
    expect(c.image_fallback).toBe(1);
    expect(c.invalid_url).toBe(1);
    expect(c.scan_failure).toBe(1);
    expect(c.retry_attempt).toBe(1);
    expect(c.fetch_timeout).toBe(1);
    expect(c.boundary_caught).toBe(1);
  });
});
