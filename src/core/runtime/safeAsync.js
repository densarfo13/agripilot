/**
 * safeAsync.js — zero-throw async wrapper for API calls and
 * any other promise-returning operations.
 *
 * PROBLEM SOLVED
 * ──────────────
 * Uncaught promise rejections cause:
 *   • Silent failures (promise swallowed before .catch())
 *   • Unhandled rejection warnings in browser console
 *   • React render states left in an inconsistent "loading"
 *     limbo when the error path wasn't prepared for
 *
 * `safeAsync` wraps any async function in a try/catch and
 * normalises the result into a single tagged union:
 *
 *   { ok: true,  data: T,    error: null   }   ← success
 *   { ok: false, data: null, error: string }   ← failure
 *
 * The caller never needs to write try/catch for network calls.
 *
 * USAGE
 * ─────
 *   import { safeAsync } from '../core/runtime/safeAsync.js';
 *
 *   // Simple call:
 *   const result = await safeAsync(() => fetchWeather(lat, lng));
 *   if (result.ok) render(result.data);
 *   else showFallback();
 *
 *   // With timeout:
 *   const result = await safeAsync(() => fetchWeather(lat, lng), { timeoutMs: 6000 });
 *
 *   // With named context (improves error logs):
 *   const result = await safeAsync(() => fetchWeather(lat, lng), { name: 'fetchWeather' });
 *
 * FEATURES
 * ────────
 *   • Never throws. All errors produce `{ ok: false, error: '...' }`.
 *   • Optional hard timeout via AbortController.
 *   • Structured error message — classifies network vs. server vs. unknown.
 *   • Audit-safe — never logs PII. Error messages are truncated at 400 chars.
 *
 * STRICT-RULE AUDIT
 * ─────────────────
 *   • No React / hook dependencies. Use anywhere (hooks, utils, workers).
 *   • Pure function with optional timeout side-effect (controller.abort).
 *   • SSR-safe.
 */

// ─── Error classification ─────────────────────────────────────────
/**
 * Classify a caught error into a user-safe string.
 * Never leaks PII or internal stack traces.
 *
 * @param {unknown} err
 * @param {string}  [name] — operation name for context
 * @returns {string}
 */
function _classifyError(err, name) {
  const ctx = name ? `[${name}] ` : '';

  if (!err) return ctx + 'Unknown error';

  const isAbort = err.name === 'AbortError'
    || /aborted/i.test(String(err.message || ''));
  if (isAbort) return ctx + 'Request timed out';

  // Network failures (no response from server).
  const isNetwork = err.name === 'TypeError'
    || err.code === 'ERR_NETWORK'
    || err.isNetworkError === true
    || /network|fetch|failed to fetch|load failed/i.test(String(err.message || ''));
  if (isNetwork) return ctx + 'Network unavailable';

  // HTTP error status on the response.
  const status = err.status || err.response?.status;
  if (status) {
    if (status === 401) return ctx + 'Session expired — please sign in again';
    if (status === 403) return ctx + 'You don\'t have permission for this';
    if (status === 404) return ctx + 'Resource not found';
    if (status === 429) return ctx + 'Too many requests — please wait a moment';
    if (status >= 500)  return ctx + 'Server error — please try again';
    return ctx + `Request failed (${status})`;
  }

  // Generic message with length cap.
  const msg = String(err.message || err || 'Unknown error');
  return ctx + msg.slice(0, 400);
}

// ─── safeAsync ────────────────────────────────────────────────────
/**
 * @template T
 * @param {() => Promise<T>} fn       — async function to execute
 * @param {{ timeoutMs?: number, name?: string }} [opts]
 * @returns {Promise<{ ok: true, data: T, error: null }
 *                 | { ok: false, data: null, error: string }>}
 */
export async function safeAsync(fn, opts = {}) {
  const { timeoutMs, name } = opts;

  let controller = null;
  let timer      = null;

  try {
    // Validate the function argument.
    if (typeof fn !== 'function') {
      return { ok: false, data: null, error: '[safeAsync] fn must be a function' };
    }

    // Optional AbortController for timeout.
    if (timeoutMs && Number.isFinite(timeoutMs) && timeoutMs > 0) {
      controller = new AbortController();
      timer = setTimeout(() => {
        try { controller.abort(); } catch { /* swallow */ }
      }, timeoutMs);
    }

    const data = await fn(controller?.signal);
    return { ok: true, data: data ?? null, error: null };

  } catch (err) {
    const error = _classifyError(err, name);
    return { ok: false, data: null, error };

  } finally {
    if (timer != null) clearTimeout(timer);
  }
}

// ─── safeAsyncAll ─────────────────────────────────────────────────
/**
 * Run multiple async operations in parallel. Each result is
 * independently wrapped so one failure doesn't block others.
 *
 * @param {Array<[string, () => Promise<unknown>]>} entries
 *   Array of [name, fn] tuples.
 * @returns {Promise<Record<string, {ok, data, error}>>}
 *
 * @example
 *   const { weather, tasks, progress } = await safeAsyncAll([
 *     ['weather',  () => fetchWeather(lat, lng)],
 *     ['tasks',    () => fetchTasks(farmId)],
 *     ['progress', () => fetchProgress(farmId)],
 *   ]);
 */
export async function safeAsyncAll(entries) {
  if (!Array.isArray(entries)) return {};

  const settled = await Promise.allSettled(
    entries.map(([name, fn]) => safeAsync(fn, { name })),
  );

  const result = {};
  entries.forEach(([name], i) => {
    // allSettled always fulfills — value is the safeAsync result.
    result[name] = settled[i].status === 'fulfilled'
      ? settled[i].value
      : { ok: false, data: null, error: `[${name}] Promise.allSettled rejected` };
  });
  return result;
}

// ─── withSafeAsync ────────────────────────────────────────────────
/**
 * Higher-order decorator. Wraps an existing async function so it
 * always returns { ok, data, error } instead of throwing.
 *
 * @template T
 * @param {(...args: any[]) => Promise<T>} asyncFn
 * @param {{ name?: string, timeoutMs?: number }} [opts]
 * @returns {(...args: any[]) => Promise<{ok, data, error}>}
 *
 * @example
 *   const safeFetchWeather = withSafeAsync(fetchWeather, { name: 'fetchWeather' });
 *   const { ok, data } = await safeFetchWeather(lat, lng);
 */
export function withSafeAsync(asyncFn, opts = {}) {
  return function safeWrapped(...args) {
    return safeAsync(() => asyncFn(...args), opts);
  };
}

// ─── Test hooks ───────────────────────────────────────────────────
export const _internal = Object.freeze({
  _classifyError,
  safeAsync,
  safeAsyncAll,
  withSafeAsync,
});

export default safeAsync;
