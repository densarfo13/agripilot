import { Suspense, useMemo, useState } from 'react';
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
// Voice Assistant V2 placement fix — ONE global floating "Ask
// Farroway" launcher for farmers. The launcher, the assistant
// bottom sheet, the context response engine, and the TTS fallback
// already exist (VoiceLauncher → VoiceAssistant → voiceAssistant
// ResponseEngine); the gap was a consistent placement. Mounting it
// here means it appears on every farmer surface (Home, Tasks, Scan,
// Weather) and is automatically absent on auth/login screens
// because those never mount ProtectedLayout. It self-hides when the
// voice feature flags are off, and we gate it off onboarding.
import VoiceLauncher from '../components/voice/VoiceLauncher.jsx';
// Conversational Farm Copilot (Beta) — flag-gated floating launcher.
// FarmCopilotLauncher returns null unless FEATURE_FARM_COPILOT_BETA
// is enabled, so with the flag off (the default) this mount is a
// pure no-op and the app is unchanged.
import FarmCopilotLauncher from '../components/copilot/FarmCopilotLauncher.jsx';

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

// Time-of-day band — drives the ambient overlay glow on the page
// backdrop. Apple-Weather aesthetic: the sky tone shifts subtly
// across the day so the app feels alive at different hours.
//
//   0–5  → deep night    (cool navy, no glow)
//   5–8  → dawn          (warm amber-rose horizon)
//   8–16 → daylight      (cool sky, neutral)
//   16–19 → dusk         (warm orange-amber)
//   19–24 → night        (cool navy + faint star pinpoints)
//
// We only call new Date() once per mount; the band is stable for
// the session so the layout doesn't re-render on every minute
// tick. Operators who want true live transitions can subscribe
// to a hour-watcher hook in a follow-up.
function _timeOfDayBand() {
  try {
    const h = new Date().getHours();
    if (h < 5)        return 'night';
    if (h < 8)        return 'dawn';
    if (h < 16)       return 'day';
    if (h < 19)       return 'dusk';
    return 'night';
  } catch { return 'day'; }
}

const TIME_OF_DAY_OVERLAYS = Object.freeze({
  // Each overlay is a SECOND background-image layer that paints
  // on top of the navy base + the radial sky/earth glows defined
  // in S.page. None of them obscure content — they only modulate
  // the ambient atmosphere.
  night: 'radial-gradient(ellipse 70% 30% at 50% -5%, rgba(28,38,58,0.50) 0%, rgba(8,17,26,0) 70%)',
  dawn:  'radial-gradient(ellipse 90% 45% at 50% 0%, rgba(228,148,108,0.22) 0%, rgba(8,17,26,0) 65%)',
  day:   'radial-gradient(ellipse 90% 35% at 50% 0%, rgba(120,160,196,0.18) 0%, rgba(8,17,26,0) 70%)',
  dusk:  'radial-gradient(ellipse 90% 45% at 50% 100%, rgba(220,140,80,0.22) 0%, rgba(8,17,26,0) 60%)',
});

// Module-level guard so the spec proof logs fire once per
// page load, not on every layout re-render.
let _appShellLogFired = false;

