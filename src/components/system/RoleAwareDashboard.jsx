/**
 * RoleAwareDashboard — picks the right page for /dashboard
 * based on the signed-in user's role.
 *
 *   <Route path="/dashboard" element={<RoleAwareDashboard />} />
 *
 * Routing (May 2026 unified-runtime fix)
 *   farmer / null / unknown role  → <Navigate to="/home" />
 *                                   (PilotHome on Soft Ochre)
 *   ngo / ngo_admin / ngo_officer
 *   / ngo_agent / admin           → renders <NgoDashboardV1 />
 *
 * WHY THE FARMER PATH NOW REDIRECTS
 *   `/home` mounts `<PilotHome />` — the canonical premium
 *   farmer runtime (Soft Ochre tokens, locked design system,
 *   verified-funding gate, orchestrator wiring). `/dashboard`
 *   used to render the legacy `<V2Dashboard />` for farmers
 *   too — a parallel runtime still carrying #86EFAC neon
 *   green literals from the pre-Soft-Ochre era. Two runtimes
 *   for the same farmer role = exactly the duplication the
 *   May 2026 unified-runtime spec calls out. The fix: redirect
 *   farmer /dashboard hits to /home so there's ONE canonical
 *   farmer Home entry. NGO/admin path is unchanged.
 *
 *   The legacy V2Dashboard file stays in src/pages/Dashboard.jsx
 *   but is now disconnected from the farmer route tree (spec §2:
 *   "Do NOT delete yet. Just fully disconnect from production
 *   runtime").
 *
 * Strict-rule audit
 *   • Pure presentational. Never throws.
 *   • useAuthOrNull keeps it safe outside the AuthProvider.
 *   • Lazy-loads NgoDashboardV1 so the farmer redirect path
 *     doesn't pull the NGO chunk into the farmer bundle.
 */

import React, { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
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

  // Farmer / null / unknown role — redirect to the canonical
  // premium runtime at /home. The `children` prop (legacy
  // V2Dashboard mount from App.jsx) is intentionally ignored
  // for these roles per the May 2026 unified-runtime fix.
  // We keep the prop in the signature so a future migration
  // away from the children-pattern doesn't change the
  // call-site shape in App.jsx.
  void children;
  return <Navigate to="/home" replace />;
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
