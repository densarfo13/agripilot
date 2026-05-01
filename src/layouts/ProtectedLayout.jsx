import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import AuthGuard from '../components/AuthGuard.jsx';
import ProfileGuard from '../components/ProfileGuard.jsx';
import LanguageSelector from '../components/LanguageSelector.jsx';
import AutoVoiceToggle from '../components/AutoVoiceToggle.jsx';
import BottomTabNav from '../components/farmer/BottomTabNav.jsx';
// Region UX System (feature-flag gated). The host self-hides
// when `regionUxSystem` is off OR there's nothing to surface
// for the active country.
import RegionBannerHost from '../components/system/RegionBannerHost.jsx';
// Multi-experience selector (self-suppresses when the user has
// only one experience). Lets a single user flip between their
// garden and their farm without re-onboarding.
import ExperienceSwitcher from '../components/system/ExperienceSwitcher.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { useUserMode } from '../context/UserModeContext.jsx';

const InnerPageLoader = () => (
  <div style={S.innerLoader}>
    <div style={S.spinnerSmall} />
  </div>
);

export default function ProtectedLayout() {
  const { logout, user, resendEmailVerification, isOfflineSession } = useAuth();
  const { t } = useTranslation();
  const { mode, setMode, allowedModes, isFarmer } = useUserMode();

  return (
    <AuthGuard>
      <ProfileGuard>
        <div style={S.page}>
          {/* Region UX banner — top of every protected page when
              the feature flag is on AND the active country is
              outside the actively-supported set. Self-hides
              otherwise; one-line removal reverses the wiring. */}
          <RegionBannerHost />
          <div style={S.container}>
            <div style={S.header}>
              {/* Left: connectivity + language */}
              <div style={S.headerLeft}>
                <span style={isOfflineSession ? S.offlineChip : S.onlineChip}>
                  <span style={isOfflineSession ? S.offlineDot : S.onlineDot} />
                  {isOfflineSession ? t('farmer.offline') : t('farmer.online')}
                </span>
                <LanguageSelector />
              </div>

              {/* Right: experience switcher + mode + voice + logout */}
              <div style={S.headerRight}>
                {isFarmer && <ExperienceSwitcher />}
                {isFarmer && allowedModes.length > 1 && (
                  <button
                    onClick={() => setMode(mode === 'basic' ? 'standard' : 'basic')}
                    style={S.modeToggle}
                    type="button"
                  >
                    {mode === 'basic' ? t('mode.simple') : t('mode.standard')}
                  </button>
                )}
                <AutoVoiceToggle />
                <button onClick={logout} style={S.logoutBtn} type="button">
                  {t('common.logout')}
                </button>
              </div>
            </div>
          </div>
          <Suspense fallback={<InnerPageLoader />}>
            <Outlet />
          </Suspense>
          {isFarmer && <BottomTabNav />}
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
    paddingBottom: '70px',
  },
  container: {
    maxWidth: '42rem',
    margin: '0 auto',
    padding: '0.625rem 1rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    minHeight: '36px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  },
  onlineChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    fontSize: '0.625rem',
    fontWeight: 700,
    color: '#86EFAC',
    background: 'rgba(34,197,94,0.08)',
    padding: '0.2rem 0.5rem',
    borderRadius: '6px',
    letterSpacing: '0.02em',
  },
  offlineChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    fontSize: '0.625rem',
    fontWeight: 700,
    color: '#FDE68A',
    background: 'rgba(120,53,15,0.35)',
    padding: '0.2rem 0.5rem',
    borderRadius: '6px',
    letterSpacing: '0.02em',
  },
  onlineDot: {
    display: 'inline-block',
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    background: '#22C55E',
    flexShrink: 0,
  },
  offlineDot: {
    display: 'inline-block',
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    background: '#F59E0B',
    flexShrink: 0,
  },
  modeToggle: {
    fontSize: '0.625rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.5)',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px',
    padding: '0.25rem 0.5rem',
    cursor: 'pointer',
    minHeight: '26px',
    WebkitTapHighlightColor: 'transparent',
    transition: 'background 0.15s',
  },
  logoutBtn: {
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '0.25rem 0.5rem',
    fontSize: '0.625rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.4)',
    background: 'transparent',
    cursor: 'pointer',
    minHeight: '26px',
    WebkitTapHighlightColor: 'transparent',
    transition: 'color 0.15s',
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
    border: '3px solid rgba(255,255,255,0.08)',
    borderTopColor: '#22C55E',
    borderRadius: '50%',
    animation: 'farroway-spin 0.8s linear infinite',
  },
};
