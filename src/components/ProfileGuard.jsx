import { Navigate, useLocation } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.jsx';
import { isProfileComplete } from '../lib/farmScore.js';

export default function ProfileGuard({ children }) {
  const location = useLocation();
  const { profile, loading, initialized } = useProfile();

  if (loading && !initialized) {
    return (
      <div style={S.loading}>
        <span style={S.loadingText}>Loading your farm profile...</span>
      </div>
    );
  }

  if (location.pathname === '/profile/setup') return children;

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
