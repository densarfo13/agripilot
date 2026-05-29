/**
 * src/runtime/organization/InterventionRuntime.ts — NGO
 * intervention runtime. Re-exports admin upserts (compose, do
 * not duplicate), adds field-officer assignment + idempotent
 * completion + org-scoped read helpers.
 *
 * Strict-rule audit
 *   • Pure runtime. Frozen envelopes. Never throws.
 *   • organizationScoped: scope reads to ONE org.
 *   • Completion is idempotent per
 *     ngo:intervention-complete:{interventionId}:{userId}.
 *   • No PII, no fake metrics.
 */

import {
  upsertIntervention, upsertInterventionParticipant,
  listInterventions,
} from '../admin';
import {
  ORGANIZATION_DASHBOARD_VERSION,
  ngoInterventionCompleteIdempotencyKey,
} from './organizationContracts';

export const INTERVENTION_RUNTIME_VERSION =
  'ngo-intervention-runtime-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

/* ── Compose: re-export admin upserts ─────────────────────── */
export { upsertIntervention, upsertInterventionParticipant };

/* ── Local in-memory tracking for org-scope reads ─────────── */
interface Assignment {
  interventionId: string;
  assignedUserId: string;
  assignedBy:     string;
  organizationId: string;
  status:         string;
  completedAt?:   string;
  notes?:         string;
  evidencePhotoUrl?: string;
  createdAt:      string;
  updatedAt:      string;
}

const _assignments: Record<string, Assignment> = Object.create(null);
const _completionKeys = new Set<string>();
const _interventionOrg: Record<string, string> = Object.create(null);

function _hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function _envelope(ok: boolean, record: any, reason = '', extras: Record<string, any> = {}) {
  return Object.freeze({
    runtimeVersion: INTERVENTION_RUNTIME_VERSION,
    ok, reason,
    record: record ? Object.freeze({ ...record }) : null,
    ...extras,
  });
}

interface AssignCtx {
  interventionId:   string;
  userId:           string;
  assignedToUserId: string;
  organizationId?:  string;
}

/**
 * Assigns a participant to an intervention. Composes the admin
 * participant upsert + tracks org-scope locally for field-officer
 * filtering. Fails closed without ids.
 */
export function assignParticipant(ctx: AssignCtx) {
  return _safe(() => {
    if (!_isObj(ctx)) return _envelope(false, null, 'invalid_context');
    const interventionId   = _str(ctx.interventionId);
    const assignedBy       = _str(ctx.userId);
    const assignedToUserId = _str(ctx.assignedToUserId);
    if (!interventionId)   return _envelope(false, null, 'interventionId_required');
    if (!assignedBy)       return _envelope(false, null, 'userId_required');
    if (!assignedToUserId) return _envelope(false, null, 'assignedToUserId_required');

    // Compose: upsert participant record on admin layer.
    const upsert = upsertInterventionParticipant({
      interventionId,
      userId: assignedToUserId,
      status: 'assigned',
    });
    if (!_isObj(upsert) || !(upsert as any).ok) {
      return _envelope(false, null,
        _str((upsert as any) && (upsert as any).reason) || 'upsert_failed');
    }

    const orgId = _str(ctx.organizationId);
    if (orgId) _interventionOrg[interventionId] = orgId;

    const id = 'assign_' + _hash(interventionId + '|' + assignedToUserId);
    const now = _now();
    const existing = _assignments[id];
    const record: Assignment = Object.freeze({
      interventionId,
      assignedUserId: assignedToUserId,
      assignedBy,
      organizationId: orgId || (existing && existing.organizationId) || '',
      status: (existing && existing.status === 'completed')
        ? 'completed' : 'assigned',
      completedAt:      existing && existing.completedAt,
      notes:            existing && existing.notes,
      evidencePhotoUrl: existing && existing.evidencePhotoUrl,
      createdAt: (existing && existing.createdAt) || now,
      updatedAt: now,
    });
    _assignments[id] = record;
    return _envelope(true, record);
  }, _envelope(false, null, 'error'));
}

interface CompleteCtx {
  interventionId:    string;
  userId:            string;
  notes?:            string;
  evidencePhotoUrl?: string;
}

/**
 * Marks an intervention complete for one participant. Idempotent
 * on ngo:intervention-complete:{interventionId}:{userId}.
 */
