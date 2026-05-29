/**
 * src/runtime/auth/federation/OrganizationFederation.ts —
 * Per-organization federation policy + JIT provisioning
 * decision engine.
 *
 *   evaluateLoginPolicy(ctx) → { allowed, reason, mode }
 *   evaluateJITProvision(ctx) → { allowed, defaultRole, reason }
 *
 * Strict-rule audit
 *   • Pure runtime. SSR-safe. Never throws.
 *   • Fail-closed by default — missing inputs deny.
 *   • Never auto-grants admin via JIT — admin must be assigned
 *     by an existing admin, not the federation flow.
 */

import {
  CLAIM_ASSIGNABLE_ROLES, NEVER_FROM_CLAIM_ROLES,
  FED_VERDICT, FED_DENY_REASON,
} from './federationContracts';

export const ORG_FEDERATION_VERSION = 'org-federation-runtime-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr  = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

const _assignable = new Set<string>(CLAIM_ASSIGNABLE_ROLES as readonly string[]);
const _never      = new Set<string>(NEVER_FROM_CLAIM_ROLES as readonly string[]);

export interface OrganizationLoginPolicy {
  organizationId:        string;
  allowedProviders:      ReadonlyArray<string>; // 'oidc' | 'google' | etc.
  requireSso:            boolean;
  allowLocalFallback:    boolean;
  jitProvisioning:       boolean;
  defaultRole:           string;
}

interface LoginPolicyCtx {
  policy:      Partial<OrganizationLoginPolicy>;
  providerType: string;
  /** If true, the user is already known + has a local password. */
  hasLocalAccount?: boolean;
}

interface LoginPolicyResult {
  allowed: boolean;
  reason:  string;
  mode:    'sso_required' | 'sso_or_local' | 'local_only' | 'denied';
}

/**
 * Decide whether the requested provider + organization combo
 * is allowed for this login attempt.
 */
export function evaluateLoginPolicy(ctx: LoginPolicyCtx): LoginPolicyResult {
  return _safe<LoginPolicyResult>(() => {
    if (!_isObj(ctx) || !_isObj(ctx.policy)) {
      return _l(false, FED_DENY_REASON.FAIL_CLOSED, 'denied');
    }
    const policy: any = ctx.policy;
    const provider = _str(ctx.providerType);
    const allowed = _arr(policy.allowedProviders).map(_str);

    if (provider !== 'local' && allowed.indexOf(provider) < 0) {
      return _l(false, FED_DENY_REASON.PROVIDER_DISABLED, 'denied');
    }
    if (provider === 'local') {
      if (policy.requireSso === true && policy.allowLocalFallback !== true) {
        return _l(false, FED_DENY_REASON.ORGANIZATION_REQUIRES_SSO, 'sso_required');
      }
      if (policy.requireSso === true) return _l(true, '', 'sso_or_local');
      return _l(true, '', 'local_only');
    }
    return _l(true, '', policy.requireSso === true ? 'sso_required' : 'sso_or_local');
  }, _l(false, FED_DENY_REASON.FAIL_CLOSED, 'denied'));
}

function _l(allowed: boolean, reason: string,
             mode: LoginPolicyResult['mode']): LoginPolicyResult {
  return Object.freeze({
    runtimeVersion: ORG_FEDERATION_VERSION,
    allowed, reason, mode,
    verdict: allowed ? FED_VERDICT.ALLOW : FED_VERDICT.DENY,
  }) as unknown as LoginPolicyResult;
}

interface JITCtx {
  policy:        Partial<OrganizationLoginPolicy>;
  /** Role candidate from claim mapping (already filtered). */
  claimRole?:    string;
}

interface JITResult {
  allowed:      boolean;
  defaultRole:  string;
  reason:       string;
}

/**
 * Decide whether a new user should be provisioned for the
 * federated login. Returns the role to assign — NEVER admin.
 */
export function evaluateJITProvision(ctx: JITCtx): JITResult {
  return _safe<JITResult>(() => {
    if (!_isObj(ctx) || !_isObj(ctx.policy)) {
      return _j(false, '', FED_DENY_REASON.FAIL_CLOSED);
    }
    if (ctx.policy.jitProvisioning !== true) {
      return _j(false, '', FED_DENY_REASON.JIT_DISABLED);
    }
    const claimRole = _str(ctx.claimRole);
    const policyDefault = _str(ctx.policy.defaultRole);
    const candidate = claimRole || policyDefault;
    if (!candidate) return _j(false, '', FED_DENY_REASON.UNKNOWN_CLAIM);
    if (!_assignable.has(candidate) || _never.has(candidate)) {
      // Defensive — the runtime refuses to provision a user
      // into a role that the contract bans from claims.
      return _j(false, '', FED_DENY_REASON.UNKNOWN_CLAIM);
    }
    return _j(true, candidate, '');
  }, _j(false, '', FED_DENY_REASON.FAIL_CLOSED));
}

function _j(allowed: boolean, defaultRole: string,
             reason: string): JITResult {
  return Object.freeze({
    runtimeVersion: ORG_FEDERATION_VERSION,
    allowed, defaultRole, reason,
    verdict: allowed ? FED_VERDICT.ALLOW : FED_VERDICT.DENY,
  }) as unknown as JITResult;
}

export function orgFederationSnapshot() {
  return Object.freeze({
    runtimeVersion:    ORG_FEDERATION_VERSION,
    jitProvisioningReady: true,
    failClosed:        true,
    neverAutoAdmin:    true,
    assignableRoles:   CLAIM_ASSIGNABLE_ROLES,
  });
}
