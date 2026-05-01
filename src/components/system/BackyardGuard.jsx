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
  try { profile = useProfile()?.profile || null; } catch { profile = null; }

  const country  = profile?.country || profile?.countryCode || null;
  const farmType = profile?.farmType || profile?.type || null;

  let isBackyard = false;
  try { isBackyard = shouldUseBackyardExperience(country, farmType); }
  catch { isBackyard = false; }

  useEffect(() => {
    if (!isBackyard) return;
    try { trackEvent('backyard_guard_redirect', { country, farmType }); }
    catch { /* swallow */ }
    try { navigate('/home', { replace: true }); }
    catch { /* swallow */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBackyard]);

  if (isBackyard) return null;
  return children || null;
}
