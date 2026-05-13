/**
 * safeApiBase.js — named entry point per the Runtime Stability spec §1.
 *
 *   const base = safeApiBase();
 *   const url  = safeApiBase('/api/v2/users/me');   // → 'https://.../api/v2/users/me'
 *
 * Why a thin named wrapper
 * ────────────────────────
 *   The existing src/lib/api/assertApiBaseUrl.js exposes `resolveApiBase()`
 *   which validates VITE_API_BASE_URL + handles Capacitor + falls
 *   back to same-origin. The spec asks for a named `safeApiBase()`
 *   that all API calls can route through.
 *
 *   This module is the spec-named adapter that:
 *     • Calls resolveApiBase() under the hood (single source of truth)
 *     • Optionally accepts a path to append, with duplicate-slash
 *       trimming
 *     • Returns a STRING that callers can drop into fetch() directly
 *     • Never throws — same-origin '' is a valid fetch base
 *
 * Strict-rule audit
 *   • Pure function. Never throws.
 *   • Trims trailing slashes on base + leading double-slashes on path
 *     so `safeApiBase('/api/v2/...')` never yields '//api/v2/...' or
 *     'https://farroway.app//api/v2/...'.
 *   • Returns '' (empty string) for same-origin when the env is
 *     unset — this is intentional, matches the documented Railway
 *     monolith pattern, and is a valid fetch base.
 */

import { resolveApiBase } from './api/assertApiBaseUrl.js';

// In-process cache of the resolved base so we don't recompute on
// every API call. The base is set at module-load time and almost
// never changes during a session (env doesn't change at runtime).
let _cachedBase = null;
let _cacheLoaded = false;

function _getBase() {
  if (_cacheLoaded) return _cachedBase;
  try {
    _cachedBase = resolveApiBase() || '';
  } catch {
    _cachedBase = '';
  }
  _cacheLoaded = true;
  return _cachedBase;
}

/**
 * Return the validated API base — optionally appended with a path.
 *
 *   safeApiBase()                     → 'https://farroway.app' (or '' for same-origin)
 *   safeApiBase('/api/v2/users/me')   → 'https://farroway.app/api/v2/users/me'
 *   safeApiBase('api/v2/x')           → 'https://farroway.app/api/v2/x'   (auto-leading-slash)
 *
 * @param {string} [path]
 * @returns {string}
 */
export function safeApiBase(path) {
  const base = (_getBase() || '').replace(/\/+$/, '');
  if (path === undefined || path === null) return base;
  const s = String(path);
  if (!s) return base;
  // Normalise leading slash so neither '/api' nor 'api' produces a
  // malformed URL like 'https://x.com//api' or 'https://x.comapi'.
  const normalised = s.startsWith('/') ? s : `/${s}`;
  // Trim any duplicate slashes at the join point.
  return `${base}${normalised.replace(/^\/+/, '/')}`;
}

/**
 * Test helper — force a re-read of the underlying base.
 */
export function _resetSafeApiBaseCache() {
  _cachedBase = null;
  _cacheLoaded = false;
}

export default { safeApiBase, _resetSafeApiBaseCache };
