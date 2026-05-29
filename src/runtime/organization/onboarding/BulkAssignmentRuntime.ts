/**
 * src/runtime/organization/onboarding/BulkAssignmentRuntime.ts
 *
 *   Pure runtime that applies bulk assignments (program / cohort /
 *   field officer / region) to every row of an onboarding batch.
 *
 *   Each helper:
 *     • Fails closed without an organizationId.
 *     • Writes through upsertBatchRow updates for each row in
 *       the batch — never mutates rows directly so the
 *       BulkImportEngine remains the single writer for batch
 *       row state.
 *     • Returns a FROZEN envelope: { ok, count, assignment }
 *       where `assignment` describes what was applied.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No persistence. No fetch. No React.
 *   • Organization-scoped at every entry point.
 */

import {
  upsertBatchRow,
  listBatchRows,
  getBatch,
} from './BulkImportEngine';

export const BULK_ASSIGNMENT_VERSION =
  'bulk-assignment-runtime-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr  = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

const _stats = {
  program:      0,
  cohort:       0,
  fieldOfficer: 0,
  region:       0,
};

interface AssignmentEnvelope {
  runtimeVersion: string;
  ok:             boolean;
  count:          number;
  reason:         string;
  assignment:     Readonly<{
    kind:           'program' | 'cohort' | 'fieldOfficer' | 'region' | 'none';
    batchId:        string;
    organizationId: string;
    value:          string;
  }>;
}

function _envelope(args: {
  ok:             boolean;
  count:          number;
  reason:         string;
  kind:           'program' | 'cohort' | 'fieldOfficer' | 'region' | 'none';
  batchId:        string;
  organizationId: string;
  value:          string;
}): AssignmentEnvelope {
  return Object.freeze({
    runtimeVersion: BULK_ASSIGNMENT_VERSION,
    ok:             args.ok,
    count:          args.count,
    reason:         args.reason,
    assignment: Object.freeze({
      kind:           args.kind,
      batchId:        args.batchId,
      organizationId: args.organizationId,
      value:          args.value,
    }),
  });
}

/**
 * Confirm the batch exists and belongs to the given org. The
 * BulkImportEngine is the source of truth — we never trust the
 * caller's claim alone.
 */
function _verifyBatch(batchId: string, organizationId: string) {
  return _safe(() => {
    const batch = getBatch(batchId);
    if (!batch) return { ok: false, reason: 'batch_not_found' };
    if (_str((batch as any).organizationId) !== organizationId) {
      return { ok: false, reason: 'organization_mismatch' };
    }
    return { ok: true, reason: '' };
  }, { ok: false, reason: 'error' });
}

function _applyToEveryRow(
  batchId:       string,
  patchFactory:  (row: any) => Record<string, any>,
): number {
  return _safe(() => {
    const rows = _arr(listBatchRows(batchId));
    let n = 0;
    for (const row of rows) {
      if (!_isObj(row)) continue;
      const patch = patchFactory(row);
      const res = upsertBatchRow({
        ...row,
        ...patch,
      });
      if (_isObj(res) && (res as any).ok === true) n += 1;
    }
    return n;
  }, 0);
}

/**
 * Bulk-assign a program to every row of a batch.
 */
export function assignProgram(
  batchId:        string,
  programId:      string,
  organizationId: string,
): AssignmentEnvelope {
  return _safe(() => {
    const bId = _str(batchId);
    const pId = _str(programId);
    const oId = _str(organizationId);
    if (!oId) {
      return _envelope({
        ok: false, count: 0, reason: 'organization_required',
        kind: 'none', batchId: bId, organizationId: oId, value: pId,
      });
    }
    if (!bId || !pId) {
      return _envelope({
        ok: false, count: 0, reason: 'missing_fields',
        kind: 'program', batchId: bId, organizationId: oId, value: pId,
      });
    }
    const v = _verifyBatch(bId, oId);
    if (!v.ok) {
      return _envelope({
        ok: false, count: 0, reason: v.reason,
        kind: 'program', batchId: bId, organizationId: oId, value: pId,
      });
    }
    const count = _applyToEveryRow(bId, () => ({ programId: pId }));
    _stats.program += count;
    return _envelope({
      ok: true, count, reason: '',
      kind: 'program', batchId: bId, organizationId: oId, value: pId,
    });
  }, _envelope({
    ok: false, count: 0, reason: 'error',
    kind: 'program',
    batchId: _str(batchId), organizationId: _str(organizationId),
    value: _str(programId),
  }));
}

/**
 * Bulk-assign a cohort to every row of a batch.
 */
export function assignCohort(
  batchId:        string,
  cohortId:       string,
  organizationId: string,
): AssignmentEnvelope {
  return _safe(() => {
    const bId = _str(batchId);
    const cId = _str(cohortId);
    const oId = _str(organizationId);
    if (!oId) {
      return _envelope({
        ok: false, count: 0, reason: 'organization_required',
        kind: 'none', batchId: bId, organizationId: oId, value: cId,
      });
    }
    if (!bId || !cId) {
      return _envelope({
        ok: false, count: 0, reason: 'missing_fields',
        kind: 'cohort', batchId: bId, organizationId: oId, value: cId,
      });
    }
    const v = _verifyBatch(bId, oId);
    if (!v.ok) {
      return _envelope({
        ok: false, count: 0, reason: v.reason,
        kind: 'cohort', batchId: bId, organizationId: oId, value: cId,
      });
    }
    const count = _applyToEveryRow(bId, () => ({ cohortId: cId }));
    _stats.cohort += count;
    return _envelope({
      ok: true, count, reason: '',
      kind: 'cohort', batchId: bId, organizationId: oId, value: cId,
    });
  }, _envelope({
    ok: false, count: 0, reason: 'error',
    kind: 'cohort',
    batchId: _str(batchId), organizationId: _str(organizationId),
    value: _str(cohortId),
  }));
}

