/**
 * src/runtime/enterprise/security/OrganizationScope.ts —
 * Per-org scoping helpers. Every read/write that crosses an
 * organization boundary goes through one of these calls.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Fail-closed by default — missing inputs return DENY.
 *   • No persistence. No PII.
 */

import {
  ENTERPRISE_SECURITY_VERSION, ACCESS_VERDICT, SCOPE_REASON,
  ORG_SCOPED_ROLES,
} from './enterpriseSecurityContracts';

export const ORGANIZATION_SCOPE_VERSION = ENTERPRISE_SECURITY_VERSION;

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export interface User {
  id?:             string;
  role?:           string;
  organizationId?: string;
}

interface ScopeResult {
  allowed: boolean;
  role:    string;
  reason:  string;
}

function _verdict(allowed: boolean, role: string, reason: string): ScopeResult {
  return Object.freeze({
    runtimeVersion: ORGANIZATION_SCOPE_VERSION,
    allowed, role, reason,
  }) as unknown as ScopeResult;
}

/**
 * Require that a user is allowed to access a specific
 * organization. Admin sees everything (aggregate). NGO admins
 * + organization_admin + field_officer must match the
 * organizationId on the user.
 *
 * Fail-closed: any missing input returns DENY.
 */
export function requireOrganizationScope(user: User | null,
                                           organizationId: string): ScopeResult {
  return _safe(() => {
    if (!_isObj(user))         return _verdict(false, '', SCOPE_REASON.NO_USER);
    const role  = _str(user.role);
    const orgId = _str(organizationId);
    if (!orgId)                return _verdict(false, role, SCOPE_REASON.MISSING_ORG_ID);
    if (role === 'admin')      return _verdict(true, role, SCOPE_REASON.OK);
    if ((ORG_SCOPED_ROLES as readonly string[]).indexOf(role) < 0) {
      return _verdict(false, role, SCOPE_REASON.ROLE_NOT_PERMITTED);
    }
    const userOrg = _str(user.organizationId);
    if (!userOrg)              return _verdict(false, role, SCOPE_REASON.FAIL_CLOSED);
    if (userOrg !== orgId)     return _verdict(false, role, SCOPE_REASON.CROSS_ORG_FORBIDDEN);
    return _verdict(true, role, SCOPE_REASON.OK);
  }, _verdict(false, '', SCOPE_REASON.FAIL_CLOSED));
}

/** Read-only diagnostic — exposes per-org access verdict shape
 *  without taking a side effect. */
export function organizationScopeSnapshot() {
  return Object.freeze({
    runtimeVersion: ORGANIZATION_SCOPE_VERSION,
    verdicts:       ACCESS_VERDICT,
    reasons:        SCOPE_REASON,
    failClosed:     true,
  });
}
