/**
 * requestDeduplicator.js — in-flight request collapse + race-prevention.
 *
 *   const result = await dedupeRequest('weather:lat=5.6:lng=-0.18', () => fetchWeather(...));
 *
 * Why this exists (spec §9)
 * ─────────────────────────
 *   Two concurrent components requesting the same data (e.g. Home
 *   + DailyBriefingCard both reading weather at mount) shouldn't
 *   trigger two network requests + double-charge the API quota.
 *   This helper collapses identical in-flight requests into one
 *   shared promise — the second caller gets the first caller's
 *   result without firing a duplicate request.
 *
 *   Plus: stale-request guards. When a component remounts and
 *   requests the same key with a newer signal, the older request
 *   can be ABORTED (the AbortController is wired through) so the
 *   stale response doesn't overwrite fresh state.
 *
 * Contract
 * ────────
 *   dedupeRequest(key, factory, options)
 *     • key: stable string identifying the request (e.g. URL +
 *       query). Different keys → different promises.
 *     • factory: () => Promise<T>. Called ONLY when there's no
 *       in-flight matching request.
 *     • options.signal: optional AbortSignal. If aborted, the
 *       caller's promise rejects with AbortError but the inner
 *       request continues (other callers waiting on it still get
 *       the result — abort is per-caller, not shared).
 *     • options.timeoutMs: optional. After this, the promise
 *       rejects with a timeout error.
 *
 * Strict-rule audit
 *   • Pure helpers around an in-process Map. SSR-safe.
 *   • Promises are NEVER reused after resolution — once a request
 *     completes, the entry is removed from the dedup map so the
 *     next call refetches.
 *   • Failures are NOT cached — a rejected promise is removed too,
 *     so a retry triggers a fresh request.
 *   • The factory's promise is never swallowed; it's re-thrown to
 *     every caller in flight at the time of rejection.
 */

const _inflight = new Map();   // key → Promise

// ─── Helpers ──────────────────────────────────────────────────

function _safeKey(k) {
  return (typeof k === 'string' && k) ? k : null;
}

function _timeoutRace(promise, ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return promise;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('request_timeout')), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

function _abortableWrap(promise, signal) {
  if (!signal || typeof signal.addEventListener !== 'function') return promise;
  if (signal.aborted) return Promise.reject(new Error('aborted'));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new Error('aborted'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (v) => { signal.removeEventListener('abort', onAbort); resolve(v); },
      (e) => { signal.removeEventListener('abort', onAbort); reject(e); },
    );
  });
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Run a request through the dedup layer. Returns whatever the
 * factory resolves to. Multiple concurrent callers with the same
 * key share ONE underlying call.
 *
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} factory
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<T>}
 */
export function dedupeRequest(key, factory, options) {
  const k = _safeKey(key);
  if (!k) return Promise.reject(new Error('invalid_key'));
  if (typeof factory !== 'function') return Promise.reject(new Error('invalid_factory'));
  const opts = (options && typeof options === 'object') ? options : {};

  let p = _inflight.get(k);
  if (!p) {
    let underlying;
    try {
      underlying = factory();
    } catch (err) {
      return Promise.reject(err);
    }
    if (!underlying || typeof underlying.then !== 'function') {
      // Factory returned a non-promise — wrap defensively but don't
      // cache, since there's nothing to dedupe.
      return Promise.resolve(underlying);
    }
    p = underlying.finally(() => {
      // Whether resolved or rejected, drop the entry so the next
      // call refetches.
      _inflight.delete(k);
    });
    _inflight.set(k, p);
  }

  // Apply per-caller signal + timeout AROUND the shared promise.
  // The shared promise keeps running for other waiters when one
  // caller aborts.
  let result = p;
  if (opts.signal)     result = _abortableWrap(result, opts.signal);
  if (opts.timeoutMs)  result = _timeoutRace(result, opts.timeoutMs);
  return result;
}

/**
 * Whether a request for this key is currently in flight.
 *
 * @param {string} key
 * @returns {boolean}
 */
export function isInflight(key) {
  return _inflight.has(_safeKey(key));
}

/**
 * Test helper — clear the in-flight map.
 */
export function _resetDedupeState() {
  _inflight.clear();
}

/**
 * Number of currently-tracked in-flight requests. For diagnostics.
 *
 * @returns {number}
 */
export function getInflightCount() {
  return _inflight.size;
}

export default {
  dedupeRequest,
  isInflight,
  getInflightCount,
  _resetDedupeState,
};
