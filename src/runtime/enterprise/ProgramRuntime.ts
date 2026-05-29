/**
 * src/runtime/enterprise/ProgramRuntime.ts — Program state.
 *
 *   import {
 *     normalizeProgram, addProgramFarmer, listProgramsFor,
 *     PROGRAM_RUNTIME_VERSION,
 *   } from 'src/runtime/enterprise/ProgramRuntime';
 *
 * Pure helpers over caller-owned program + program-farmer lists.
 * No persistence; routes handle writes through wave-5.
 */

import {
  PROGRAM_STATUSES, PROGRAM_FARMER_STATUSES,
} from './enterpriseContracts';

export const PROGRAM_RUNTIME_VERSION = 'program-runtime-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

const VALID_PROGRAM_STATUS  = new Set(Object.values(PROGRAM_STATUSES));
const VALID_FARMER_STATUS   = new Set(Object.values(PROGRAM_FARMER_STATUSES));

export function normalizeProgram(raw: unknown) {
  return _safe(() => {
    if (!_isObj(raw)) return null;
    const status = _str(raw.status).toLowerCase();
    return Object.freeze({
      id:             _str(raw.id),
      organizationId: _str(raw.organizationId),
      name:           _str(raw.name),
      description:    _str(raw.description),
      cropFocus:      _str(raw.cropFocus),
      country:        _str(raw.country),
      region:         _str(raw.region),
      district:       _str(raw.district),
      startDate:      _str(raw.startDate),
      endDate:        _str(raw.endDate),
      status:         VALID_PROGRAM_STATUS.has(status) ? status : PROGRAM_STATUSES.DRAFT,
      createdAt:      _str(raw.createdAt) || _now(),
      updatedAt:      _str(raw.updatedAt) || _now(),
    });
  }, null);
}

export function normalizeProgramFarmer(raw: unknown) {
  return _safe(() => {
    if (!_isObj(raw)) return null;
    const status = _str(raw.status).toLowerCase();
    return Object.freeze({
      id:        _str(raw.id),
      programId: _str(raw.programId),
      userId:    _str(raw.userId),
      farmId:    _str(raw.farmId),
      gardenId:  _str(raw.gardenId),
      cohortId:  _str(raw.cohortId),
      status:    VALID_FARMER_STATUS.has(status) ? status
                  : PROGRAM_FARMER_STATUSES.INVITED,
      joinedAt:  _str(raw.joinedAt),
      createdAt: _str(raw.createdAt) || _now(),
      updatedAt: _str(raw.updatedAt) || _now(),
    });
  }, null);
}

export function listProgramsFor(programs: unknown[], organizationId: string) {
  return _safe(() => {
    return Object.freeze(_arr(programs)
      .map(normalizeProgram)
      .filter((p): p is NonNullable<typeof p> =>
        p != null && p.organizationId === organizationId));
  }, Object.freeze([]));
}

export function addProgramFarmer(participants: unknown[], participant: any) {
  return _safe(() => {
    const normalized = normalizeProgramFarmer(participant);
    if (!normalized) return Object.freeze(_arr(participants).slice());
    const existing = _arr(participants)
      .map(normalizeProgramFarmer)
      .filter(Boolean) as any[];
    // Dedupe by (programId, userId)
    const filtered = existing.filter((p) =>
      !(p.programId === normalized.programId
        && p.userId === normalized.userId));
    return Object.freeze(filtered.concat([normalized]));
  }, Object.freeze(_arr(participants).slice()));
}
