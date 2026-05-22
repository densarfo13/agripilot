/**
 * permanentRuntimeStability.test.js — Permanent Runtime + Scan
 * Stability. Covers the new runtime, network, assets, and
 * preview seams shipped for this hardening pass.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  safeOn, safeOff, registerSafeRejectionHandler, _resetForTests as _resetBus,
} from '../../../src/core/runtime/runtimeEventBus.js';
import { safeLog } from '../../../src/core/runtime/safeRuntimeLogger.js';
import { safeAuthFetch } from '../../../src/core/network/safeAuthFetch.js';
import {
  resolveAsset, resolveImageWithFallback, LAST_RESORT_IMAGE, DEFAULT_IMAGE_FALLBACKS,
} from '../../../src/core/assets/safeAssetResolver.js';
import {
  isPreviewValid, shouldKeepPreview, fallbackSrcFor, describePreview, PREVIEW_STAGE,
} from '../../../src/core/scan/safePreviewRenderer.js';

// ─── runtimeEventBus — safe listener registration ─────────

function _makeTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      if (listeners.has(type)) listeners.get(type).delete(fn);
    },
    fire(type, ev) {
      const set = listeners.get(type);
      if (!set) return;
      for (const fn of set) fn(ev);
    },
  };
}

describe('safeOn — wrapped handlers cannot crash the page', () => {
  it('registers and unregisters cleanly', () => {
    const target = _makeTarget();
    let count = 0;
    const off = safeOn(target, 'click', () => { count += 1; });
    target.fire('click');
    target.fire('click');
    expect(count).toBe(2);
    off();
    target.fire('click');
    expect(count).toBe(2);
  });

  it('swallows a thrown handler error', () => {
    const target = _makeTarget();
    const off = safeOn(target, 'tick', () => { throw new Error('boom'); });
    expect(() => target.fire('tick')).not.toThrow();
    off();
  });

  it('swallows an async-rejecting handler', async () => {
    const target = _makeTarget();
    const off = safeOn(target, 'tick', async () => { throw new Error('async boom'); });
    expect(() => target.fire('tick')).not.toThrow();
    await new Promise((r) => setTimeout(r, 5));
    off();
  });

  it('idempotent — same handler+type+target wraps once', () => {
    const target = _makeTarget();
    let count = 0;
    const fn = () => { count += 1; };
    const off1 = safeOn(target, 'click', fn);
    const off2 = safeOn(target, 'click', fn);
    target.fire('click');
    expect(count).toBe(1);
    expect(off1).toBe(off2);
    off1();
  });

  it('never throws on garbage input', () => {
    expect(() => safeOn(null, null, null)).not.toThrow();
    expect(() => safeOff(null, null, null)).not.toThrow();
  });
});

describe('registerSafeRejectionHandler — SSR-safe', () => {
  beforeEach(() => { _resetBus(); });

  it('returns false when no window is available (node test env)', () => {
    expect(registerSafeRejectionHandler()).toBe(false);
  });
});

// ─── safeRuntimeLogger ─────────────────────────────────────

describe('safeRuntimeLogger', () => {
  beforeEach(() => safeLog._resetForTests());

  it('exposes the expected API surface', () => {
    expect(typeof safeLog.debug).toBe('function');
    expect(typeof safeLog.info).toBe('function');
    expect(typeof safeLog.warn).toBe('function');
    expect(typeof safeLog.error).toBe('function');
    expect(typeof safeLog.capture).toBe('function');
    expect(typeof safeLog.captureAsync).toBe('function');
    expect(typeof safeLog.throttledNoise).toBe('function');
  });

  it('capture never throws on garbage input', () => {
    expect(() => safeLog.capture(null)).not.toThrow();
    expect(() => safeLog.capture(new Error('x'))).not.toThrow();
    expect(() => safeLog.captureAsync({})).not.toThrow();
  });
});

// ─── safeAuthFetch ─────────────────────────────────────────

describe('safeAuthFetch — 401 retry-once + unavailable shape', () => {
  it('returns ok when fetch resolves with a 2xx + json body', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
    const r = await safeAuthFetch('/api/test');
    expect(r.ok).toBe(true);
    expect(r.data).toEqual({ ok: true });
    delete globalThis.fetch;
  });

  it('returns unavailable on 401 with no refresh handler', async () => {
    globalThis.fetch = async () => new Response('', { status: 401 });
    const r = await safeAuthFetch('/api/v2/tts/status');
    expect(r.ok).toBe(false);
    expect(r.unavailable).toBe(true);
    expect(r.status).toBe(401);
    delete globalThis.fetch;
  });

  it('retries once after onAuthRefresh returns true', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      if (calls === 1) return new Response('', { status: 401 });
      return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const r = await safeAuthFetch('/api/v2/tts/status', {}, { onAuthRefresh: () => true });
    expect(r.ok).toBe(true);
    expect(calls).toBe(2);
    delete globalThis.fetch;
  });

  it('returns unavailable on a 5xx', async () => {
    globalThis.fetch = async () => new Response('', { status: 503 });
    const r = await safeAuthFetch('/api/dead');
    expect(r.unavailable).toBe(true);
    expect(r.status).toBe(503);
    delete globalThis.fetch;
  });

  it('never throws on garbage input', async () => {
    const r = await safeAuthFetch(null);
    expect(r.unavailable).toBe(true);
  });
});

// ─── safeAssetResolver ─────────────────────────────────────

describe('safeAssetResolver', () => {
  it('returns the first candidate in a known fallback chain', () => {
    expect(resolveAsset('logo-premium-192'))
      .toBe(DEFAULT_IMAGE_FALLBACKS['logo-premium-192'][0]);
  });

  it('advances through the chain when prior candidates failed', () => {
    const first = resolveAsset('logo-premium-192');
    const next  = resolveAsset('logo-premium-192', { failedSoFar: [first] });
    expect(next).not.toBe(first);
  });

  it('always ends at the last-resort image when everything fails', () => {
    const chain = DEFAULT_IMAGE_FALLBACKS['logo-premium-192'];
    const out = resolveAsset('logo-premium-192', { failedSoFar: chain.slice() });
    expect(out).toBe(LAST_RESORT_IMAGE);
  });

  it('unknown keys are treated as raw paths with a last-resort fallback', () => {
    const out = resolveAsset('/unknown/path.png');
    expect(out).toBe('/unknown/path.png');
  });

  it('resolveImageWithFallback returns a usable initialSrc + onError advance', () => {
    const r = resolveImageWithFallback('logo-premium');
    expect(typeof r.initialSrc).toBe('string');
    const next = r.nextOnError(r.initialSrc);
    expect(next).not.toBe(r.initialSrc);
  });
});

// ─── safePreviewRenderer ───────────────────────────────────

describe('safePreviewRenderer — no broken-image icon ever', () => {
  it('isPreviewValid requires src + loaded + non-zero dims', () => {
    expect(isPreviewValid({ src: '/x.jpg', loaded: true, naturalWidth: 100, naturalHeight: 100 })).toBe(true);
    expect(isPreviewValid({ src: '/x.jpg', loaded: false, naturalWidth: 100, naturalHeight: 100 })).toBe(false);
    expect(isPreviewValid({ src: '', loaded: true, naturalWidth: 100, naturalHeight: 100 })).toBe(false);
    expect(isPreviewValid({ src: '/x.jpg', loaded: true, naturalWidth: 0, naturalHeight: 0 })).toBe(false);
  });

  it('shouldKeepPreview true for STABLE / ANALYZING / RESULT — the persistence rule', () => {
    expect(shouldKeepPreview(PREVIEW_STAGE.STABLE)).toBe(true);
    expect(shouldKeepPreview(PREVIEW_STAGE.ANALYZING)).toBe(true);
    expect(shouldKeepPreview(PREVIEW_STAGE.RESULT)).toBe(true);
    expect(shouldKeepPreview(PREVIEW_STAGE.EMPTY)).toBe(false);
    expect(shouldKeepPreview(PREVIEW_STAGE.ERROR)).toBe(false);
  });

  it('fallbackSrcFor returns the brand mark ONLY on ERROR stage', () => {
    expect(fallbackSrcFor(PREVIEW_STAGE.ERROR)).toBe(LAST_RESORT_IMAGE);
    for (const s of [
      PREVIEW_STAGE.EMPTY, PREVIEW_STAGE.LOADING, PREVIEW_STAGE.STABLE,
      PREVIEW_STAGE.ANALYZING, PREVIEW_STAGE.RESULT,
    ]) {
      expect(fallbackSrcFor(s)).toBe('');
    }
  });

  it('describePreview is failure-safe', () => {
    expect(() => describePreview(null, null)).not.toThrow();
    const d = describePreview(
      { src: '/x.jpg', loaded: true, naturalWidth: 100, naturalHeight: 100 },
      PREVIEW_STAGE.STABLE,
    );
    expect(d.shouldRender).toBe(true);
    expect(d.src).toBe('/x.jpg');
  });
});
