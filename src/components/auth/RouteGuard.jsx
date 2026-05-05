/**
 * RouteGuard — client-side role gate for protected routes.
 *
 *   <Route path="/admin" element={
 *     <RouteGuard path="/admin">
 *       <AdminControlPage />
 *     </RouteGuard>
 *   } />
 *
 *   Or with explicit allowed roles (overrides the registry):
 *
 *   <RouteGuard allowedRoles={[ROLES.NGO_ADMIN]}>
 *     <NgoDashboard />
 *   </RouteGuard>
 *
 * Behavior
 * ────────
 *   • Reads the current role via `getUserRole()` (resolves from
 *     localStorage.farroway_active_role mirrored from auth)
 *   • Looks up the route's allow-list via `canAccessRoute(path)`
 *     OR uses the explicit `allowedRoles` prop
 *   • Allowed → renders children unchanged
 *   • Denied → renders the spec's "no access" message + fires
 *     `role_access_denied` analytics (Spec §3 + §20)
 *
 * Why client-side gating in addition to server-side
 * ─────────────────────────────────────────────────
 *   The server is the source of truth for restricted-data
 *   access; the spec is explicit ("Backend must verify role
 *   before returning restricted data"). This component is the
 *   UX-side safety net:
 *     • prevents "loading… spinner → unauthorized" flicker
 *       when a user types a forbidden URL directly
 *     • fires the `role_access_denied` analytics event so the
 *       funnel can measure attempted-but-blocked access
 *     • surfaces the spec's exact wording instead of a 403
 *       response page from the server
 *
 * ══════════════════════════════════════════════════════════════
 * PERMANENT ROUTING RULE — DO NOT VIOLATE:
 *
 * RouteGuard checks ONLY:
 *   1. user.role is in the route's allowed-roles list
 *
 * RouteGuard must NEVER check or block on:
 *   • location missing
 *   • crop / plant missing
 *   • farm / garden completeness
 *   • onboardingComplete flag
 *   • any form of "profile is incomplete"
 *
 * Missing setup data → inline prompt cards (not route blocks).
 * Auth missing → handled by AuthGuard before RouteGuard runs.
 * See src/core/routePolicy.js for the canonical rule set.
 * ══════════════════════════════════════════════════════════════
 *
 * Strict-rule audit
 *   • Pure presentational — never mutates state.
 *   • Never throws — analytics call is try/catch'd.
 *   • All visible text via tStrict.
 *   • Server-side authz is unchanged; this is purely UX.
 */

import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useStrictTranslation as useTranslation } from '../../i18n/useStrictTranslation.js';
import { tStrict } from '../../i18n/strictT.js';
import { trackEvent } from '../../core/analytics.js';
import { getUserRole, isRoleAllowed } from '../../core/userRole.js';
import { canAccessRoute, getRouteAllowedRoles } from '../../core/roleAccess.js';

export default function RouteGuard({
  path,
  allowedRoles,
  children,
}) {
  // Re-render on language flip so the denial copy localizes.
  useTranslation();
  const location = useLocation();

  // Resolve the path the guard is gating. Caller can override
  // via the `path` prop (useful for /buyer/:id where the
  // location.pathname has a dynamic segment); falls back to
  // location.pathname so the typical wrap-route pattern works
  // without arguments.
  const resolvedPath = path || location.pathname;

  // Compute access decision once per render. allowedRoles
  // (when supplied) wins; otherwise the central registry
  // decides via canAccessRoute(). Memoised so a
  // deep-equal-stable allowedRoles array doesn't churn.
  const { allowed, currentRole } = useMemo(() => {
    let role = 'farmer';
    try { role = getUserRole(); }
    catch { role = 'farmer'; }
    if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
      return { allowed: isRoleAllowed(role, allowedRoles), currentRole: role };
    }
    return { allowed: canAccessRoute(resolvedPath, role), currentRole: role };
  }, [resolvedPath, allowedRoles]);

  // Spec §20 — fire role_access_denied analytics on denial.
  // Once-per-mount via empty-deps useEffect + the same access
  // decision; never re-fires on a re-render unless the path
  // changes. Wrapped in try/catch so analytics never crashes
  // the render path.
  useEffect(() => {
    if (allowed) return;
    try {
      trackEvent('role_access_denied', {
        path:    resolvedPath,
        role:    currentRole,
        allowed: getRouteAllowedRoles(resolvedPath),
      });
    } catch { /* swallow — analytics never blocks UI */ }
  }, [allowed, resolvedPath, currentRole]);

  if (allowed) {
    return children || null;
  }

  // Spec §3 + §21 — denied message. Exact wording per spec:
  // "You don't have access to this area."
  return (
    <main
      style={S.page}
      data-testid="route-guard-denied"
      data-attempted-path={resolvedPath}
    >
      <section style={S.card} role="alert" aria-live="polite">
        <span style={S.icon} aria-hidden="true">{'\uD83D\uDD12'}</span>
        <h2 style={S.title}>
          {tStrict('routeGuard.denied.title',
            'You don\u2019t have access to this area.')}
        </h2>
        <p style={S.body}>
          {tStrict('routeGuard.denied.body',
            'If you think this is wrong, contact your account admin.')}
        </p>
        <a
          href="/"
          style={S.cta}
          data-testid="route-guard-go-home"
        >
          {tStrict('routeGuard.denied.goHome', 'Go to Home')}
        </a>
      </section>
    </main>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#EAF2FF',
    padding: '1.5rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: '24rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 16,
    padding: '24px 22px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 12,
  },
  icon: {
    fontSize: 32,
    lineHeight: 1,
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: '#FFFFFF',
    lineHeight: 1.3,
  },
  body: {
    margin: 0,
    fontSize: 14,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 1.5,
  },
  cta: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#22C55E',
    color: '#0B1D34',
    border: 'none',
    borderRadius: 12,
    padding: '12px 20px',
    fontSize: 15,
    fontWeight: 800,
    minHeight: 44,
    width: '100%',
    textDecoration: 'none',
    marginTop: 6,
    cursor: 'pointer',
  },
};
