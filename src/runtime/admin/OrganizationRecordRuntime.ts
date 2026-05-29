/**
 * src/runtime/admin/OrganizationRecordRuntime.ts — Organization /
 * Program / ProgramEnrollment / Intervention /
 * InterventionParticipant record runtime.
 *
 *   Composes the prior Enterprise Runtime — this layer adds the
 *   spec'd record shapes + lightweight in-memory store the
 *   Founder dashboard can read until the pending Prisma
 *   migration deploys.
 */

import {
  ORG_TYPES, ORG_STATUSES, PROGRAM_STATUSES,
  ENROLLMENT_STATUSES, INTERVENTION_TYPES,
  INTERVENTION_STATUSES, PARTICIPANT_STATUSES,
} from './adminImpactContracts';

export const ORG_RECORD_RUNTIME_VERSION = 'organization-record-runtime-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

function _hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const _validOrgType    = new Set<string>(ORG_TYPES as readonly string[]);
const _validOrgStatus  = new Set<string>(ORG_STATUSES as readonly string[]);
const _validProgStatus = new Set<string>(PROGRAM_STATUSES as readonly string[]);
const _validEnrollStatus = new Set<string>(ENROLLMENT_STATUSES as readonly string[]);
const _validIntType    = new Set<string>(INTERVENTION_TYPES as readonly string[]);
const _validIntStatus  = new Set<string>(INTERVENTION_STATUSES as readonly string[]);
const _validPartStatus = new Set<string>(PARTICIPANT_STATUSES as readonly string[]);

interface Organization {
  id: string; name: string; type: string;
  country?: string; region?: string;
  status: string; createdAt: string; updatedAt: string;
}
interface Program {
  id: string; organizationId: string; name: string;
  cropFocus?: string; region?: string; district?: string;
  status: string; startDate?: string; endDate?: string;
  createdAt: string; updatedAt: string;
}
interface ProgramEnrollment {
  id: string; programId: string; userId: string;
  farmId?: string; status: string;
  joinedAt: string; createdAt: string; updatedAt: string;
}
interface Intervention {
  id: string; organizationId: string; programId?: string;
  name: string; type: string; status: string;
  plannedDate?: string; completedDate?: string;
  createdAt: string; updatedAt: string;
}
interface InterventionParticipant {
  id: string; interventionId: string; userId: string;
  farmId?: string; status: string;
  notes?: string; evidencePhotoUrl?: string;
  completedAt?: string; createdAt: string; updatedAt: string;
}

const _orgs:          Record<string, Organization>            = Object.create(null);
const _programs:      Record<string, Program>                 = Object.create(null);
const _enrollments:   Record<string, ProgramEnrollment>       = Object.create(null);
const _interventions: Record<string, Intervention>            = Object.create(null);
const _participants:  Record<string, InterventionParticipant> = Object.create(null);

function _envelope(ok: boolean, record: any, reason = '') {
  return Object.freeze({
    runtimeVersion: ORG_RECORD_RUNTIME_VERSION,
    ok, reason, record: record ? Object.freeze({ ...record }) : null,
  });
}

/* ── Organization ───────────────────────────────────────── */
export function upsertOrganization(ctx: Partial<Organization>) {
  return _safe(() => {
    if (!_isObj(ctx)) return _envelope(false, null, 'invalid_context');
    const name = _str(ctx.name);
    const type = _str(ctx.type);
    if (!name) return _envelope(false, null, 'name_required');
    if (!_validOrgType.has(type)) return _envelope(false, null, 'invalid_type');
    const status = _str(ctx.status) || 'pilot';
    if (!_validOrgStatus.has(status)) return _envelope(false, null, 'invalid_status');
    const id = _str(ctx.id) || ('org_' + _hash(name + '|' + type));
    const now = _now();
    const existing = _orgs[id];
    const record: Organization = Object.freeze({
      id, name, type, status,
      country: _str(ctx.country) || undefined,
      region:  _str(ctx.region)  || undefined,
      createdAt: (existing && existing.createdAt) || now,
      updatedAt: now,
    });
    _orgs[id] = record;
    return _envelope(true, record);
  }, _envelope(false, null, 'error'));
}

