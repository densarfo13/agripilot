/**
 * routePolicy.js — single source of truth for client-side
 * routing decisions.
 *
 * THREE rules, in plain English:
 *   1. User not authenticated  → redirect to /login.
 *   2. User authenticated but setup incomplete → show optional
 *      prompt inline. NEVER redirect automatically.
 *   3. User role not allowed for this route → show "no access"
 *      message (RouteGuard handles this).
 *
 * ══════════════════════════════════════════════════════════════
 * DO NOT redirect users to setup for missing location / crop /
 * farm / garden. Setup is optional. Show inline prompts only.
 * Auth missing is the ONLY reason to redirect automatically.
 * ══════════════════════════════════════════════════════════════
 *
 * No React. No I/O. Pure functions — safe in SSR and tests.
 */

/**
 * canAccessApp — true when the user is authenticated.
 * Auth missing is the only condition that forces a redirect.
 *
 * @param {object|null} user - the resolved auth user object
 * @returns {boolean}
 */
export function canAccessApp(user) {
  return Boolean(user);
}

/**
 * shouldForceSetup — always false.
 *
 * Setup (location / crop / farm / garden) is NEVER forced.
 * An incomplete profile means inline prompts, not route blocks.
 * This function exists so every call-site is self-documenting:
 * callers that previously checked "should I redirect to setup?"
 * replace their condition with this and get the correct answer.
 *
 * @returns {false}
 */
export function shouldForceSetup() {
  return false;
}

/**
 * shouldShowSetupPrompt — true when the user is authenticated
 * but has missing profile data. Used to decide whether to
 * render an optional "Add details" inline card on Home.
 *
 * Never used as a route gate — only for UI hints.
 *
 * @param {object|null} user - the resolved auth user object
 * @returns {boolean}
 */
export function shouldShowSetupPrompt(user) {
  if (!user) return false;
  const missingLocation  = !user.location && !user.lat && !user.lng;
  const missingCrop      = !user.cropOrPlant && !user.crop && !user.plantName && !user.cropId;
  const missingFarmData  = !user.hasFarmOrGarden && !user.farmId && !user.gardenId;
  return missingLocation || missingCrop || missingFarmData;
}

/**
 * setupRedirectPath — the path to navigate to when the USER
 * explicitly taps "Add details" / "Set up farm" / etc.
 * Only called from button-click handlers, never from guards.
 *
 * @returns {string}
 */
export function setupRedirectPath() {
  return '/onboarding/fast';
}