/**
 * Bulk-assign a field officer to every row of a batch.
 *
 *   Best-effort validation that the field officer exists in the
 *   same organization. The admin runtime is the source of truth;
 *   if it can't confirm (e.g. user not yet provisioned), we
 *   still accept the assignment — the audit/permission layer
 *   will reject downstream actions if the officer is bogus.
 */
export function assignFieldOfficer(
  batchId:            string,
  fieldOfficerUserId: string,
  organizationId:     string,
): AssignmentEnvelope {
  return _safe(() => {
    const bId = _str(batchId);
    const uId = _str(fieldOfficerUserId);
    const oId = _str(organizationId);
    if (!oId) {
      return _envelope({
        ok: false, count: 0, reason: 'organization_required',
        kind: 'none', batchId: bId, organizationId: oId, value: uId,
      });
    }
    if (!bId || !uId) {
      return _envelope({
        ok: false, count: 0, reason: 'missing_fields',
        kind: 'fieldOfficer', batchId: bId, organizationId: oId, value: uId,
      });
    }
    const v = _verifyBatch(bId, oId);
    if (!v.ok) {
      return _envelope({
        ok: false, count: 0, reason: v.reason,
        kind: 'fieldOfficer', batchId: bId, organizationId: oId, value: uId,
      });
    }

    // Best-effort same-org check via the admin runtime.
    // Dynamic import keeps this engine pure on the cold path and
    // safe against circulars; failure → accept the assignment.
    const sameOrg = _safe(() => {
      const adminMod = require('../../admin') as {
        findFarmerProfile?: (id: string) => any;
      };
      const finder = adminMod && adminMod.findFarmerProfile;
      if (typeof finder !== 'function') return true;
      const fp = finder(uId);
      if (!_isObj(fp)) return true; // not provisioned — accept
      return _str((fp as any).organizationId) === oId
          || _str((fp as any).organizationId) === '';
    }, true);

    if (!sameOrg) {
      return _envelope({
        ok: false, count: 0, reason: 'officer_org_mismatch',
        kind: 'fieldOfficer', batchId: bId, organizationId: oId, value: uId,
      });
    }

    const count = _applyToEveryRow(bId, () => ({
      fieldOfficerUserId: uId,
    }));
    _stats.fieldOfficer += count;
    return _envelope({
      ok: true, count, reason: '',
      kind: 'fieldOfficer', batchId: bId, organizationId: oId, value: uId,
    });
  }, _envelope({
    ok: false, count: 0, reason: 'error',
    kind: 'fieldOfficer',
    batchId: _str(batchId), organizationId: _str(organizationId),
    value: _str(fieldOfficerUserId),
  }));
}

/**
 * Bulk-assign a region label to every row of a batch.
 */
export function assignRegion(
  batchId:        string,
  region:         string,
  organizationId: string,
): AssignmentEnvelope {
  return _safe(() => {
    const bId = _str(batchId);
    const rg  = _str(region).trim();
    const oId = _str(organizationId);
    if (!oId) {
      return _envelope({
        ok: false, count: 0, reason: 'organization_required',
        kind: 'none', batchId: bId, organizationId: oId, value: rg,
      });
    }
    if (!bId || !rg) {
      return _envelope({
        ok: false, count: 0, reason: 'missing_fields',
        kind: 'region', batchId: bId, organizationId: oId, value: rg,
      });
    }
    const v = _verifyBatch(bId, oId);
    if (!v.ok) {
      return _envelope({
        ok: false, count: 0, reason: v.reason,
        kind: 'region', batchId: bId, organizationId: oId, value: rg,
      });
    }
    const count = _applyToEveryRow(bId, () => ({ region: rg }));
    _stats.region += count;
    return _envelope({
      ok: true, count, reason: '',
      kind: 'region', batchId: bId, organizationId: oId, value: rg,
    });
  }, _envelope({
    ok: false, count: 0, reason: 'error',
    kind: 'region',
    batchId: _str(batchId), organizationId: _str(organizationId),
    value: _str(region),
  }));
}

/** Diagnostic snapshot — counts per assignment kind. */
export function assignmentSnapshot() {
  return _safe(() => Object.freeze({
    runtimeVersion: BULK_ASSIGNMENT_VERSION,
    scope:          "organizationId" as const,
    program:        _stats.program,
    cohort:         _stats.cohort,
    fieldOfficer:   _stats.fieldOfficer,
    region:         _stats.region,
    total:
      _stats.program + _stats.cohort +
      _stats.fieldOfficer + _stats.region,
  }), Object.freeze({
    runtimeVersion: BULK_ASSIGNMENT_VERSION,
    program: 0, cohort: 0, fieldOfficer: 0, region: 0, total: 0,
  }));
}

/** Test-only — wipe the counters. */
export function _resetAssignmentStats() {
  _stats.program      = 0;
  _stats.cohort       = 0;
  _stats.fieldOfficer = 0;
  _stats.region       = 0;
}
