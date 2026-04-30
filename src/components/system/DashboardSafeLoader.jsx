/**
 * DashboardSafeLoader — wrapper for protected routes that
 * loads → repairs → renders, with bounded redirects so the
 * dashboard never enters an infinite loop with /setup-farm
 * (spec §3, §9).
 *
 * Usage:
 *   <DashboardSafeLoader
 *     user={user} profile={profile} farms={farms}
 *     activeFarm={activeFarm}
 *     isAuthLoading={isAuthLoading}
 *     isProfileLoading={isProfileLoading}
 *   >
 *     <Dashboard />
 *   </DashboardSafeLoader>
 *
 * Behaviour:
 *   • status === 'loading'                → splash
 *   • status === 'ready'                  → render children
 *   • status === 'needs_onboarding'       → navigate to setup,
 *                                            but only ONCE per
 *                                            session (anti-loop)
 *   • status === 'needs_farm_selection'   → render <EmptyFarmState/>
 *   • status === 'error' (or N children-render failures) →
 *                                            recovery card
 *
 * Strict-rule audit
 *   • Hides quietly when FEATURE_SAFE_SESSION is off (renders
 *     children straight through) so existing pilots are
 *     unaffected.
 *   • Per-session redirect counter prevents the dashboard ↔
 *     setup loop the spec calls out.
 *   • Children render through an inline error boundary that
 *     falls back to the recovery card on the second failure.
 */

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import { isFeatureEnabled } from '../../utils/featureFlags.js';
import { useSessionBootstrap } from '../../core/sessionBootstrap.js';
import EmptyFarmState from './EmptyFarmState.jsx';

const SETUP_PATH = '/onboarding/simple';
const REDIRECT_LIMIT = 1;

// ── Inline children error boundary ───────────────────────────
class ChildrenBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failures: 0, error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    // Bump failure counter; the parent decides what to do.
    this.setState((s) => ({ failures: s.failures + 1, error }));
    if (typeof this.props.onFailure === 'function') {
      try { this.props.onFailure(error); } catch { /* swallow */ }
    }
  }
  render() {
    if (this.state.failures >= 2) {
      return this.props.fallback || null;
    }
    if (this.state.error) {
      // Re-render once after recovering. If it fails again,
      // the failures counter will trip the fallback above.
      return this.props.children;
    }
    return this.props.children;
  }
}

export default function DashboardSafeLoader({
  user             = null,
  profile          = null,
  farms            = null,
  activeFarm       = null,
  isAuthLoading    = false,
  isProfileLoading = false,
  backendAvailable = true,
  children,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const redirectCountRef = React.useRef(0);

  // Flag off → render children straight through. Keeps
  // existing pilots unchanged.
  if (!isFeatureEnabled('FEATURE_SAFE_SESSION')) {
    return children || null;
  }

  const session = useSessionBootstrap({
    user, profile, farms, activeFarm,
    isAuthLoading, isProfileLoading, backendAvailable,
  });

  // Anti-loop redirect to /setup. Spec §9: never bounce
  // between dashboard and setup; only redirect once per
  // session, and never if the user is already there.
  React.useEffect(() => {
    if (session.status !== 'needs_onboarding') return;
    if (location.pathname === SETUP_PATH) return;
    if (redirectCountRef.current >= REDIRECT_LIMIT) return;
    redirectCountRef.current += 1;
    try { navigate(SETUP_PATH, { replace: true }); }
    catch { /* ignore */ }
  }, [session.status, location.pathname, navigate]);

  if (session.status === 'loading') {
    return <SafeSplash />;
  }

  if (session.status === 'needs_farm_selection') {
    return (
      <EmptyFarmState
        message={tSafe(
          'recovery.needsFarmSelection',
          'You have farms but none is selected on this device. Pick one to continue.',
        )}
      />
    );
  }

  if (session.status === 'needs_onboarding') {
    // We tried to redirect above but the limit may have
    // tripped (e.g. the redirect path itself is broken).
    // Render the recovery card as a safe terminal state.
    if (redirectCountRef.current >= REDIRECT_LIMIT
        && location.pathname !== SETUP_PATH) {
      return <EmptyFarmState />;
    }
    return <SafeSplash />;
  }

  if (session.status === 'error') {
    return <EmptyFarmState />;
  }

  // status === 'ready' — render children inside the boundary.
  return (
    <ChildrenBoundary fallback={<EmptyFarmState />}>
      {children}
    </ChildrenBoundary>
  );
}

function SafeSplash() {
  return (
    <main style={S.splash} data-testid="dashboard-safe-splash">
      <div style={S.spinner} aria-hidden="true" />
      <p style={S.splashText}>
        {tSafe('recovery.loading', 'Loading your farm\u2026')}
      </p>
    </main>
  );
}

const S = {
  splash: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#EAF2FF',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.875rem',
  },
  spinner: {
    width: 36, height: 36,
    borderRadius: '50%',
    border: '3px solid rgba(34,197,94,0.18)',
    borderTopColor: '#22C55E',
    animation: 'farroway-safe-spin 0.9s linear infinite',
  },
  splashText: { margin: 0, fontSize: '0.9375rem', color: '#9FB3C8' },
};

// Inject the spinner keyframes once (avoids a styled-components
// dependency for a single 4-line animation).
if (typeof document !== 'undefined') {
  const STYLE_ID = 'farroway-safe-spin-keyframes';
  if (!document.getElementById(STYLE_ID)) {
    try {
      const el = document.createElement('style');
      el.id = STYLE_ID;
      el.textContent = '@keyframes farroway-safe-spin { to { transform: rotate(360deg); } }';
      document.head.appendChild(el);
    } catch { /* ignore */ }
  }
}
