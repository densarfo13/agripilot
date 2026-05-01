/**
 * NgoBottomNav — bottom navigation for NGO / Program-admin
 * users on mobile.
 *
 * Mirrors the architecture spec §7 NGO/Admin nav:
 *   Dashboard / Farmers / Programs / Reports / Funding Leads / Settings
 *
 * The desktop V1 sidebar (`src/components/Layout.jsx`) is the
 * primary admin surface. This component fills the mobile gap so
 * a phone-using NGO operator gets one-tap access to the same
 * sections without scrolling a sidebar that's hidden on small
 * screens.
 *
 * Mounted in `ProtectedLayout` based on the active user's role.
 * Self-suppresses during onboarding / setup paths.
 *
 * Strict-rule audit
 *   * All visible text via tStrict.
 *   * Inline styles only; safe-area-inset-bottom respected.
 *   * Never throws.
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';

const NGO_TABS = [
  { key: 'dashboard',  path: '/ngo',                  icon: '\uD83D\uDCCA', labelKey: 'ngo.nav.dashboard',    fallback: 'Dashboard' },
  { key: 'farmers',    path: '/farmers',              icon: '\uD83D\uDC68\u200D\uD83C\uDF3E', labelKey: 'ngo.nav.farmers', fallback: 'Farmers' },
  { key: 'programs',   path: '/admin/ngo-program',    icon: '\uD83D\uDCDA', labelKey: 'ngo.nav.programs',     fallback: 'Programs' },
  { key: 'reports',    path: '/ngo/impact',           icon: '\uD83D\uDCC8', labelKey: 'ngo.nav.reports',      fallback: 'Reports' },
  { key: 'funding',    path: '/admin/funding',        icon: '\uD83D\uDCB0', labelKey: 'ngo.nav.fundingLeads', fallback: 'Funding Leads' },
  { key: 'settings',   path: '/settings',             icon: '\u2699',       labelKey: 'ngo.nav.settings',     fallback: 'Settings' },
];

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
    overflowX: 'auto',
  },
  tab: {
    flex: '0 0 auto',
    minWidth: 64,
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
    padding: '0 8px',
    minHeight: 44,
  },
  tabActive: { color: C.inkActive },
  icon: { fontSize: 18, lineHeight: 1 },
};

export default function NgoBottomNav() {
  useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  if (_isSetupPath(location?.pathname || '')) return null;

  return (
    <nav
      style={S.nav}
      role="navigation"
      aria-label="NGO navigation"
      data-testid="ngo-bottom-nav"
    >
      <div style={S.row}>
        {NGO_TABS.map((tab) => {
          const active = location.pathname === tab.path
            || location.pathname.startsWith(`${tab.path}/`);
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => { try { navigate(tab.path); } catch { /* swallow */ } }}
              style={active ? { ...S.tab, ...S.tabActive } : S.tab}
              data-testid={`ngo-tab-${tab.key}`}
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
