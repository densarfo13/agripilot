/**
 * BuyerBottomNav — bottom navigation for buyer-role users.
 *
 * Mirrors the farmer BottomTabNav pattern but with the
 * buyer-flow tabs from the architecture spec §7:
 *   Buy / Saved / Interests / Contact / Profile
 *
 * Mounted in `ProtectedLayout` based on the active user's role
 * (buyer → BuyerBottomNav, farmer → BottomTabNav, NGO/staff →
 * NgoBottomNav). Self-suppresses during onboarding paths so
 * the setup flow stays full-screen.
 *
 * Strict-rule audit
 *   * All visible text via tStrict.
 *   * Inline styles only.
 *   * safe-area-inset-bottom on the wrapper so iOS home
 *     indicator never overlaps tap targets.
 *   * Never throws — useLocation / useNavigate calls are
 *     plain hooks; t() is wrapped via tStrict.
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';

const BUYER_TABS = [
  { key: 'buy',       path: '/marketplace',         icon: '\uD83D\uDED2', labelKey: 'buyer.nav.buy',       fallback: 'Buy' },
  { key: 'saved',     path: '/buyer/interests',     icon: '\u2665',       labelKey: 'buyer.nav.saved',     fallback: 'Saved' },
  { key: 'interests', path: '/buyer/notifications', icon: '\uD83D\uDD14', labelKey: 'buyer.nav.interests', fallback: 'Interests' },
  { key: 'contact',   path: '/contact',             icon: '\u2709',       labelKey: 'buyer.nav.contact',   fallback: 'Contact' },
  { key: 'profile',   path: '/settings',            icon: '\uD83D\uDC64', labelKey: 'buyer.nav.profile',   fallback: 'Profile' },
];

// Setup paths where the bottom nav must NOT render — same
// blocklist BottomTabNav uses so the experience is consistent.
const HIDE_NAV_PATHS = [
  '/start', '/welcome', '/landing',
  '/farmer-welcome', '/verify-otp',
  '/login', '/register', '/forgot-password', '/reset-password', '/verify-email',
  '/onboarding', '/farm/new', '/profile/setup',
  '/beginner-reassurance',
];

function _isSetupPath(pathname) {
  if (!pathname) return false;
  for (const p of HIDE_NAV_PATHS) {
    if (pathname === p || pathname.startsWith(`${p}/`)) return true;
  }
  return false;
}

const C = {
  bg: '#0B1D34',
  border: 'rgba(255,255,255,0.08)',
  ink: 'rgba(255,255,255,0.65)',
  inkActive: '#22C55E',
};

const S = {
  nav: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    background: C.bg,
    borderTop: `1px solid ${C.border}`,
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    zIndex: 30,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'stretch',
    height: 56,
  },
  tab: {
    flex: 1,
    appearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    color: C.ink,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.04em',
    minHeight: 44,
  },
  tabActive: { color: C.inkActive },
  icon: { fontSize: 18, lineHeight: 1 },
};

export default function BuyerBottomNav() {
  useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  if (_isSetupPath(location?.pathname || '')) return null;

  return (
    <nav
      style={S.nav}
      role="navigation"
      aria-label="Buyer navigation"
      data-testid="buyer-bottom-nav"
    >
      <div style={S.row}>
        {BUYER_TABS.map((tab) => {
          const active = location.pathname === tab.path
            || location.pathname.startsWith(`${tab.path}/`);
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => { try { navigate(tab.path); } catch { /* swallow */ } }}
              style={active ? { ...S.tab, ...S.tabActive } : S.tab}
              data-testid={`buyer-tab-${tab.key}`}
              aria-current={active ? 'page' : undefined}
            >
              <span style={S.icon} aria-hidden="true">{tab.icon}</span>
              <span>{tStrict(tab.labelKey, tab.fallback)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
