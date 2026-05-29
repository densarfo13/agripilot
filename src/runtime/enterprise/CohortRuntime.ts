/**
 * src/runtime/enterprise/CohortRuntime.ts — Cohort state.
 *
 * Pure helpers over caller-owned cohorts.
 */

import { COHORT_TYPES } from './enterpriseContracts';

export const COHORT_RUNTIME_VERSION = 'cohort-runtime-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

const VALID_TYPES = new Set(Object.values(COHORT_TYPES));

export function normalizeCohort(raw: unknown) {
  return _safe(() => {
    if (!_isObj(raw)) return null;
    const type = _str(raw.type).toLowerCase();
    return Object.freeze({
      id:             _str(raw.id),
      organizationId: _str(raw.organizationId),
      programId:      _str(raw.programId),
      name:           _str(raw.name),
      type:           VALID_TYPES.has(type) ? type : COHORT_TYPES.CUSTOM,
      country:        _str(raw.country),
      region:         _str(raw.region),
      district:       _str(raw.district),
      crop:           _str(raw.crop),
      createdAt:      _str(raw.createdAt) || _now(),
      updatedAt:      _str(raw.updatedAt) || _now(),
    });
  }, null);
}

export function listCohortsFor(cohorts: unknown[],
                                 filter: { organizationId?: string;
                                           programId?: string;
                                           type?: string }) {
  return _safe(() => {
    const f = _isObj(filter) ? filter : {};
    return Object.freeze(_arr(cohorts)
      .map(normalizeCohort)
      .filter((c): c is NonNullable<typeof c> => {
        if (!c) return false;
        if (f.organizationId && c.organizationId !== f.organizationId) return false;
        if (f.programId && c.programId !== f.programId) return false;
        if (f.type && c.type !== f.type) return false;
        return true;
      }));
  }, Object.freeze([]));
}
