/**
 * ProfileGuard — ensures a complete farmer profile before rendering children.
 *
 * Ownership: ProfileGuard owns the profile-incomplete redirect to /profile/setup.
 * This keeps redirect logic in one place (single-responsibility pattern).
 *
 * Loading behaviour (infinite-loading fix, May 2026):
 *   useAuthStore does NOT export `initialized` or `loading` fields — they were
 *   always `undefined`, making `!initialized` permanently true and causing an
 *   infinite loading skeleton.
 *
 *   In optional mode (the default used by ProtectedLayout): auth loading is
 *   already handled by the surrounding AuthGuard. ProfileGuard simply renders
 *   children so pages manage their own partial-data states.
 *
 *   In strict mode (optional=false): we read `authLoading` from AuthContext
 *   (which does track real loading state) and only show the skeleton while
 *   that is true, capped at 4 seconds by a local timer.
 *
 * NEVER returns null — see blank-screen spec §1.
 */
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { isProfileComplete } from '../utils/farmScore.js';
import { useAuthStore } from '../store/authStore.js';
// AuthContext provides the real auth-loading signal for strict mode.
// useAuthOrNull is used so this component can also render outside the
// AuthProvider (belt-and-suspenders for SSR / test environments).
import { useAuthOrNull } from '../context/AuthContext.jsx';

export default function ProfileGuard({ children, optional = true }) {
  const { user } = useAuthStore();
  const profile = user?.profile || user;

  // ── Optional mode (default) ────────────────────────────────────
  // AuthGuard already blocked until auth was resolved. ProfileGuard's
  // job here is only to be a pass-through; each page owns its own
  // partial-data loading state.
  // DO NOT gate on `initialized` from authStore — that field does not
  // exist in the store and would evaluate as `undefined` (→ always true
  // → infinite spinner).
  if (optional) {
    return children;
  }

  // ── Strict mode ────────────────────────────────────────────────
  // Used when explicit=false. Show a loading skeleton while auth is
  // resolving, then check profile completeness.
  return (
    <StrictGuard profile={profile}>{children}</StrictGuard>
  );
}

/**
 * StrictGuard — encapsulates the auth-loading hook so it only runs in
 * strict mode (avoids calling useAuthOrNull unconditionally in the
 * optional-mode fast path where it's never needed).
 */
function StrictGuard({ profile, children }) {
  // useAuthOrNull is the non-throwing variant — safe to call even outside
  // AuthProvider. Call unconditionally to satisfy rules-of-hooks.
  const auth = useAuthOrNull();
  const authLoading = auth?.authLoading ?? false;

  // Safety cap: never show the loading skeleton for more than 4 seconds.
  // If auth hasn't resolved by then, render children anyway so the user
  // sees something rather than a permanent spinner.
  const [forceRender, setForceRender] = useState(false);
  useEffect(() => {
    if (!authLoading) return undefined;
    const t = setTimeout(() => setForceRender(true), 4000);
    return () => clearTimeout(t);
  }, [authLoading]);

  if (authLoading && !forceRender) {
    return (
      <div style={LOADING_S.page} data-testid="profile-guard-loading">
        <div style={LOADING_S.spinner} aria-hidden="true" />
        <span style={LOADING_S.brand}>Farroway</span>
        <span style={LOADING_S.text}>Loading your farm…</span>
      </div>
    );
  }

  if (!isProfileComplete(profile)) {
    return <Navigate to="/profile/setup" replace />;
  }

  return children;
}

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
    borderTopColor: '#C8944D',
    borderRadius: '50%',
    animation: 'farroway-spin 0.8s linear infinite',
  },
  brand: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#C8944D',
    letterSpacing: '0.02em',
  },
  text: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.5)',
  },
};
