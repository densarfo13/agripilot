/**
 * src/runtime/enterprise/InterventionRuntime.ts — Intervention
 * state.
 *
 *   import {
 *     normalizeIntervention, normalizeParticipant,
 *     summarizeIntervention, INTERVENTION_RUNTIME_VERSION,
 *   } from 'src/runtime/enterprise/InterventionRuntime';
 *
 * Pure helpers. No persistence.
 */

import {
  INTERVENTION_TYPES, INTERVENTION_STATUSES, PARTICIPANT_STATUSES,
} from './enterpriseContracts';

export const INTERVENTION_RUNTIME_VERSION = 'intervention-runtime-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

const VALID_TYPES         = new Set(Object.values(INTERVENTION_TYPES));
const VALID_STATUSES      = new Set(Object.values(INTERVENTION_STATUSES));
const VALID_PART_STATUSES = new Set(Object.values(PARTICIPANT_STATUSES));

export function normalizeIntervention(raw: unknown) {
  return _safe(() => {
    if (!_isObj(raw)) return null;
    const type   = _str(raw.type).toLowerCase();
    const status = _str(raw.status).toLowerCase();
    return Object.freeze({
      id:             _str(raw.id),
      organizationId: _str(raw.organizationId),
      programId:      _str(raw.programId),
      cohortId:       _str(raw.cohortId),
      name:           _str(raw.name),
      type:           VALID_TYPES.has(type) ? type : INTERVENTION_TYPES.OTHER,
      description:    _str(raw.description),
      plannedDate:    _str(raw.plannedDate),
      deliveredDate:  _str(raw.deliveredDate),
      status:         VALID_STATUSES.has(status) ? status
                       : INTERVENTION_STATUSES.PLANNED,
      createdAt:      _str(raw.createdAt) || _now(),
      updatedAt:      _str(raw.updatedAt) || _now(),
    });
  }, null);
}

export function normalizeParticipant(raw: unknown) {
  return _safe(() => {
    if (!_isObj(raw)) return null;
    const status = _str(raw.status).toLowerCase();
    return Object.freeze({
      id:              _str(raw.id),
      interventionId:  _str(raw.interventionId),
      userId:          _str(raw.userId),
      farmId:          _str(raw.farmId),
      plantId:         _str(raw.plantId),
      status:          VALID_PART_STATUSES.has(status) ? status
                        : PARTICIPANT_STATUSES.ASSIGNED,
      evidencePhotoUrl: _str(raw.evidencePhotoUrl),
      notes:           _str(raw.notes),
      completedAt:     _str(raw.completedAt),
      createdAt:       _str(raw.createdAt) || _now(),
      updatedAt:       _str(raw.updatedAt) || _now(),
    });
  }, null);
}

/**
 * Summarize one intervention's participant outcomes:
 * { assigned, delivered, accepted, completed, missed, evidenceCount }.
 */
export function summarizeIntervention(interventionId: string,
                                        participants: unknown[]) {
  return _safe(() => {
    const id = _str(interventionId);
    const list = _arr(participants)
      .map(normalizeParticipant)
      .filter((p): p is NonNullable<typeof p> =>
        p != null && p.interventionId === id);
    const counts: Record<string, number> = {
      assigned: 0, delivered: 0, accepted: 0,
      completed: 0, missed: 0, evidenceCount: 0,
    };
    for (const p of list) {
      if (p.status === 'assigned')  counts.assigned++;
      if (p.status === 'delivered') counts.delivered++;
      if (p.status === 'accepted')  counts.accepted++;
      if (p.status === 'completed') counts.completed++;
      if (p.status === 'missed')    counts.missed++;
      if (p.evidencePhotoUrl)       counts.evidenceCount++;
    }
    return Object.freeze({
      runtimeVersion: INTERVENTION_RUNTIME_VERSION,
      interventionId: id,
      participantCount: list.length,
      ...counts,
    });
  }, Object.freeze({
    runtimeVersion: INTERVENTION_RUNTIME_VERSION,
    interventionId: '',
    participantCount: 0,
    assigned: 0, delivered: 0, accepted: 0,
    completed: 0, missed: 0, evidenceCount: 0,
  }));
}
