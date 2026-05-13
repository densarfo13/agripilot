/**
 * safeFetch.js — defensive wrapper around `window.fetch`.
 *
 *   import { safeFetch } from '../utils/safeFetch.js';
 *
 *   const res = await safeFetch('/api/weather', { timeout: 6000 });
 *   if (res.ok) { … }
 *
 * Guarantees:
 *   • Validates URL via safeUrl before calling fetch — so
 *     `safeFetch(undefined)` returns the fallback response instead
 *     of throwing 'TypeError: Failed to fetch'.
 *   • Default 8 s AbortController timeout (override via opts.timeout).
 *   • Returns a Response-shaped object even on error so callers can
 *     check `.ok` without try/catch.
 *   • Fallback shape:
 *       { ok: false, status: 0, statusText: '<reason>',
 *         json: async () => null, text: async () => '',
 *         _failed: true, _reason: '<short reason>' }
 *   • Dev-only one-shot warning per failure key.
 *   • Never throws — every code path resolves to a Response or fallback.
 *
 * Strict-rule audit
 *   • Pure module — no React.
 *   • SSR-safe — fetch / window guarded.
 *   • No retry loop. No infinite recursion.
 */

import { safeUrl } from './safeUrl.js';

const _seen = new Set();
function _isDev() {
  try { return !!(import.meta && import.meta.env && import.meta.env.DEV); }
  catch { return false; }
}
function _warnOnce(key, msg, extra) {
  try {
    if (!_isDev()) return;
    if (_seen.has(key)) return;
    _seen.add(key);
     
    console.warn(`[Farroway safeFetch] ${msg}`, extra);
  } catch { /* never throw from a diagnostic */ }
}

const DEFAULT_TIMEOUT_MS = 8_000;

/**
 * Build the canonical fallback response. Same shape as `Response`
 * for the 4 fields the codebase actually uses (.ok / .status /
 * .statusText / .json / .text) plus diagnostic fields.
 */
function _fallback(reason) {
  return Object.freeze({
    ok:         false,
    status:     0,
    statusText: reason || 'safe-fallback',
    headers:    new Headers(),
    url:        '',
    json:       async () => null,
    text:       async () => '',
    _failed:    true,
    _reason:    reason || 'safe-fallback',
  });
}

/**
 * safeFetch(input, opts?) → Promise<Response | FallbackResponse>
 *
 * @param {string|URL} input
 * @param {object} [opts]
 * @param {number} [opts.timeout]   ms before AbortController fires (default 8000)
 * @param {string} [opts.method]
 * @param {object} [opts.headers]
 * @param {*}      [opts.body]
 * @param {string} [opts.cache]     fetch cache mode
 * @param {string} [opts.credentials] fetch credentials mode
 * @param {AbortSignal} [opts.signal] caller-owned signal (composed with timeout)
 */
export async function safeFetch(input, opts = {}) {
  // ── 0. SSR / no-fetch guard ───────────────────────────────
  if (typeof fetch !== 'function') {
    _warnOnce('no-fetch', 'fetch unavailable in this environment', null);
    return _fallback('no-fetch');
  }

  // ── 1. URL validation ─────────────────────────────────────
  const u = safeUrl(input);
  if (!u) {
    _warnOnce('bad-url:' + String(input).slice(0, 32),
      'invalid URL input — request dropped', input);
    return _fallback('invalid-url');
  }

  // ── 2. Timeout via AbortController (composed with caller signal) ─
  const timeout = (typeof opts.timeout === 'number' && opts.timeout > 0)
    ? opts.timeout : DEFAULT_TIMEOUT_MS;
  const ac = new AbortController();
  let timer = null;
  try { timer = setTimeout(() => { try { ac.abort(); } catch { /* swallow */ } }, timeout); }
  catch { /* swallow */ }

  // Compose with caller's signal (abort propagates either direction).
  if (opts.signal && typeof opts.signal.addEventListener === 'function') {
    try {
      opts.signal.addEventListener('abort', () => {
        try { ac.abort(); } catch { /* swallow */ }
      }, { once: true });
    } catch { /* swallow */ }
  }

  // ── 3. Issue the request ──────────────────────────────────
  try {
    const res = await fetch(u.href, {
      method:      opts.method      || 'GET',
      headers:     opts.headers     || undefined,
      body:        opts.body        || undefined,
      cache:       opts.cache       || 'no-store',
      credentials: opts.credentials || 'same-origin',
      signal:      ac.signal,
    });
    return res;
  } catch (err) {
    // AbortError is expected on timeout; everything else is logged once.
    const isAbort = err && (err.name === 'AbortError'
      || /aborted/i.test(String(err.message || '')));
    if (!isAbort) {
      _warnOnce('fetch:' + u.href.slice(0, 64), 'fetch failed', err && err.message);
    }
    return _fallback(isAbort ? 'timeout' : 'network-error');
  } finally {
    if (timer) { try { clearTimeout(timer); } catch { /* swallow */ } }
  }
}

/**
 * safeFetchJson(input, opts?) — convenience wrapper that awaits
 * .json() inside the same defensive envelope. Returns the parsed
 * object, or `null` on any failure (network / bad JSON / non-OK).
 */
export async function safeFetchJson(input, opts = {}) {
  const res = await safeFetch(input, opts);
  if (!res || !res.ok) return null;
  try { return await res.json(); }
  catch { return null; }
}

export const _internal = Object.freeze({
  DEFAULT_TIMEOUT_MS,
  _fallback,
});
