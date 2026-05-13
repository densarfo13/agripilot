/**
 * RoleHomeRedirect — sends the signed-in user to the canonical
 * home path for their role.
 *
 *   <Route path="/home" element={<RoleHomeRedirect />} />
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
 * ─── Loop guard (May 2026 blank-screen fix) ───────────────────
 * Earlier versions navigated to whatever getHomePathForRole
 * returned — including the very route this component is mounted
 * at. For farmers, getHomePathForRole returns '/home', which is
 * also where this component lives → React Router renders
 * RoleHomeRedirect → it returns <Navigate to="/home" /> → mounts
 * RoleHomeRedirect → ad infinitum. The browser paints the
 * background and never gets past the redirect cycle, hence the
 * "blank screen, no UI" report.
 *
 * The fix:
 *   1. Read the current pathname via useLocation().
 *   2. If the resolved primary target equals the current path,
 *      use the role's fallbackHomePath instead.
 *   3. If the fallback ALSO equals the current path (shouldn't
 *      happen, but belt-and-braces) render a real, visible
 *      "go home" UI directly — never another Navigate.
 *
 * Strict-rule audit
 *   • Pure routing decision; never throws.
 *   • useAuthOrNull never throws outside its provider.
 *   • Returns <Navigate replace> so the redirect doesn't
 *     pollute history.
 *   • Cannot infinite-loop — every code path either points to
 *     a different URL or paints visible UI.
 */

import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuthOrNull } from '../../context/AuthContext.jsx';
import {
  getHomePathForRole,
  getFallbackHomePathForRole,
} from '../../lib/roleFeatures.js';

function _samePath(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  // Trim trailing slash for stable comparison ("/home" === "/home/").
  const norm = (s) => (s.length > 1 && s.endsWith('/') ? s.slice(0, -1) : s);
  return norm(a) === norm(b);
}

export default function RoleHomeRedirect() {
  const auth = useAuthOrNull();
  const location = useLocation();
  const authLoading = auth && auth.authLoading === true;
  const user = auth && auth.user ? auth.user : null;
  const here = location && typeof location.pathname === 'string'
    ? location.pathname
    : '/';

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

  const role = user && typeof user.role === 'string' ? user.role : '';
  const primary  = getHomePathForRole(role);
  const fallback = getFallbackHomePathForRole(role);

  // Loop guard step 1 — if the role's primary home equals the
  // current path, use the fallback so we never re-mount this
  // component on the same URL.
  if (_samePath(primary, here)) {
    if (!_samePath(fallback, here)) {
      try {
         
        console.warn(
          '[Farroway] RoleHomeRedirect: primary home "'
          + primary + '" equals current path; using fallback "'
          + fallback + '" instead.'
        );
      } catch { /* swallow */ }
      return <Navigate to={fallback} replace />;
    }
    // Loop guard step 2 — even the fallback equals the current
    // path. Render visible UI rather than navigating; this is
    // the "always paint SOMETHING" guarantee for the blank-
    // screen failsafe.
    try {
       
      console.error(
        '[Farroway] RoleHomeRedirect: both primary and fallback '
        + 'home paths equal current path "' + here + '". '
        + 'Painting safe-home UI to break the loop.'
      );
    } catch { /* swallow */ }
    return (
      <div style={S.safeHome} role="status">
        <div style={S.safeHomeCard}>
          <h1 style={S.safeHomeTitle}>You're home.</h1>
          <p style={S.safeHomeText}>
            We couldn't auto-route to a richer home view. Use the
            links below to continue.
          </p>
          <div style={S.safeHomeBtnRow}>
            <Link to="/dashboard" style={S.safeHomeBtnPrimary}>
              Open dashboard
            </Link>
            <Link to="/tasks" style={S.safeHomeBtnGhost}>
              Today's tasks
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <Navigate to={primary} replace />;
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
  safeHome: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#FFFFFF',
    padding: '2rem',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", '
              + 'Roboto, sans-serif',
  },
  safeHomeCard: {
    maxWidth: '24rem',
    width: '100%',
    textAlign: 'center',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    padding: '2rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  safeHomeTitle: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 800,
    letterSpacing: '-0.01em',
  },
  safeHomeText: {
    margin: 0,
    fontSize: '0.9375rem',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 1.55,
  },
  safeHomeBtnRow: {
    display: 'flex',
    gap: '0.5rem',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: '0.5rem',
  },
  safeHomeBtnPrimary: {
    padding: '0.85rem 1.4rem',
    borderRadius: '12px',
    background: '#C8944D',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: '0.9375rem',
    textDecoration: 'none',
    boxShadow: '0 8px 22px rgba(200,148,77,0.25)',
    minHeight: 46,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeHomeBtnGhost: {
    padding: '0.85rem 1.4rem',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: '0.9375rem',
    textDecoration: 'none',
    minHeight: 46,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
