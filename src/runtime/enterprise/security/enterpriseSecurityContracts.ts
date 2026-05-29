/**
 * src/runtime/enterprise/security/enterpriseSecurityContracts.ts
 * — Frozen contracts for tenant isolation + cross-role access.
 *
 * Strict-rule audit
 *   • Pure data. SSR-safe. No engine imports.
 */

export const ENTERPRISE_SECURITY_VERSION = 'enterprise-security-v1';

export const ACCESS_VERDICT = Object.freeze({
  ALLOW: 'allow',
  DENY:  'deny',
});

export const SCOPE_REASON = Object.freeze({
  OK:                       'ok',
  MISSING_ORG_ID:           'missing_organizationId',
  ROLE_NOT_PERMITTED:       'role_not_permitted',
  CROSS_ORG_FORBIDDEN:      'cross_org_forbidden',
  NO_USER:                  'no_user',
  FAIL_CLOSED:              'fail_closed_default',
  INTERNAL_SCOPE_ONLY:      'internal_scope_only',
});

/** Roles that may read or write organization data. */
export const ORG_SCOPED_ROLES = Object.freeze([
  'organization_admin', 'ngo_admin', 'field_officer', 'admin',
]);

/** Roles that may ONLY read aggregate diagnostics across orgs. */
export const AGGREGATE_DIAGNOSTIC_ROLES = Object.freeze(['admin']);
