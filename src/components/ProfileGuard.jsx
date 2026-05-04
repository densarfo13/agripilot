import { Navigate, useLocation } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.jsx';
import { isProfileComplete } from '../lib/farmScore.js';
import { isFirstTimeFarmer } from '../utils/fastOnboarding/index.js';
import { shouldShowSetup } from '../utils/onboarding.js';
import { BYPASS_SETUP_FOR_PILOT } from '../lib/pilotFlags.js';

export default function ProfileGuard({ children }) {
  const location = useLocation();
  const { profile, farms, loading, initialized } = useProfile();

  // ─── Pilot bypass (May 2026 emergency fix) ───────────────────────
  // While the live pilot is unstable we route EVERY authenticated
  // user straight to Home. The in-Home "Complete setup" card
  // surfaces missing crop / location / farm context inline so the
  // user can finish setup without leaving Home, and no automatic
  // redirect can ping-pong them back to "/onboarding/fast" or
  // "/profile/setup". Auth + role state is untouched. Flip the
  // flag in src/lib/pilotFlags.js to disable the bypass; nothing
  // else in this guard needs to change.
  if (BYPASS_SETUP_FOR_PILOT) {
    return children;
  }

  // ─── Onboarding-loop fix v2 (May 2026) ───────────────────────────
  // shouldShowSetup() unifies two rules per the final fix spec:
  //   1. Either `farroway_onboarding_done` OR
  //      `farroway_onboarding_completed` truthy → flag is set.
  //      The original `isOnboardingComplete()`-only check missed
  //      users who completed setup via a save handler that
  //      stamped only the _completed key.
  //   2. Spec §6 fallback — even when the flag is true, if no
  //      garden/farm record exists on the device (wipe /
  //      migration / new device), still send the user to setup
  //      so we never paint a blank Home dashboard.
  // The server profile remains the source of truth for
  // incomplete-data prompts inside the app; the automatic
  // top-of-router redirect is gated by this combined check.
  if (!shouldShowSetup()) return children;

  // Show loading while profile hasn't been initialized for current auth session.
  // This prevents flashing /profile/setup when profile fetch is still in-flight.
  if (!initialized || (loading && !profile)) {
    return (
      <div style={S.loading}>
        <div style={S.loadingInner}>
          <div style={S.spinner} />
          <span style={S.brand}>Farroway</span>
          <span style={S.loadingText}>Loading your farm profile...</span>
        </div>
      </div>
    );
  }

  // Always let the onboarding / setup destinations render themselves.
  if (location.pathname === '/onboarding/minimal') return children;
  if (location.pathname === '/onboarding/quick')   return children;
  if (location.pathname === '/onboarding/fast')    return children;
  if (location.pathname === '/onboarding')         return children;
  if (location.pathname === '/onboarding/v3')      return children;
  if (location.pathname === '/profile/setup')      return children;

  // If the profile is already complete, no routing work needed.
  if (isProfileComplete(profile || {})) return children;

  // ─── Onboarding-loop fix v3 (May 2026 spec §5) ──────────────
  // sessionStorage guard: if the user has ALREADY been
  // redirected to setup once in this tab session and they
  // bounced back here without completing it, do NOT redirect
  // again. The user gets to use the app; the in-app
  // CompleteSetupCard surfaces missing data inline. Without
  // this guard a save-handler bug or a stale profile fetch
  // can ping-pong the user between /dashboard and
  // /onboarding/* until the browser throttles navigation.
  let alreadyVisitedSetup = false;
  try {
    if (typeof sessionStorage !== 'undefined') {
      alreadyVisitedSetup = sessionStorage.getItem('farroway_setup_visited') === '1';
    }
  } catch { alreadyVisitedSetup = false; }
  if (alreadyVisitedSetup) {
    return children;
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('farroway_setup_visited', '1');
    }
  } catch { /* tolerate */ }

  // Profile incomplete. Decide where to send them.
  const firstTime = isFirstTimeFarmer({ profile, farms });

  if (firstTime) {
    // ─── First-time path: minimal 2-screen onboarding ─────────
    // "Are you new to farming?" → 3-field setup (location, size,
    // crop) → /dashboard. Reaches the first actionable task in
    // under 60 s.
    return <Navigate to="/onboarding/minimal" replace />;
  }

  // ─── Returning user with an incomplete legacy profile: the old
  // /profile/setup remains the right destination for them. ────────
  return <Navigate to="/profile/setup" replace />;
}

const S = {
  loading: {
    minHeight: '100vh',
    background: '#0F172A',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingInner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
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
  loadingText: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.5)',
  },
};