export function completeIntervention(ctx: CompleteCtx) {
  return _safe(() => {
    if (!_isObj(ctx)) return _envelope(false, null, 'invalid_context');
    const interventionId = _str(ctx.interventionId);
    const userId         = _str(ctx.userId);
    if (!interventionId) return _envelope(false, null, 'interventionId_required');
    if (!userId)         return _envelope(false, null, 'userId_required');

    const key = ngoInterventionCompleteIdempotencyKey(interventionId, userId);
    if (_completionKeys.has(key)) {
      const id = 'assign_' + _hash(interventionId + '|' + userId);
      const existing = _assignments[id] || null;
      return _envelope(true, existing, 'duplicate',
        { idempotencyKey: key });
    }

    const notes            = _str(ctx.notes) || undefined;
    const evidencePhotoUrl = _str(ctx.evidencePhotoUrl) || undefined;

    // Compose: mark the admin participant record as completed.
    const upsert = upsertInterventionParticipant({
      interventionId,
      userId,
      status: 'completed',
      notes,
      evidencePhotoUrl,
      completedAt: _now(),
    });
    if (!_isObj(upsert) || !(upsert as any).ok) {
      return _envelope(false, null,
        _str((upsert as any) && (upsert as any).reason) || 'upsert_failed');
    }

    const id = 'assign_' + _hash(interventionId + '|' + userId);
    const now = _now();
    const existing = _assignments[id];
    const record: Assignment = Object.freeze({
      interventionId,
      assignedUserId:   userId,
      assignedBy:       (existing && existing.assignedBy) || userId,
      organizationId:   (existing && existing.organizationId)
                          || _interventionOrg[interventionId] || '',
      status:           'completed',
      completedAt:      now,
      notes,
      evidencePhotoUrl,
      createdAt: (existing && existing.createdAt) || now,
      updatedAt: now,
    });
    _assignments[id] = record;
    _completionKeys.add(key);
    return _envelope(true, record, '', { idempotencyKey: key });
  }, _envelope(false, null, 'error'));
}

/**
 * Scoped: lists assignments for ONE field officer within ONE
 * organization. Fails closed when ids missing.
 */
export function listAssignedInterventions(
  userId: string,
  organizationId: string,
): ReadonlyArray<Assignment> {
  return _safe(() => {
    const uid   = _str(userId);
    const orgId = _str(organizationId);
    if (!uid || !orgId) return Object.freeze([] as Assignment[]);
    const pool = Object.values(_assignments).filter((a) =>
      a.assignedUserId === uid
      && (a.organizationId === orgId
          || _interventionOrg[a.interventionId] === orgId));
    return Object.freeze(pool.map((a) => Object.freeze({ ...a })));
  }, Object.freeze([] as Assignment[]));
}

/** Scoped: snapshot of intervention status counts for ONE org. */
export function interventionSnapshot(organizationId: string) {
  return _safe(() => {
    const orgId = _str(organizationId);
    if (!orgId) {
      return Object.freeze({
        runtimeVersion: INTERVENTION_RUNTIME_VERSION,
        organizationId: '',
        total: 0,
        byStatus: Object.freeze({} as Record<string, number>),
        organizationScoped: true,
        fakeMetrics: false,
        reason: 'organizationId_required',
      });
    }
    const pool = listInterventions({ organizationId: orgId });
    const byStatus: Record<string, number> = {};
    for (const i of pool) {
      const s = _str((i as any).status);
      byStatus[s] = (byStatus[s] || 0) + 1;
    }
    return Object.freeze({
      runtimeVersion: INTERVENTION_RUNTIME_VERSION,
      organizationId: orgId,
      total:          pool.length,
      byStatus:       Object.freeze(byStatus),
      organizationScoped: true,
      fakeMetrics:    false,
      reason:         '',
    });
  }, Object.freeze({
    runtimeVersion: INTERVENTION_RUNTIME_VERSION,
    organizationId: '',
    total: 0,
    byStatus: Object.freeze({} as Record<string, number>),
    organizationScoped: true,
    fakeMetrics: false,
    reason: 'error',
  }));
}

export { ORGANIZATION_DASHBOARD_VERSION };

/** Test-only — wipe. */
export function _resetInterventionAssignments() {
  for (const k of Object.keys(_assignments)) delete _assignments[k];
  for (const k of Object.keys(_interventionOrg)) delete _interventionOrg[k];
  _completionKeys.clear();
}
