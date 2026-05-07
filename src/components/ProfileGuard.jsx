import React from 'react';
import { Navigate } from 'react-router-dom';
import { isProfileComplete } from '../utils/farmScore.js';
import { useAuthStore } from '../store/authStore.js';

/**
 * ProfileGuard — ensures a complete farmer profile before rendering children.
 *
 * Ownership: ProfileGuard owns the profile-incomplete redirect to /profile/setup.
 * This keeps redirect logic in one place (single-responsibility pattern).
 *
 * Loading: shows nothing while profile initializes (prevents a flash/blink).
 * Redirect: sends to /profile/setup when isProfileComplete returns false.
 *
 * NOTE: Setup can be made optional by passing `optional={true}` — in that
 * case ProfileGuard renders children even when profile is incomplete.
 * See src/core/routePolicy.js for the canonical route-level rule set.
 */
export default function ProfileGuard({ children, optional = true }) {
  const { user, loading, initialized } = useAuthStore();
  const profile = user?.profile || user;

  // Show nothing while auth/profile initializes to avoid blink
  // Condition: !initialized || (loading && !profile)
  if (!initialized || (loading && !profile)) {
    return null;
  }

  // Optional mode (default): always render children without redirect.
  // Inline prompt cards surface missing data on the destination page.
  if (optional) {
    return children;
  }

  // Strict mode: redirect to /profile/setup when profile is incomplete.
  // ProfileGuard owns this redirect — no other component should duplicate it.
  if (!isProfileComplete(profile)) {
    return <Navigate to="/profile/setup" replace />;
  }

  return children;
}
