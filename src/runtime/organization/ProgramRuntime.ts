/**
 * src/runtime/organization/ProgramRuntime.ts — NGO Program
 * runtime. Re-exports the admin program upserts (compose, do
 * not duplicate) and adds org-scoped read helpers + snapshot.
 *
 * Strict-rule audit
 *   • Pure runtime. Frozen envelopes. Never throws.
 *   • organizationScoped: every list/snapshot scoped to a
 *     program (and the program is itself scoped to ONE org by
 *     the admin record layer).
 *   • No cross-org aggregation.
 */

import {
  upsertProgram, upsertProgramEnrollment,
  listFarmerProfiles, listPrograms,
} from '../admin';
import {
  ORGANIZATION_DASHBOARD_VERSION,
} from './organizationContracts';

export const PROGRAM_RUNTIME_VERSION = 'ngo-program-runtime-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/* ── Compose: re-export the admin program upserts ─────────── */
export { upsertProgram, upsertProgramEnrollment };

/**
 * Scoped: lists farmer enrollments for ONE program inside ONE
 * organization. The programId is itself scoped to a single
 * organizationId at the admin record layer; passing
 * organizationId here makes the scoping explicit and lets
 * callers fail closed when org context is missing.
 * Fails closed when programId missing.
 */
export function listEnrollmentsForProgram(
  programId: string,
  organizationId?: string,
): ReadonlyArray<any> {
  return _safe(() => {
    const pid = _str(programId);
    const orgId = _str(organizationId);
    if (!pid) return Object.freeze([] as any[]);
    const pool = listFarmerProfiles(
      orgId ? { programId: pid, organizationId: orgId } : { programId: pid },
    );
    return Object.freeze(pool.map((p) => Object.freeze({ ...p })));
  }, Object.freeze([] as any[]));
}

/**
 * Scoped snapshot for ONE program inside ONE organization —
 * counts enrolled / active / completed farmers. The programId is
 * itself scoped to a single organizationId at the admin record
 * layer; the optional organizationId here makes the scope
 * explicit for callers. Returns frozen envelope.
 */
export function programSnapshot(
  programId: string,
  organizationId?: string,
) {
  return _safe(() => {
    const pid = _str(programId);
    const orgId = _str(organizationId);
    if (!pid) {
      return Object.freeze({
        runtimeVersion:  PROGRAM_RUNTIME_VERSION,
        programId:       '',
        farmersEnrolled: 0,
        activeFarmers:   0,
        completedCount:  0,
        organizationScoped: true,
        fakeMetrics:     false,
        reason:          'programId_required',
      });
    }
    const enrollments = listEnrollmentsForProgram(pid, orgId || undefined);
    let active = 0;
    let completed = 0;
    for (const e of enrollments) {
      if (!_isObj(e)) continue;
      const status = _str((e as any).onboardingStatus);
      if (status === 'active') active++;
      // "completed" enrollment surfaced via onboardingStatus
      // or first_task_done as a soft completion signal.
      if (status === 'first_task_done') completed++;
    }
    return Object.freeze({
      runtimeVersion:  PROGRAM_RUNTIME_VERSION,
      programId:       pid,
      farmersEnrolled: enrollments.length,
      activeFarmers:   active,
      completedCount:  completed,
      organizationScoped: true,
      fakeMetrics:     false,
      reason:          '',
    });
  }, Object.freeze({
    runtimeVersion:  PROGRAM_RUNTIME_VERSION,
    programId:       '',
    farmersEnrolled: 0,
    activeFarmers:   0,
    completedCount:  0,
    organizationScoped: true,
    fakeMetrics:     false,
    reason:          'error',
  }));
}

/** Scoped: lists programs for ONE org. Fails closed. */
export function listProgramsForOrganization(organizationId: string)
    : ReadonlyArray<any> {
  return _safe(() => {
    const orgId = _str(organizationId);
    if (!orgId) return Object.freeze([] as any[]);
    return listPrograms({ organizationId: orgId });
  }, Object.freeze([] as any[]));
}

export { ORGANIZATION_DASHBOARD_VERSION };
