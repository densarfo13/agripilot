/**
 * safeAuthFetch.js — 401-aware fetch helper with graceful degrade.
 *
 *   import { safeAuthFetch } from 'src/core/network/safeAuthFetch.js';
 *
 *   const result = await safeAuthFetch('/api/v2/tts/status');
 *   if (result.ok) use(result.data);
 *   else if (result.unavailable) disableFeature();
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A tiny wrapper around `fetch` that:
 *     • retries ONCE on a 401 (after invoking an injectable
 *       refresh handler) — never an infinite loop,
 *     • returns a normalized `{ ok, status, data, unavailable,
 *       error }` shape so callers can degrade gracefully without
 *       try/catch sprawl,
 *     • marks `unavailable: true` on 401 / 403 / 404 / 5xx so the
 *       caller can disable an optional feature (e.g. TTS) without
 *       breaking the rest of the app.
 *
 *   It does NOT replace `src/api/client.js` (the axios instance
 *   that does the session step-up dance) — this is the lighter
 *   helper for OPTIONAL endpoints where a failure shouldn't even
 *   try to recover the session.
 *
 * Strict-rule audit
 *   • Never throws. SSR-safe (returns a typed unavailable when
 *     `fetch` is missing).
 */

import { recordObservation, OBSERVABILITY } from '../observability/observabilityTracker.js';
import { safeLog } from '../runtime/safeRuntimeLogger.js';

/** @typedef {{ ok:boolean, status:number, data:any, unavailable:boolean, error:string }} SafeFetchResult */

const DEFAULT_TIMEOUT_MS = 10_000;

function _unavailable(error, status) {
  return Object.freeze({
    ok: false,
    status: status || 0,
    data: null,
    unavailable: true,
    error: error || 'unavailable',
  });
}

function _ok(status, data) {
  return Object.freeze({
    ok: true, status, data, unavailable: false, error: '',
  });
}

async function _doFetch(url, opts, timeoutMs) {
  if (typeof fetch !== 'function') {
    return _unavailable('no_fetch', 0);
  }
  // Build a timed controller — works in both node 18+ and browsers.
  let controller, timer;
  try {
    controller = (typeof AbortController === 'function') ? new AbortController() : null;
    if (controller) {
      timer = setTimeout(() => { try { controller.abort(); } catch { /* ignore */ } }, timeoutMs);
    }
    const res = await fetch(url, { ...opts, signal: controller && controller.signal });
    let body = null;
    try {
      const ct = res.headers && res.headers.get ? res.headers.get('content-type') : '';
      if (ct && ct.includes('application/json')) body = await res.json();
      else body = await res.text();
    } catch { /* body parse — non-fatal */ }
    return { res, body };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Fetch an endpoint with a single auth-retry pass.
 *
 * @param {string} url
 * @param {object} [opts]
 * @param {object} [config]
 * @param {() => (Promise<boolean>|boolean)} [config.onAuthRefresh]
 *        called once on 401; should refresh the session and
 *        return true if the retry should proceed.
 * @param {number} [config.timeoutMs]
 * @returns {Promise<SafeFetchResult>}
 */
export async function safeAuthFetch(url, opts, config) {
  try {
    if (!url || typeof url !== 'string') return _unavailable('bad_url', 0);
    const cfg = (config && typeof config === 'object') ? config : {};
    const timeout = Number.isFinite(cfg.timeoutMs) ? cfg.timeoutMs : DEFAULT_TIMEOUT_MS;

    let attempt;
    try {
      attempt = await _doFetch(url, opts || {}, timeout);
    } catch (err) {
      // Network / abort error.
      const msg = (err && err.name === 'AbortError') ? 'timeout' : (err && err.message) || 'network';
      safeLog.warn('safeAuthFetch network error', { url, msg });
      return _unavailable(msg, 0);
    }
    let { res, body } = attempt;

    // 401 → refresh once if a handler is provided, otherwise
    // mark unavailable (graceful degrade).
    if (res.status === 401) {
      try { recordObservation(OBSERVABILITY.AUTH_FAILURE); } catch { /* ignore */ }
      if (typeof cfg.onAuthRefresh === 'function') {
        let refreshed = false;
        try { refreshed = !!(await cfg.onAuthRefresh()); } catch { refreshed = false; }
        if (refreshed) {
          try {
            const retried = await _doFetch(url, opts || {}, timeout);
            res = retried.res; body = retried.body;
          } catch (err) {
            const msg = (err && err.name === 'AbortError') ? 'timeout' : (err && err.message) || 'network';
            return _unavailable(msg, 0);
          }
        }
      }
      if (res.status === 401) return _unavailable('unauthorized', 401);
    }

    if (res.status >= 500) {
      try { recordObservation(OBSERVABILITY.API_500); } catch { /* ignore */ }
      return _unavailable(`server_${res.status}`, res.status);
    }
    if (res.status === 404 || res.status === 403) {
      return _unavailable(`http_${res.status}`, res.status);
    }
    if (!res.ok) {
      return _unavailable(`http_${res.status}`, res.status);
    }
    return _ok(res.status, body);
  } catch (err) {
    safeLog.capture(err, { source: 'safeAuthFetch' });
    return _unavailable('exception', 0);
  }
}

export default safeAuthFetch;
