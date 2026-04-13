import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import AuthGuard from '../components/AuthGuard.jsx';
import ProfileGuard from '../components/ProfileGuard.jsx';
import FarmerUuidBadge from '../components/FarmerUuidBadge.jsx';
import LanguageSelector from '../components/LanguageSelector.jsx';
import AutoVoiceToggle from '../components/AutoVoiceToggle.jsx';
import OfflineStatusBadge from '../components/OfflineStatusBadge.jsx';
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
              <div>
                <div style={S.signedInLabel}>Signed in</div>
                <div style={S.email}>{user?.email || '-'}</div>
                {!user?.emailVerifiedAt && (
                  <button
                    onClick={() => resendEmailVerification()}
                    style={S.resendBtn}
                  >
                    Resend verification email
                  </button>
                )}
              </div>

              <div style={S.headerRight}>
                {isOfflineSession && <span style={S.offlineTag}>Offline</span>}
                <OfflineStatusBadge />
                <LanguageSelector />
                <AutoVoiceToggle />
                <FarmerUuidBadge />
                <button onClick={logout} style={S.logoutBtn}>
                  Logout
                </button>
              </div>
            </div>
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  signedInLabel: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.6)',
  },
  email: {
    fontSize: '0.875rem',
    fontWeight: 600,
  },
  resendBtn: {
    marginTop: '0.5rem',
    fontSize: '0.75rem',
    color: '#FDE68A',
    textDecoration: 'underline',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  offlineTag: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#FDE68A',
    background: 'rgba(120,53,15,0.5)',
    padding: '0.25rem 0.5rem',
    borderRadius: '6px',
  },
  logoutBtn: {
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.15)',
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#FFFFFF',
    background: 'transparent',
    cursor: 'pointer',
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
