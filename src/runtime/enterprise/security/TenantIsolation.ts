/**
 * src/runtime/enterprise/security/TenantIsolation.ts —
 * Per-tenant query filtering. Engines feed any list of records
 * through `scopeRecordsToTenant()` and only org-matched rows
 * survive.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Fail-closed: missing user / missing role → empty list.
 */

import {
  ENTERPRISE_SECURITY_VERSION, ORG_SCOPED_ROLES,
} from './enterpriseSecurityContracts';

export const TENANT_ISOLATION_VERSION = ENTERPRISE_SECURITY_VERSION;

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr  = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

interface User {
  id?:             string;
  role?:           string;
  organizationId?: string;
}

/**
 * Filter a record list to ones the viewing user is allowed to
 * see. Admin sees all org-tagged records (aggregate). NGO
 * staff sees only their own org. Everyone else gets [].
 */
export function scopeRecordsToTenant<T extends { organizationId?: string }>(
                                       user: User | null,
                                       records: ReadonlyArray<T>): ReadonlyArray<T> {
  return _safe(() => {
    if (!_isObj(user)) return Object.freeze([]) as any;
    const role  = _str(user.role);
    const list  = _arr(records);
    if (role === 'admin') {
      return Object.freeze(list.filter((r) =>
        _isObj(r) && _str((r as any).organizationId))) as any;
    }
    if ((ORG_SCOPED_ROLES as readonly string[]).indexOf(role) < 0) {
      return Object.freeze([]) as any;
    }
    const userOrg = _str(user.organizationId);
    if (!userOrg) return Object.freeze([]) as any;
    return Object.freeze(list.filter((r) =>
      _isObj(r)
      && _str((r as any).organizationId) === userOrg)) as any;
  }, Object.freeze([]) as any);
}

/** Snapshot used by diagnostics + CI gate. */
export function tenantIsolationSnapshot() {
  return Object.freeze({
    runtimeVersion: TENANT_ISOLATION_VERSION,
    failClosed:     true,
    rolesAllowed:   ORG_SCOPED_ROLES,
  });
}
