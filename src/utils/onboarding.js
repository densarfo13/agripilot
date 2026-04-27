/**
 * onboarding.js — single-flag onboarding completion store.
 *
 * Why this file exists
 * ────────────────────
 * Before this fix the app was deciding "show setup or not" purely
 * from a server-fetched `profile` object via `isProfileComplete()`.
 * Any temporary blip (cold cache, slow first /me, server returning
 * a partial profile) would route the user back to the setup screen
 * - then a fresh fetch would route them away - producing a visible
 * loop. The user's report:
 *
 *   "User keeps getting redirected to setup screen every time the
 *    app loads."
 *
 * The cure is a simple, persisted client-side flag: once a farmer
 * has been through setup ONCE on this device, never re-route them
 * there automatically. The server profile remains the source of
 * truth for incomplete-data prompts INSIDE the app, but the
 * automatic top-of-router redirect is gated on this flag.
 *
 * Storage keys
 *   farroway_onboarding_done   - "true" once setup completes
 *   farroway_language          - last selected UI language (mirror)
 *   farroway_country           - last selected country
 *
 * Strict rules respected:
 *   * never crashes on missing localStorage (SSR / private mode)
 *   * never loses the flag on logout (paired with the
 *     clearSessionState change that preserves it)
 *   * never overwrites a real user choice with a default
 */

export const ONBOARDING_DONE_KEY = 'farroway_onboarding_done';
export const LANGUAGE_KEY        = 'farroway_language';
export const COUNTRY_KEY         = 'farroway_country';

/* ─── helpers ──────────────────────────────────────────────────── */

function _safeGet(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _safeSet(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, String(value == null ? '' : value));
  } catch { /* swallow - quota / private mode */ }
}

function _safeRemove(key) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch { /* swallow */ }
}

/* ─── onboarding flag ──────────────────────────────────────────── */

export function setOnboardingComplete() {
  _safeSet(ONBOARDING_DONE_KEY, 'true');
}

export function isOnboardingComplete() {
  return _safeGet(ONBOARDING_DONE_KEY) === 'true';
}

/** Test / "redo onboarding" admin helper. Not wired into any UI. */
export function resetOnboarding() {
  _safeRemove(ONBOARDING_DONE_KEY);
}

/* ─── language preference ──────────────────────────────────────── */

export function setSavedLanguage(code) {
  if (!code) return;
  _safeSet(LANGUAGE_KEY, code);
}

export function getSavedLanguage() {
  const v = _safeGet(LANGUAGE_KEY);
  return v && v.trim() ? v : null;
}

/* ─── country preference ───────────────────────────────────────── */

export function setSavedCountry(code) {
  if (!code) return;
  _safeSet(COUNTRY_KEY, code);
}

export function getSavedCountry() {
  const v = _safeGet(COUNTRY_KEY);
  return v && v.trim() ? v : null;
}
