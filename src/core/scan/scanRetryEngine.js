/**
 * scanRetryEngine.js — pure async-retry primitive for the scan
 * pipeline.
 *
 *   import { withScanRetry, DEFAULT_RETRY_OPTS } from
 *     'src/core/scan/scanRetryEngine.js';
 *
 *   const out = await withScanRetry(
 *     async (attempt) => analyzeScan({ imageBase64 }),
 *     { activeSessionId, isStale, maxAttempts: 3 },
 *   );
 *
 * Why a dedicated module
 * ──────────────────────
 *   The V5 stability spec asks for silent retries (upload 3×, AI
 *   inference 1×) that don't surface a "Retry" button until the
 *   user-visible budget is exhausted. The retry must:
 *     • respect a stale-session check between attempts so a
 *       cancel + retake doesn't continue an old retry chain
 *     • back off exponentially (200 ms × 2^attempt, capped at 4 s)
 *     • never throw — return a verdict envelope the caller branches
 *       on
 *     • carry the per-attempt timing so the debug overlay shows
 *       inferenceLatencyMs and the failedStage rows
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws (delegates wrap themselves).
 *   • SSR-safe (no DOM / window). Test-injectable timer hook.
 */

const _defaultDelay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let _delay = _defaultDelay;

/** Test hook — inject a synchronous delay so vitest doesn't sleep. */
export function _setDelayForTests(fn) {
  _delay = typeof fn === 'function' ? fn : _defaultDelay;
}
export function _resetDelayForTests() { _delay = _defaultDelay; }

export const DEFAULT_RETRY_OPTS = Object.freeze({
  maxAttempts: 3,
  baseDelayMs: 200,
  maxDelayMs:  4000,
  jitter:      true,
});

function _backoffMs(attempt, opts) {
  const base = Number(opts.baseDelayMs) || DEFAULT_RETRY_OPTS.baseDelayMs;
  const cap  = Number(opts.maxDelayMs)  || DEFAULT_RETRY_OPTS.maxDelayMs;
  const raw = Math.min(cap, base * Math.pow(2, Math.max(0, attempt - 1)));
  if (opts.jitter === false) return raw;
  // Decorrelated jitter: keep [base, raw * 2) range.
  const lo = base;
  const hi = raw * 2;
  return Math.floor(lo + Math.random() * (hi - lo));
}

/**
 * Run `fn(attempt)` up to `opts.maxAttempts` times. The function
 * MUST return a value on success and EITHER throw OR return
 * `{ ok: false }` on failure. The wrapper interprets both.
 *
 * Stale-session signature:
 *   • Provide `isStale: (sessionId) => bool` so the retry chain
 *     short-circuits when the user has moved on.
 *   • Provide `activeSessionId` so each attempt can pass it back to
 *     the caller in the timing rows.
 *
 * Verdict shape:
 *   {
 *     ok:           boolean,
 *     value:        last successful result (or null),
 *     attempts:     number of attempts made,
 *     totalLatencyMs: number,
 *     lastError:    string,
 *     stale:        true when aborted because session went stale,
 *     timings:      [{ attempt, latencyMs, ok, reason }],
 *   }
 */
export async function withScanRetry(fn, opts) {
  const t0 = Date.now();
  const o = (opts && typeof opts === 'object') ? opts : {};
  const maxAttempts = Math.max(1, Number(o.maxAttempts) || DEFAULT_RETRY_OPTS.maxAttempts);
  const isStale = typeof o.isStale === 'function' ? o.isStale : () => false;
  const activeSessionId = o.activeSessionId || null;
  const onAttempt = typeof o.onAttempt === 'function' ? o.onAttempt : null;
  const timings = [];
  let lastError = '';
  if (typeof fn !== 'function') {
    return Object.freeze({
      ok: false, value: null, attempts: 0, totalLatencyMs: 0,
      lastError: 'no_fn', stale: false, timings: [],
    });
  }
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Stale-session short circuit BEFORE we call fn — the caller
    // may have torn down the session between attempts.
    if (isStale(activeSessionId)) {
      return Object.freeze({
        ok: false, value: null, attempts: attempt - 1,
        totalLatencyMs: Date.now() - t0, lastError: 'stale',
        stale: true, timings: Object.freeze(timings.slice()),
      });
    }
    const tA = Date.now();
    let value = null;
    let ok = false;
    let reason = '';
    try {
      const out = await fn(attempt);
      // Truthy non-{ok:false} return counts as success. This keeps
      // the wrapper agnostic to result shape (analyzeScan returns a
      // result object; uploadImage may return { url }; both fine).
      if (out && typeof out === 'object' && out.ok === false) {
        reason = String(out.reason || 'fn_returned_false');
        ok = false;
      } else if (out == null) {
        reason = 'fn_returned_null';
        ok = false;
      } else {
        value = out;
        ok = true;
      }
    } catch (err) {
      reason = (err && err.message) ? String(err.message) : 'exception';
      ok = false;
    }
    const latencyMs = Date.now() - tA;
    timings.push(Object.freeze({ attempt, latencyMs, ok, reason }));
    try { if (onAttempt) onAttempt({ attempt, latencyMs, ok, reason }); }
    catch { /* swallow */ }
    if (ok) {
      return Object.freeze({
        ok: true, value, attempts: attempt,
        totalLatencyMs: Date.now() - t0, lastError: '',
        stale: false, timings: Object.freeze(timings.slice()),
      });
    }
    lastError = reason;
    if (attempt < maxAttempts) {
      // Re-check stale before sleeping so a fresh cancel skips the
      // wasted backoff.
      if (isStale(activeSessionId)) {
        return Object.freeze({
          ok: false, value: null, attempts: attempt,
          totalLatencyMs: Date.now() - t0, lastError: 'stale',
          stale: true, timings: Object.freeze(timings.slice()),
        });
      }
      const wait = _backoffMs(attempt, o);
      try { await _delay(wait); } catch { /* swallow */ }
    }
  }
  return Object.freeze({
    ok: false, value: null, attempts: maxAttempts,
    totalLatencyMs: Date.now() - t0, lastError,
    stale: false, timings: Object.freeze(timings.slice()),
  });
}

const _module = {
  DEFAULT_RETRY_OPTS, withScanRetry,
  _setDelayForTests, _resetDelayForTests,
};
export default _module;
