/**
 * sessionManager.js — narrow storage primitives for the
 * logout + reset flows.
 *
 *   clearSession()         remove the auth token + session cache
 *   clearUserState()       remove the user record + progress
 *   clearOnboarding()      remove the onboarding-done flag
 *   clearMlData()          remove the ML data pipeline stores
 *
 * Each helper is a NARROW pass; the high-level flows in
 * logout.js + resetApp.js compose them. Per the strict rule
 * "do not clear unrelated data accidentally", every helper
 * touches a fixed, named list of keys - no localStorage.clear()
 * anywhere.
 *
 * Strict-rule audit
 *   * works offline (localStorage only)
 *   * never throws (every storage call try/catch wrapped)
 *   * doesn't loop redirects: callers handle navigation;
 *     this module is pure storage
 *   * doesn't clear unrelated data: each helper is a fixed
 *     allow-list
 */

/* ─── Internal helpers ─────────────────────────────────────────── */

function _safeRemove(key) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch { /* swallow - quota / private mode / SSR */ }
}

/* ─── 1. SESSION (auth token + cache) ──────────────────────────── */

/**
 * Keys that hold the active auth session. clearSession() flushes
 * all of them so the next /me call routes the user back to login
 * even when one of the legacy stores still has a stale value.
 */
const SESSION_KEYS = Object.freeze([
  'farroway_token',           // legacy zustand-backed token
  'farroway:session_cache',   // V2 cookie-flow user mirror
  'farroway:access_token',    // legacy bundle key
  'farroway:refresh_token',   // legacy bundle key
]);

export function clearSession() {
  for (const k of SESSION_KEYS) _safeRemove(k);
}

/* ─── 2. USER STATE (user record + progress) ──────────────────── */

/**
 * Keys that hold the per-user payload but NOT the auth session.
 * Cleared on logout so the next farmer to sign in on the same
 * device doesn't see the previous farmer's progress, but
 * preserved on logout for the SAME farmer signing back in
 * (we only clear on explicit logout, not on a refresh).
 */
const USER_STATE_KEYS = Object.freeze([
  'farroway_user',
  'farroway_progress',
  'farroway:user_profile',
  'farroway:active_farm_id',
  'agripilot_currentFarmId',
]);

export function clearUserState() {
  for (const k of USER_STATE_KEYS) _safeRemove(k);
}

/* ─── 3. ONBOARDING (kept SEPARATE from session/user) ─────────── */

/**
 * Per the missed-day-loop fix in commit fe0715e, the onboarding
 * flag MUST survive logout - otherwise every login walks the
 * farmer through setup again. clearOnboarding() is reserved for
 * the explicit "Reset App" path in resetApp.js.
 */
const ONBOARDING_KEYS = Object.freeze([
  'farroway_onboarding_done',     // canonical flag
  'farroway:onboarding_complete', // legacy flag
  'farroway.onboardingV3',        // OnboardingV3 detail record
  'farroway_quick_onboarded',     // QuickStart flag
  'farroway_farm_created',        // QuickStart auto-farm flag
  'farroway_quick_voice_fired',   // QuickStart voice ledger
]);

export function clearOnboarding() {
  for (const k of ONBOARDING_KEYS) _safeRemove(k);
}

/* ─── 4. ML DATA PIPELINE (events / labels / weights) ─────────── */

/**
 * The full reset path drops the local ML stores so a new pilot
 * can start with a clean dataset. Logout DOES NOT call this -
 * a logout is just an end-of-session, the labels stay.
 */
const ML_KEYS = Object.freeze([
  'farroway_events',
  'farroway_labels',
  'farroway_label_prompt_ledger',
  'farroway_passive_labeler_ledger',
  'farroway_weights_pest',
  'farroway_weights_drought',
  'farroway_outcomes',
  'farroway_performance_pest',
  'farroway_performance_drought',
  'farroway_outbreak_reports',
  'farroway_pest_reports',
  'farroway_outbreak_notif_ledger',
  'farroway_pest_banner_dismissed',
  'farroway_pest_voice_fired',
  'farroway_recovery_voice_fired',
  'farroway_trend_snapshots',
  'farroway_weather',
  'farroway_streak',
  'farroway_streak_anchor',
  'farroway_last_checkin',
  'farroway_last_reminder_day',
  'farroway_last_notification',
  'farroway_last_notification_task',
]);

export function clearMlData() {
  for (const k of ML_KEYS) _safeRemove(k);
}

/* ─── Test helpers (named exports only) ───────────────────────── */

export const _internal = Object.freeze({
  SESSION_KEYS, USER_STATE_KEYS, ONBOARDING_KEYS, ML_KEYS,
});
