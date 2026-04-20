/**
 * firstTimeFarmerGuard.js — the single source of truth for
 * "is this a first-time farmer who must take the fast flow,
 * NOT the legacy manual Save Farm Profile form?"
 *
 * Used by:
 *   • ProfileGuard       — to redirect into /onboarding/fast
 *   • ProfileSetup       — to short-circuit out of the legacy page
 *   • FastOnboardingRoute — to decide whether to render the flow
 *   • dev warnings       — to flag regressions at runtime
 *
 * Contract:
 *   isFirstTimeFarmer({ profile, farms, fastState }) → boolean
 *     true  → they must go through /onboarding/fast
 *     false → legacy setup or direct Home is fine
 *
 * Rules (any one of these counts as "not a first-time farmer"):
 *   1. fast onboarding has been completed   (fastState.completedAt)
 *   2. they already have an active farm     (farms[].status === 'active')
 *   3. profile is already complete          (all legacy required fields set)
 *
 * Otherwise: first-time farmer, send them to the fast flow.
 *
 * Progressive onboarding is allowed to refine details later —
 * farm size is NOT required to clear this guard.
 */

import { loadFastState, hasCompletedFastOnboarding } from './fastOnboardingPersistence.js';

/** True when the profile has enough legacy fields to count as "set up". */
function hasLegacyProfile(profile) {
  if (!profile || typeof profile !== 'object') return false;
  return Boolean(
    profile.farmerName &&
    profile.cropType &&
    profile.country
  );
}

/** True when the user has at least one active farm on the server. */
function hasActiveFarm(farms) {
  if (!Array.isArray(farms)) return false;
  return farms.some((f) => f && f.status === 'active');
}

/**
 * Main predicate. All inputs optional — the function degrades
 * gracefully when any source is missing.
 */
export function isFirstTimeFarmer({ profile = null, farms = null, fastState = undefined } = {}) {
  // Resolve fast-onboarding state (caller may pass in; otherwise read from storage).
  const resolvedFast = fastState === undefined ? loadFastState() : fastState;

  // If they've completed the new fast flow, they're NOT first-time anymore.
  if (hasCompletedFastOnboarding(resolvedFast)) return false;

  // If the server knows about an active farm, they're NOT first-time.
  if (hasActiveFarm(farms)) return false;

  // If they already have a legacy profile populated, they're NOT first-time.
  if (hasLegacyProfile(profile)) return false;

  // Otherwise: first-time — must take the fast flow.
  return true;
}

/**
 * Dev-only warning emitter. In production this is a no-op; in dev
 * it logs a clear message to the console so regressions surface fast.
 *
 * The second argument is a free-form object to aid debugging.
 */
export function warnFirstTimeRoutingRegression(reason, details = {}) {
  if (typeof window === 'undefined') return;
  const env = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) || 'development';
  if (env === 'production') return;
  // eslint-disable-next-line no-console
  console.warn(
    '[farroway.firstTimeRouting]',
    reason,
    { ...details, at: new Date().toISOString() },
  );
}

/** Named reasons used by ProfileGuard / ProfileSetup to stay consistent. */
export const FIRST_TIME_WARN = Object.freeze({
  LEGACY_PAGE_REACHED:        'first-time farmer reached legacy Save Farm Profile page',
  FARMER_TYPE_ON_LEGACY:      'farmer type collected on legacy page instead of fast flow',
  FARM_SIZE_BEFORE_FIRST_TASK:'farm size required before first task',
  CROP_REC_BYPASSED:          'crop recommendation flow bypassed for first-time farmer',
  FLOW_ENDED_ON_SAVE_PROFILE: 'first-time route ended on Save Farm Profile screen',
});
