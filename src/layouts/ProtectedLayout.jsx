import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import AuthGuard from '../components/AuthGuard.jsx';
import ProfileGuard from '../components/ProfileGuard.jsx';
import LanguageSelector from '../components/LanguageSelector.jsx';
import AutoVoiceToggle from '../components/AutoVoiceToggle.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Inner page loader — shown while lazy child routes load.
// This Suspense boundary is INSIDE AuthGuard+ProfileGuard so the guards
// stay mounted while page chunks load (prevents guard remount blink).
const InnerPageLoader = () => (
  <div style={S.innerLoader}>
    <div style={S.spinnerSmall} />
  </div>
);

export default function ProtectedLayout() {
  const { logout, user, resendEmailVerification, isOfflineSession } = useAuth();

  return (
    <AuthGuard>
      <ProfileGuard>
        <div style={S.page}>
          <div style={S.container}>
            <div style={S.header}>
              {/* Left: minimal user info */}
              <div style={S.headerLeft}>
                {isOfflineSession && <span style={S.offlineChip}>Offline</span>}
                {!isOfflineSession && <span style={S.onlineChip}>Online</span>}
                <LanguageSelector />
              </div>

              {/* Right: compact actions */}
              <div style={S.headerRight}>
                <AutoVoiceToggle />
                <button onClick={logout} style={S.logoutBtn}>
                  Logout
                </button>
              </div>
            </div>
            {/* Email verification banner — only when needed, non-intrusive */}
            {!user?.emailVerifiedAt && user?.email && (
              <div style={S.verifyBanner}>
                <span style={S.verifyText}>Verify your email: {user.email}</span>
                <button onClick={() => resendEmailVerification()} style={S.verifyBtn}>
                  Resend
                </button>
              </div>
            )}
          </div>
          {/* Inner Suspense: lazy child pages load here without unmounting the layout/guards */}
          <Suspense fallback={<InnerPageLoader />}>
            <Outlet />
          </Suspense>
        </div>
      </ProfileGuard>
    </AuthGuard>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: '#0F172A',
    color: '#FFFFFF',
  },
  container: {
    maxWidth: '72rem',
    margin: '0 auto',
    padding: '1rem 1.5rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  onlineChip: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    color: '#86EFAC',
    background: 'rgba(34,197,94,0.12)',
    padding: '0.2rem 0.5rem',
    borderRadius: '6px',
  },
  offlineChip: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    color: '#FDE68A',
    background: 'rgba(120,53,15,0.5)',
    padding: '0.2rem 0.5rem',
    borderRadius: '6px',
  },
  logoutBtn: {
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.12)',
    padding: '0.375rem 0.75rem',
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.6)',
    background: 'transparent',
    cursor: 'pointer',
    minHeight: '36px',
  },
  verifyBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    marginTop: '0.5rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '10px',
    background: 'rgba(250,204,21,0.08)',
    border: '1px solid rgba(250,204,21,0.2)',
  },
  verifyText: {
    fontSize: '0.75rem',
    color: '#FDE68A',
    fontWeight: 500,
  },
  verifyBtn: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#FDE68A',
    background: 'none',
    border: '1px solid rgba(250,204,21,0.3)',
    borderRadius: '6px',
    padding: '0.25rem 0.5rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  innerLoader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 0',
  },
  spinnerSmall: {
    width: '1.5rem',
    height: '1.5rem',
    border: '3px solid rgba(255,255,255,0.1)',
    borderTopColor: '#22C55E',
    borderRadius: '50%',
    animation: 'farroway-spin 0.8s linear infinite',
  },
};
