/**
 * safeNavigateHome.js — guarded navigation to the home dashboard.
 *
 *   import { safeNavigateHome } from '../utils/safeNavigateHome.js';
 *
 *   safeNavigateHome(navigate);
 *
 * Guard contract (final crash-prevention spec §6)
 *   • If the user has no active experience (no garden, no farm),
 *     route to `/login` instead of `/home` so we never paint a
 *     blank dashboard with no data to read.
 *   • If the explicit-logout flag is set, route to `/login` even
 *     when storage still has a stale farm — bootstrap will then
 *     short-circuit on the same flag.
 *   • Otherwise, navigate to `/home` with `replace: true`.
 *
 * Why a helper instead of inline `navigate('/home')`
 *   Every save handler (BackyardOnboarding, NewFarmScreen,
 *   GardenSetupForm, MinimalFarmSetup, AdaptiveFarmSetup) ends
 *   in `navigate('/home', { replace: true })`. A blank dashboard
 *   bug means one of those handlers fired before the
 *   experience pointer landed in localStorage. The helper makes
 *   the safety check the default.
 *
 * Strict-rule audit
 *   * Pure function. No I/O on import.
 *   * Wraps every storage read so SSR / private mode won't throw.
 *   * Returns `true` when navigation happened, `false` when the
 *     caller's `navigate` reference was missing.
 */

import { isExplicitLogout } from './explicitLogout.js';
import { getActiveExperience } from '../store/multiExperience.js';

export function safeNavigateHome(navigate, opts = {}) {
  if (typeof navigate !== 'function') return false;
  const replace = opts.replace !== false; // default true

  // Explicit-logout beats every other route choice.
  try {
    if (isExplicitLogout()) {
      navigate('/login', { replace });
      return true;
    }
  } catch { /* swallow */ }

  // No active experience — sending the user to /home would
  // render a blank dashboard. Route to /login (bootstrap will
  // then bounce them through onboarding if a farm record
  // does exist on the device but the pointer is missing — the
  // repair pass owns that recovery, not navigation).
  let exp = null;
  try { exp = getActiveExperience(); } catch { exp = null; }
  if (!exp) {
    navigate('/login', { replace });
    return true;
  }

  navigate('/home', { replace });
  return true;
}

export default safeNavigateHome;
