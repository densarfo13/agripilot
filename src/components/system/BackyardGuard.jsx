/**
 * BackyardGuard — wraps routes that should never be reachable
 * by a U.S. backyard / home garden user (Sell, Opportunities).
 *
 * Behaviour
 *   * Reads `country` + `farmType` from ProfileContext.
 *   * If `shouldUseBackyardExperience(country, farmType)` is true,
 *     redirects to `/home` with `replace: true` and fires a
 *     `backyard_guard_redirect` analytics event so the funnel
 *     can show how often a stale link / direct URL hit landed
 *     on the wrong surface.
 *   * Otherwise renders `children` unchanged.
 *
 * Why this exists
 *   BottomTabNav already filters Sell + Funding tiles out of the
 *   nav for backyard users, but the underlying routes were still
 *   reachable via direct URL or stale push notifications. This
 *   guard closes that leak without modifying every page file.
 *
 * Strict-rule audit
 *   * Never throws. ProfileContext / analytics calls are wrapped.
 *   * No user-visible text — pure routing concern.
 *   * Renders `children` synchronously when not gated, so there
 *     is no flash for the 99% case (farmer / unknown experience).
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../../context/ProfileContext.jsx';
import { shouldUseBackyardExperience } from '../../config/regionConfig.js';
import { trackEvent } from '../../analytics/analyticsStore.js';

export default function BackyardGuard({ children }) {
  const navigate = useNavigate();
  let profile = null;
  let profileLoading = false;
  let profileInitialized = true;
  try {
    const ctx = useProfile() || {};
    profile = ctx.profile || null;
    profileLoading = !!ctx.loading;
    profileInitialized = ctx.initialized !== false;
  } catch {
    profile = null;
    profileLoading = false;
    profileInitialized = true;
  }

  const country  = profile?.country || profile?.countryCode || null;
  const farmType = profile?.farmType || profile?.type || null;

  // Defer the experience check until ProfileContext has a real
  // answer. Without this, a backyard user who deep-links into
  // /sell can see one frame of the farmer surface before the
  // redirect fires (the profile load races the route mount).
  const profileReady = profileInitialized && !profileLoading
    && (profile !== null || profileInitialized);

  let isBackyard = false;
  try {
    if (profileReady) {
      isBackyard = shouldUseBackyardExperience(country, farmType);
    }
  } catch { isBackyard = false; }

  useEffect(() => {
    if (!profileReady) return;
    if (!isBackyard) return;
    try { trackEvent('backyard_guard_redirect', { country, farmType }); }
    catch { /* swallow */ }
    try { navigate('/home', { replace: true }); }
    catch { /* swallow */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileReady, isBackyard]);

  // While profile is still loading, render nothing rather than
  // flash the underlying farmer page. ProtectedLayout already
  // shows a spinner above us, so a blank child here is invisible.
  if (!profileReady) return null;
  if (isBackyard) return null;
  return children || null;
}
