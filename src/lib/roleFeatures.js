/**
 * roleFeatures.js — single source of truth for role-driven
 * routing, navigation, and feature gating.
 *
 *   import {
 *     getRoleFeatures,
 *     getHomePathForRole,
 *     getNavTabsForRole,
 *     hasFeature,
 *   } from './lib/roleFeatures.js';
 *
 *   const features = getRoleFeatures('ngo');
 *   // → { homePath: '/dashboard', navTabs: [...], surfaces: {...} }
 *
 * Why a single map
 *   The codebase already has many role-aware pieces
 *   (RoleRoute, role aliases, per-role navs). This module
 *   consolidates the WHERE (homePath), the WHAT (navTabs +
 *   surfaces), and the IF (hasFeature) into one auditable
 *   table. Any new role-aware decision SHOULD route through
 *   here so we never drift between "what nav shows" and
 *   "what the route guard allows."
 *
 * Roles
 *   farmer → consumer-style daily-action surface
 *            home: /home (canonical) — falls back to /dashboard
 *            tabs: Home / My Grow / Tasks / Progress / Scan
 *   ngo    → operator dashboard with stats + tables
 *            home: /dashboard
 *            tabs: Dashboard / Farmers / Analytics
 *   buyer  → marketplace listings + filters
 *            home: /market
 *            tabs: Marketplace / Listings / Contact
 *
 * Strict-rule audit
 *   • Pure data. Frozen objects.
 *   • Unknown roles fall through to the farmer feature set so
 *     a logged-out / undefined role boot still has a usable
 *     surface.
 *   • Maps the canonical role names AND the legacy subtypes
 *     (ngo_admin, ngo_officer, ngo_agent, buyer_admin) so the
 *     existing role-alias system still resolves correctly.
 */

// ─── Feature surfaces ────────────────────────────────────────
// Each surface key is a high-level capability the role gets.
// hasFeature(role, key) returns true when the role's
// feature set lists the key.

const FARMER_FEATURES = Object.freeze({
  homePath: '/home',
  // Fallback if /home doesn't render for any reason.
  fallbackHomePath: '/dashboard',
  navTabs: Object.freeze([
    Object.freeze({ key: 'home',     path: '/dashboard', label: 'Home' }),
    Object.freeze({ key: 'grow',     path: '/my-grow',   label: 'My Grow' }),
    Object.freeze({ key: 'tasks',    path: '/tasks',     label: 'Tasks' }),
    Object.freeze({ key: 'progress', path: '/progress',  label: 'Progress' }),
    Object.freeze({ key: 'scan',     path: '/scan',      label: 'Scan' }),
  ]),
  surfaces: Object.freeze({
    home:        true,
    tasks:       true,
    progress:    true,
    scan:        true,
    myGrow:      true,
    dashboard:   false,
    farmers:     false,
    analytics:   false,
    marketplace: false,
    listings:    false,
    contact:     false,
  }),
});

const NGO_FEATURES = Object.freeze({
  homePath: '/dashboard',
  fallbackHomePath: '/ngo',
  navTabs: Object.freeze([
    Object.freeze({ key: 'dashboard', path: '/dashboard', label: 'Dashboard' }),
    Object.freeze({ key: 'farmers',   path: '/farmers',   label: 'Farmers' }),
    Object.freeze({ key: 'analytics', path: '/admin/analytics', label: 'Analytics' }),
  ]),
  surfaces: Object.freeze({
    home:        false,
    tasks:       false,
    progress:    false,
    scan:        false,
    myGrow:      false,
    dashboard:   true,
    farmers:     true,
    analytics:   true,
    marketplace: false,
    listings:    false,
    contact:     false,
  }),
});

const BUYER_FEATURES = Object.freeze({
  homePath: '/market',
  fallbackHomePath: '/marketplace',
  navTabs: Object.freeze([
    Object.freeze({ key: 'marketplace', path: '/market',           label: 'Marketplace' }),
    Object.freeze({ key: 'listings',    path: '/buyer/interests',  label: 'My Listings' }),
    Object.freeze({ key: 'contact',     path: '/buyer/notifications', label: 'Contact' }),
  ]),
  surfaces: Object.freeze({
    home:        false,
    tasks:       false,
    progress:    false,
    scan:        false,
    myGrow:      false,
    dashboard:   false,
    farmers:     false,
    analytics:   false,
    marketplace: true,
    listings:    true,
    contact:     true,
  }),
});

// ─── Role normaliser ────────────────────────────────────────
// Recognises canonical names + the existing role aliases used
// across the platform. Returns one of: 'farmer' | 'ngo' |
// 'buyer'. Unknown / null / non-string → 'farmer'.

const NGO_ROLES   = new Set(['ngo', 'ngo_admin', 'ngo_officer', 'ngo_agent']);
const BUYER_ROLES = new Set(['buyer', 'buyer_admin']);
// Platform admin roles aren't part of this map — they go
// through the existing RoleRoute / admin-layout flow. For our
// nav we treat them as farmer so they have a usable home.
function _normaliseRole(role) {
  const r = typeof role === 'string' ? role.toLowerCase().trim() : '';
  if (NGO_ROLES.has(r))   return 'ngo';
  if (BUYER_ROLES.has(r)) return 'buyer';
  return 'farmer';
}

// ─── Public API ──────────────────────────────────────────────

/** getRoleFeatures(role) — returns the frozen feature object. */
export function getRoleFeatures(role) {
  switch (_normaliseRole(role)) {
    case 'ngo':   return NGO_FEATURES;
    case 'buyer': return BUYER_FEATURES;
    case 'farmer':
    default:      return FARMER_FEATURES;
  }
}

/** getHomePathForRole(role) — canonical path the role lands on. */
export function getHomePathForRole(role) {
  return getRoleFeatures(role).homePath;
}

/**
 * getFallbackHomePathForRole(role) — backup path the role lands
 * on when the primary homePath would cause a circular redirect
 * (e.g. RoleHomeRedirect mounted at /home + farmer.homePath = /home
 * → infinite loop). Each role definition supplies its own fallback;
 * we default to '/dashboard' if a future role omits it.
 */
export function getFallbackHomePathForRole(role) {
  const f = getRoleFeatures(role);
  return (f && typeof f.fallbackHomePath === 'string' && f.fallbackHomePath)
    || '/dashboard';
}

/** getNavTabsForRole(role) — array of { key, path, label }. */
export function getNavTabsForRole(role) {
  return getRoleFeatures(role).navTabs;
}

/**
 * hasFeature(role, key) — convenience predicate for surfaces.
 *
 *   hasFeature('farmer', 'tasks')        // true
 *   hasFeature('ngo',    'analytics')    // true
 *   hasFeature('buyer',  'marketplace')  // true
 *   hasFeature('buyer',  'tasks')        // false
 */
export function hasFeature(role, key) {
  if (typeof key !== 'string' || !key) return false;
  const f = getRoleFeatures(role);
  return f.surfaces[key] === true;
}

// Test hooks.
export const _internal = Object.freeze({
  FARMER_FEATURES,
  NGO_FEATURES,
  BUYER_FEATURES,
  _normaliseRole,
});

export default {
  getRoleFeatures,
  getHomePathForRole,
  getFallbackHomePathForRole,
  getNavTabsForRole,
  hasFeature,
};
