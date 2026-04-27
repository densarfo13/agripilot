/**
 * logout.js — clean logout flow.
 *
 *   logout(navigate, opts?)
 *
 * Order of operations matters here:
 *   1. Clear the in-memory zustand auth state FIRST so the
 *      next render flips to logged-out before any async work.
 *   2. Clear localStorage session + user state (narrow allow-
 *      list from sessionManager).
 *   3. Optionally call AuthContext.logout for cookie invalidation
 *      via the existing server round-trip - we wire this through
 *      a callback the caller can pass; logout itself stays sync.
 *   4. Navigate to /login with `replace: true` so a back-tap
 *      from the login screen doesn't land back on a now-blank
 *      protected page.
 *
 * Strict rules respected
 *   * never throws (every step try/catch wrapped)
 *   * works offline: storage clears + navigate are local; the
 *     optional cookie-invalidation hook fires + ignores network
 *     failure
 *   * never causes redirect loops: the onboarding flag is
 *     PRESERVED so ProfileGuard's "is this farmer onboarded"
 *     check passes when they sign back in. Reset is a SEPARATE
 *     flow in resetApp.js.
 *   * doesn't clear unrelated data: only SESSION_KEYS +
 *     USER_STATE_KEYS via sessionManager.
 */

import { clearSession, clearUserState } from './sessionManager.js';
import { useAuthStore } from '../store/authStore.js';

const NOOP_NAVIGATE = () => { /* noop */ };

/**
 * logout(navigate, opts?)
 *
 * navigate    react-router useNavigate() callback. When
 *             omitted (e.g. from a non-React caller) we still
 *             complete the storage clear + return cleanly.
 *
 * opts:
 *   destination       default '/login' - where to send the
 *                      farmer after the clear
 *   confirmServerSide async function the caller can pass to
 *                      invalidate the server-side session
 *                      cookie (e.g. AuthContext.logout). Fire-
 *                      and-forget; failures swallowed.
 */
export function logout(navigate, opts = {}) {
  const dest = (opts && opts.destination) || '/login';

  // 1. Flip in-memory React state immediately. Wrapped so a
  //    missing zustand store on first import never throws.
  try {
    if (useAuthStore && typeof useAuthStore.setState === 'function') {
      useAuthStore.setState({ user: null, token: null, stepUpRequired: false });
    }
    if (useAuthStore && typeof useAuthStore.getState === 'function') {
      const state = useAuthStore.getState();
      if (state && typeof state.logout === 'function') {
        try { state.logout(); } catch { /* swallow */ }
      }
    }
  } catch { /* swallow */ }

  // 2. Storage clears.
  try { clearSession(); }   catch { /* swallow */ }
  try { clearUserState(); } catch { /* swallow */ }

  // 3. Optional cookie-side invalidation. Fire-and-forget.
  if (opts && typeof opts.confirmServerSide === 'function') {
    try {
      Promise.resolve(opts.confirmServerSide())
        .catch(() => { /* network blip - tokens already gone locally */ });
    } catch { /* swallow */ }
  }

  // 4. Navigate. `replace` so the back-button doesn't land on
  //    the previous protected page.
  const nav = typeof navigate === 'function' ? navigate : NOOP_NAVIGATE;
  try { nav(dest, { replace: true }); }
  catch {
    // Older react-router builds expect a string second arg.
    try { nav(dest); } catch { /* swallow */ }
  }
}

export default logout;
