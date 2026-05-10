/**
 * BottomTabNav — persistent bottom navigation for farmer-facing screens.
 *
 * Role/mode split:
 *   Farmer  (6 tabs): Home · My Farm · Tasks · Progress · Funding · Sell
 *   Garden  (5 tabs): Home · My Grow · Tasks · Progress · Scan
 *
 * Both share Home / Tasks / Progress. Divergent tabs:
 *   • Farmer gets  My Farm + Funding + Sell (no Scan in bottom nav)
 *   • Garden gets  My Grow + Scan           (no Funding/Sell)
 *
 * Mode detection (spec §3): profile.mode === "garden"
 *   OR profile.farmType === "backyard"
 *   OR profile.userType === "backyard"
 *   OR activeContextType === "garden" (ExperienceSwitcher)
 *   Default: farmer
 *
 * Scan placement (spec §4):
 *   • Farmer: Scan appears as a card inside My Farm only (FEATURE_SCAN gated)
 *   • Garden: Scan is a bottom-nav tab (FEATURE_SCAN gated; hidden when off)
 *
 * Icons always visible, label under icon, active tab highlighted with
 * green indicator. Large tap targets, mobile-first, premium dark styling.
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { useStrictTranslation as useTranslation } from '../../i18n/useStrictTranslation.js';
import { tSafe } from '../../i18n/tSafe.js';
import { NAV_ICONS } from '../../lib/farmerIcons.js';
// useProfileOrNull is the non-throwing variant — bottom nav
// renders on login pages where ProfileProvider isn't mounted.
// Wrapping `useProfile()` in try/catch would desync React's
// hook counter (error #310). The OrNull variant uses
// `useContext` directly and returns null when no provider.
import { useProfileOrNull } from '../../context/ProfileContext.jsx';
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
// 'garden', the nav switches to GARDEN_TABS regardless of the
// profile's farmType, so a user with both a garden and a farm
// flips nav surfaces instantly on switch.
import useExperience from '../../hooks/useExperience.js';
// Surface-level feature flags (UPPER_SNAKE_CASE system). Used for
// FEATURE_SCAN tab visibility. Distinct from the camelCase
// config/features.js system above.
import { isFeatureEnabled as isSurfaceEnabled } from '../../utils/featureFlags.js';
// Explicit grow-mode toggle — checked FIRST in isGarden so the nav
// flips immediately on ExperienceTabs tap, even when the user has
// no garden/farm entities yet (switchExperience returns false in
// that case, so activeContextType never updates).
import useGrowMode from '../../hooks/useGrowMode.js';

// ── Canonical tab definitions ────────────────────────────────────────────
//
// Farmer nav (6 tabs) — spec §1:
//   Home · My Farm · Tasks · Progress · Funding · Sell
//   Scan does NOT appear here; it lives as a card inside My Farm.
const FARMER_TABS = [
  { key: 'home',     path: '/dashboard', icon: NAV_ICONS.home,     labelKey: 'nav.home',     fallback: 'Home' },
  { key: 'farm',     path: '/my-farm',   icon: NAV_ICONS.farm,     labelKey: 'nav.myFarm',   fallback: 'My Farm' },
  { key: 'tasks',    path: '/tasks',     icon: NAV_ICONS.tasks,    labelKey: 'nav.tasks',    fallback: 'Tasks' },
  { key: 'progress', path: '/progress',  icon: NAV_ICONS.progress, labelKey: 'nav.progress', fallback: 'Progress' },
  { key: 'funding',  path: '/funding',   icon: NAV_ICONS.funding,  labelKey: 'nav.funding',  fallback: 'Funding' },
  { key: 'sell',     path: '/sell',      icon: NAV_ICONS.sell,     labelKey: 'nav.sell',     fallback: 'Sell' },
];

// Garden / backyard nav (5 tabs) — Garden Mode Refactor spec §2:
//   Home · My Grow · Tasks · Journal · Scan
//   Funding and Sell do NOT appear here.
//   Progress is replaced by Journal — gardeners read their growth
//   story as a timeline of care moments, not as commercial metrics.
//   Scan tab is hidden when FEATURE_SCAN is off (route stays mounted).
const GARDEN_TABS = [
  { key: 'home',     path: '/dashboard', icon: NAV_ICONS.home,     labelKey: 'nav.home',     fallback: 'Home' },
  { key: 'grow',     path: '/my-grow',   icon: NAV_ICONS.farm,     labelKey: 'nav.myGrow',   fallback: 'My Grow' },
  { key: 'tasks',    path: '/tasks',     icon: NAV_ICONS.tasks,    labelKey: 'nav.tasks',    fallback: 'Tasks' },
  { key: 'journal',  path: '/journal',   icon: NAV_ICONS.journal,  labelKey: 'nav.journal',  fallback: 'Journal' },
  { key: 'scan',     path: '/scan',      icon: NAV_ICONS.scan,     labelKey: 'nav.scan',     fallback: 'Scan' },
];

// Unified alias kept for the regionUxSystem fallback path only.
// External callers that still import BACKYARD_TABS get GARDEN_TABS.
const BACKYARD_TABS = GARDEN_TABS;

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

  // ─── Hook-order fix (May 2026 React #300 hardening) ────────
  // ALL hooks (useProfileOrNull, useExperience) MUST run on every
  // render — not gated by the _isSetupPath() early return below
  // and NOT wrapped in a try/catch. The previous shape had
  // useExperience inside a `try { ... } catch {}` block which is
  // a textbook hooks-rule violation: if the hook throws, React's
  // hook counter desyncs and the next render trips error #300.
  //
  // useExperience has its own internal try/catch around the
  // localStorage / event-listener wiring; calling it directly is
  // safe.
  const _profileCtx = useProfileOrNull();
  const profile = (_profileCtx && _profileCtx.profile) || null;
  const country = profile?.country || profile?.countryCode || null;

  const exp = useExperience();
  // Explicit grow-mode key — highest priority for isGarden below.
  // Unconditional hook call (rules-of-hooks safe; lives alongside
  // the existing useExperience call, before any early return).
  const { mode: _growMode } = useGrowMode();
  let activeContextType = null;
  let farmType = profile?.farmType || null;
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

  // Self-hide during setup / onboarding flows so users don't
  // accidentally navigate away mid-setup and leave a partial
  // farm/garden record behind. Lives BELOW every hook so the
  // hook order is stable across the path-change transition.
  if (_isSetupPath(location?.pathname || '')) return null;

  // ── Garden / farmer mode detection (spec §3) ───────────────
  // Priority order:
  //   1. activeContextType from useExperience (ExperienceSwitcher signal)
  //   2. Explicit profile fields: mode, userType, farmType
  //   3. Legacy country+farmType heuristic via shouldUseBackyardExperience
  //   4. Default: farmer
  // Priority order (highest → lowest):
  //   1. Explicit farroway_active_grow_mode toggle (always wins)
  //   2. activeContextType from useExperience (entity-based)
  //   3. Explicit profile fields
  //   4. Country+farmType heuristic
  //   5. Default: farmer
  const isGarden = (_growMode === 'garden')
    || (activeContextType === 'garden')
    || (profile?.mode === 'garden')
    || (profile?.userType === 'backyard')
    || (activeContextType == null
        && shouldUseBackyardExperience(country, farmType));

  // ── Tab selection (spec §1 / §2) ───────────────────────────
  // The legacy regionUxSystem flag-gated path is preserved for
  // pilots that rely on the 4-tab subset. When off (default),
  // the canonical farmer-6 / garden-5 split applies.
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
  } else if (isGarden) {
    // Garden mode (spec §2): Home · My Grow · Tasks · Progress · Scan
    // Scan tab hidden when FEATURE_SCAN is off; route stays mounted
    // so deep links resolve cleanly. Funding + Sell never appear.
    tabs = isSurfaceEnabled('FEATURE_SCAN')
      ? GARDEN_TABS
      : GARDEN_TABS.filter((t) => t.key !== 'scan');
  } else {
    // Farmer mode (spec §1): Home · My Farm · Tasks · Progress · Funding · Sell
    // Scan does NOT appear in the bottom nav — it lives as a card
    // inside the My Farm page when FEATURE_SCAN is on.
    tabs = FARMER_TABS;
  }

  // Reference BACKYARD_TABS so the linter doesn't flag the legacy
  // export as unused — kept on disk for callers importing the
  // deprecated symbol.
  void BACKYARD_TABS;

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
