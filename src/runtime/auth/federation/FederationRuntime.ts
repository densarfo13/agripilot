/**
 * src/runtime/auth/federation/FederationRuntime.ts — Composite
 * facade that the API layer + login UI call into. Stitches
 * OIDC + Claim mapper + Org policy + audit emitters into one
 * frozen envelope per login attempt.
 *
 * Strict-rule audit
 *   • Pure runtime. SSR-safe. Never throws.
 *   • Fail-closed. Every uncertain path → DENY with a reason.
 *   • Never logs tokens / secrets / raw credentials.
 *   • Never auto-grants admin.
 */

import {
  FEDERATION_RUNTIME_VERSION, FED_VERDICT, FED_DENY_REASON,
  PERSISTENCE_KINDS,
} from './federationContracts';
import {
  validateOIDCConfig, buildAuthorizationURL, OIDC_RUNTIME_VERSION,
} from './OIDCRuntime';
import {
  samlSnapshot, SAML_RUNTIME_VERSION,
} from './SAMLRuntime';
import {
  mapClaimsToRole, mapEmailDomainToOrg, CLAIM_MAPPER_VERSION,
  ClaimRoleMapping,
} from './ClaimMapper';
import {
  evaluateLoginPolicy, evaluateJITProvision,
  ORG_FEDERATION_VERSION, OrganizationLoginPolicy,
} from './OrganizationFederation';

export { FEDERATION_RUNTIME_VERSION };

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr  = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

interface StartLoginCtx {
  providerType:  string;
  /** Caller-supplied provider config; runtime validates shape. */
  oidc?:         { issuer: string; clientId: string;
                    redirectUri: string; scope?: string;
                    codeChallenge?: string };
  /** Login policy for the user's organization (if any). */
  policy?:       Partial<OrganizationLoginPolicy>;
  /** Random opaque state — caller generates + stashes for callback. */
  state:         string;
}

/**
 * Begin a federated login. Returns either:
 *   { ok: true, authorizationUrl } — caller redirects there.
 *   { ok: false, reason } — caller surfaces the safe deny message.
 */
export function startFederatedLogin(ctx: StartLoginCtx) {
  return _safe(() => {
    if (!_isObj(ctx)) return _err(FED_DENY_REASON.FAIL_CLOSED);
    const providerType = _str(ctx.providerType);

    // Policy gate first.
    if (_isObj(ctx.policy)) {
      const p = evaluateLoginPolicy({
        policy: ctx.policy, providerType,
      }) as any;
      if (!p.allowed) return _err(_str(p.reason));
    }

    if (providerType === 'oidc' || providerType === 'microsoft_entra'
        || providerType === 'okta' || providerType === 'google') {
      const oidc = _isObj(ctx.oidc) ? ctx.oidc as any : null;
      if (!oidc) return _err(FED_DENY_REASON.PROVIDER_NOT_CONFIGURED);
      const v = validateOIDCConfig(oidc) as any;
      if (!v.ok) return _err(_str(v.reason));
      const url = buildAuthorizationURL({
        issuer:      _str(oidc.issuer),
        clientId:    _str(oidc.clientId),
        redirectUri: _str(oidc.redirectUri),
        state:       _str(ctx.state),
        scope:       _str(oidc.scope) || 'openid email profile',
        codeChallenge:        _str(oidc.codeChallenge) || undefined,
        codeChallengeMethod:  oidc.codeChallenge ? 'S256' : undefined,
      });
      if (!url) return _err(FED_DENY_REASON.PROVIDER_NOT_CONFIGURED);
      return Object.freeze({
        runtimeVersion: FEDERATION_RUNTIME_VERSION,
        ok: true, providerType,
        authorizationUrl: url,
        verdict: FED_VERDICT.ALLOW,
      });
    }
    if (providerType === 'saml') {
      // Placeholder runtime — always deny until a real
      // implementation lands.
      return _err(FED_DENY_REASON.PROVIDER_NOT_CONFIGURED);
    }
    if (providerType === 'local' || providerType === 'apple') {
      // Local + Apple flows are handled by their existing
      // auth surfaces, not this runtime.
      return Object.freeze({
        runtimeVersion: FEDERATION_RUNTIME_VERSION,
        ok: true, providerType,
        delegateTo: providerType,
        verdict: FED_VERDICT.ALLOW,
      });
    }
    return _err(FED_DENY_REASON.PROVIDER_DISABLED);
  }, _err(FED_DENY_REASON.FAIL_CLOSED));
}

