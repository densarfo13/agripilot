/**
 * RoleHomeRedirect — sends the signed-in user to the canonical
 * home path for their role.
 *
 *   <Route path="/" element={<RoleHomeRedirect />} />
 *
 * Why a dedicated component
 *   "/" used to redirect everyone to /dashboard. That worked
 *   when there was one role. With farmer / ngo / buyer the
 *   landing surface differs, so this component reads the
 *   user's role via useAuthOrNull (non-throwing) and uses
 *   roleFeatures.getHomePathForRole to resolve the right
 *   target.
 *
 *   • Logged-out users → /login (the existing public auth path).
 *   • Loading auth     → render the same lightweight page
 *                        loader other guards use, so we never
 *                        flash an early redirect.
 *   • role=farmer      → /home (or fallback /dashboard).
 *   • role=ngo         → /dashboard.
 *   • role=buyer       → /market.
 *
 * Strict-rule audit
 *   • Pure routing decision; never throws.
 *   • useAuthOrNull never throws outside its provider.
 *   • Returns <Navigate replace> so the redirect doesn't
 *     pollute history.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthOrNull } from '../../context/AuthContext.jsx';
import { getHomePathForRole } from '../../lib/roleFeatures.js';

export default function RoleHomeRedirect() {
  const auth = useAuthOrNull();
  const authLoading = auth && auth.authLoading === true;
  const user = auth && auth.user ? auth.user : null;

  if (authLoading) {
    // Inline minimal loading screen — matches other guards in
    // the codebase. We deliberately don't import a heavy page-
    // loader to keep this hot path light.
    return (
      <div style={S.loading} aria-busy="true">
        <div style={S.spinner} />
      </div>
    );
  }

  if (!user) {
    // Not signed in — punt to the existing login page. The
    // login flow sets `from` so the user returns here after
    // auth completes.
    return <Navigate to="/login" replace />;
  }

  const target = getHomePathForRole(user.role);
  return <Navigate to={target} replace />;
}

const S = {
  loading: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-top, #0c1f1c)',
  },
  spinner: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.12)',
    borderTopColor: 'var(--role-accent, #2ecc71)',
    animation: 'farroway-spin 0.8s linear infinite',
  },
};
