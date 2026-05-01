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
// helper now treats EITHER key as a valid completion signal.
export const ONBOARDING_COMPLETED_KEY = 'farroway_onboarding_completed';
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
  // Write BOTH keys so every reader (ProfileGuard, repairSession,
  // FarmerEntry, getActiveContext) sees the same answer no matter
  // which key it's checking.
  _safeSet(ONBOARDING_DONE_KEY,      'true');
  _safeSet(ONBOARDING_COMPLETED_KEY, 'true');
}

export function isOnboardingComplete() {
  // OR semantics — either key truthy means "done." This stops the
  // farroway_onboarding_done vs farroway_onboarding_completed
  // mismatch from re-routing finished users back to setup.
  return _safeGet(ONBOARDING_DONE_KEY)      === 'true'
      || _safeGet(ONBOARDING_COMPLETED_KEY) === 'true';
}

/**
 * shouldShowSetup() — final routing-decision helper for guards.
 * Final fix spec §6:
 *   • onboarding NOT complete                → show setup
 *   • onboarding complete + farm/garden exists → go home
 *   • onboarding complete + no entity exists → show setup (the
 *     entity must have been wiped or migrated; safer to onboard
 *     than to render a blank Home dashboard)
 *
 * Reads gardens/farms via the multi-experience selector helpers,
 * which themselves prefer the post-migration arrays and fall
 * back to the legacy partition. Pure function. Never throws.
 */
export function shouldShowSetup() {
  if (!isOnboardingComplete()) return true;
  // Onboarding is complete — only redirect to setup if zero
  // entities exist on the device.
  let hasAnyEntity = false;
  try {
    if (typeof localStorage !== 'undefined') {
      const _array = (key) => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return [];
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
      };
      // Post-migration first-class arrays.
      const gardens = _array('farroway_gardens');
      const farms   = _array('farroway_farms');
      // Legacy combined partition (pre-migration sessions).
      const legacy  = _array('farroway.farms');
      hasAnyEntity = (gardens.length + farms.length + legacy.length) > 0;
    }
  } catch { hasAnyEntity = false; }
  return !hasAnyEntity;
}

/** Test / "redo onboarding" admin helper. Not wired into any UI. */
export function resetOnboarding() {
  _safeRemove(ONBOARDING_DONE_KEY);
  _safeRemove(ONBOARDING_COMPLETED_KEY);
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
