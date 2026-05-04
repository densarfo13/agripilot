/**
 * RoleAwareDashboard — picks the right page for /dashboard
 * based on the signed-in user's role.
 *
 *   <Route path="/dashboard" element={<RoleAwareDashboard />} />
 *
 * Routing
 *   farmer / null / unknown role  → renders the farmer
 *                                   <V2Dashboard /> (default
 *                                   passed in via children)
 *   ngo / ngo_admin / ngo_officer
 *   / ngo_agent / admin           → renders <NgoDashboardV1 />
 *
 * Why a wrapper instead of separate routes
 *   The spec calls for /dashboard to BE the role-aware
 *   landing — same path, different page. This wrapper keeps
 *   the existing /dashboard route mount unchanged and
 *   delegates the page choice to a single audited helper.
 *
 * Strict-rule audit
 *   • Pure presentational. Never throws.
 *   • useAuthOrNull keeps it safe outside the AuthProvider.
 *   • Lazy-loads NgoDashboardV1 so the farmer-default path
 *     doesn't pull the NGO chunk into the farmer bundle.
 */

import React, { lazy, Suspense } from 'react';
import { useAuthOrNull } from '../../context/AuthContext.jsx';

const NgoDashboardV1 = lazy(() => import('../../pages/ngo/NgoDashboardV1.jsx'));

const NGO_ROLES = new Set([
  'ngo', 'ngo_admin', 'ngo_officer', 'ngo_agent',
  // Platform admins also see the NGO dashboard at /dashboard so
  // they have an operator view by default; their own admin
  // surfaces remain on /admin/*.
  'platform_admin', 'super_admin',
]);

function _normaliseRole(role) {
  return typeof role === 'string' ? role.toLowerCase().trim() : '';
}

export default function RoleAwareDashboard({ children }) {
  const auth = useAuthOrNull();
  const role = _normaliseRole(auth && auth.user && auth.user.role);

  if (NGO_ROLES.has(role)) {
    return (
      <Suspense fallback={<DashboardLoader />}>
        <NgoDashboardV1 />
      </Suspense>
    );
  }

  // Default — render whatever the parent passed in (the
  // existing farmer V2Dashboard mount).
  return children || null;
}

function DashboardLoader() {
  return (
    <div style={S.loader} aria-busy="true" data-testid="ngo-dashboard-loader">
      <div style={S.spinner} />
    </div>
  );
}

const S = {
  loader: {
    minHeight: '60vh',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  spinner: {
    width: 28, height: 28, borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.12)',
    borderTopColor: 'var(--role-accent, #2aa7a1)',
    animation: 'farroway-spin 0.8s linear infinite',
  },
};

export const _internal = Object.freeze({ NGO_ROLES, _normaliseRole });
