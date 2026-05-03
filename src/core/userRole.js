/**
 * userRole.js — central role registry + resolver.
 *
 *   import { getUserRole, isRoleAllowed, ROLES }
 *     from '../core/userRole.js';
 *
 *   const role = getUserRole();   // 'backyard_user' | 'farmer' |
 *                                 // 'buyer' | 'ngo_admin' |
 *                                 // 'field_agent' | 'platform_admin'
 *
 * Why a separate module from userType.js
 * ──────────────────────────────────────
 *   `userType.js` answers a UX question: "what experience does
 *   this user see?" → backyard / farmer / ngo.
 *
 *   THIS module answers a SECURITY question: "what is this user
 *   permitted to do?" → 6-role model from the Final Go-Live
 *   Audit spec §2.
 *
 *   The two concepts overlap but aren't equivalent:
 *     • userType=backyard → userRole=backyard_user
 *     • userType=farmer   → userRole=farmer | buyer
 *                            (a buyer is a farmer-mode UX with a
 *                            different role; backend auth decides
 *                            which routes they can hit)
 *     • userType=ngo      → userRole=ngo_admin | field_agent |
 *                            platform_admin
 *                            (UX is the same dashboard; ROLE
 *                            decides which farmers / programs
 *                            the dashboard can see)
 *
 *   Keeping them separate means:
 *     • UI surfaces read userType via useUserMode (cheap, sync,
 *       safe to mistake on)
 *     • Route guards + data access checks read userRole (must
 *       match server-side auth; never trust localStorage alone)
 *
 * Resolution chain
 *   1. Auth-store user.role (the canonical source — server-
 *      verified during login + /me refresh)
 *   2. Legacy `farroway_active_role` slot (mirrored from
 *      AuthContext.user → localStorage by the existing
 *      useEffect bridge)
 *   3. 'farmer' default — the safest fallback for an
 *      authenticated session whose role hasn't been resolved
 *      yet (full UX, no admin tools, no buyer tools)
 *
 * Strict-rule audit
 *   • Pure read — never writes, never throws.
 *   • SSR-safe (every browser global is feature-checked).
 *   • Server-side authorization is the source of truth; this
 *     module is the FRONTEND mirror used for UX gating only.
 *     Never trust the role for restricted-data access — the
 *     backend re-checks every request.
 */

/** Spec §2 — 6-role model. */
export const ROLES = Object.freeze({
  BACKYARD_USER:  'backyard_user',
  FARMER:         'farmer',
  BUYER:          'buyer',
  NGO_ADMIN:      'ngo_admin',
  FIELD_AGENT:    'field_agent',
  PLATFORM_ADMIN: 'platform_admin',
});

const ALL_ROLES = Object.freeze(Object.values(ROLES));

// Map legacy auth-record role names onto the canonical 6-role
// model. Auth pre-this-turn stamped `super_admin` /
// `institutional_admin` / `staff` / `ngo` — collapse those
// onto the spec's exact names.
const ROLE_ALIASES = Object.freeze({
  super_admin:           ROLES.PLATFORM_ADMIN,
  admin:                 ROLES.PLATFORM_ADMIN,
  institutional_admin:   ROLES.NGO_ADMIN,
  ngo:                   ROLES.NGO_ADMIN,
  staff:                 ROLES.NGO_ADMIN,
  field_officer:         ROLES.FIELD_AGENT,
  agent:                 ROLES.FIELD_AGENT,
});

function _safeReadLocal(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _normaliseRole(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  if (ALL_ROLES.includes(s)) return s;
  if (ROLE_ALIASES[s]) return ROLE_ALIASES[s];
  // Two informal names the codebase has used historically.
  if (s === 'guest' || s === '') return null;
  return null;
}

/**
 * getUserRole() — returns one of the 6 canonical role values
 * for the current session. Resolution:
 *   1. localStorage.farroway_active_role (mirrored from
 *      AuthContext on every user change)
 *   2. 'farmer' default — the safest fallback for an
 *      authenticated session whose role hasn't loaded yet.
 *
 * Pure read; never throws.
 */
export function getUserRole() {
  const raw = _safeReadLocal('farroway_active_role');
  return _normaliseRole(raw) || ROLES.FARMER;
}

/**
 * isRoleAllowed(role, allowed) → boolean.
 *
 * Convenience guard for route + feature gates:
 *
 *   if (isRoleAllowed(getUserRole(), [ROLES.NGO_ADMIN, ROLES.FIELD_AGENT])) {
 *     // render NGO dashboard
 *   }
 *
 * Accepts a single role string or an array. Returns false on
 * any unknown role, empty allowed list, or shape mismatch —
 * the conservative "deny by default" stance the spec asks for.
 */
export function isRoleAllowed(role, allowed) {
  const r = _normaliseRole(role);
  if (!r) return false;
  if (Array.isArray(allowed)) {
    return allowed.some((a) => _normaliseRole(a) === r);
  }
  return _normaliseRole(allowed) === r;
}

/**
 * Maps the auth role → UX userType. UX surfaces should read
 * userType (via useUserMode) — this is the bridge used by the
 * `core/userType.js` module's role-check branch.
 */
export function userTypeForRole(role) {
  const r = _normaliseRole(role);
  if (!r) return 'farmer';
  if (r === ROLES.BACKYARD_USER) return 'backyard';
  if (r === ROLES.NGO_ADMIN
      || r === ROLES.FIELD_AGENT
      || r === ROLES.PLATFORM_ADMIN) return 'ngo';
  // FARMER + BUYER both render the farmer-mode UX; backend
  // auth restricts which routes/data the buyer role can reach.
  return 'farmer';
}

export const _internal = Object.freeze({
  ALL_ROLES, ROLE_ALIASES, _normaliseRole,
});

export default { ROLES, getUserRole, isRoleAllowed, userTypeForRole };
