/**
 * session.js — minimal token-session helpers.
 *
 * The codebase already has two parallel session stores:
 *
 *   1. `useAuthStore` (src/store/authStore.js)
 *      Legacy localStorage-backed token. Same key the spec asks
 *      for: `farroway_token` + `farroway_user`.
 *   2. `AuthContext` (src/context/AuthContext.jsx)
 *      Newer httpOnly-cookie + `farroway:session_cache` mirror
 *      for instant offline restore.
 *
 * This file is the thin functional wrapper the spec asks for. It
 * keeps the SAME token key (`farroway_token`) so it stays binary-
 * compatible with `useAuthStore.setAuth` / `.logout` - calling
 * either side updates the value the other side reads. The
 * `isLoggedIn` check ALSO consults the V2 session-cache mirror so
 * a cookie-only login is reflected here without a token write.
 *
 * Strict-rule audit:
 *   * Doesn't fight the existing stores - it just wraps the same
 *     storage they already write.
 *   * Never throws (every localStorage call is try/catch wrapped).
 *   * No new auth flow; just call-site ergonomics.
 */

const TOKEN_KEY        = 'farroway_token';
const SESSION_CACHE_KEY = 'farroway:session_cache';

function _safeRead(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _safeWrite(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, String(value == null ? '' : value));
  } catch { /* quota / private mode - swallow */ }
}

function _safeRemove(key) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch { /* swallow */ }
}

/* ─── Token helpers (legacy localStorage flow) ──────────────────── */

export function setSession(token) {
  if (!token) return;
  _safeWrite(TOKEN_KEY, token);
}

export function getSession() {
  const v = _safeRead(TOKEN_KEY);
  return v && v.trim() ? v : null;
}

export function clearSession() {
  _safeRemove(TOKEN_KEY);
}

/**
 * isLoggedIn()
 *
 * Returns true when EITHER:
 *   * a legacy `farroway_token` is stored (token-based flow), OR
 *   * a non-empty session cache exists (V2 cookie-based flow has
 *     a verified-recently user mirrored to localStorage).
 *
 * This makes the helper safe to drop into any consumer regardless
 * of which auth path the user came in through.
 */
export function isLoggedIn() {
  if (getSession()) return true;
  const raw = _safeRead(SESSION_CACHE_KEY);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    return !!(parsed && parsed.user && (parsed.user.id || parsed.user.email));
  } catch { return false; }
}

/* ─── Test helpers (do not import from production code) ─────────── */

export const _internal = Object.freeze({
  TOKEN_KEY, SESSION_CACHE_KEY,
});
