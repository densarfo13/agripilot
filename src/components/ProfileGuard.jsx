import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useFarmStore } from '../store/farmStore.js';
import { isProfileComplete } from '../utils/farmScore.js';

/**
 * Profile guard — redirects farmer-role users with incomplete profiles
 * to /profile/setup. Allows /profile/setup itself to render normally.
 */
export default function ProfileGuard({ children }) {
  const location = useLocation();
  const { fetchProfiles, currentProfile } = useFarmStore();
  const [loading, setLoading] = useState(true);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const profiles = await fetchProfiles();
        if (!active) return;
        const profile = profiles?.[0] || currentProfile;
        setComplete(isProfileComplete(profile || {}));
      } catch {
        // On error, allow /profile/setup, redirect others
        if (active) setComplete(location.pathname === '/profile/setup');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={S.loading}>
        <span style={S.loadingText}>Loading your farm profile...</span>
      </div>
    );
  }

  if (!complete && location.pathname !== '/profile/setup') {
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
