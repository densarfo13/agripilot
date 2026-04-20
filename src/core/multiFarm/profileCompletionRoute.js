/**
 * profileCompletionRoute.js — the single router decision for
 * every "Complete Profile" / "Setup Farm" / "Add New Farm"
 * button in the app.
 *
 * Replaces scattered `navigate('/profile/setup')` calls — the
 * legacy form — with a context-aware decision that routes
 * first-time farmers to the fast flow, existing users to the
 * dedicated edit/new-farm flows, and falls back to the legacy
 * page ONLY when it's explicitly the right destination (manual
 * add-new-farm for existing multi-farm users).
 *
 * Contract:
 *
 *   resolveProfileCompletionRoute({ profile, farms, reason? })
 *     → { path, query }
 *
 * reason values:
 *   'setup'             — default. First-time: fast flow. Existing: edit.
 *   'new_farm'          — existing user adding a second farm.
 *   'complete_profile'  — existing user with incomplete profile.
 *
 * Pure. No React. No navigation. Feeds any router.
 */

import { isFirstTimeFarmer } from '../../utils/fastOnboarding/firstTimeFarmerGuard.js';

/** hasMinimumProfileForEdit — enough data to meaningfully edit. */
function hasMinimumProfileForEdit(profile) {
  return !!(profile && typeof profile === 'object' && profile.id);
}

export function resolveProfileCompletionRoute({
  profile = null, farms = [], reason = 'setup',
} = {}) {
  // First-time farmers always go to the fast flow — never the legacy form.
  if (isFirstTimeFarmer({ profile, farms })) {
    return Object.freeze({ path: '/onboarding/fast', query: {} });
  }

  // Existing user adding a new farm → legacy setup is the intended
  // destination for this case (it supports ?newFarm=1 mode).
  if (reason === 'new_farm') {
    return Object.freeze({ path: '/profile/setup', query: { newFarm: '1' } });
  }

  // Existing user with incomplete profile → prefer the dedicated
  // edit page in completion mode. Falls back to legacy setup only
  // when there is no editable profile id (shouldn't happen for
  // existing users, but keeps the decision total).
  if (hasMinimumProfileForEdit(profile)) {
    return Object.freeze({
      path: '/edit-farm',
      query: { mode: 'complete_profile', farmId: profile.id },
    });
  }

  // Safe fallback for the edge case: legacy form.
  return Object.freeze({ path: '/profile/setup', query: {} });
}

/** Render {path, query} into a plain URL string. */
export function routeToUrl(dest) {
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
