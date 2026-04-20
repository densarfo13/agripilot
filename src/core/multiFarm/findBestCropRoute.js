/**
 * findBestCropRoute.js — pure router-decision for the
 * "Find My Best Crop" button.
 *
 * Contract:
 *
 *   resolveFindBestCropRoute({ profile, farms })
 *     → { path, query }
 *
 * Rules (from §2):
 *   • first-time farmer (no farm) → /onboarding/fast
 *       (the fast flow already handles recommendation)
 *   • existing farm with enough data → /crop-recommendations?farmId=X
 *   • existing farm with MISSING essentials → /edit-farm?mode=complete_for_recommendation
 *
 * We DO NOT send existing users to /crop-fit (the onboarding
 * intake) anymore — that was the bug this helper closes.
 *
 * Pure. No React. No navigation. The caller takes the returned
 * `{path, query}` and passes it to react-router.
 */

import { isFirstTimeFarmer } from '../../utils/fastOnboarding/firstTimeFarmerGuard.js';

/**
 * hasMinimumFarmForRec — the recommendation engine needs at
 * least a country code to produce useful suggestions. Everything
 * else is a "nice to have".
 *
 * See §7: "Minimum recommended fields: countryCode required,
 * cropId optional, stateCode optional, farmSize optional, stage
 * optional."
 */
export function hasMinimumFarmForRec(profile) {
  if (!profile || typeof profile !== 'object') return false;
  const cc = profile.countryCode || profile.country;
  return typeof cc === 'string' && cc.trim().length > 0;
}

/**
 * Build the "complete for recommendation" edit-farm destination
 * so the user only has to fill the missing essentials rather
 * than see the full edit form.
 */
function buildCompleteDestination(farmId) {
  return {
    path: '/edit-farm',
    query: { mode: 'complete_for_recommendation', farmId: farmId || null },
  };
}

/**
 * Build the existing-user recommendations destination. farmId
 * is passed so the recommendations page knows which farm to
 * compute against (multi-farm support).
 */
function buildRecommendationDestination(farmId) {
  return {
    path: '/crop-recommendations',
    query: { farmId: farmId || null },
  };
}

/**
 * Build the first-time destination. For first-time farmers,
 * we send them to the fast onboarding flow which has its own
 * recommendation screen (Screen 4).
 */
function buildFirstTimeDestination() {
  return { path: '/onboarding/fast', query: {} };
}

/**
 * resolveFindBestCropRoute — main entry point. Returns a
 * frozen `{path, query}` that a caller can feed to any router.
 */
export function resolveFindBestCropRoute({ profile = null, farms = [] } = {}) {
  if (isFirstTimeFarmer({ profile, farms })) {
    return Object.freeze(buildFirstTimeDestination());
  }
  if (!hasMinimumFarmForRec(profile)) {
    return Object.freeze(buildCompleteDestination(profile?.id || null));
  }
  return Object.freeze(buildRecommendationDestination(profile?.id || null));
}

/** Render a {path, query} into a plain URL string. */
export function destinationToUrl(dest) {
  if (!dest || typeof dest !== 'object') return '/';
  const path = dest.path || '/';
  const q = dest.query || {};
  const parts = [];
  for (const k of Object.keys(q)) {
    const v = q[k];
    if (v == null || v === '') continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `${path}?${parts.join('&')}` : path;
}
