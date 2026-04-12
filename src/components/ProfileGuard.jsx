import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.jsx';
import { isProfileComplete } from '../utils/farmScore.js';

/**
 * Profile guard — redirects farmer-role users with incomplete profiles
 * to /profile/setup. Uses shared ProfileContext (no duplicate fetch).
 * Allows /profile/setup itself to render normally.
 */
export default function ProfileGuard({ children }) {
  const location = useLocation();
  const { profile, loading, initialized } = useProfile();

  // Still loading for the first time — show spinner
  if (loading && !initialized) {
    return (
      <div style={S.loading}>
        <span style={S.loadingText}>Loading your farm profile...</span>
      </div>
    );
  }

  // /profile/setup is always allowed
  if (location.pathname === '/profile/setup') {
    return children;
  }

  // Incomplete profile — redirect to setup
  if (!isProfileComplete(profile || {})) {
    return <Navigate to="/profile/setup" replace />;
  }

  return children;
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
  loadingText: {
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.6)',
  },
};
