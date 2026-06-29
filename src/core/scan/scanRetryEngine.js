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

/**
 * isRetriableScanFailure — should a failed provider attempt be retried?
 *
 * Resilience rule: retry ONLY transient failures. A terminal failure cannot
 * succeed on retry, so hammering it 3× with backoff just makes the farmer wait
 * longer — and for CREDITS it is actively wasteful. Mirrors the server-side
 * FAILURE_CATEGORY semantics (services/scan/certification/providerFailure.js):
 *   TERMINAL  → AUTH (401/403), CREDITS (402), INVALID_RESPONSE (parse/malformed),
 *               and an empty result (same photo → same empty candidate list).
 *   TRANSIENT → TIMEOUT, NETWORK/5xx, RATE_LIMIT (429), and anything unknown.
 *
 * Safe asymmetry: returns true (retry) for anything not CLEARLY terminal, so it
 * can only skip pointless retries — it never blocks a transient one. Pure, total.
 *
 * @param {string} reason  failure reason / error message (any provider shape)
 * @returns {boolean}
 */
export function isRetriableScanFailure(reason) {
  const r = String(reason == null ? '' : reason).toLowerCase();
  if (!r) return true; // unknown → allow retry (safe default)
  if (/http[_\s-]?40[13]\b|unauthor|forbidden|invalid.?key|credential|\bapi.?key\b|\bauth\b/.test(r)) return false; // AUTH
  if (/http[_\s-]?402\b|credit|quota|insufficient|payment|exhaust|out of/.test(r)) return false;                    // CREDITS
  if (/http[_\s-]?40[04]\b/.test(r)) return false; // 400 bad request / 404 not found — our request/endpoint, retry won't help
  if (/parse|malformed|invalid.?response|unexpected token|unexpected end|bad.?json|schema|map_error/.test(r)) return false; // bad body
  if (/no.?candidate|empty.?candidate|no.?plant|no.?match|unsupported.?object/.test(r)) return false;              // empty result
  return true; // timeout / network / 5xx / 429 / unknown → transient
}

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
  // Optional resilience gate: a predicate (reason, attempt) => boolean. When it
  // returns false the failure is terminal and we stop retrying immediately.
  // Absent → retry every failure (backward-compatible). Pass isRetriableScanFailure.
  const shouldRetry = typeof o.shouldRetry === 'function' ? o.shouldRetry : null;
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
    // Terminal failure (auth / credits / malformed body / empty result) → retrying
    // cannot succeed; give up now rather than waste the farmer's time on backoff.
    if (shouldRetry && !shouldRetry(reason, attempt)) {
      return Object.freeze({
        ok: false, value: null, attempts: attempt,
        totalLatencyMs: Date.now() - t0, lastError: reason,
        stale: false, gaveUp: 'terminal', timings: Object.freeze(timings.slice()),
      });
    }
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
  DEFAULT_RETRY_OPTS, withScanRetry, isRetriableScanFailure,
  _setDelayForTests, _resetDelayForTests,
};
export default _module;
