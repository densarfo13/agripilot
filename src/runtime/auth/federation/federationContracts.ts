/**
 * src/runtime/auth/federation/federationContracts.ts — Frozen
 * contracts for the federation layer.
 *
 * Strict-rule audit
 *   • Pure data, no engine imports. SSR-safe.
 *   • Fail-closed by default.
 */

export const FEDERATION_RUNTIME_VERSION = 'farroway-federation-runtime-v1';

export const PROVIDER_TYPES = Object.freeze([
  'oidc',
  'saml',
  'google',
  'apple',
  'microsoft_entra',
  'okta',
  'local',          // email/password (always-on for growers)
] as const);
export type ProviderType = (typeof PROVIDER_TYPES)[number];

/** Roles that CAN be assigned by claim mapping. Admin is never
 *  in this list — admin must be granted explicitly via the
 *  RBAC runtime, not by an external claim. */
export const CLAIM_ASSIGNABLE_ROLES = Object.freeze([
  'farmer', 'gardener', 'grower', 'buyer',
  'field_officer', 'ngo_admin', 'organization_viewer',
] as const);
export type ClaimAssignableRole = (typeof CLAIM_ASSIGNABLE_ROLES)[number];

/** Roles that MUST NEVER be assigned from a claim. */
export const NEVER_FROM_CLAIM_ROLES = Object.freeze([
  'admin', 'organization_admin',
]);

export const FEDERATION_AUDIT_EVENTS = Object.freeze([
  'federation_provider_created',
  'federation_provider_updated',
  'federated_login_success',
  'federated_login_failed',
  'jit_user_created',
  'federated_identity_linked',
  'claim_role_mapping_created',
  'role_assigned_from_claim',
  'sso_access_denied',
]);

/** Fields engines must NEVER persist on a federation record. */
export const FEDERATION_PII_DROP_LIST = Object.freeze([
  'password', 'rawToken', 'accessToken', 'refreshToken',
  'idToken', 'clientSecret', 'sessionCookie',
  'authorizationHeader', 'apiKey',
]);

/** Verdict shape returned by every fail-closed federation API. */
export const FED_VERDICT = Object.freeze({
  ALLOW: 'allow',
  DENY:  'deny',
});

export const FED_DENY_REASON = Object.freeze({
  PROVIDER_DISABLED:       'provider_disabled',
  PROVIDER_NOT_CONFIGURED: 'provider_not_configured',
  ISSUER_INVALID:          'issuer_invalid',
  CLIENT_ID_MISSING:       'client_id_missing',
  ORGANIZATION_REQUIRES_SSO:'organization_requires_sso',
  JIT_DISABLED:            'jit_disabled_no_account',
  UNKNOWN_CLAIM:           'unknown_claim_no_default_role',
  CROSS_ORG_FORBIDDEN:     'cross_org_forbidden',
  FAIL_CLOSED:             'fail_closed',
});

/** PRISMA: types referenced by the server-side write surface.
 *  The runtime tolerates either in-memory snapshots or
 *  Prisma-backed shapes — the field names match. */
export const PERSISTENCE_KINDS = Object.freeze({
  IN_MEMORY: 'in_memory',
  PRISMA:    'prisma',
});
