/**
 * src/runtime/security/permissionMatrix.ts — Single source of
 * truth for which role can do what.
 *
 * Strict-rule audit
 *   • Pure data. SSR-safe. No engine imports.
 *   • Fail-closed: any role/action pair not listed → deny.
 */

import { ROLES, ACTIONS, Role, Action } from './roleContracts';

/**
 * Per-role allow-list of actions. Anything not listed is
 * denied. Grower roles (farmer/gardener/grower) have a tight
 * scope; admin sees everything.
 */
export const ROLE_PERMISSIONS: Readonly<Record<string, ReadonlyArray<string>>> =
  Object.freeze({
    farmer: Object.freeze([
      'scan:create', 'plant:create', 'plant:read', 'plant:update',
      'task:complete', 'artifact:create', 'sell:mark_ready',
    ]),
    gardener: Object.freeze([
      'scan:create', 'plant:create', 'plant:read', 'plant:update',
      'task:complete', 'artifact:create',
    ]),
    grower: Object.freeze([
      'scan:create', 'plant:create', 'plant:read', 'plant:update',
      'task:complete', 'artifact:create', 'sell:mark_ready',
    ]),
    buyer: Object.freeze([
      'buyer:send_interest',
    ]),
    field_officer: Object.freeze([
      'organization:read', 'program:read',
      'intervention:read', 'intervention:write',
      'artifact:create', 'report:read',
    ]),
    ngo_admin: Object.freeze([
      'organization:read', 'organization:write',
      'program:read', 'program:write',
      'intervention:read', 'intervention:write',
      'report:read', 'report:export',
    ]),
    organization_admin: Object.freeze([
      'organization:read', 'organization:write',
      'program:read', 'program:write',
      'intervention:read', 'intervention:write',
      'report:read', 'report:export',
    ]),
    admin: Object.freeze(ACTIONS as readonly string[]),
  });

/** Sanity-check at module load. Logs if any role is missing. */
for (const r of ROLES) {
  if (!ROLE_PERMISSIONS[r]) {
    // eslint-disable-next-line no-console
    console.warn('[rbac] role missing from permission matrix:', r);
  }
}
