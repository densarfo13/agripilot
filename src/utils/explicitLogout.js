/**
 * explicitLogout.js — single source of truth for the
 * "user explicitly logged out" flag.
 *
 *   localStorage['farroway_explicit_logout'] === 'true'
 *
 * Why this exists
 *   Repair logic in `repairSession` + `repairExperience` was
 *   designed for the offline-first happy path: see a farm in
 *   storage → assume the user is signed in → restore the home
 *   dashboard. That logic is correct for a returning user but
 *   wrong after an explicit logout — the farmer taps Logout,
 *   the bootstrap repair pass re-stamps the onboarding flag,
 *   the cached profile loads, and the app sends them right
 *   back into the dashboard.
 *
 *   The fix: an explicit-logout marker every repair path checks
 *   first. If set, the bootstrap short-circuits to the logged-
 *   out state and stays on /login until the user manually
 *   re-authenticates. On successful login the flag is cleared,
 *   so repair logic resumes normal behaviour.
 *
 * API
 *   markExplicitLogout()     — call from logout flow
 *   clearExplicitLogout()    — call from successful login flow
 *   isExplicitLogout()       — read; safe in any context
 *
 * Strict-rule audit
 *   * Never throws. Every storage call is try/catch wrapped.
 *   * Pure ESM. No React imports.
 *   * Returns false in SSR / private-mode browsers so the
 *     repair logic stays the canonical path on the server.
 */

export const EXPLICIT_LOGOUT_KEY = 'farroway_explicit_logout';

function _hasStorage() {
  try { return typeof localStorage !== 'undefined'; }
  catch { return false; }
}

export function markExplicitLogout() {
  if (!_hasStorage()) return false;
  try { localStorage.setItem(EXPLICIT_LOGOUT_KEY, 'true'); return true; }
  catch { return false; }
}

export function clearExplicitLogout() {
  if (!_hasStorage()) return false;
  try { localStorage.removeItem(EXPLICIT_LOGOUT_KEY); return true; }
  catch { return false; }
}

export function isExplicitLogout() {
  if (!_hasStorage()) return false;
  try { return localStorage.getItem(EXPLICIT_LOGOUT_KEY) === 'true'; }
  catch { return false; }
}

export default {
  EXPLICIT_LOGOUT_KEY,
  markExplicitLogout,
  clearExplicitLogout,
  isExplicitLogout,
};
