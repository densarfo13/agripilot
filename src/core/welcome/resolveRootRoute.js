/**
 * resolveRootRoute.js — pure router decision for "where does a
 * just-logged-in user land?"
 *
 *   resolveRootRoute({ user, profile, farms })
 *     → '/program-dashboard' | '/dashboard' | '/welcome-farmer'
 *
 * Rules:
 *   1. user.onboardingSource === 'ngo' (or user.source === 'ngo')
 *      → program dashboard — NGO farmers never see consumer onboarding
 *   2. user has an active farm → consumer dashboard
 *   3. otherwise → welcome screen (first-impression entry)
 *
 * Pure. No React. No storage. Safe on missing / partial inputs.
 */

function isNgoSourced(user) {
  if (!user || typeof user !== 'object') return false;
  const src = user.onboardingSource || user.source;
  if (!src || typeof src !== 'string') return false;
  return src.trim().toLowerCase() === 'ngo';
}

function hasActiveFarm(farms, profile) {
  if (Array.isArray(farms) && farms.some((f) => f && f.status === 'active')) {
    return true;
  }
  if (profile && profile.id && profile.cropType && profile.country) {
    return true;
  }
  return false;
}

export function resolveRootRoute({ user = null, profile = null, farms = null } = {}) {
  if (isNgoSourced(user)) return '/program-dashboard';
  if (hasActiveFarm(farms, profile)) return '/dashboard';
  return '/welcome-farmer';
}

/**
 * userBelongsToProgram — returns the program name if the user
 * is NGO-sourced AND has a program tag. Otherwise null.
 */
export function userBelongsToProgram(user) {
  if (!isNgoSourced(user)) return null;
  const program = user?.program;
  if (typeof program !== 'string' || !program.trim()) return null;
  return program.trim();
}

export const _internal = { isNgoSourced, hasActiveFarm };
