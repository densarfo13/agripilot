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

export const ONBOARDING_DONE_KEY      = 'farroway_onboarding_done';
// Onboarding-loop fix v2: every save handler (BackyardOnboarding,
// NewFarmScreen, GardenSetupForm, MinimalFarmSetup,
// AdaptiveFarmSetup) plus repairSession.js stamp this _completed
// key. The original helper only checked the _done key, so a user
// who completed setup via a save handler still got bounced back
// to setup when ProfileGuard called isOnboardingComplete(). The
// helper now treats ANY of the three known keys as a valid
// completion signal.
export const ONBOARDING_COMPLETED_KEY = 'farroway_onboarding_completed';
// Logout-loop fix v3 (May 2026 spec §3) — third recognised
// completion key. Some external flows / future code paths may
// stamp this snake-case variant; isOnboardingComplete() must
// honour it so a returning user is never mis-routed back to
// setup just because a different writer used a different key.
export const ONBOARDING_COMPLETE_KEY  = 'farroway_onboarding_complete';
export const LANGUAGE_KEY             = 'farroway_language';
export const COUNTRY_KEY              = 'farroway_country';

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
  // Write all three known keys so every reader (ProfileGuard,
  // repairSession, FarmerEntry, getActiveContext, external
  // writers) sees the same answer no matter which key it's
  // checking.
  _safeSet(ONBOARDING_DONE_KEY,      'true');
  _safeSet(ONBOARDING_COMPLETED_KEY, 'true');
  _safeSet(ONBOARDING_COMPLETE_KEY,  'true');
}

export function isOnboardingComplete() {
  // OR semantics — any of the three keys truthy means "done."
  // Stops a writer/reader mismatch from re-routing finished
  // users back to setup.
  return _safeGet(ONBOARDING_DONE_KEY)      === 'true'
      || _safeGet(ONBOARDING_COMPLETED_KEY) === 'true'
      || _safeGet(ONBOARDING_COMPLETE_KEY)  === 'true';
}

/**
 * shouldShowSetup() — final routing-decision helper for guards.
 *
 * Logout-loop fix v3 (May 2026 spec §3 + §5):
 *   • onboarding NOT complete                → show setup
 *   • onboarding complete                    → go home (NEVER
 *     auto-route to setup just because local entity arrays are
 *     empty — that was the May 2026 logout-loop trigger after
 *     a cache reset / device wipe). The in-app Home / My Farm /
 *     My Grow surfaces detect missing entities themselves and
 *     render an inline "Complete setup" card; the top-of-router
 *     redirect is reserved for genuinely-unset users.
 *
 * Pure function. Never throws.
 */
export function shouldShowSetup() {
  if (!isOnboardingComplete()) return true;
  // Onboarding is complete — never redirect. Even if local
  // entity arrays are empty (cache reset, fresh install on a
  // new device, partial migration), the user has a server-side
  // session and either:
  //   • the server profile will hydrate the entity arrays on
  //     the next /me round-trip, or
  //   • the in-app "Complete setup" card surfaces inside Home
  //     so the user can finish missing details without losing
  //     their session.
  return false;
}

/** Test / "redo onboarding" admin helper. Not wired into any UI. */
export function resetOnboarding() {
  _safeRemove(ONBOARDING_DONE_KEY);
  _safeRemove(ONBOARDING_COMPLETED_KEY);
  _safeRemove(ONBOARDING_COMPLETE_KEY);
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
