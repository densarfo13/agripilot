/**
 * getFirstValueScreen — what screen a farmer should land on right
 * after onboarding completes. Goal: never a dead-end success page.
 *
 *   getFirstValueScreen({ pickedCrop, activeCycle, mode }) →
 *     { path, state }
 *
 * Rules:
 *   - If they already have an active cycle → /today
 *   - Else if they picked a crop in onboarding → /crop-plan
 *     (which kicks off the cycle)
 *   - Else → /recommendations (or /farmer/onboarding/recs if that
 *     route exists). Backyard mode still lands on the same path
 *     — the recommendation step handles mode internally.
 */

export function getFirstValueScreen({ pickedCrop, activeCycle, mode, onboardingContext } = {}) {
  if (activeCycle?.id) {
    return { path: '/today', state: { source: 'onboarding', onboardingContext } };
  }
  if (pickedCrop?.crop || pickedCrop?.key) {
    return {
      path: '/crop-plan',
      state: {
        onboardingContext,
        crop: pickedCrop,
        source: 'onboarding',
      },
    };
  }
  // Fallback: land on recommendations screen with whatever context
  // we have so the scorer can produce a list immediately. The route
  // is the existing `/crop-fit/us` (see App.jsx) — if the app later
  // exposes `/recommendations` we swap the path here in one place.
  return {
    path: '/today',
    state: {
      source: 'onboarding',
      onboardingContext,
      showRecommendations: true,
    },
  };
}

export function buildPostOnboardingRoute(form = {}) {
  return getFirstValueScreen({
    pickedCrop: form.pickedCrop || null,
    activeCycle: form.activeCycle || null,
    mode: form.mode || null,
    onboardingContext: form,
  });
}
