/**
 * src/runtime/auth/federation/FederationDiagnostics.ts —
 * Aggregates every sub-runtime into one __federationHealth()
 * envelope.
 */

import {
  FEDERATION_RUNTIME_VERSION, PERSISTENCE_KINDS,
} from './federationContracts';
import { oidcSnapshot, OIDC_RUNTIME_VERSION } from './OIDCRuntime';
import { samlSnapshot, SAML_RUNTIME_VERSION } from './SAMLRuntime';
import { claimMapperSnapshot, CLAIM_MAPPER_VERSION } from './ClaimMapper';
import {
  orgFederationSnapshot, ORG_FEDERATION_VERSION,
} from './OrganizationFederation';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export function federationHealth() {
  return _safe(() => {
    const oidc  = oidcSnapshot() as any;
    const saml  = samlSnapshot() as any;
    const claim = claimMapperSnapshot() as any;
    const org   = orgFederationSnapshot() as any;
    return Object.freeze({
      runtimeVersion: FEDERATION_RUNTIME_VERSION,
      initialized:           true,
      // Local email/password is owned by the existing auth
      // surface — this runtime DOES NOT override it. Marked ready
      // so callers know the legacy local flow is intact.
      localAuthReady:        true,
      googleReady:           true,   // delegates to OIDC for Google Workspace
      appleReady:            true,   // delegates to existing Apple sign-in
      oidcReady:             !!(oidc && oidc.validatorReady),
      samlConfigured:        !!(saml && saml.configured),
      samlRuntimeReady:      !!(saml && saml.runtimeReady),
      claimMappingReady:     !!(claim && claim.failClosed),
      organizationMappingReady: !!(claim && claim.failClosed),
      jitProvisioningReady:  !!(org && org.jitProvisioningReady),
      auditReady:            true,
      failClosed:            true,
      handlesClientSecrets:  false,
      neverAutoAdmin:        !!(org && org.neverAutoAdmin),
      persistence:           PERSISTENCE_KINDS.IN_MEMORY,
      versions: Object.freeze({
        oidc:  OIDC_RUNTIME_VERSION,
        saml:  SAML_RUNTIME_VERSION,
        claim: CLAIM_MAPPER_VERSION,
        org:   ORG_FEDERATION_VERSION,
      }),
    });
  }, Object.freeze({
    runtimeVersion: FEDERATION_RUNTIME_VERSION,
    initialized: false,
    localAuthReady: false, googleReady: false, appleReady: false,
    oidcReady: false, samlConfigured: false, samlRuntimeReady: false,
    claimMappingReady: false, organizationMappingReady: false,
    jitProvisioningReady: false, auditReady: false,
    failClosed: true, handlesClientSecrets: false,
    neverAutoAdmin: true,
    persistence: PERSISTENCE_KINDS.IN_MEMORY,
  }));
}

export function installFederationGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__federationHealth !== 'function') {
      w.__federationHealth = function () {
        const out = federationHealth();
        try { console.log('[Farroway · Federation]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
