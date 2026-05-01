/**
 * getNavigationItems.js — region-experience-aware bottom nav tabs.
 *
 * Spec port note
 * ──────────────
 * The design doc lists nav targets like `/home`, `/scan`, `/ask`,
 * `/sell`, `/funding`. Several of those don't exist as top-level
 * routes in this codebase yet — the spec was authored against an
 * idealised route set. To keep navigation **working** while the
 * route catalog catches up, each entry resolves the **spoken /
 * displayed label** against the **closest existing real route**:
 *
 *     spec route   → resolved real route   (exists today)
 *     ──────────────────────────────────────
 *     /home        → /dashboard            ← farmer landing
 *     /my-farm     → /my-farm              ✓
 *     /tasks       → /tasks                ✓
 *     /progress    → /progress             ✓
 *     /ask         → /today                ← voice nav lives there
 *     /scan        → /scan-crop            ← real path
 *     /funding     → /program-dashboard    ← farmer funding view
 *     /sell        → /farmer/listings      ← seller-side hub
 *
 * Updating the resolution is a one-line edit per entry. The
 * spoken keyword bank in `VoiceAssistant.jsx` follows the same
 * convention so the two surfaces agree on where every label lands.
 *
 * Strict-rule audit
 *   • Pure / no React / no I/O.
 *   • Returns a fresh array each call (never a frozen ref) so
 *     downstream consumers can decorate without mutating shared
 *     state.
 *   • Labels carry `key` (i18n) + `fallback` (English) so the
 *     consumer can run them through tStrict without leaking
 *     English in non-English UIs.
 */

/**
 * @typedef {'farm'|'backyard'|'generic'} RegionExperience
 *
 * @typedef {Object} NavItem
 * @property {string} key       i18n key for the label
 * @property {string} fallback  English fallback (caller passes
 *                              into tStrict as the second arg)
 * @property {string} path      resolved real route
 * @property {string} icon      single emoji
 * @property {string} testid    stable selector for tests
 */

const FARM_ITEMS = [
  { key: 'nav.home',     fallback: 'Home',       path: '/dashboard',         icon: '\uD83C\uDFE1', testid: 'tab-home' },
  { key: 'nav.myFarm',   fallback: 'My Farm',    path: '/my-farm',           icon: '\uD83C\uDF3E', testid: 'tab-farm' },
  { key: 'nav.tasks',    fallback: 'Tasks',      path: '/tasks',             icon: '\u2705',       testid: 'tab-tasks' },
  { key: 'nav.progress', fallback: 'Progress',   path: '/progress',          icon: '\uD83D\uDCC8', testid: 'tab-progress' },
  // Funding tab now points at the new Funding Hub at /funding
  // (region- and role-aware static catalog). The page itself
  // checks the fundingHub feature flag and renders a "rolling
  // out" message when off, so the route is always safe to land.
  { key: 'nav.funding',  fallback: 'Funding',    path: '/funding',           icon: '\uD83D\uDCB0', testid: 'tab-funding' },
  { key: 'nav.sell',     fallback: 'Sell',       path: '/farmer/listings',   icon: '\uD83E\uDDFA', testid: 'tab-sell' },
];

// Scan path resolution is deferred to call time so the new
// /scan flow is reachable when the `scanDetection` feature
// flag is on without changing this static table.
const _BACKYARD_ITEMS_BASE = [
  { key: 'nav.home',      fallback: 'Home',       path: '/dashboard', icon: '\uD83C\uDFE1', testid: 'tab-home' },
  { key: 'nav.myGarden',  fallback: 'My Garden',  path: '/my-farm',   icon: '\uD83C\uDF31', testid: 'tab-farm' },
  { key: 'nav.tasks',     fallback: 'Tasks',      path: '/tasks',     icon: '\u2705',       testid: 'tab-tasks' },
  { key: 'nav.progress',  fallback: 'Progress',   path: '/progress',  icon: '\uD83D\uDCC8', testid: 'tab-progress' },
  { key: 'nav.ask',       fallback: 'Ask',        path: '/today',     icon: '\uD83C\uDFA4', testid: 'tab-ask' },
  { key: 'nav.scan',      fallback: 'Scan',       path: '__scan__',   icon: '\uD83D\uDCF8', testid: 'tab-scan' },
];

const GENERIC_ITEMS = [
  // Generic experience: subset of farm items, sell hidden until
  // we know the region opens marketplace flow. Mirrors §10
  // (Sell flow visibility) — backyard + generic both hide Sell.
  { key: 'nav.home',     fallback: 'Home',     path: '/dashboard', icon: '\uD83C\uDFE1', testid: 'tab-home' },
  { key: 'nav.myFarm',   fallback: 'My Farm',  path: '/my-farm',   icon: '\uD83C\uDF3E', testid: 'tab-farm' },
  { key: 'nav.tasks',    fallback: 'Tasks',    path: '/tasks',     icon: '\u2705',       testid: 'tab-tasks' },
  { key: 'nav.progress', fallback: 'Progress', path: '/progress',  icon: '\uD83D\uDCC8', testid: 'tab-progress' },
];

// Static import — Vite ESM has no `require`. Defensive
// destructure with a guard so a malformed features module
// can never break the nav.
import * as _features from '../config/features.js';

/**
 * Resolve the runtime scan path. The `__scan__` sentinel above
 * is replaced here so the table stays static while the actual
 * destination flips with the `scanDetection` feature flag.
 */
function _resolveScanPath() {
  try {
    if (typeof _features?.isFeatureEnabled === 'function'
        && _features.isFeatureEnabled('scanDetection')) {
      return '/scan';
    }
  } catch { /* ignore */ }
  return '/scan-crop';
}

function _materialise(items) {
  return items.map((it) => (
    it.path === '__scan__' ? { ...it, path: _resolveScanPath() } : { ...it }
  ));
}

/**
 * @param {RegionExperience} experience
 * @returns {NavItem[]}
 */
export function getNavigationItems(experience) {
  if (experience === 'backyard') return _materialise(_BACKYARD_ITEMS_BASE);
  if (experience === 'generic')  return GENERIC_ITEMS.slice();
  return FARM_ITEMS.slice();
}

// Backwards compat — older imports asked for BACKYARD_ITEMS.
export const BACKYARD_ITEMS = _BACKYARD_ITEMS_BASE;

export const _internal = Object.freeze({ FARM_ITEMS, BACKYARD_ITEMS: _BACKYARD_ITEMS_BASE, GENERIC_ITEMS });

export default getNavigationItems;
