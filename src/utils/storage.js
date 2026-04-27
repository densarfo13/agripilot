/**
 * storage.js — never-throws localStorage facade.
 *
 *   getItem(key) / setItem(key, value) / removeItem(key)
 *
 * Each helper wraps the underlying call in try/catch so a
 * locked-down browser (private mode, deleted storage partition,
 * quota exceeded) does not propagate the SecurityError /
 * QuotaExceededError to render. SafeParse is re-exported from
 * `safeParse.js` so call sites have one import path for "all
 * the never-throws read primitives".
 *
 * Why a facade
 *   Bare `localStorage.getItem(...)` throws in Safari private
 *   mode, in WebView shells with storage disabled, and during
 *   SSR. Every reader having its own try/catch is bug-prone —
 *   one untouched site is enough to white-screen the app on a
 *   farmer's locked-down phone. Routing through these helpers
 *   means new code is safe by default.
 *
 * Strict-rule audit
 *   * Never throws
 *   * No localStorage.clear() — there is intentionally no
 *     `clearAll` helper; the only legitimate sweeps are the
 *     allow-listed ones in src/utils/sessionManager.js +
 *     src/lib/auth/clearSessionState.js
 */

import { safeParse, safeReadJSON } from './safeParse.js';

export function getItem(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setItem(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch {
    /* quota exceeded / private mode / SSR — silently no-op */
  }
}

export function removeItem(key) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch {
    /* never propagate from a remove — caller is doing cleanup */
  }
}

/**
 * Convenience: read + parse JSON in one call. Returns the supplied
 * fallback on any failure (missing key, corrupt value, locked-down
 * storage). Identical to the helper in safeParse.js — re-exported
 * here so call sites that already import from storage.js don't
 * need a second import.
 */
export function getJSON(key, fallback) {
  return safeReadJSON(key, fallback);
}

export { safeParse, safeReadJSON };

export default { getItem, setItem, removeItem, getJSON, safeParse, safeReadJSON };
