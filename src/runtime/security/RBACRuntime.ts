/**
 * src/runtime/security/RBACRuntime.ts — Role / permission
 * runtime. The single read API every guard calls.
 *
 *   import {
 *     hasPermission, isRole, listPermissionsFor,
 *     installRBACGlobal, rbacHealth, RBAC_VERSION,
 *   } from 'src/runtime/security/RBACRuntime';
 *
 *   window.__rbacHealth()
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws. Fail-closed.
 *   • No PII. No fetch.
 */

import {
  RBAC_VERSION, ROLES, ACTIONS,
} from './roleContracts';
import { ROLE_PERMISSIONS } from './permissionMatrix';

export { RBAC_VERSION, ROLES, ACTIONS, ROLE_PERMISSIONS };

const _arr  = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

const _roleSet = new Set<string>(ROLES as readonly string[]);

export function isRole(role: string): boolean {
  return _safe(() => _roleSet.has(_str(role)), false);
}

export function hasPermission(role: string, action: string): boolean {
  return _safe(() => {
    const r = _str(role);
    const a = _str(action);
    if (!r || !a) return false;
    const allowed = ROLE_PERMISSIONS[r];
    if (!allowed) return false;
    return (_arr(allowed) as string[]).indexOf(a) >= 0;
  }, false);
}

export function listPermissionsFor(role: string): ReadonlyArray<string> {
  return _safe(() =>
    Object.freeze((ROLE_PERMISSIONS[_str(role)] || []).slice()),
    Object.freeze([] as string[]));
}

export function rbacHealth() {
  return Object.freeze({
    runtimeVersion:   RBAC_VERSION,
    initialized:      true,
    rolesReady:       true,
    permissionsReady: true,
    failClosed:       true,
    roles:            ROLES,
    actionCount:      ACTIONS.length,
    rolePermissions:  ROLE_PERMISSIONS,
  });
}

export function installRBACGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__rbacHealth !== 'function') {
      w.__rbacHealth = function () {
        const out = rbacHealth();
        try { console.log('[Farroway · RBAC]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
