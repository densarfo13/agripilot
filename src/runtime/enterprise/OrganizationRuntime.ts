/**
 * src/runtime/enterprise/OrganizationRuntime.ts — Organization
 * state engine.
 *
 *   import {
 *     normalizeOrganization, addMember, listMembersFor,
 *     getMemberRole, canMemberWrite,
 *     ORGANIZATION_RUNTIME_VERSION,
 *   } from 'src/runtime/enterprise/OrganizationRuntime';
 *
 * What this is
 * ────────────
 *   Pure functional helpers over caller-owned organization +
 *   member lists. Engines never persist; the route layer (when
 *   the Prisma migration ships) handles writes through the
 *   wave-5 single-writer.
 *
 *   Composition-only. Frozen returns. SSR-safe.
 */

import {
  ORG_TYPES, ORG_STATUSES, ORG_ROLES, ROLES_THAT_CAN_WRITE,
} from './enterpriseContracts';

export const ORGANIZATION_RUNTIME_VERSION = 'organization-runtime-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

const VALID_TYPES   = new Set(Object.values(ORG_TYPES));
const VALID_STATUS  = new Set(Object.values(ORG_STATUSES));
const VALID_ROLES   = new Set(Object.values(ORG_ROLES));

export function normalizeOrganization(raw: unknown) {
  return _safe(() => {
    if (!_isObj(raw)) return null;
    const type   = _str(raw.type).toUpperCase();
    const status = _str(raw.status).toLowerCase();
    return Object.freeze({
      id:        _str(raw.id),
      name:      _str(raw.name),
      type:      VALID_TYPES.has(type)   ? type   : ORG_TYPES.INTERNAL,
      country:   _str(raw.country),
      region:    _str(raw.region),
      status:    VALID_STATUS.has(status) ? status : ORG_STATUSES.PILOT,
      createdAt: _str(raw.createdAt) || _now(),
      updatedAt: _str(raw.updatedAt) || _now(),
    });
  }, null);
}

export function normalizeMember(raw: unknown) {
  return _safe(() => {
    if (!_isObj(raw)) return null;
    const role = _str(raw.role).toLowerCase();
    return Object.freeze({
      id:             _str(raw.id),
      organizationId: _str(raw.organizationId),
      userId:         _str(raw.userId),
      role:           VALID_ROLES.has(role) ? role : ORG_ROLES.VIEWER,
      createdAt:      _str(raw.createdAt) || _now(),
      updatedAt:      _str(raw.updatedAt) || _now(),
    });
  }, null);
}

export function listMembersFor(members: unknown[], organizationId: string) {
  return _safe(() => {
    return Object.freeze(_arr(members)
      .map(normalizeMember)
      .filter((m): m is NonNullable<typeof m> =>
        m != null && m.organizationId === organizationId));
  }, Object.freeze([]));
}

export function getMemberRole(members: unknown[],
                                organizationId: string,
                                userId: string): string {
  return _safe(() => {
    if (!organizationId || !userId) return '';
    const list = _arr(members).map(normalizeMember).filter(Boolean);
    const hit  = (list as any[]).find((m) =>
      m && m.organizationId === organizationId && m.userId === userId);
    return hit ? hit.role : '';
  }, '');
}

export function canMemberWrite(role: string): boolean {
  if (!role) return false;
  return ROLES_THAT_CAN_WRITE.indexOf(role) !== -1;
}

export function addMember(members: unknown[], member: any) {
  return _safe(() => {
    const normalized = normalizeMember(member);
    if (!normalized) return Object.freeze(_arr(members).slice());
    const existing = _arr(members)
      .map(normalizeMember)
      .filter(Boolean) as any[];
    // Dedupe by (organizationId, userId)
    const filtered = existing.filter((m) =>
      !(m.organizationId === normalized.organizationId
        && m.userId === normalized.userId));
    return Object.freeze(filtered.concat([normalized]));
  }, Object.freeze(_arr(members).slice()));
}