function _err(reason: string) {
  return Object.freeze({
    runtimeVersion: FEDERATION_RUNTIME_VERSION,
    ok: false, reason,
    verdict: FED_VERDICT.DENY,
  });
}

interface CompleteLoginCtx {
  providerType:  string;
  /** Validated claims from the OIDC token response (caller
   *  performs the network exchange + signature verification). */
  claims:        Record<string, any>;
  /** Org mapping table the caller scoped by organizationId. */
  mappings:      ReadonlyArray<ClaimRoleMapping>;
  /** Org login policy. */
  policy?:       Partial<OrganizationLoginPolicy>;
  /** Whether a Farroway user already exists for this subject. */
  userExists:    boolean;
}

/**
 * Complete a federated login. Caller has already exchanged the
 * code for an ID token and verified the issuer signature. This
 * function maps claims → role + decides JIT provisioning.
 *
 * Returns the role to assign (NEVER admin) and the audit shape.
 */
export function completeFederatedLogin(ctx: CompleteLoginCtx) {
  return _safe(() => {
    if (!_isObj(ctx)) return _err(FED_DENY_REASON.FAIL_CLOSED);

    // Map claims → role.
    const m = mapClaimsToRole({
      claims:   _isObj(ctx.claims) ? ctx.claims : {},
      mappings: _arr(ctx.mappings) as ReadonlyArray<ClaimRoleMapping>,
      defaultRole: _str(ctx.policy && (ctx.policy as any).defaultRole),
    }) as any;

    if (ctx.userExists === true) {
      // Existing user — linking flow. Role on the existing user
      // wins; we DO NOT downgrade or upgrade based on claims.
      // The mapping result is INFORMATIONAL for the audit row.
      return Object.freeze({
        runtimeVersion: FEDERATION_RUNTIME_VERSION,
        ok: true, providerType: _str(ctx.providerType),
        operation: 'link_existing',
        suggestedRole: m.ok ? _str(m.role) : '',
        auditAction: 'federated_identity_linked',
        verdict: FED_VERDICT.ALLOW,
      });
    }

    // New user — must satisfy JIT policy.
    const j = evaluateJITProvision({
      policy:    _isObj(ctx.policy) ? ctx.policy : {},
      claimRole: m.ok ? _str(m.role) : '',
    }) as any;
    if (!j.allowed) return _err(_str(j.reason));

    return Object.freeze({
      runtimeVersion: FEDERATION_RUNTIME_VERSION,
      ok: true, providerType: _str(ctx.providerType),
      operation: 'jit_provision',
      role: _str(j.defaultRole),
      auditAction: 'jit_user_created',
      verdict: FED_VERDICT.ALLOW,
    });
  }, _err(FED_DENY_REASON.FAIL_CLOSED));
}

export function federationRuntimeSnapshot() {
  return Object.freeze({
    runtimeVersion: FEDERATION_RUNTIME_VERSION,
    failClosed:     true,
    /** Honest transparency until the federation Prisma stage
     *  deploys. */
    persistence:    PERSISTENCE_KINDS.IN_MEMORY,
    handlesClientSecrets: false,
    versions: Object.freeze({
      oidc:    OIDC_RUNTIME_VERSION,
      saml:    SAML_RUNTIME_VERSION,
      claim:   CLAIM_MAPPER_VERSION,
      org:     ORG_FEDERATION_VERSION,
    }),
  });
}

export { mapEmailDomainToOrg, samlSnapshot };
