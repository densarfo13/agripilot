/**
 * resolveWelcomeRoute.js — pure router decision for the new
 * minimal welcome / first-impression screen.
 *
 *   resolveWelcomeEntry({ profile, farms })
 *     → { action: 'welcome' | 'dashboard' | 'onboarding' }
 *
 * Rules:
 *   • user with an active farm → 'dashboard'
 *   • user partway through fast onboarding → 'onboarding' (resume)
 *   • everyone else → 'welcome' (show the new minimal screen)
 *
 * The click-handler targets don't live here — the component
 * owns navigate() — but this helper tells the component whether
 * the welcome screen should even mount in the first place.
 */

import { isFirstTimeFarmer }
  from '../../utils/fastOnboarding/firstTimeFarmerGuard.js';
import { hasCompletedFastOnboarding, loadFastState }
  from '../../utils/fastOnboarding/fastOnboardingPersistence.js';

export function resolveWelcomeEntry({ profile = null, farms = null } = {}) {
  // Users with any active farm → straight to dashboard.
  if (Array.isArray(farms) && farms.some((f) => f && f.status === 'active')) {
    return Object.freeze({ action: 'dashboard' });
  }
  if (profile && profile.id && profile.cropType && profile.country) {
    return Object.freeze({ action: 'dashboard' });
  }

  // Partially-completed fast onboarding → resume where left off.
  const fast = loadFastState();
  if (fast && !hasCompletedFastOnboarding(fast) && fast.hasSeenIntro) {
    return Object.freeze({ action: 'onboarding' });
  }

  // First-time / returning-no-farm → show the new welcome screen.
  if (isFirstTimeFarmer({ profile, farms })) {
    return Object.freeze({ action: 'welcome' });
  }

  // Safe default — treat as welcome so nothing's worse than
  // showing the first screen redundantly.
  return Object.freeze({ action: 'welcome' });
}

/**
 * resolvePrimaryCtaDestination — where "Find My Best Crop"
 * should go given the current onboarding answer + stored farm.
 * Called at click time so a late-arriving geolocation doesn't
 * affect the decision.
 */
export function resolvePrimaryCtaDestination({ profile = null } = {}) {
  // If there's a farm with a country already, take them to the
  // existing recommendations page with farmId — same path the
  // "Find My Best Crop" button on My Farm already uses.
  if (profile && profile.id && (profile.countryCode || profile.country)) {
    return `/crop-recommendations?farmId=${encodeURIComponent(profile.id)}`;
  }
  // Fresh users hit the legacy crop-fit intake — it respects the
  // onboarding state blob we just wrote to localStorage.
  return '/crop-fit';
}

/**
 * resolveSecondaryCtaDestination — "Continue Setup" should send
 * first-timers through the fast onboarding flow, and existing
 * users to the new-farm page (adding a farm to their account).
 */
export function resolveSecondaryCtaDestination({ profile = null, farms = null } = {}) {
  if (isFirstTimeFarmer({ profile, farms })) return '/onboarding/fast';
  return '/farm/new';
}
