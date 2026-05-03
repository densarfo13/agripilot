/**
 * roleAliases.js — server-side mirror of the frontend
 * `core/userRole.js` ROLE_ALIASES map.
 *
 * Why this file exists
 * ────────────────────
 * The frontend security layer (Final Go-Live Audit §2) uses the
 * canonical 6-role model:
 *   backyard_user / farmer / buyer / ngo_admin / field_agent /
 *   platform_admin
 *
 * The server's auth records were stamped with legacy role names
 * (super_admin / institutional_admin / field_officer / staff /
 * ngo). Existing middleware (`authorize`, `requireRole`) compares
 * roles by exact-match string, so a frontend caller passing the
 * spec name to `requireRole('platform_admin')` would not match a
 * user whose JWT carries `role: 'super_admin'`.
 *
 * This module is a NORMALIZER — never a parallel auth pipeline.
 * It maps both directions onto a single canonical set so existing
 * middleware can be called with either flavour and behave the
 * same way. It does NOT introduce new middleware, does NOT
 * mutate user records, and is pure read.
 *
 * Strict-rule audit
 *   • No DB writes, no token rewrites — pure mapping.
 *   • Server-side authz is unchanged; this is a normalisation
 *     helper that the same `requireRole(...)` middleware can
 *     opt into via `expandRoles([...])`.
 *   • Unknown roles pass through unchanged so callers never
 *     accidentally widen access by passing an unrecognised name.
 */

// Spec §2 — 6-role canonical model, expressed as the lower-case
// strings the codebase already uses everywhere.
export const SPEC_ROLES = Object.freeze({
  BACKYARD_USER:  'backyard_user',
  FARMER:         'farmer',
  BUYER:          'buyer',
  NGO_ADMIN:      'ngo_admin',
  FIELD_AGENT:    'field_agent',
  PLATFORM_ADMIN: 'platform_admin',
});

// Each canonical key resolves to the set of role strings any of
// the existing auth records may carry for that conceptual role.
// Ordering inside each array is informational only.
export const ROLE_GROUPS = Object.freeze({
  backyard_user:  ['backyard_user'],
  farmer:         ['farmer'],
  buyer:          ['buyer'],
  ngo_admin:      ['ngo_admin', 'institutional_admin', 'ngo', 'staff'],
  field_agent:    ['field_agent', 'field_officer', 'agent'],
  platform_admin: ['platform_admin', 'super_admin', 'admin'],
});

// Reverse map: any legacy name → its canonical 6-role bucket.
const LEGACY_TO_CANONICAL = (() => {
  const out = Object.create(null);
  for (const canonical of Object.keys(ROLE_GROUPS)) {
    for (const alias of ROLE_GROUPS[canonical]) {
      out[String(alias).toLowerCase()] = canonical;
    }
  }
  return Object.freeze(out);
})();

/**
 * normalizeRole(role) → canonical 6-role name, or the input
 * lower-cased when no alias matches. Pure read, never throws.
 */
export function normalizeRole(role) {
  if (role == null) return '';
  const s = String(role).trim().toLowerCase();
  if (!s) return '';
  return LEGACY_TO_CANONICAL[s] || s;
}

/**
 * expandRoles(input) → array<string>.
 *
 * Accepts a single role string or an array. Returns the union of
 * each role's group (canonical name + every legacy alias) so
 * existing exact-match middleware (`authorize(...names)`,
 * `requireRole(...names)`) catches BOTH the spec name and any
 * legacy name a JWT may carry.
 *
 *   expandRoles(['platform_admin'])
 *   → ['platform_admin', 'super_admin', 'admin']
 *
 *   expandRoles('ngo_admin')
 *   → ['ngo_admin', 'institutional_admin', 'ngo', 'staff']
 *
 * Unknown roles pass through unchanged (the conservative
 * "deny-by-default" stance — never accidentally widen access
 * via a typo).
 */
export function expandRoles(input) {
  const list = Array.isArray(input) ? input : [input];
  const out = new Set();
  for (const item of list) {
    if (item == null) continue;
    const s = String(item).trim().toLowerCase();
    if (!s) continue;
    const canonical = LEGACY_TO_CANONICAL[s] || s;
    const group = ROLE_GROUPS[canonical];
    if (group && group.length > 0) {
      for (const alias of group) out.add(alias);
    } else {
      out.add(s);
    }
  }
  return Array.from(out);
}

/**
 * isRoleInGroup(actual, allowedSpecNames) → boolean.
 *
 * Convenience helper: returns true when the user's actual role
 * (legacy or canonical) maps onto ANY of the supplied spec
 * names. Used by tests and by route-local guards that want to
 * check a role without invoking middleware.
 */
export function isRoleInGroup(actual, allowedSpecNames) {
  const a = normalizeRole(actual);
  if (!a) return false;
  const allowed = Array.isArray(allowedSpecNames)
    ? allowedSpecNames
    : [allowedSpecNames];
  for (const spec of allowed) {
    if (normalizeRole(spec) === a) return true;
  }
  return false;
}

export default {
  SPEC_ROLES, ROLE_GROUPS,
  normalizeRole, expandRoles, isRoleInGroup,
};
