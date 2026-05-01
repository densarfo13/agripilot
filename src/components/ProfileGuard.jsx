import { Navigate, useLocation } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.jsx';
import { isProfileComplete } from '../lib/farmScore.js';
import { isFirstTimeFarmer } from '../utils/fastOnboarding/index.js';
import { shouldShowSetup } from '../utils/onboarding.js';

export default function ProfileGuard({ children }) {
  const location = useLocation();
  const { profile, farms, loading, initialized } = useProfile();

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

  // Profile incomplete. Decide where to send them.
  const firstTime = isFirstTimeFarmer({ profile, farms });

  if (firstTime) {
    // ─── First-time path: minimal 2-screen onboarding ─────────
    // "Are you new to farming?" → 3-field setup (location, size,
    // crop) → /dashboard. Reaches the first actionable task in
    // under 60 s. The legacy /onboarding/quick and
    // /onboarding/fast routes remain mounted for any deep links
    // that were previously documented.
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
