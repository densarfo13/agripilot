/**
 * src/runtime/enterprise/security/EnterpriseAccessGuard.ts —
 * Composite gate: combines tenant scope + RBAC into one
 * verdict per attempted action.
 *
 *   guardAction({ user, action, organizationId? })
 *     → { allowed, role, reason }
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Fail-closed.
 */

import {
  ENTERPRISE_SECURITY_VERSION, ACCESS_VERDICT, SCOPE_REASON,
} from './enterpriseSecurityContracts';
import { requireOrganizationScope } from './OrganizationScope';
import { hasPermission, ROLE_PERMISSIONS } from
  '../../security/RBACRuntime';

export const ENTERPRISE_ACCESS_GUARD_VERSION = ENTERPRISE_SECURITY_VERSION;

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

interface GuardCtx {
  user?:           any;
  action?:         string;
  organizationId?: string;
}

export function guardAction(ctx: GuardCtx) {
  return _safe(() => {
    if (!_isObj(ctx) || !_isObj(ctx.user)) {
      return _verdict(false, '', SCOPE_REASON.NO_USER);
    }
    const role = _str(ctx.user.role);
    const action = _str(ctx.action);
    if (!action || !hasPermission(role, action)) {
      return _verdict(false, role, SCOPE_REASON.ROLE_NOT_PERMITTED);
    }
    const orgId = _str(ctx.organizationId);
    if (orgId) {
      const scope = requireOrganizationScope(ctx.user, orgId) as any;
      if (!scope.allowed) {
        return _verdict(false, role, _str(scope.reason));
      }
    }
    return _verdict(true, role, SCOPE_REASON.OK);
  }, _verdict(false, '', SCOPE_REASON.FAIL_CLOSED));
}

function _verdict(allowed: boolean, role: string, reason: string) {
  return Object.freeze({
    runtimeVersion: ENTERPRISE_ACCESS_GUARD_VERSION,
    allowed, role, reason,
    verdict: allowed ? ACCESS_VERDICT.ALLOW : ACCESS_VERDICT.DENY,
  });
}

export function enterpriseAccessGuardSnapshot() {
  return Object.freeze({
    runtimeVersion: ENTERPRISE_ACCESS_GUARD_VERSION,
    failClosed:     true,
    rolePermissionMatrix: ROLE_PERMISSIONS,
  });
}
