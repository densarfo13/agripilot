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
  // ─── Hook-order fix (May 2026 React #300 hardening) ────────
  // ALL hooks must run on every render. The flag-off short-
  // circuit was previously between hook calls, which trips
  // the rules-of-hooks linter. Keep the flag-off branch but
  // move it BELOW every hook declaration; the safe-session
  // bootstrap simply runs and is ignored when the flag is off.
  const location = useLocation();
  const navigate = useNavigate();
  const redirectCountRef = React.useRef(0);

  const safeSessionEnabled = isFeatureEnabled('FEATURE_SAFE_SESSION');

  const session = useSessionBootstrap({
    user, profile, farms, activeFarm,
    isAuthLoading, isProfileLoading, backendAvailable,
  });

  // Setup is optional. The needs_onboarding render branch below
  // shows EmptyFarmState (an inline "Add farm" card) so the user
  // stays on their destination page and can tap the CTA when ready.
  // No automatic redirect — tapping Home or My Grow must NEVER
  // send the user to setup involuntarily.
  React.useEffect(() => {
    // no-op: auto-redirect removed per routing fix spec.
    // location, navigate, redirectCountRef are declared above and
    // kept in hook-call position to preserve React's hook order.
    void safeSessionEnabled; void session.status;
  }, [safeSessionEnabled, session.status]);

  // Flag off → render children straight through.
  if (!safeSessionEnabled) {
    return children || null;
  }

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
    // No auto-redirect. Show the inline "Add farm" card so the
    // user can continue from the page they tapped to reach.
    return <EmptyFarmState />;
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
