/**
 * src/runtime/auth/federation/ClaimMapper.ts — Maps OIDC /
 * SAML claims to Farroway roles + organization context.
 *
 *   import {
 *     mapClaimsToRole, mapEmailDomainToOrg,
 *     CLAIM_MAPPER_VERSION,
 *   } from 'src/runtime/auth/federation/ClaimMapper';
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Fail-closed: unknown role names and admin-equivalents
 *     never get assigned.
 *   • Admin / organization_admin can NEVER be assigned from a
 *     claim — the contract enforces this via NEVER_FROM_CLAIM_ROLES.
 */

import {
  CLAIM_ASSIGNABLE_ROLES, NEVER_FROM_CLAIM_ROLES,
  FED_VERDICT, FED_DENY_REASON,
} from './federationContracts';

export const CLAIM_MAPPER_VERSION = 'claim-mapper-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr  = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

const _assignable = new Set<string>(CLAIM_ASSIGNABLE_ROLES as readonly string[]);
const _never      = new Set<string>(NEVER_FROM_CLAIM_ROLES as readonly string[]);

export interface ClaimRoleMapping {
  organizationId:  string;
  providerId?:     string;
  claimName:       string;   // e.g. "groups", "role"
  claimValue:      string;   // e.g. "Farroway-NGO-Admin"
  role:            string;   // target Farroway role
}

interface MapCtx {
  /** Raw provider claims after validation. */
  claims:        Record<string, any>;
  /** Org-scoped mapping table. */
  mappings:      ReadonlyArray<ClaimRoleMapping>;
  /** Default role from OrganizationLoginPolicy (optional). */
  defaultRole?:  string;
}

interface MapResult {
  ok:            boolean;
  role:          string;
  reason:        string;
  matchedClaim?: string;
  matchedValue?: string;
}

/**
 * Walk the org's claim-mapping table looking for a match
 * inside the provider's claims. If multiple match, the FIRST
 * mapping wins (org admin orders them by priority). Returns
 * the default role only when no claim matches AND the default
 * itself is assignable.
 */
export function mapClaimsToRole(ctx: MapCtx): MapResult {
  return _safe<MapResult>(() => {
    if (!_isObj(ctx)) {
      return _r(false, '', FED_DENY_REASON.UNKNOWN_CLAIM);
    }
    const claims   = _isObj(ctx.claims) ? ctx.claims : {};
    const mappings = _arr(ctx.mappings);

    for (const mapping of mappings) {
      if (!_isObj(mapping)) continue;
      const role = _str((mapping as any).role);
      if (!_assignable.has(role) || _never.has(role)) {
        // Defensive — the gate / API already rejects mappings
        // that point at admin, but the runtime double-checks.
        continue;
      }
      const cName  = _str((mapping as any).claimName);
      const cValue = _str((mapping as any).claimValue);
      if (!cName || !cValue) continue;
      const incoming = (claims as any)[cName];
      const incomingValues = _arr(incoming).length > 0
        ? _arr(incoming).map(_str)
        : [_str(incoming)];
      if (incomingValues.indexOf(cValue) >= 0) {
        return _r(true, role, '', cName, cValue);
      }
    }

    // No claim matched — fall through to the policy default.
    const def = _str(ctx.defaultRole);
    if (def && _assignable.has(def) && !_never.has(def)) {
      return _r(true, def, '');
    }
    return _r(false, '', FED_DENY_REASON.UNKNOWN_CLAIM);
  }, _r(false, '', FED_DENY_REASON.FAIL_CLOSED));
}

function _r(ok: boolean, role: string, reason: string,
             matchedClaim?: string, matchedValue?: string): MapResult {
  return Object.freeze({
    runtimeVersion: CLAIM_MAPPER_VERSION,
    ok, role, reason,
    matchedClaim, matchedValue,
    verdict: ok ? FED_VERDICT.ALLOW : FED_VERDICT.DENY,
  }) as unknown as MapResult;
}

/**
 * Map an email domain → organizationId via the org policy
 * table. Used when a user lands on the org login page and
 * enters an email; we pick the matching provider.
 */
export function mapEmailDomainToOrg(email: string,
                                      domainPolicies: ReadonlyArray<{ domain: string; organizationId: string }>) {
  return _safe(() => {
    const at = _str(email).indexOf('@');
    if (at < 0) return Object.freeze({
      runtimeVersion: CLAIM_MAPPER_VERSION,
      ok: false, organizationId: '', reason: 'no_domain',
    });
    const domain = _str(email).slice(at + 1).toLowerCase();
    for (const p of _arr(domainPolicies)) {
      if (!_isObj(p)) continue;
      if (_str(p.domain).toLowerCase() === domain && _str(p.organizationId)) {
        return Object.freeze({
          runtimeVersion: CLAIM_MAPPER_VERSION,
          ok: true, organizationId: _str(p.organizationId), reason: '',
        });
      }
    }
    return Object.freeze({
      runtimeVersion: CLAIM_MAPPER_VERSION,
      ok: false, organizationId: '', reason: 'no_match',
    });
  }, Object.freeze({
    runtimeVersion: CLAIM_MAPPER_VERSION,
    ok: false, organizationId: '', reason: 'error',
  }));
}

export function claimMapperSnapshot() {
  return Object.freeze({
    runtimeVersion: CLAIM_MAPPER_VERSION,
    assignableRoles: CLAIM_ASSIGNABLE_ROLES,
    neverFromClaim:  NEVER_FROM_CLAIM_ROLES,
    failClosed:      true,
  });
}
