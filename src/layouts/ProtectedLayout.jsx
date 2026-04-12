import { Outlet } from 'react-router-dom';
import AuthGuard from '../components/AuthGuard.jsx';
import ProfileGuard from '../components/ProfileGuard.jsx';
import FarmerUuidBadge from '../components/FarmerUuidBadge.jsx';
import LanguageSelector from '../components/LanguageSelector.jsx';
import AutoVoiceToggle from '../components/AutoVoiceToggle.jsx';
import OfflineStatusBadge from '../components/OfflineStatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedLayout() {
  const { logout, user, resendEmailVerification } = useAuth();

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
          <Outlet />
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
};
