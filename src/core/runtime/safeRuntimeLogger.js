/**
 * safeRuntimeLogger.js — production-safe console policy.
 *
 *   import { safeLog } from 'src/core/runtime/safeRuntimeLogger.js';
 *
 *   safeLog.info('something happened');
 *   safeLog.warn('soft issue', { context });
 *   safeLog.capture(err, { source: 'somewhere' });
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A tiny console wrapper that:
 *     • suppresses `info` / `debug` in production builds
 *     • routes `warn` / `error` through a structured shape
 *     • THROTTLES repeated identical errors (so a re-firing event
 *       loop never floods the console)
 *     • forwards captured errors to the existing
 *       `observabilityTracker.RUNTIME_ERROR` counter
 *
 *   It does NOT silently swallow errors — dev environments still
 *   see them. It does NOT replace Sentry (src/lib/sentry.js) —
 *   that pipeline already exists and continues to receive crashes
 *   via the global ErrorBoundary.
 *
 * Strict-rule audit
 *   • Never throws. SSR-safe.
 */

import { recordObservation, OBSERVABILITY } from '../observability/observabilityTracker.js';

const IS_PROD = (() => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env.PROD === true;
    }
    if (typeof process !== 'undefined' && process.env) {
      return process.env.NODE_ENV === 'production';
    }
  } catch { /* fallthrough */ }
  return false;
})();

const _seen = new Map(); // signature → { count, lastAtMs }
const THROTTLE_MS = 30_000; // identical errors logged at most once per 30 s
const NOISE_LOG_INTERVAL_MS = 60_000;
let _noiseLastLogAt = 0;
let _noiseCount = 0;

function _signature(err, ctx) {
  try {
    const msg = (err && (err.message || String(err))) || 'unknown';
    const src = (ctx && ctx.source) || '';
    return `${src}::${String(msg).slice(0, 200)}`;
  } catch { return 'sig::error'; }
}

function _shouldEmit(sig, nowMs) {
  const prev = _seen.get(sig);
  if (!prev) {
    _seen.set(sig, { count: 1, lastAtMs: nowMs });
    return true;
  }
  prev.count += 1;
  if (nowMs - prev.lastAtMs > THROTTLE_MS) {
    prev.lastAtMs = nowMs;
    return true;
  }
  return false;
}

function _safeConsole(level, ...args) {
  try {
    /* eslint-disable no-console */
    const fn = typeof console !== 'undefined' && typeof console[level] === 'function'
      ? console[level]
      : null;
    if (fn) fn(...args);
    /* eslint-enable no-console */
  } catch { /* never throw from a logger */ }
}

export const safeLog = Object.freeze({
  /** Verbose — dev only. */
  debug(message, ctx) {
    if (IS_PROD) return;
    _safeConsole('debug', '[farroway]', message, ctx || '');
  },
  /** Informational — dev only. */
  info(message, ctx) {
    if (IS_PROD) return;
    _safeConsole('info', '[farroway]', message, ctx || '');
  },
  /** Always shown — for soft issues that don't crash. */
  warn(message, ctx) {
    _safeConsole('warn', '[farroway]', message, ctx || '');
  },
  /** Critical — always shown, structured + throttled. */
  error(message, ctx) {
    const now = Date.now();
    if (_shouldEmit(_signature({ message }, ctx), now)) {
      _safeConsole('error', '[farroway]', message, ctx || '');
    }
  },
  /**
   * Capture a synchronous exception. Routes through:
   *   1. throttled `console.error`,
   *   2. `observabilityTracker.RUNTIME_ERROR`.
   * Never re-throws.
   */
  capture(err, ctx) {
    try {
      const now = Date.now();
      const sig = _signature(err, ctx);
      if (_shouldEmit(sig, now)) {
        _safeConsole('error', '[farroway]', err, ctx || '');
      }
      try { recordObservation(OBSERVABILITY.RUNTIME_ERROR); } catch { /* ignore */ }
    } catch { /* never throw from a logger */ }
  },
  /** Same as `capture` but for promise rejections. */
  captureAsync(err, ctx) {
    this.capture(err, ctx);
  },
  /**
   * Compress noise (e.g. cross-extension rejections) into a single
   * "we suppressed N items" line at most once per minute.
   */
  throttledNoise(label) {
    try {
      _noiseCount += 1;
      const now = Date.now();
      if (now - _noiseLastLogAt > NOISE_LOG_INTERVAL_MS) {
        if (!IS_PROD) {
          _safeConsole('debug', '[farroway:noise]', label, `suppressed=${_noiseCount}`);
        }
        _noiseLastLogAt = now;
        _noiseCount = 0;
      }
    } catch { /* swallow */ }
  },
  /** Test hook — clear throttle state. */
  _resetForTests() {
    _seen.clear();
    _noiseLastLogAt = 0;
    _noiseCount = 0;
  },
});

export default safeLog;
