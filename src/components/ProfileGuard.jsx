import { Navigate, useLocation } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.jsx';
import { isProfileComplete } from '../lib/farmScore.js';
import { isFirstTimeFarmer } from '../utils/fastOnboarding/index.js';

export default function ProfileGuard({ children }) {
  const location = useLocation();
  const { profile, farms, loading, initialized } = useProfile();

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

  // Always let the fast flow render itself — it IS the first-time destination.
  if (location.pathname === '/onboarding/fast') return children;
  // Legacy setup page is still allowed for users who navigate to it directly
  // (e.g. editing an existing farm), but first-time farmers are kicked out
  // inside that page via its own short-circuit.
  if (location.pathname === '/profile/setup') return children;

  // If the profile is already complete, no routing work needed.
  if (isProfileComplete(profile || {})) return children;

  // Profile incomplete. Decide where to send them.
  const firstTime = isFirstTimeFarmer({ profile, farms });

  if (firstTime) {
    // ─── First-time path: go to the fast flow, NOT the legacy form. ─
    return <Navigate to="/onboarding/fast" replace />;
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