export default function ProtectedLayout() {
  const { logout, user, resendEmailVerification, isOfflineSession } = useAuth();
  const { t } = useTranslation();
  const { mode, setMode, allowedModes, isFarmer } = useUserMode();
  const location = useLocation();
  const onboarding = _isOnboardingPath(location?.pathname || '');

  // Home Bottom Nav Visibility Fix §8 — dev-only proof that
  // /home renders INSIDE this AppShell (the layout that owns
  // the BottomTabNav). Fires once per page load.
  if (typeof import.meta !== 'undefined'
      && import.meta.env
      && import.meta.env.DEV
      && !_appShellLogFired) {
    _appShellLogFired = true;
    try {
      const path = (location && location.pathname) || '';
      const role = String((user && user.role) || '').toLowerCase();
      const navKind = (isFarmer || role === 'farmer') ? 'farmer'
                    : (role === 'buyer') ? 'buyer'
                    : 'role-aware';
       
      console.log('[APP_SHELL_ACTIVE]', path);
       
      console.log('[BOTTOM_NAV_RENDERED]', navKind);
       
      console.log('[BOTTOM_NAV_HOME_TARGET]', '/home');
       
      console.log('[HOME_PAGE_RENDERED_INSIDE_SHELL]', path === '/home' || path === '/');
    } catch { /* swallow */ }
  }
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Cache once per mount — the band only changes a few times per
  // day and we never want the page to re-paint mid-tap. Operators
  // can flip the band manually via DevTools by setting
  //   document.body.dataset.timeOfDay = 'dusk'
  // which the CSS picks up regardless of the inline style.
  const tod = useMemo(_timeOfDayBand, []);
  const todOverlay = TIME_OF_DAY_OVERLAYS[tod] || TIME_OF_DAY_OVERLAYS.day;

  return (
    <AuthGuard>
      <ProfileGuard>
        <div
          style={{
            ...S.page,
            // Compose the time-of-day overlay over the base
            // background stack. The overlay is a single radial
            // glow that shifts warm/cool depending on the hour
            // — Apple Weather aesthetic.
            backgroundImage: `${todOverlay}, ${S.page.backgroundImage}`,
          }}
          data-time-of-day={tod}
        >
          {/* Region UX banner — top of every protected page when
              the feature flag is on AND the active country is
              outside the actively-supported set. Self-hides
              otherwise; one-line removal reverses the wiring. */}
          <RegionBannerHost />
          <div style={S.container}>
            {/* HEADER DUPLICATION FIX —
                  • Online badge removed app-wide (spec: "Remove ALL Online
                    badges from every page"). The offline-state chip remains
                    as a warning when the user is offline; when online,
                    nothing is rendered.
                  • Bell + Menu hide on /home and / (Home owns its hero
                    actions there). All other routes still see the
                    standard chrome bell + menu. */}
            {(() => {
              const path = (location && location.pathname) || '';
              const isHome = path === '/' || path === '/home';
              return (
            <div style={S.header} data-route-home={isHome ? 'true' : 'false'}>
              {/* Left: offline-state chip only. The online chip was removed
                  per the header duplication fix — connectivity is surfaced
                  only when offline, never as a passive green badge. */}
              <div style={S.headerLeft}>
                {isOfflineSession ? (
                  <span style={S.offlineChip}>
                    <span style={S.offlineDot} />
                    {t('farmer.offline')}
                  </span>
                ) : null}
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
              {/* Bell + Menu — hidden on /home (Home owns its hero
                  actions). All other routes still get the chrome
                  bell + menu. data-route-home attribute marks the
                  state for the header-duplication gate. */}
              <div style={S.headerRight} data-testid="layout-chrome-right" data-hidden-on-home={isHome ? 'true' : 'false'}>
                {!isHome && !onboarding && isSurfaceEnabled('FEATURE_NOTIFICATIONS') && (() => {
                  try {
                    const bellUserId = String(user?.sub || user?.id || '');
                    return bellUserId
                      ? <NotificationBell userId={bellUserId} testId="header-notification-bell" />
                      : null;
                  } catch { return null; }
                })()}
                {!isHome && !onboarding && (
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
              );
            })()}
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
          {/* Voice Assistant V2 — global floating "Ask Farroway"
              launcher. Farmer surfaces only (the response engine is
              farm-context based; buyer/NGO get nothing useful from
              it). Hidden during onboarding so setup stays
              distraction-free. The FAB is bottom-right, above the
              BottomTabNav, safe-area aware (VoiceLauncher FLOATING
              styles). Tapping opens the existing assistant sheet —
              no separate chatbot page, no always-listening, no
              autoplay. */}
          {!onboarding
            && (isFarmer || String(user?.role || '').toLowerCase() === 'farmer') && (
            <VoiceLauncher variant="floating" />
          )}
          {/* Conversational Farm Copilot (Beta). Self-gates on
              FEATURE_FARM_COPILOT_BETA — renders nothing when the
              flag is off, so this is a no-op for every farmer until
              the Beta is deliberately enabled. Farmer surfaces only,
              hidden during onboarding. The FAB stacks above the
              voice launcher so the two never overlap. */}
          {!onboarding
            && (isFarmer || String(user?.role || '').toLowerCase() === 'farmer') && (
            <FarmCopilotLauncher />
          )}
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
  // May 2026 v3 — immersive companion shell. Apple Weather /
  // Oura aesthetic: deep navy base + layered atmospheric glows
  // (cool sky at top, warm earth at bottom) so the page reads as
  // an actual sky-to-ground atmosphere, not a flat dark surface.
  page: {
    minHeight: '100vh',
    color: '#EAF2FF',
    backgroundColor: '#08111A',
    backgroundImage: [
      // Cool sky glow at the top
      'radial-gradient(ellipse 90% 50% at 50% -10%, rgba(60,86,116,0.45) 0%, rgba(8,17,26,0) 70%)',
      // Warm earth glow at the bottom (subtle ochre wash)
      'radial-gradient(ellipse 90% 40% at 50% 110%, rgba(200,148,77,0.16) 0%, rgba(8,17,26,0) 65%)',
      // Base atmospheric gradient: deep navy → twilight → earth
      'linear-gradient(180deg, #08111A 0%, #0B1A28 35%, #0E1F2C 75%, #1A2026 100%)',
    ].join(', '),
    // Bottom padding accounts for the fixed bottom nav (62px) +
    // iPhone safe-area inset so content doesn't tuck under the
    // nav on devices with a home indicator.
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
    color: '#A8C283',
    background: 'rgba(143,171,115,0.16)',
    border: '1px solid rgba(143,171,115,0.32)',
    padding: '0.2rem 0.5rem',
    borderRadius: '999px',
    letterSpacing: '0.02em',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
  },
  offlineChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    fontSize: '0.625rem',
    fontWeight: 700,
    color: '#F0CB7A',
    background: 'rgba(214,161,61,0.20)',
    border: '1px solid rgba(214,161,61,0.40)',
    padding: '0.2rem 0.5rem',
    borderRadius: '999px',
    letterSpacing: '0.02em',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
  },
  onlineDot: {
    display: 'inline-block',
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    background: '#8FAB73',
    flexShrink: 0,
  },
  offlineDot: {
    display: 'inline-block',
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    background: '#D6A13D',
    flexShrink: 0,
  },
  modeToggle: {
    fontSize: '0.625rem',
    fontWeight: 600,
    color: 'rgba(234,242,255,0.78)',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '6px',
    padding: '0.25rem 0.5rem',
    cursor: 'pointer',
    minHeight: '26px',
    WebkitTapHighlightColor: 'transparent',
    transition: 'background 0.15s',
  },
  logoutBtn: {
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.10)',
    padding: '0.25rem 0.5rem',
    fontSize: '0.625rem',
    fontWeight: 600,
    color: 'rgba(234,242,255,0.78)',
    background: 'transparent',
    cursor: 'pointer',
    minHeight: '26px',
    WebkitTapHighlightColor: 'transparent',
    transition: 'color 0.15s',
  },
  // Single glass menu button that opens the settings drawer.
  menuBtn: {
    width: 34,
    height: 34,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    color: '#EAF2FF',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    padding: 0,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
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
    color: '#EAF2FF',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: 10,
    padding: '0.65rem 0.85rem',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    minHeight: 42,
  },
  drawerLogout: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: '#F1A89E',
    background: 'rgba(198,90,75,0.16)',
    border: '1px solid rgba(198,90,75,0.42)',
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
