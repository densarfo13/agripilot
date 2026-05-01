/**
 * BottomTabNav — persistent bottom navigation for farmer-facing screens.
 *
 * 5 tabs: Home, My Farm, Tasks, Progress, Sell.
 * Icons always visible, label under icon, active tab
 * highlighted with green indicator. Large tap targets,
 * mobile-first, premium dark styling.
 *
 * Sell is intentionally LAST in the row so the primary
 * action surface (Home → My Farm → Tasks → Progress) keeps
 * its existing position. Farmers who never list produce
 * never see anything change about their daily flow; for
 * those who do, the entry is one tap from anywhere.
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { useStrictTranslation as useTranslation } from '../../i18n/useStrictTranslation.js';
import { tSafe } from '../../i18n/tSafe.js';
import { NAV_ICONS } from '../../lib/farmerIcons.js';
import { useProfile } from '../../context/ProfileContext.jsx';
import {
  getRegionConfig, shouldUseBackyardExperience,
} from '../../config/regionConfig.js';
import { getBackyardLabel } from '../../experience/backyardExperience.js';
// Region UX System (feature-flag gated). When on, the helper
// becomes the single source of truth for tab items so future
// region changes only need to touch `getNavigationItems`.
import { isFeatureEnabled } from '../../config/features.js';
import { resolveRegionUX } from '../../core/regionUXEngine.js';
import { getNavigationItems } from '../../navigation/getNavigationItems.js';

// Farm-experience tabs (Ghana / Nigeria / Kenya / India / etc).
const FARM_TABS = [
  { key: 'home',          path: '/dashboard',     icon: NAV_ICONS.home,          labelKey: 'nav.home',          fallback: 'Home' },
  { key: 'farm',          path: '/my-farm',       icon: NAV_ICONS.farm,          labelKey: 'nav.myFarm',        fallback: 'Farm' },
  { key: 'tasks',         path: '/tasks',         icon: NAV_ICONS.tasks,         labelKey: 'nav.tasks',         fallback: 'Tasks' },
  { key: 'progress',      path: '/progress',      icon: NAV_ICONS.progress,      labelKey: 'nav.progress',      fallback: 'Progress' },
  { key: 'opportunities', path: '/opportunities', icon: NAV_ICONS.opportunities, labelKey: 'nav.opportunities', fallback: 'Funding' },
  { key: 'sell',          path: '/sell',          icon: NAV_ICONS.sell,          labelKey: 'nav.sell',          fallback: 'Sell' },
];

// Backyard-experience tabs (U.S. backyard / home garden) —
// spec §10. "My Garden" replaces "Farm"; Sell is removed
// because backyard users don't list produce; Ask + Scan
// surface as nav entries instead.
const BACKYARD_TABS = [
  { key: 'home',     path: '/dashboard', icon: NAV_ICONS.home,     labelKey: 'nav.home',     fallback: 'Home' },
  { key: 'farm',     path: '/my-farm',   icon: NAV_ICONS.farm,     labelKey: 'nav.myGarden', fallback: 'My Garden' },
  { key: 'tasks',    path: '/tasks',     icon: NAV_ICONS.tasks,    labelKey: 'nav.tasks',    fallback: 'Tasks' },
  { key: 'progress', path: '/progress',  icon: NAV_ICONS.progress, labelKey: 'nav.progress', fallback: 'Progress' },
  { key: 'ask',      path: '/help',      icon: NAV_ICONS.help || '\u2754', labelKey: 'nav.ask',  fallback: 'Ask' },
  { key: 'scan',     path: '/dashboard?scan=1', icon: NAV_ICONS.scan || '\uD83D\uDCF7', labelKey: 'nav.scan', fallback: 'Scan' },
];

// Setup / onboarding paths where the bottom nav must self-hide
// (Adaptive setup spec §5 — users should not leave setup midway
// and create broken state). Match prefix so child routes inherit.
const HIDE_NAV_PATHS = [
  '/onboarding',           // covers /onboarding, /onboarding/v3, /backyard, /us-experience, etc.
  '/farm/new',
  '/edit-farm',
  '/setup-farm',
  '/profile/setup',
  '/welcome-farmer',
];

function _isSetupPath(pathname) {
  if (!pathname) return false;
  for (const prefix of HIDE_NAV_PATHS) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return true;
  }
  return false;
}

export default function BottomTabNav() {
  const location = useLocation();
  const navigate = useNavigate();
  // Subscribe to farroway:langchange so the labels refresh on flip.
  // We don't use the bound `t` here — the cleanup spec mandates
  // tSafe for every nav label so a missing key shows the visible
  // tab key fallback rather than humanised English.
  useTranslation();

  // Self-hide during setup / onboarding flows so users don't
  // accidentally navigate away mid-setup and leave a partial
  // farm/garden record behind.
  if (_isSetupPath(location?.pathname || '')) return null;

  // Region-aware tab list (spec §10). Reads through the
  // existing ProfileContext so we never need an extra fetch.
  // Falls back to the farm tab list whenever profile / region
  // is unknown — pilots running today are unaffected.
  let profile = null;
  try { profile = useProfile()?.profile || null; }
  catch { /* outside ProfileContext (e.g. login page) */ }
  const country = profile?.country || profile?.countryCode || null;
  const farmType = profile?.farmType || null;
  const isBackyard = shouldUseBackyardExperience(country, farmType);

  // Region UX System path (feature-flag gated). When on, derive
  // tabs through `getNavigationItems(experience)` — this routes
  // generic-experience users through a 4-tab subset (Sell hidden
  // until we know the region opens a marketplace flow). Existing
  // pilots with the flag OFF keep the inline FARM_TABS /
  // BACKYARD_TABS path verbatim.
  let TABS;
  if (isFeatureEnabled('regionUxSystem')) {
    const ux = resolveRegionUX({
      detectedCountry: country,
      detectedRegion:  profile?.region || null,
      farmType,
    });
    const items = getNavigationItems(ux.experience);
    // Adapt nav-item shape to the BottomTabNav row shape so the
    // existing render loop is unchanged.
    TABS = items.map((it) => ({
      key:      it.testid?.replace(/^tab-/, '') || it.path,
      path:     it.path,
      icon:     it.icon,
      labelKey: it.key,
      fallback: it.fallback,
    }));
  } else {
    TABS = isBackyard ? BACKYARD_TABS : FARM_TABS;
  }

  const currentPath = location.pathname;

  return (
    <nav style={S.nav} data-testid="bottom-tab-nav">
      {TABS.map((tab) => {
        const isActive = currentPath === tab.path;
        // tSafe: missing key → readable English fallback (the
        // pre-v3 form used `tab.key` which surfaced literal
        // "sell" / "tasks" strings — fine when keys exist for
        // every locale, ugly when one is missing). The
        // explicit `fallback` field keeps the surface readable
        // in either case.
        const label = tSafe(tab.labelKey, tab.fallback || tab.key);
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => navigate(tab.path)}
            style={S.tab}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
            data-testid={`tab-${tab.key}`}
          >
            {/* Active indicator bar */}
            {isActive && <span style={S.activeBar} />}
            <span style={{
              ...S.icon,
              ...(isActive ? S.iconActive : {}),
            }}>
              {tab.icon}
            </span>
            <span style={{
              ...S.label,
              ...(isActive ? S.labelActive : {}),
            }}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

const S = {
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'space-around',
    background: 'rgba(8,20,35,0.92)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderTop: '1px solid rgba(255,255,255,0.04)',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    zIndex: 100,
    minHeight: '62px',
  },
  tab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.2rem',
    padding: '0.5rem 0 0.375rem',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    minHeight: '58px',
    position: 'relative',
  },
  activeBar: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: '2.5px',
    borderRadius: '0 0 2px 2px',
    background: '#22C55E',
  },
  icon: {
    fontSize: '1.375rem',
    lineHeight: 1,
    opacity: 0.4,
    transition: 'opacity 0.2s ease, transform 0.15s ease',
  },
  iconActive: {
    opacity: 1,
    transform: 'scale(1.08)',
  },
  label: {
    fontSize: '0.625rem',
    fontWeight: 600,
    color: '#6F8299',
    letterSpacing: '0.02em',
    transition: 'color 0.2s ease',
  },
  labelActive: {
    color: '#22C55E',
    fontWeight: 700,
  },
};
