import { Navigate, useLocation } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.jsx';
import { isProfileComplete } from '../lib/farmScore.js';
import { isFirstTimeFarmer } from '../utils/fastOnboarding/index.js';
import { isOnboardingComplete } from '../utils/onboarding.js';

export default function ProfileGuard({ children }) {
  const location = useLocation();
  const { profile, farms, loading, initialized } = useProfile();

  // ─── Onboarding-loop fix (Apr 2026 hotfix) ──────────────────────
  // Once a farmer has been through setup ONCE on this device, never
  // automatically route them back. The server profile remains the
  // source of truth for incomplete-data prompts inside the app, but
  // the top-of-router redirect is gated on this client flag so a
  // partial / slow / cold-cache server response can't bounce the
  // user into a redirect loop.
  if (isOnboardingComplete()) return children;

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
  if (location.pathname === '/onboarding/quick') return children;
  if (location.pathname === '/onboarding/fast')  return children;
  if (location.pathname === '/onboarding')       return children;
  if (location.pathname === '/onboarding/v3')    return children;
  if (location.pathname === '/profile/setup')    return children;

  // If the profile is already complete, no routing work needed.
  if (isProfileComplete(profile || {})) return children;

  // Profile incomplete. Decide where to send them.
  const firstTime = isFirstTimeFarmer({ profile, farms });

  if (firstTime) {
    // ─── First-time path: frictionless QuickStart screen ───────
    // Single-tap setup that auto-creates a default farm + auto-
    // detects country + lands the user in /tasks. The legacy
    // /onboarding/fast remains reachable for QA + any deep links
    // that were previously documented.
    return <Navigate to="/onboarding/quick" replace />;
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
