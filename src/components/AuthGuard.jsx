import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Inject spinner keyframe once
let keyframeInjected = false;
function injectSpinnerKeyframe() {
  if (keyframeInjected) return;
  keyframeInjected = true;
  const style = document.createElement('style');
  style.textContent = '@keyframes farroway-spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(style);
}

export default function AuthGuard({ children }) {
  useEffect(() => { injectSpinnerKeyframe(); }, []);
  const location = useLocation();
  const { isAuthenticated, authLoading, isOfflineSession } = useAuth();

  if (authLoading) {
    return (
      <div style={S.loading}>
        <div style={S.loadingInner}>
          {/* Branded spinner dot */}
          <div style={S.spinner} />
          <span style={S.brand}>Farroway</span>
          <span style={S.loadingText}>Loading your farm...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <>
      {isOfflineSession && (
        <div style={S.offlineBanner}>
          Offline — showing cached data. Changes will sync when you reconnect.
        </div>
      )}
      {children}
    </>
  );
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
  offlineBanner: {
    background: '#78350F',
    color: '#FDE68A',
    textAlign: 'center',
    padding: '0.5rem 1rem',
    fontSize: '0.813rem',
    fontWeight: 500,
  },
};
