/**
 * src/core/api/client.js — hardened API client facade.
 *
 * Re-exports the central axios instance from src/api/client.js
 * and adds runtime-layer enhancements:
 *
 *   1. Offline detection before every request.
 *   2. Standardized error object (never raw axios errors to callers).
 *   3. safeAsync() integration so callers get { ok, data, error }.
 *   4. Per-request timeout (default 10 s) with abort on timeout.
 *   5. One-shot retry for idempotent operations.
 *
 * WHY A FACADE?
 * ─────────────
 * src/api/client.js is 300+ lines of auth, interceptor, and
 * retry logic. Adding runtime-layer concerns there would increase
 * coupling. This facade sits between the runtime layer and the
 * raw axios client — consumers in src/core/* use this file;
 * existing page/component code that already imports src/api/client.js
 * continues working unchanged.
 *
 * USAGE
 * ─────
 *   import { coreGet, corePost, corePut, coreDelete } from '../core/api/client.js';
 *
 *   // Simple GET:
 *   const { ok, data, error } = await coreGet('/api/weather', { lat, lng });
 *   if (!ok) return SAFE_WEATHER;
 *   return data;
 *
 *   // POST with body:
 *   const { ok, error } = await corePost('/api/tasks/complete', { taskId });
 *
 * STRICT-RULE AUDIT
 * ─────────────────
 *   • Never throws — all errors returned in { ok: false, error }.
 *   • Never logs tokens, passwords, or session IDs.
 *   • Offline detection runs synchronously before the network call.
 *   • Timeout aborts the request — no orphaned fetch.
 *   • SSR-safe (checks typeof navigator before reading .onLine).
 */

import api from '../../api/client.js';
import { safeAsync } from '../runtime/safeAsync.js';

// ─── Constants ───────────────────────────────────────────────────
const DEFAULT_TIMEOUT_MS = 10_000;  // 10 seconds
const RETRY_DELAY_MS     = 800;     // wait before single retry

// ─── Offline detection ───────────────────────────────────────────
/**
 * Quick synchronous check. Does NOT probe the network — callers
 * that need a deep reachability check should call isReallyOnline()
 * from services/isReallyOnline.js separately.
 *
 * @returns {boolean}
 */
function _isNavigatorOnline() {
  try {
    if (typeof navigator === 'undefined') return true; // SSR — assume online
    return navigator.onLine !== false;
  } catch { return true; }
}

// ─── Delay helper ────────────────────────────────────────────────
function _delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Core request builder ────────────────────────────────────────
/**
 * @typedef {Object} CoreResult
 * @property {boolean}     ok
 * @property {unknown}     data
 * @property {string|null} error
 * @property {number|null} status    — HTTP status when available
 */

/**
 * @param {'get'|'post'|'put'|'patch'|'delete'} method
 * @param {string} url
 * @param {unknown} [body]
 * @param {{ params?, timeoutMs?, retryOnce?, headers? }} [opts]
 * @returns {Promise<CoreResult>}
 */
async function _request(method, url, body, opts = {}) {
  const {
    params,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retryOnce = method === 'get',  // only GET retries by default (idempotent)
    headers = {},
  } = opts;

  // Offline gate — fail fast with a helpful message.
  if (!_isNavigatorOnline()) {
    return {
      ok:     false,
      data:   null,
      error:  'You are offline. Check your connection and try again.',
      status: null,
    };
  }

  const axiosConfig = {
    params,
    headers,
    timeout: timeoutMs,
  };

  const doRequest = async () => {
    const response = await (
      method === 'get'    ? api.get(url, axiosConfig) :
      method === 'post'   ? api.post(url, body, axiosConfig) :
      method === 'put'    ? api.put(url, body, axiosConfig) :
      method === 'patch'  ? api.patch(url, body, axiosConfig) :
      method === 'delete' ? api.delete(url, axiosConfig) :
      Promise.reject(new Error(`Unsupported method: ${method}`))
    );
    return response.data;
  };

  // First attempt.
  const first = await safeAsync(doRequest, { name: `${method.toUpperCase()} ${url}` });
  if (first.ok) {
    return { ok: true, data: first.data, error: null, status: null };
  }

  // Single retry for idempotent methods on network / timeout errors.
  const isRetryable = retryOnce && (
    /network|timeout|timed out/i.test(first.error || '')
  );

  if (isRetryable) {
    await _delay(RETRY_DELAY_MS);
    const retry = await safeAsync(doRequest, { name: `${method.toUpperCase()} ${url} [retry]` });
    if (retry.ok) {
      return { ok: true, data: retry.data, error: null, status: null };
    }
    return { ok: false, data: null, error: retry.error, status: null };
  }

  return { ok: false, data: null, error: first.error, status: null };
}

// ─── Public verbs ─────────────────────────────────────────────────
/**
 * @param {string} url
 * @param {{ params?, timeoutMs?, retryOnce?, headers? }} [opts]
 * @returns {Promise<CoreResult>}
 */
export function coreGet(url, opts) {
  return _request('get', url, undefined, opts);
}

/**
 * @param {string}  url
 * @param {unknown} [body]
 * @param {{ params?, timeoutMs?, headers? }} [opts]
 * @returns {Promise<CoreResult>}
 */
export function corePost(url, body, opts) {
  return _request('post', url, body, { retryOnce: false, ...opts });
}

/**
 * @param {string}  url
 * @param {unknown} [body]
 * @param {{ params?, timeoutMs?, headers? }} [opts]
 * @returns {Promise<CoreResult>}
 */
export function corePut(url, body, opts) {
  return _request('put', url, body, { retryOnce: false, ...opts });
}

/**
 * @param {string}  url
 * @param {unknown} [body]
 * @param {{ params?, timeoutMs?, headers? }} [opts]
 * @returns {Promise<CoreResult>}
 */
export function corePatch(url, body, opts) {
  return _request('patch', url, body, { retryOnce: false, ...opts });
}

/**
 * @param {string} url
 * @param {{ params?, timeoutMs?, headers? }} [opts]
 * @returns {Promise<CoreResult>}
 */
export function coreDelete(url, opts) {
  return _request('delete', url, undefined, { retryOnce: false, ...opts });
}

// ─── Offline status export ────────────────────────────────────────
export { _isNavigatorOnline as isNavigatorOnline };

// ─── Re-export raw axios instance for cases that need direct access ─
export { default as axiosInstance } from '../../api/client.js';

// ─── Test hooks ───────────────────────────────────────────────────
export const _internal = Object.freeze({
  DEFAULT_TIMEOUT_MS,
  RETRY_DELAY_MS,
  _isNavigatorOnline,
  _request,
});
