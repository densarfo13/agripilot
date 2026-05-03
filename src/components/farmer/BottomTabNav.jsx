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
// Multi-experience selector — when the active experience is
// 'garden', the nav switches to BACKYARD_TABS regardless of the
// profile's farmType, so a user with both a garden and a farm
// flips nav surfaces instantly on switch.
import useExperience from '../../hooks/useExperience.js';

// Farm vs Garden UX spec §1 — the second tab is renamed
// "My Grow" across BOTH experience variants. A single label
// covers users who own farms, gardens, or both, and the
// destination page (/my-farm) renders Farms / Gardens tabs
// internally so the per-experience filtering is explicit.
// Route stays at /my-farm so existing deep links and the
// router config keep working unchanged.
// Standardize Navigation System §1 + §3 — single 5-tab
// structure shared by every userType:
//   Home | My Grow | Tasks | Progress | Scan
// Funding + Sell removed from primary nav per §3 (their pages
// continue to exist; per §4 they should surface inside
// Progress / My Grow as section links — that placement
// migration is out of scope for this turn). Backyard vs
// farmer adaptation happens INSIDE My Grow (Farms / Gardens
// tabs) per §2 — not at the nav level. Same single TABS
// array for backyard / farmer / ngo so cross-mode flips
// don't reshuffle the nav.
const TABS = [
  { key: 'home',     path: '/dashboard', icon: NAV_ICONS.home,     labelKey: 'nav.home',     fallback: 'Home' },
  { key: 'farm',     path: '/my-farm',   icon: NAV_ICONS.farm,     labelKey: 'nav.myGrow',   fallback: 'My Grow' },
  { key: 'tasks',    path: '/tasks',     icon: NAV_ICONS.tasks,    labelKey: 'nav.tasks',    fallback: 'Tasks' },
  { key: 'progress', path: '/progress',  icon: NAV_ICONS.progress, labelKey: 'nav.progress', fallback: 'Progress' },
  { key: 'scan',     path: '/scan',      icon: NAV_ICONS.scan,     labelKey: 'nav.scan',     fallback: 'Scan' },
];

// Setup / onboarding paths where the bottom nav must self-hide
// (Adaptive setup spec \u00a75 + high-trust onboarding spec \u00a77 \u2014
// users should not leave setup midway and create broken state,
// AND must not see funding/sell/scan affordances before setup
// is complete). Match prefix so child routes inherit.
const HIDE_NAV_PATHS = [
  '/onboarding',           // covers /onboarding, /onboarding/v3, /backyard, /us-experience, /onboarding/start (FastFlow), etc.
  '/farm/new',
  '/edit-farm',
  '/setup-farm',
  // High-trust onboarding spec \u00a77 \u2014 Quick setup forms hand
  // off to /home themselves; bottom nav must self-hide here so
  // a half-filled setup form can't be abandoned via a tab tap
  // and the funding/sell/scan tabs aren't visible distractions
  // during onboarding.
  '/setup/garden',
  '/setup/farm',
  // Legacy minimal-farm setup entry kept for deep links.
  '/start/farm',
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
  // Context-driven UI spec §2 — `activeContextType` from
  // useExperience is the canonical signal: 'farm' shows all
  // tabs, 'garden' shows the strict 4-tab subset (no Funding /
  // Sell). Falls back to the legacy farmType + region heuristic
  // when useExperience can't resolve a snapshot (login screens
  // mount BottomTabNav outside the experience scope).
  let activeContextType = null;
  let farmType = profile?.farmType || null;
  try {
    const exp = useExperience();
    if (exp && (exp.activeContextType === 'garden' || exp.activeContextType === 'farm')) {
      activeContextType = exp.activeContextType;
    }
    if (exp && exp.activeEntity && exp.activeEntity.farmType) {
      farmType = exp.activeEntity.farmType;
    } else if (exp && exp.experience === exp.EXPERIENCE.GARDEN) {
      farmType = 'backyard';
    } else if (exp && exp.experience === exp.EXPERIENCE.FARM) {
      // Only override if the profile farmType IS a backyard one;
      // otherwise leave the existing value (some farms ship as
      // 'commercial', not 'small_farm').
      if (!farmType || farmType === 'backyard' || farmType === 'home_garden') {
        farmType = 'small_farm';
      }
    }
  } catch { /* outside hook scope — fall back to profile */ }
  // Spec §2: prefer activeContextType. Only fall back to the
  // legacy region+farmType heuristic when context is unknown
  // (login flow / pre-onboarding paths).
  const isBackyard = (activeContextType === 'garden')
    || (activeContextType == null
        && shouldUseBackyardExperience(country, farmType));

  // Standardize Navigation System §1 — single canonical 5-tab
  // array (TABS) used by every userType. The `isBackyard`
  // signal is computed above but no longer drives the nav
  // shape — backyard / farmer / ngo all see the same Home /
  // My Grow / Tasks / Progress / Scan structure. Per-type
  // adaptation happens INSIDE My Grow (Farms / Gardens tabs)
  // per spec §2.
  //
  // The legacy regionUxSystem flag-gated path is preserved
  // for any pilot still relying on the 4-tab subset routing
  // — when the flag is on, getNavigationItems(experience)
  // computes its own subset; when off, every user gets the
  // canonical 5-tab structure.
  let tabs;
  if (isFeatureEnabled('regionUxSystem')) {
    const ux = resolveRegionUX({
      detectedCountry: country,
      detectedRegion:  profile?.region || null,
      farmType,
    });
    const items = getNavigationItems(ux.experience);
    tabs = items.map((it) => ({
      key:      it.testid?.replace(/^tab-/, '') || it.path,
      path:     it.path,
      icon:     it.icon,
      labelKey: it.key,
      fallback: it.fallback,
    }));
  } else {
    // Reference isBackyard so the linter doesn't flag it as
    // unused — kept in scope for any future per-type tweak
    // that lives at this level (e.g. swapping the My Grow
    // icon between 🌾 and 🌱). Today, both userTypes get
    // the identical TABS array.
    void isBackyard;
    tabs = TABS;
  }

  const currentPath = location.pathname;

  return (
    <nav style={S.nav} data-testid="bottom-tab-nav">
      {tabs.map((tab) => {
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
