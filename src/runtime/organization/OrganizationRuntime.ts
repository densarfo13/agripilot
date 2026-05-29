/**
 * src/runtime/organization/OrganizationRuntime.ts — NGO
 * organization membership runtime. Composes on top of the
 * admin Organization record store; adds member-role
 * management scoped per-organization.
 *
 * Strict-rule audit
 *   • Pure runtime. Frozen envelopes. Never throws.
 *   • organizationScoped: every read takes an organizationId
 *     and fails closed when it's missing.
 *   • No cross-org aggregation.
 *   • No PII surfaced.
 */

import {
  ORGANIZATION_DASHBOARD_VERSION, MEMBER_ROLES,
} from './organizationContracts';

export const ORGANIZATION_RUNTIME_VERSION =
  'organization-runtime-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

const _validRoles = new Set<string>(MEMBER_ROLES as readonly string[]);

export interface OrganizationMember {
  id:             string;
  organizationId: string;
  userId:         string;
  role:           string;
  createdAt:      string;
  updatedAt:      string;
}

const _members: Record<string, OrganizationMember> = Object.create(null);

function _hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function _envelope(ok: boolean, record: OrganizationMember | null, reason = '') {
  return Object.freeze({
    runtimeVersion: ORGANIZATION_RUNTIME_VERSION,
    ok, reason,
    record: record ? Object.freeze({ ...record }) : null,
  });
}

interface UpsertCtx {
  organizationId: string;
  userId:         string;
  role:           string;
}

export function upsertOrganizationMember(ctx: UpsertCtx) {
  return _safe(() => {
    if (!_isObj(ctx)) return _envelope(false, null, 'invalid_context');
    const organizationId = _str(ctx.organizationId);
    const userId         = _str(ctx.userId);
    const role           = _str(ctx.role);
    if (!organizationId) return _envelope(false, null, 'organizationId_required');
    if (!userId)         return _envelope(false, null, 'userId_required');
    if (!_validRoles.has(role)) return _envelope(false, null, 'invalid_role');
    const id = 'member_' + _hash(organizationId + '|' + userId);
    const now = _now();
    const existing = _members[id];
    const record: OrganizationMember = Object.freeze({
      id, organizationId, userId, role,
      createdAt: (existing && existing.createdAt) || now,
      updatedAt: now,
    });
    _members[id] = record;
    return _envelope(true, record);
  }, _envelope(false, null, 'error'));
}

/** Scoped: lists members of ONE organization. Fails closed. */
export function listMembers(organizationId: string)
    : ReadonlyArray<OrganizationMember> {
  return _safe(() => {
    const orgId = _str(organizationId);
    if (!orgId) return Object.freeze([] as OrganizationMember[]);
    const pool = Object.values(_members)
      .filter((m) => m.organizationId === orgId);
    return Object.freeze(pool.map((m) => Object.freeze({ ...m })));
  }, Object.freeze([] as OrganizationMember[]));
}

/** Scoped: returns the member's role inside ONE org, or null. */
export function findMemberRole(
  organizationId: string,
  userId: string,
): string | null {
  return _safe(() => {
    const orgId = _str(organizationId);
    const uid   = _str(userId);
    if (!orgId || !uid) return null;
    const id = 'member_' + _hash(orgId + '|' + uid);
    const rec = _members[id];
    return rec ? rec.role : null;
  }, null);
}

/** Scoped snapshot — counts members by role for ONE org. */
export function organizationSnapshot(organizationId: string) {
  return _safe(() => {
    const orgId = _str(organizationId);
    if (!orgId) {
      return Object.freeze({
        runtimeVersion: ORGANIZATION_RUNTIME_VERSION,
        organizationId: '',
        total: 0,
        byRole: Object.freeze({} as Record<string, number>),
        organizationScoped: true,
        fakeMetrics: false,
        reason: 'organizationId_required',
      });
    }
    const pool = Object.values(_members)
      .filter((m) => m.organizationId === orgId);
    const byRole: Record<string, number> = {};
    for (const r of MEMBER_ROLES) byRole[r] = 0;
    for (const m of pool) {
      byRole[m.role] = (byRole[m.role] || 0) + 1;
    }
    return Object.freeze({
      runtimeVersion: ORGANIZATION_RUNTIME_VERSION,
      organizationId: orgId,
      total: pool.length,
      byRole: Object.freeze(byRole),
      organizationScoped: true,
      fakeMetrics: false,
      reason: '',
    });
  }, Object.freeze({
    runtimeVersion: ORGANIZATION_RUNTIME_VERSION,
    organizationId: '',
    total: 0,
    byRole: Object.freeze({} as Record<string, number>),
    organizationScoped: true,
    fakeMetrics: false,
    reason: 'error',
  }));
}

export { ORGANIZATION_DASHBOARD_VERSION };

/** Test-only — wipe. */
export function _resetOrganizationMembers() {
  for (const k of Object.keys(_members)) delete _members[k];
}
