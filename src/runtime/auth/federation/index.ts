/**
 * src/runtime/auth/federation/index.ts — Barrel.
 */

export {
  FEDERATION_RUNTIME_VERSION, PROVIDER_TYPES,
  CLAIM_ASSIGNABLE_ROLES, NEVER_FROM_CLAIM_ROLES,
  FEDERATION_AUDIT_EVENTS, FEDERATION_PII_DROP_LIST,
  FED_VERDICT, FED_DENY_REASON, PERSISTENCE_KINDS,
} from './federationContracts';

export {
  validateOIDCConfig, buildAuthorizationURL, oidcSnapshot,
  OIDC_RUNTIME_VERSION,
} from './OIDCRuntime';
export type { OIDCProviderConfig } from './OIDCRuntime';

export {
  samlSnapshot, SAML_RUNTIME_VERSION,
} from './SAMLRuntime';

export {
  mapClaimsToRole, mapEmailDomainToOrg, claimMapperSnapshot,
  CLAIM_MAPPER_VERSION,
} from './ClaimMapper';
export type { ClaimRoleMapping } from './ClaimMapper';

export {
  evaluateLoginPolicy, evaluateJITProvision,
  orgFederationSnapshot, ORG_FEDERATION_VERSION,
} from './OrganizationFederation';
export type { OrganizationLoginPolicy } from './OrganizationFederation';

export {
  startFederatedLogin, completeFederatedLogin,
  federationRuntimeSnapshot,
} from './FederationRuntime';

export {
  federationHealth, installFederationGlobal,
} from './FederationDiagnostics';
