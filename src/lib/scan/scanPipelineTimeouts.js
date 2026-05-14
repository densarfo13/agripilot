/**
 * scanPipelineTimeouts — per-stage timeout helpers + safe retry
 * wrappers for the scan pipeline.
 *
 *   import { withScanTimeout, SCAN_TIMEOUTS, safeScanRetry }
 *     from '../lib/scan/scanPipelineTimeouts.js';
 *
 *   const out = await withScanTimeout(
 *     compressImage(file),
 *     SCAN_TIMEOUTS.compression,
 *     'compression',
 *   );
 *
 *   const result = await safeScanRetry(
 *     () => requestScanAnalysis(payload),
 *     { attempts: 2, timeoutMs: SCAN_TIMEOUTS.inference },
 *   );
 *
 * Per-stage budgets (Scan Pipeline Timeout Audit defaults):
 *   compression  10s — iPhone HEIC + large JPEGs decode slowly
 *                       on older devices; a 10s ceiling is the
 *                       point at which we'd rather show a retry
 *                       than wait silently.
 *   upload       12s — Slow cellular connections push base64
 *                       payloads up to ~10s on bad networks;
 *                       budget covers tail latency without
 *                       letting a hung uplink lock the UI.
 *   inference    10s — Slightly above scanApiService's existing
 *                       8s timeout so this outer budget is a
 *                       safety net, not the primary clock.
 *   parsing       3s — Response body parsing is normally
 *                       sub-second; 3s ceiling catches a
 *                       pathological JSON stream stall.
 *
 * Why a separate module
 *   The current scanApiService.js sets ONE timeout (8s) on the
 *   fetch alone — the subsequent `res.json()` await is
 *   unbounded. If the response body streams slowly (slow
 *   network on a large JSON payload) the user sees the
 *   "taking longer than expected" copy with no recovery. This
 *   helper lets every stage carry its own ceiling so a stall
 *   surfaces fast at the offending step instead of bubbling
 *   up as a generic timeout.
 *
 * Strict-rule audit
 *   * Pure JS. Never throws on bad input — bad arguments are
 *     normalised. Promise rejections are passed through.
 *   * The timeout wrapper races the input against a
 *     setTimeout-driven Promise; the original promise is NOT
 *     cancelled (we can't cancel a promise without an
 *     AbortController), so callers that need true cancellation
 *     should pass an AbortController and call .abort() in the
 *     timeout branch themselves. The wrapper accepts an
 *     optional `onTimeout` callback that lets the caller wire
 *     this without coupling here to the AbortController API.
 *   * SSR-safe (no DOM access).
 */

export const SCAN_TIMEOUTS = Object.freeze({
  compression: 10_000,
  upload:      12_000,
  inference:   10_000,
  parsing:      3_000,
});

export class ScanTimeoutError extends Error {
  constructor(stage, ms) {
    super(`scan_${stage}_timeout_${ms}ms`);
    this.name  = 'ScanTimeoutError';
    this.stage = stage || 'unknown';
    this.ms    = Number.isFinite(ms) ? ms : null;
    this.kind  = 'timeout';
  }
}

function _normMs(value, fallback) {
  if (!Number.isFinite(value) || value <= 0) return fallback || 0;
  return value;
}

/**
 * Race a promise against a per-stage timeout.
 *
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} [stage]    label surfaced on the thrown error
 * @param {() => void} [onTimeout] optional fire-and-forget hook
 *   the caller uses to abort a fetch / cancel a worker. Called
 *   only when the timeout fires; never thrown from.
 * @returns {Promise<T>}
 */
export function withScanTimeout(promise, ms, stage, onTimeout) {
  const budget = _normMs(ms, 0);
  if (budget <= 0) return Promise.resolve(promise);
  let timer = null;
  return new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      if (typeof onTimeout === 'function') {
        try { onTimeout(); } catch { /* swallow */ }
      }
      reject(new ScanTimeoutError(stage, budget));
    }, budget);
    Promise.resolve(promise).then(
      (v) => { try { clearTimeout(timer); } catch { /* swallow */ } resolve(v); },
      (e) => { try { clearTimeout(timer); } catch { /* swallow */ } reject(e); },
    );
  });
}

/**
 * Safe-retry wrapper. Runs a factory at most `attempts` times
 * with a per-attempt timeout. Each attempt receives a fresh
 * AbortController on `attempt.signal`. Retries only on
 * ScanTimeoutError + network-shaped errors; rejects 4xx-style
 * failures immediately so the user isn't waiting for a result
 * that will never succeed.
 *
 * @param {(ctx: { attempt: number, signal: AbortSignal }) => Promise<T>} factory
 * @param {object} [opts]
 * @param {number} [opts.attempts]
 * @param {number} [opts.timeoutMs]
 * @param {string} [opts.stage]
 * @returns {Promise<T>}
 */
export async function safeScanRetry(factory, opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const attempts  = Math.max(1, Math.min(4, Number.isFinite(o.attempts)  ? o.attempts  : 2));
  const timeoutMs = _normMs(o.timeoutMs, SCAN_TIMEOUTS.inference);
  const stage     = typeof o.stage === 'string' ? o.stage : 'inference';

  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let controller = null;
    try {
      controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    } catch { controller = null; }
    const signal = controller && controller.signal;

    try {
      const promise = Promise.resolve(factory({ attempt, signal }));
      const onTimeout = () => {
        try { controller && controller.abort(); } catch { /* swallow */ }
      };
      const value = await withScanTimeout(promise, timeoutMs, stage, onTimeout);
      return value;
    } catch (err) {
      lastError = err;
      const isTimeout = err && (err.kind === 'timeout' || err.name === 'ScanTimeoutError');
      const isNetwork = err && err.name === 'TypeError'; // fetch network failure
      const httpStatus = err && (err.status || err.statusCode);
      const is5xx = Number.isFinite(httpStatus) && httpStatus >= 500;
      // 4xx-style errors fail fast — retrying never recovers a
      // 401 / 403 / 404 / 422.
      const retryable = isTimeout || isNetwork || is5xx;
      if (!retryable || attempt >= attempts) break;
    }
  }
  throw lastError || new Error(`safe_retry_exhausted_${stage}`);
}

const _module = {
  SCAN_TIMEOUTS,
  ScanTimeoutError,
  withScanTimeout,
  safeScanRetry,
};
export default _module;
