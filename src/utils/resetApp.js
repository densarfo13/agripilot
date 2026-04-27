/**
 * resetApp.js — full "start over" reset.
 *
 *   resetApp(navigate, opts?)
 *
 * Used ONLY when the farmer explicitly chooses Reset App in
 * Settings. Wipes the entire local dataset (session, user
 * state, onboarding flag, ML pipeline) and lands the farmer
 * on the QuickStart welcome screen.
 *
 * NOT a logout. Logout preserves the onboarding flag + ML
 * data; resetApp drops everything so a programme can hand the
 * device to a new farmer with a clean slate.
 *
 * Strict rules respected
 *   * never throws (try/catch on every step)
 *   * works offline: every clear is local; navigate is sync
 *   * never loops redirects: the onboarding flag IS cleared
 *     here, so the next /today/quick render kicks the farmer
 *     to /onboarding/quick via ProfileGuard
 *   * doesn't clear unrelated data: composes the named-key
 *     allow-lists in sessionManager. localStorage.clear() is
 *     never used.
 */

import {
  clearSession,
  clearUserState,
  clearOnboarding,
  clearMlData,
} from './sessionManager.js';
import { useAuthStore } from '../store/authStore.js';

const NOOP_NAVIGATE = () => { /* noop */ };
const DEFAULT_DESTINATION = '/onboarding/quick';

/**
 * resetApp(navigate, opts?)
 *
 * opts:
 *   destination        default '/onboarding/quick' (matches the
 *                       QuickStart route landed in commit b167e97)
 *   keepFarroSettings  default true. The Settings panel
 *                       (notification preferences + reminder
 *                       time) is the kind of thing a programme
 *                       sets up once at deployment - we keep
 *                       it across resets unless the caller
 *                       explicitly asks to nuke them.
 *   confirmServerSide  optional async hook for cookie-side
 *                       invalidation. Fire-and-forget.
 */
export function resetApp(navigate, opts = {}) {
  const dest = (opts && opts.destination) || DEFAULT_DESTINATION;

  // 1. Flip in-memory React state first.
  try {
    if (useAuthStore && typeof useAuthStore.setState === 'function') {
      useAuthStore.setState({ user: null, token: null, stepUpRequired: false });
    }
  } catch { /* swallow */ }

  // 2. Storage clears - composed allow-lists, NEVER
  //    localStorage.clear().
  try { clearSession(); }     catch { /* swallow */ }
  try { clearUserState(); }   catch { /* swallow */ }
  try { clearOnboarding(); }  catch { /* swallow */ }
  try { clearMlData(); }      catch { /* swallow */ }

  // 3. Settings panel preferences are typically programme-set,
  //    so we keep them by default. opts.keepFarroSettings ===
  //    false explicitly opts in to nuking them.
  if (opts && opts.keepFarroSettings === false) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('farroway_settings');
        localStorage.removeItem('farroway_language');
        localStorage.removeItem('farroway_country');
      }
    } catch { /* swallow */ }
  }

  // 4. IndexedDB stores hold the durable copies of farm +
  //    progress + outbreak. We DON'T blow these away from the
  //    JS side - they survive the localStorage reset, but the
  //    next markTaskDone / saveOutbreakReport will re-seed the
  //    mirror cleanly. A heavier reset that drops the IDB
  //    database is a v2 admin tool; for now we want the reset
  //    to be reversible by signing back in.

  // 5. Optional cookie-side invalidation.
  if (opts && typeof opts.confirmServerSide === 'function') {
    try {
      Promise.resolve(opts.confirmServerSide())
        .catch(() => { /* swallow */ });
    } catch { /* swallow */ }
  }

  // 6. Navigate. replace so the back-button can't land on a
  //    page that thinks the farmer is still onboarded.
  const nav = typeof navigate === 'function' ? navigate : NOOP_NAVIGATE;
  try { nav(dest, { replace: true }); }
  catch {
    try { nav(dest); } catch { /* swallow */ }
  }
}

export default resetApp;
