/**
 * authKeys.js — single source of truth for every localStorage key
 * the auth surface touches.
 *
 * Why a constants module
 *   The same key strings used to be inlined as bare literals across
 *   sessionManager.js, authStore.js, AuthContext.jsx, logout.js,
 *   resetApp.js, clearSessionState.js and every guard / page that
 *   reads or writes a session value. A typo in any one of those
 *   sites (`farroway-token` vs `farroway_token`) silently breaks
 *   logout / reset / restore without raising a build error. Routing
 *   every reader and writer through this module means a typo
 *   becomes a static reference error.
 *
 * Coexistence with V2 cookie auth
 *   Farroway's V2 auth is httpOnly-cookie based — `token` and
 *   `refreshToken` here are the V1 admin slots, kept as the
 *   canonical names so the reset sweep still finds them on a
 *   mixed-session device. The V2 cookie session is mirrored to
 *   `farroway:session_cache` (kept in legacy.sessionCache below)
 *   so the bootstrap can show a non-blank UI while /me is in
 *   flight. Both schemes coexist; this module names them all.
 *
 * Strict-rule audit
 *   * No localStorage.clear() anywhere
 *   * Onboarding key kept SEPARATE from session/user keys so a
 *     logout never wipes it (the canonical April 2026 fix)
 *   * Frozen so the constant set can't be mutated at runtime
 */

export const AUTH_KEYS = Object.freeze({
  // Canonical V1 admin slots (also written by login flows that
  // pre-date the V2 cookie path).
  token:        'farroway_token',
  refreshToken: 'farroway_refresh_token',
  user:         'farroway_user',

  // Onboarding flag — must SURVIVE logout. Only resetApp clears it.
  onboarding:   'farroway_onboarding_done',
});

// Legacy / co-existing keys that other parts of the auth system
// still read. Kept here so the central sweep (resetApp / clear
// helpers) finds every slot. Adding a key here is opt-in — readers
// don't import these unless they specifically need them.
export const LEGACY_AUTH_KEYS = Object.freeze({
  // V2 cookie session mirror — written by AuthContext on every /me
  // success, read on bootstrap so the UI shows the cached user
  // instantly while /me is in flight.
  sessionCache:        'farroway:session_cache',
  // Legacy onboarding flag aliases (early Farroway versions used
  // these; readers check both for back-compat).
  onboardingComplete:  'farroway:onboarding_complete',
  onboardingV3:        'farroway.onboardingV3',
  // V2 access/refresh slots that some legacy clients populated.
  // Frontend never reads these directly (cookies are httpOnly) —
  // they're listed so reset sweeps find any lingering values.
  v2AccessToken:       'farroway:access_token',
  v2RefreshToken:      'farroway:refresh_token',
  // User profile mirrors that the dashboard uses for offline-first
  // first paint.
  userProfile:         'farroway:user_profile',
  farmerProfile:       'farroway:farmerProfile',
  activeFarmId:        'farroway:active_farm_id',
});

export default AUTH_KEYS;