/* ── Program ────────────────────────────────────────────── */
export function upsertProgram(ctx: Partial<Program>) {
  return _safe(() => {
    if (!_isObj(ctx)) return _envelope(false, null, 'invalid_context');
    const organizationId = _str(ctx.organizationId);
    const name = _str(ctx.name);
    if (!organizationId) return _envelope(false, null, 'organizationId_required');
    if (!name)           return _envelope(false, null, 'name_required');
    const status = _str(ctx.status) || 'draft';
    if (!_validProgStatus.has(status)) return _envelope(false, null, 'invalid_status');
    const id = _str(ctx.id)
      || ('program_' + _hash(organizationId + '|' + name));
    const now = _now();
    const existing = _programs[id];
    const record: Program = Object.freeze({
      id, organizationId, name, status,
      cropFocus: _str(ctx.cropFocus) || undefined,
      region:    _str(ctx.region)    || undefined,
      district:  _str(ctx.district)  || undefined,
      startDate: _str(ctx.startDate) || undefined,
      endDate:   _str(ctx.endDate)   || undefined,
      createdAt: (existing && existing.createdAt) || now,
      updatedAt: now,
    });
    _programs[id] = record;
    return _envelope(true, record);
  }, _envelope(false, null, 'error'));
}

/* ── ProgramEnrollment ──────────────────────────────────── */
export function upsertProgramEnrollment(ctx: Partial<ProgramEnrollment>) {
  return _safe(() => {
    if (!_isObj(ctx)) return _envelope(false, null, 'invalid_context');
    const programId = _str(ctx.programId);
    const userId    = _str(ctx.userId);
    if (!programId || !userId) {
      return _envelope(false, null, 'programId_and_userId_required');
    }
    const status = _str(ctx.status) || 'invited';
    if (!_validEnrollStatus.has(status)) {
      return _envelope(false, null, 'invalid_status');
    }
    const id = _str(ctx.id)
      || ('enrollment_' + _hash(programId + '|' + userId));
    const now = _now();
    const existing = _enrollments[id];
    const record: ProgramEnrollment = Object.freeze({
      id, programId, userId, status,
      farmId:   _str(ctx.farmId) || undefined,
      joinedAt: (existing && existing.joinedAt) || now,
      createdAt: (existing && existing.createdAt) || now,
      updatedAt: now,
    });
    _enrollments[id] = record;
    return _envelope(true, record);
  }, _envelope(false, null, 'error'));
}

/* ── Intervention ───────────────────────────────────────── */
export function upsertIntervention(ctx: Partial<Intervention>) {
  return _safe(() => {
    if (!_isObj(ctx)) return _envelope(false, null, 'invalid_context');
    const organizationId = _str(ctx.organizationId);
    const name = _str(ctx.name);
    const type = _str(ctx.type);
    if (!organizationId) return _envelope(false, null, 'organizationId_required');
    if (!name)           return _envelope(false, null, 'name_required');
    if (!_validIntType.has(type))   return _envelope(false, null, 'invalid_type');
    const status = _str(ctx.status) || 'planned';
    if (!_validIntStatus.has(status)) return _envelope(false, null, 'invalid_status');
    const id = _str(ctx.id)
      || ('intervention_' + _hash(organizationId + '|' + name));
    const now = _now();
    const existing = _interventions[id];
    const record: Intervention = Object.freeze({
      id, organizationId, name, type, status,
      programId:     _str(ctx.programId)     || undefined,
      plannedDate:   _str(ctx.plannedDate)   || undefined,
      completedDate: _str(ctx.completedDate) || undefined,
      createdAt: (existing && existing.createdAt) || now,
      updatedAt: now,
    });
    _interventions[id] = record;
    return _envelope(true, record);
  }, _envelope(false, null, 'error'));
}

