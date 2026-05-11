import { Suspense, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AuthGuard from '../components/AuthGuard.jsx';
import ProfileGuard from '../components/ProfileGuard.jsx';
import LanguageSelector from '../components/LanguageSelector.jsx';
import AutoVoiceToggle from '../components/AutoVoiceToggle.jsx';
import BottomTabNav from '../components/farmer/BottomTabNav.jsx';
// Architecture audit §7 — buyer + NGO mobile bottom navs.
// Self-suppress during setup paths just like BottomTabNav.
import BuyerBottomNav from '../components/buyer/BuyerBottomNav.jsx';
import NgoBottomNav   from '../components/admin/NgoBottomNav.jsx';
// Region UX System (feature-flag gated). The host self-hides
// when `regionUxSystem` is off OR there's nothing to surface
// for the active country.
import RegionBannerHost from '../components/system/RegionBannerHost.jsx';
// Multi-experience selector (self-suppresses when the user has
// only one experience). Lets a single user flip between their
// garden and their farm without re-onboarding.
import ExperienceSwitcher from '../components/system/ExperienceSwitcher.jsx';
// Final feedback-loop spec §1, §8 — global host that listens
// for `farroway:request_feedback` events emitted from
// meaningful action paths and renders the lightweight prompt.
// Self-suppresses on first app open + during setup/onboarding.
import UserFeedbackPromptHost from '../components/feedback/UserFeedbackPromptHost.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { useUserMode } from '../context/UserModeContext.jsx';
// In-app notification bell — safe mode (no push/SMS/email).
// Self-hides when FEATURE_NOTIFICATIONS is off; never blocks render.
import NotificationBell from '../components/NotificationBell.jsx';
import { isFeatureEnabled as isSurfaceEnabled } from '../utils/featureFlags.js';
// Settings drawer — consolidates the chrome controls that used to
// crowd the header (language, mode toggle, voice toggle, logout).
// One menu button on the right opens the drawer; the visible header
// shrinks to: online chip · notification bell · menu.
import SettingsDrawer from '../components/system/SettingsDrawer.jsx';

const InnerPageLoader = () => (
  <div style={S.innerLoader}>
    <div style={S.spinnerSmall} />
  </div>
);

// Spec \u00a74 \u2014 onboarding paths where the chrome must hide
// distractions (logout, mode toggle, AutoVoice). Mirrors
// BottomTabNav.HIDE_NAV_PATHS so the same set of routes hides
// every chrome affordance. The language selector stays visible
// per spec ("Show only: language selector if needed").
const ONBOARDING_PREFIXES = [
  '/onboarding',
  '/setup/garden',
  '/setup/farm',
  '/start',          // covers /start, /start/farm, /start/garden
  '/farm/new',
  '/edit-farm',
  '/setup-farm',
  '/profile/setup',
  '/welcome-farmer',
];

function _isOnboardingPath(pathname) {
  if (!pathname) return false;
  for (const p of ONBOARDING_PREFIXES) {
    if (pathname === p || pathname.startsWith(p + '/')) return true;
  }
  return false;
}

export default function ProtectedLayout() {
  const { logout, user, resendEmailVerification, isOfflineSession } = useAuth();
  const { t } = useTranslation();
  const { mode, setMode, allowedModes, isFarmer } = useUserMode();
  const location = useLocation();
  const onboarding = _isOnboardingPath(location?.pathname || '');
  const [settingsOpen, setSettingsOpen] = useState(false);

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
              {/* Left: connectivity chip only. Language selector
                  moved into the settings drawer per UI tightening
                  spec section 5. */}
              <div style={S.headerLeft}>
                <span style={isOfflineSession ? S.offlineChip : S.onlineChip}>
                  <span style={isOfflineSession ? S.offlineDot : S.onlineDot} />
                  {isOfflineSession ? t('farmer.offline') : t('farmer.online')}
                </span>
              </div>

              {/* Right: notification bell + menu button. The menu
                  opens a slide-in drawer containing language,
                  experience switcher, mode toggle, voice toggle,
                  and logout \u2014 everything that used to crowd
                  the header sits one tap away.
                  Spec \u00a74: suppress mode toggle / AutoVoice / logout
                  during onboarding so the user has zero distractions
                  while completing setup. The language selector
                  (left side) stays visible per spec. */}
              <div style={S.headerRight} data-testid="layout-chrome-right">
                {!onboarding && isSurfaceEnabled('FEATURE_NOTIFICATIONS') && (() => {
                  try {
                    const bellUserId = String(user?.sub || user?.id || '');
                    return bellUserId
                      ? <NotificationBell userId={bellUserId} testId="header-notification-bell" />
                      : null;
                  } catch { return null; }
                })()}
                {!onboarding && (
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    style={S.menuBtn}
                    aria-label={t('settings.title')}
                    data-testid="layout-settings-menu"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Settings drawer — holds the chrome controls that used
              to crowd the header. Self-hides during onboarding so
              the user has zero distractions while completing setup. */}
          {!onboarding && (
            <SettingsDrawer
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              title={t('settings.title')}
              testId="layout-settings-drawer"
            >
              {isFarmer && (
                <div style={S.drawerSection}>
                  <ExperienceSwitcher />
                </div>
              )}
              <div style={S.drawerSection}>
                <LanguageSelector />
              </div>
              {isFarmer && allowedModes.length > 1 && (
                <div style={S.drawerSection}>
                  <button
                    onClick={() => setMode(mode === 'basic' ? 'standard' : 'basic')}
                    style={S.drawerModeToggle}
                    type="button"
                    data-testid="drawer-mode-toggle"
                  >
                    {mode === 'basic' ? t('mode.simple') : t('mode.standard')}
                  </button>
                </div>
              )}
              <div style={S.drawerSection}>
                <AutoVoiceToggle />
              </div>
              <div style={{ ...S.drawerSection, marginTop: 'auto' }}>
                <button
                  onClick={() => { setSettingsOpen(false); try { logout(); } catch { /* swallow */ } }}
                  style={S.drawerLogout}
                  type="button"
                  data-testid="drawer-logout"
                >
                  {t('common.logout')}
                </button>
              </div>
            </SettingsDrawer>
          )}
          <Suspense fallback={<InnerPageLoader />}>
            <Outlet />
          </Suspense>
          {/* Architecture audit §7: bottom nav per role.
              Farmer roles render the existing FARM/BACKYARD
              tabs (BottomTabNav handles experience switching
              internally). Buyer renders BuyerBottomNav.
              NGO/staff roles render NgoBottomNav. Platform
              admins use the V1 desktop sidebar (Layout.jsx)
              and don't show a bottom nav on their V2 surfaces.
              Each component self-suppresses on setup paths. */}
          {(() => {
            const role = String(user?.role || '').toLowerCase();
            if (isFarmer || role === 'farmer') return <BottomTabNav />;
            if (role === 'buyer') return <BuyerBottomNav />;
            if (
              role === 'reviewer'           ||
              role === 'field_officer'      ||
              role === 'institutional_admin'||
              role === 'agent'              ||
              role === 'ngo_admin'          ||
              role === 'program_admin'
            ) return <NgoBottomNav />;
            return null;
          })()}
          {/* Feedback prompt host — listens globally; never
              renders unless a meaningful action emits the
              farroway:request_feedback event AND the session
              flag isn't already set AND we're not on a setup
              path. */}
          <UserFeedbackPromptHost />
        </div>
      </ProfileGuard>
    </AuthGuard>
  );
}

// Soft Ochre / Beige design system (May 2026 platform refactor).
// Topbar/page chrome flips from dark navy to warm beige body wash;
// the header itself sits on transparent so the beige background
// shows through. Online/offline pills tuned to read on the new
// surface — growth-green for "online" (success signal) and warm
// amber for "offline" (warning signal).
const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #F6F1E7 0%, #EFE7D5 100%)',
    color: '#1F2933',
    // Bottom padding accounts for the fixed bottom nav (62px) +
    // iPhone safe-area inset so content doesn't tuck under the
    // nav on devices with a home indicator. Spec §1 (compact
    // mobile layout): keep important action above the fold and
    // honour safe-area-inset-bottom.
    paddingBottom: 'calc(70px + env(safe-area-inset-bottom, 0px))',
    paddingTop: 'env(safe-area-inset-top, 0px)',
  },
  container: {
    maxWidth: '42rem',
    margin: '0 auto',
    // Tighter top padding so the hero card lifts toward the top
    // of the viewport on mobile (spec §1: reduce top padding).
    padding: '0.4rem 0.85rem 0',
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
    color: '#3F6A3F',
    background: 'rgba(94,142,94,0.12)',
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
    color: '#8A5C12',
    background: 'rgba(224,162,56,0.16)',
    padding: '0.2rem 0.5rem',
    borderRadius: '6px',
    letterSpacing: '0.02em',
  },
  onlineDot: {
    display: 'inline-block',
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    background: '#5E8E5E',
    flexShrink: 0,
  },
  offlineDot: {
    display: 'inline-block',
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    background: '#E0A238',
    flexShrink: 0,
  },
  modeToggle: {
    fontSize: '0.625rem',
    fontWeight: 600,
    color: '#667085',
    background: '#FFF9F0',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: '6px',
    padding: '0.25rem 0.5rem',
    cursor: 'pointer',
    minHeight: '26px',
    WebkitTapHighlightColor: 'transparent',
    transition: 'background 0.15s',
  },
  logoutBtn: {
    borderRadius: '6px',
    border: '1px solid rgba(31,41,51,0.08)',
    padding: '0.25rem 0.5rem',
    fontSize: '0.625rem',
    fontWeight: 600,
    color: '#667085',
    background: 'transparent',
    cursor: 'pointer',
    minHeight: '26px',
    WebkitTapHighlightColor: 'transparent',
    transition: 'color 0.15s',
  },
  // Single menu button that opens the settings drawer. Replaces
  // the language/mode/voice/logout cluster that used to live on
  // the right side of the header.
  menuBtn: {
    width: 34,
    height: 34,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(31,41,51,0.05)',
    border: '1px solid rgba(31,41,51,0.08)',
    borderRadius: 10,
    color: '#1F2933',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    padding: 0,
  },
  // Drawer body sections — vertical stack with consistent gap.
  drawerSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  drawerModeToggle: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#1F2933',
    background: '#FFF9F0',
    border: '1px solid rgba(31,41,51,0.12)',
    borderRadius: 10,
    padding: '0.65rem 0.85rem',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    minHeight: 42,
  },
  drawerLogout: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: '#C65A4B',
    background: 'rgba(198,90,75,0.08)',
    border: '1px solid rgba(198,90,75,0.25)',
    borderRadius: 10,
    padding: '0.7rem 0.9rem',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    minHeight: 44,
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
    border: '3px solid rgba(31,41,51,0.10)',
    borderTopColor: '#D4A35F',
    borderRadius: '50%',
    animation: 'farroway-spin 0.8s linear infinite',
  },
};
