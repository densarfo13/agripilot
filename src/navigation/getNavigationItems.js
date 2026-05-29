/**
 * getNavigationItems.js — region-experience-aware bottom nav tabs.
 *
 * Remove Mobile Dashboard Experience (Wave 9) — the grower
 * bottom nav drops "Progress" (analytics overtone) and
 * renames the slot to "Activity" (timeline). Farm mode keeps
 * Sell as the 5th slot; Garden mode keeps Activity. Both
 * modes always carry Home / (My Farm | My Plants) / Scan /
 * Tasks. Funding moved off the primary nav for farm users —
 * it stays reachable from the secondary "More" surface and
 * via direct URL.
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
  // Bottom Nav Home Source-of-Truth §2 — Home targets /home.
  { key: 'nav.home',     fallback: 'Home',       path: '/home',              icon: '🏡', testid: 'tab-home' },
  { key: 'nav.myFarm',   fallback: 'My Farm',    path: '/my-farm',           icon: '🌾', testid: 'tab-farm' },
  { key: 'nav.scan',     fallback: 'Scan',       path: '__scan__',           icon: '📸', testid: 'tab-scan' },
  { key: 'nav.tasks',    fallback: 'Tasks',      path: '/tasks',             icon: '✅',       testid: 'tab-tasks' },
  { key: 'nav.sell',     fallback: 'Sell',       path: '/farmer/listings',   icon: '🧺', testid: 'tab-sell' },
];

// Scan path resolution is deferred to call time so the new
// /scan flow is reachable when the `scanDetection` feature
// flag is on without changing this static table.
const _BACKYARD_ITEMS_BASE = [
  { key: 'nav.home',      fallback: 'Home',       path: '/home',       icon: '🏡', testid: 'tab-home' },
  { key: 'nav.myPlants',  fallback: 'My Plants',  path: '/my-plants',  icon: '🌱', testid: 'tab-myplants' },
  { key: 'nav.scan',      fallback: 'Scan',       path: '__scan__',    icon: '📸', testid: 'tab-scan' },
  { key: 'nav.tasks',     fallback: 'Tasks',      path: '/tasks',      icon: '✅',       testid: 'tab-tasks' },
  { key: 'nav.activity',  fallback: 'Activity',   path: '/activity',   icon: '📋', testid: 'tab-activity' },
];

const GENERIC_ITEMS = [
  // Generic experience: subset of farm items, sell hidden until
  // we know the region opens marketplace flow. Mirrors §10
  // (Sell flow visibility) — backyard + generic both hide Sell.
  { key: 'nav.home',     fallback: 'Home',     path: '/home',      icon: '🏡', testid: 'tab-home' },
  { key: 'nav.myFarm',   fallback: 'My Farm',  path: '/my-farm',   icon: '🌾', testid: 'tab-farm' },
  { key: 'nav.scan',     fallback: 'Scan',     path: '__scan__',   icon: '📸', testid: 'tab-scan' },
  { key: 'nav.tasks',    fallback: 'Tasks',    path: '/tasks',     icon: '✅',       testid: 'tab-tasks' },
  { key: 'nav.activity', fallback: 'Activity', path: '/activity',  icon: '📋', testid: 'tab-activity' },
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
  if (experience === 'generic')  return _materialise(GENERIC_ITEMS);
  return _materialise(FARM_ITEMS);
}

// Backwards compat — older imports asked for BACKYARD_ITEMS.
export const BACKYARD_ITEMS = _BACKYARD_ITEMS_BASE;

export const _internal = Object.freeze({ FARM_ITEMS, BACKYARD_ITEMS: _BACKYARD_ITEMS_BASE, GENERIC_ITEMS });

export default getNavigationItems;