/* ── InterventionParticipant ────────────────────────────── */
export function upsertInterventionParticipant(ctx: Partial<InterventionParticipant>) {
  return _safe(() => {
    if (!_isObj(ctx)) return _envelope(false, null, 'invalid_context');
    const interventionId = _str(ctx.interventionId);
    const userId         = _str(ctx.userId);
    if (!interventionId || !userId) {
      return _envelope(false, null, 'interventionId_and_userId_required');
    }
    const status = _str(ctx.status) || 'assigned';
    if (!_validPartStatus.has(status)) {
      return _envelope(false, null, 'invalid_status');
    }
    const id = _str(ctx.id)
      || ('part_' + _hash(interventionId + '|' + userId));
    const now = _now();
    const existing = _participants[id];
    const record: InterventionParticipant = Object.freeze({
      id, interventionId, userId, status,
      farmId:           _str(ctx.farmId)           || undefined,
      notes:            _str(ctx.notes)            || undefined,
      evidencePhotoUrl: _str(ctx.evidencePhotoUrl) || undefined,
      completedAt:      _str(ctx.completedAt)      || undefined,
      createdAt: (existing && existing.createdAt) || now,
      updatedAt: now,
    });
    _participants[id] = record;
    return _envelope(true, record);
  }, _envelope(false, null, 'error'));
}

/* ── Read helpers ───────────────────────────────────────── */
export function listOrganizations(): ReadonlyArray<Organization> {
  return _safe(() => Object.freeze(Object.values(_orgs).map((o) =>
    Object.freeze({ ...o }))), Object.freeze([] as Organization[]));
}
export function listPrograms(opts?: { organizationId?: string }): ReadonlyArray<Program> {
  return _safe(() => {
    const o = _isObj(opts) ? opts as any : {};
    let pool = Object.values(_programs);
    if (_str(o.organizationId)) {
      pool = pool.filter((p) => p.organizationId === o.organizationId);
    }
    return Object.freeze(pool.map((p) => Object.freeze({ ...p })));
  }, Object.freeze([] as Program[]));
}
export function listInterventions(opts?: { organizationId?: string }):
    ReadonlyArray<Intervention> {
  return _safe(() => {
    const o = _isObj(opts) ? opts as any : {};
    let pool = Object.values(_interventions);
    if (_str(o.organizationId)) {
      pool = pool.filter((i) => i.organizationId === o.organizationId);
    }
    return Object.freeze(pool.map((i) => Object.freeze({ ...i })));
  }, Object.freeze([] as Intervention[]));
}

export function organizationRecordSnapshot() {
  return _safe(() => Object.freeze({
    runtimeVersion: ORG_RECORD_RUNTIME_VERSION,
    organizations: Object.keys(_orgs).length,
    activeOrganizations: Object.values(_orgs)
      .filter((o) => o.status === 'active').length,
    programs:    Object.keys(_programs).length,
    activePrograms: Object.values(_programs)
      .filter((p) => p.status === 'active').length,
    enrollments: Object.keys(_enrollments).length,
    activeEnrollments: Object.values(_enrollments)
      .filter((e) => e.status === 'active').length,
    interventions: Object.keys(_interventions).length,
    completedInterventions: Object.values(_interventions)
      .filter((i) => i.status === 'completed').length,
    participants: Object.keys(_participants).length,
  }), Object.freeze({
    runtimeVersion: ORG_RECORD_RUNTIME_VERSION,
    organizations: 0, activeOrganizations: 0,
    programs: 0, activePrograms: 0,
    enrollments: 0, activeEnrollments: 0,
    interventions: 0, completedInterventions: 0,
    participants: 0,
  }));
}

export function _resetOrgRecords() {
  for (const k of Object.keys(_orgs))          delete _orgs[k];
  for (const k of Object.keys(_programs))      delete _programs[k];
  for (const k of Object.keys(_enrollments))   delete _enrollments[k];
  for (const k of Object.keys(_interventions)) delete _interventions[k];
  for (const k of Object.keys(_participants))  delete _participants[k];
}
