/**
 * sessionDebug.js — opt-in console diagnostics for the auth /
 * onboarding loop investigations.
 *
 * Logging is gated TWICE:
 *   1. Only fires in dev mode OR when `localStorage.farroway:debug`
 *      is set to `'1'`. Production users never see these lines.
 *   2. Logs are namespaced under `[FARROWAY_SESSION]` so a Sentry
 *      / Railway log drain can grep them out cleanly.
 *
 * Usage:
 *   import { logSessionState } from '../utils/sessionDebug';
 *   logSessionState();
 *
 * Or wire it once at app boot:
 *   useEffect(() => logSessionState(), []);
 *
 * Strict rule audit:
 *   * never throws (every read is try/catch wrapped)
 *   * never spams production (gated by dev flag + opt-in key)
 *   * pure read - never writes localStorage
 */

import { getSession, isLoggedIn } from './session.js';
import { isOnboardingComplete, getSavedLanguage, getSavedCountry } from './onboarding.js';

const DEBUG_FLAG_KEY = 'farroway:debug';

function _isDebugEnabled() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
      return true;
    }
  } catch { /* ignore */ }
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(DEBUG_FLAG_KEY) === '1';
  } catch { return false; }
}

/**
 * One-shot snapshot of the auth + onboarding signals that
 * decide where the user lands. Useful when a user reports
 * being stuck on login or setup.
 */
export function logSessionState(label = 'snapshot') {
  if (!_isDebugEnabled()) return;
  let token = null;
  let logged = false;
  let onboarded = false;
  let lang = null;
  let country = null;
  try { token     = getSession(); }            catch { /* ignore */ }
  try { logged    = isLoggedIn(); }             catch { /* ignore */ }
  try { onboarded = isOnboardingComplete(); }   catch { /* ignore */ }
  try { lang      = getSavedLanguage(); }       catch { /* ignore */ }
  try { country   = getSavedCountry(); }        catch { /* ignore */ }
  try {
    console.log('[FARROWAY_SESSION]', label, {
      tokenPresent: !!token,
      isLoggedIn:   logged,
      isOnboarded:  onboarded,
      savedLang:    lang,
      savedCountry: country,
    });
  } catch { /* console missing - swallow */ }
}

/** Toggle the production-side debug flag from a console one-liner. */
export function enableSessionDebug() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(DEBUG_FLAG_KEY, '1');
  } catch { /* swallow */ }
}

/** Disable the debug flag again. */
export function disableSessionDebug() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(DEBUG_FLAG_KEY);
  } catch { /* swallow */ }
}
