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
 * Loading: shows a visible loading skeleton while profile initializes.
 * NEVER returns null — a blank screen is never safe here because
 * ProfileGuard wraps the entire ProtectedLayout (header + nav + page content).
 * Returning null would blank the whole page for the duration of auth init.
 *
 * Redirect: sends to /profile/setup when isProfileComplete returns false.
 *
 * NOTE: Setup can be made optional by passing `optional={true}` — in that
 * case ProfileGuard renders children even when profile is incomplete.
 * See src/core/routePolicy.js for the canonical route-level rule set.
 */
export default function ProfileGuard({ children, optional = true }) {
  const { user, loading, initialized } = useAuthStore();
  const profile = user?.profile || user;

  // Safe loading state — ALWAYS render visible content so the 4-second
  // blank-screen watchdog in main.jsx never fires during auth init.
  // The previous `return null` caused FARROWAY_BLANK because ProfileGuard
  // wraps the entire ProtectedLayout; null here blanked the full page.
  if (!initialized || (loading && !profile)) {
    return (
      <div style={LOADING_S.page} data-testid="profile-guard-loading">
        <div style={LOADING_S.spinner} aria-hidden="true" />
        <span style={LOADING_S.brand}>Farroway</span>
        <span style={LOADING_S.text}>Loading your farm…</span>
      </div>
    );
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

// Spinner animation is already declared in AuthGuard.jsx via the
// farroway-spin @keyframes injected by main.jsx. Using the same
// class keeps the animation consistent and doesn't duplicate the
// keyframe injection.
const LOADING_S = {
  page: {
    minHeight: '100vh',
    background: '#0B1D34',
    color: '#FFFFFF',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  spinner: {
    width: '2rem',
    height: '2rem',
    border: '3px solid rgba(255,255,255,0.1)',
    borderTopColor: '#22C55E',
    borderRadius: '50%',
    animation: 'farroway-spin 0.8s linear infinite',
  },
  brand: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#22C55E',
    letterSpacing: '0.02em',
  },
  text: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.5)',
  },
};
