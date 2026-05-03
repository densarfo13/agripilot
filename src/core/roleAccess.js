/**
 * roleAccess.js — central route-allowlist registry.
 *
 *   import { canAccessRoute, getRouteAllowedRoles, ROUTE_ACCESS }
 *     from '../core/roleAccess.js';
 *
 *   if (!canAccessRoute('/admin')) {
 *     // route the user to a "no access" surface
 *   }
 *
 * Why a separate registry rather than per-route guards
 * ────────────────────────────────────────────────────
 *   The existing `<RoleRoute roles={STAFF_ROLES}>` pattern in
 *   App.jsx works route-by-route. This module adds a SINGLE
 *   READABLE TABLE that answers "who can see what?" — useful
 *   for:
 *     • the launch-readiness audit (grep one file, see every
 *       route's role gate)
 *     • per-route guards that don't have inline role lists
 *     • analytics — `role_access_denied` events need to know
 *       what was attempted vs. what was allowed
 *     • the security checklist (§22) — easier to spot
 *       under-protected routes when they're all in one file
 *
 * Spec coverage (Final Go-Live Audit §3)
 *   /home /my-grow /tasks /progress /scan → backyard + farmer
 *   /buyer                                 → buyer + admin
 *   /ngo                                   → ngo_admin /
 *                                            field_agent / admin
 *   /admin                                 → platform_admin only
 *
 * Strict-rule audit
 *   • Pure data + pure read fns; never throws.
 *   • Defaults to DENY for unknown routes — the conservative
 *     "deny by default" stance the spec mandates.
 *   • Frontend gate ONLY — backend re-checks every request;
 *     never trust this alone for restricted-data access.
 */

import { ROLES, getUserRole, isRoleAllowed } from './userRole.js';

/**
 * Path-prefix → allowed-roles registry. Each entry maps a
 * route prefix to the array of canonical roles that can
 * access it. Prefixes are matched left-to-right; longest
 * match wins (so `/admin` is checked before `/`).
 *
 * Adding a new gated route is a one-line change here + the
 * existing `<RoleRoute>` wrapper at the App.jsx mount.
 */
export const ROUTE_ACCESS = Object.freeze({
  // Spec §3 farmer / backyard surfaces
  '/dashboard':   [ROLES.BACKYARD_USER, ROLES.FARMER],
  '/home':        [ROLES.BACKYARD_USER, ROLES.FARMER],
  '/my-farm':     [ROLES.BACKYARD_USER, ROLES.FARMER],
  // Phase 1 §A.5 — backyard nav tab. Same page as /my-farm,
  // routed for the backyard label. Strict no-duplicates: no
  // parallel page; the existing /my-farm renders the right
  // wording via useUserMode().
  '/my-grow':     [ROLES.BACKYARD_USER, ROLES.FARMER],
  '/tasks':       [ROLES.BACKYARD_USER, ROLES.FARMER],
  '/progress':    [ROLES.BACKYARD_USER, ROLES.FARMER],
  '/scan':        [ROLES.BACKYARD_USER, ROLES.FARMER],
  '/farms':       [ROLES.BACKYARD_USER, ROLES.FARMER],
  '/manage-gardens': [ROLES.BACKYARD_USER, ROLES.FARMER],
  '/onboarding':  [ROLES.BACKYARD_USER, ROLES.FARMER, ROLES.BUYER, ROLES.NGO_ADMIN, ROLES.FIELD_AGENT, ROLES.PLATFORM_ADMIN],

  // Farmer-only feature surfaces
  '/opportunities': [ROLES.FARMER],
  '/sell':          [ROLES.FARMER],

  // Spec §3 buyer
  '/buyer':         [ROLES.BUYER, ROLES.PLATFORM_ADMIN],
  '/marketplace':   [ROLES.BUYER, ROLES.PLATFORM_ADMIN, ROLES.FARMER],

  // Spec §3 NGO
  '/ngo':           [ROLES.NGO_ADMIN, ROLES.FIELD_AGENT, ROLES.PLATFORM_ADMIN],
  '/farmers':       [ROLES.NGO_ADMIN, ROLES.FIELD_AGENT, ROLES.PLATFORM_ADMIN],

  // Spec §3 admin (most restrictive)
  '/admin':         [ROLES.PLATFORM_ADMIN],
  '/admin-ops':     [ROLES.PLATFORM_ADMIN],
});

/** Public routes accessible without auth. */
const PUBLIC_PATHS = Object.freeze([
  '/',
  '/welcome',
  '/landing',
  '/login',
  '/register',
  '/farmer-welcome',
  '/start',
  '/verify-otp',
  '/try',
  '/preview',
]);

function _isPublic(path) {
  if (!path) return true;
  if (PUBLIC_PATHS.includes(path)) return true;
  // Marketplace browse is public per spec §10 (buyer flow shows
  // listings before signup).
  if (path === '/marketplace') return true;
  return false;
}

/**
 * Pick the longest prefix in ROUTE_ACCESS that matches the
 * given path. Returns the matching key, or null.
 */
function _matchPrefix(path) {
  if (!path) return null;
  let best = null;
  for (const key of Object.keys(ROUTE_ACCESS)) {
    if (path === key || path.startsWith(`${key}/`)) {
      if (!best || key.length > best.length) best = key;
    }
  }
  return best;
}

/**
 * canAccessRoute(path, role?) → boolean.
 *
 * Returns true when the supplied (or current) role is in the
 * allowlist for the route's longest-prefix match. Public
 * routes always return true. Unknown routes default to FALSE
 * (deny-by-default).
 */
export function canAccessRoute(path, role) {
  if (_isPublic(path)) return true;
  const r = role || getUserRole();
  const match = _matchPrefix(path);
  if (!match) return false;
  const allowed = ROUTE_ACCESS[match] || [];
  return isRoleAllowed(r, allowed);
}

/**
 * getRouteAllowedRoles(path) → array<string>.
 *
 * Convenience for the launch-readiness audit + admin tooling.
 * Returns the allowed role list for the longest-prefix match,
 * or an empty array for unknown / public routes.
 */
export function getRouteAllowedRoles(path) {
  if (_isPublic(path)) return [];
  const match = _matchPrefix(path);
  if (!match) return [];
  return [...(ROUTE_ACCESS[match] || [])];
}

export const _internal = Object.freeze({
  PUBLIC_PATHS, _isPublic, _matchPrefix,
});

export default {
  ROUTE_ACCESS,
  canAccessRoute,
  getRouteAllowedRoles,
};
