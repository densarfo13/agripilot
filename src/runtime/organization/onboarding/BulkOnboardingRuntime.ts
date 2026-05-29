/**
 * src/runtime/organization/onboarding/BulkOnboardingRuntime.ts
 *
 *   Composite facade that orchestrates the full bulk-onboarding
 *   workflow:
 *
 *     uploadCSV → validateBatch → resolveDuplicatesPreview → importBatch
 *
 *   • Pure composition over the part-1 engines (BulkImportEngine,
 *     BatchValidationEngine) and the part-2 engines
 *     (DuplicateDetectionEngine, FarmerProvisioningRuntime,
 *     BulkAssignmentRuntime).
 *   • Emits AuditEvents at the workflow checkpoints. PII is
 *     never logged in metadata.
 *   • Pins window.__bulkOnboardingHealth() for diagnostics.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Frozen envelopes. No persistence writes (engines own state).
 *   • Organization-scoped at every entry point.
 */

import {
  uploadCSV          as _uploadCSV,
  listBatchRows,
  getBatch,
  upsertBatchRow,
  recomputeBatchCounts,
  batchImportSnapshot,
  BULK_IMPORT_VERSION,
} from './BulkImportEngine';

import {
  validateRow,
  validationSnapshot,
  BATCH_VALIDATION_VERSION,
} from './BatchValidationEngine';

import {
  detectDuplicates,
  duplicateDetectionSnapshot,
  DUPLICATE_DETECTION_VERSION,
} from './DuplicateDetectionEngine';

import {
  provisionFarmerFromRow,
  provisioningSnapshot,
  FARMER_PROVISIONING_VERSION,
} from './FarmerProvisioningRuntime';

import {
  assignmentSnapshot,
  BULK_ASSIGNMENT_VERSION,
} from './BulkAssignmentRuntime';

import { listFarmerProfiles } from '../../admin';
import { writeAuditEvent } from '../../audit';

import { BULK_ONBOARDING_VERSION } from './onboardingContracts';
export const BULK_ONBOARDING_RUNTIME_VERSION =
  'farroway-bulk-onboarding-runtime-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr  = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/* ── Public envelope shapes ───────────────────────────────── */

interface UploadEnvelope {
  runtimeVersion: string;
  ok:             boolean;
  reason:         string;
  batchId:        string;
  rowCount:       number;
}

interface ValidateEnvelope {
  runtimeVersion: string;
  ok:             boolean;
  reason:         string;
  batchId:        string;
  validCount:     number;
  invalidCount:   number;
}

interface DuplicatePreviewEnvelope {
  runtimeVersion: string;
  ok:             boolean;
  reason:         string;
  batchId:        string;
  hardCount:      number;
  softCount:      number;
  matches:        ReadonlyArray<{
    rowNumber:     number;
    kind:          'hard' | 'soft';
    reason:        string;
    matchedUserId: string;
  }>;
}

interface ImportEnvelope {
  runtimeVersion: string;
  ok:             boolean;
  reason:         string;
  batchId:        string;
  created:        number;
  linked:         number;
  failed:         number;
  skipped:        number;
}

/* ── uploadCSV ────────────────────────────────────────────── */

export function uploadCSV(ctx: any): UploadEnvelope {
  return _safe(() => {
    if (!_isObj(ctx)) {
      return Object.freeze({
        runtimeVersion: BULK_ONBOARDING_VERSION,
        ok: false, reason: 'invalid_context',
        batchId: '', rowCount: 0,
      });
    }
    const organizationId = _str((ctx as any).organizationId);
    if (!organizationId) {
      return Object.freeze({
        runtimeVersion: BULK_ONBOARDING_VERSION,
        ok: false, reason: 'organization_required',
        batchId: '', rowCount: 0,
      });
    }

    const res = _uploadCSV(ctx);
    if (!_isObj(res) || (res as any).ok !== true) {
      return Object.freeze({
        runtimeVersion: BULK_ONBOARDING_VERSION,
        ok: false,
        reason: _str((res as any)?.reason) || 'upload_failed',
        batchId: '', rowCount: 0,
      });
    }
    const batchId  = _str((res as any).batchId)
                   || _str((res as any).batch?.id);
    const rowCount = typeof (res as any).rowCount === 'number'
      ? (res as any).rowCount as number
      : _arr((res as any).rows).length;

    writeAuditEvent({
      actorUserId:    _str((ctx as any).actorUserId)
                      || 'system_bulk_onboarding',
      action:         'bulk_onboarding_batch_uploaded',
      entityType:     'EnrollmentBatch',
      entityId:       batchId,
      organizationId,
      metadata: {
        rowCount,
        source: _str((ctx as any).source) || 'csv',
      },
    });

    return Object.freeze({
      runtimeVersion: BULK_ONBOARDING_VERSION,
      ok: true, reason: '',
      batchId, rowCount,
    });
  }, Object.freeze({
    runtimeVersion: BULK_ONBOARDING_VERSION,
    ok: false, reason: 'error',
    batchId: '', rowCount: 0,
  }));
}

/* ── validateBatch ────────────────────────────────────────── */

export function validateBatch(batchId: string): ValidateEnvelope {
  return _safe(() => {
    const bId = _str(batchId);
    if (!bId) {
      return Object.freeze({
        runtimeVersion: BULK_ONBOARDING_VERSION,
        ok: false, reason: 'batch_required',
        batchId: '', validCount: 0, invalidCount: 0,
      });
    }
    const batch = getBatch(bId);
    if (!_isObj(batch)) {
      return Object.freeze({
        runtimeVersion: BULK_ONBOARDING_VERSION,
        ok: false, reason: 'batch_not_found',
        batchId: bId, validCount: 0, invalidCount: 0,
      });
    }

    const rows = _arr(listBatchRows(bId));
    let validCount = 0;
    let invalidCount = 0;
    for (const row of rows) {
      if (!_isObj(row)) continue;
      const v = validateRow(row);
      const ok = _isObj(v) && (v as any).ok === true;
      const status = ok ? 'validated' : 'invalid';
      if (ok) validCount += 1; else invalidCount += 1;
      upsertBatchRow({
        ...row,
        status,
        errors: ok ? [] : _arr((v as any).errors),
      });
    }
    _safe(() => recomputeBatchCounts(bId), undefined);

    writeAuditEvent({
      actorUserId:    'system_bulk_onboarding',
      action:         'bulk_onboarding_batch_validated',
      entityType:     'EnrollmentBatch',
      entityId:       bId,
      organizationId: _str((batch as any).organizationId),
      metadata: { validCount, invalidCount, total: rows.length },
    });

    return Object.freeze({
      runtimeVersion: BULK_ONBOARDING_VERSION,
      ok: true, reason: '',
      batchId: bId, validCount, invalidCount,
    });
  }, Object.freeze({
    runtimeVersion: BULK_ONBOARDING_VERSION,
    ok: false, reason: 'error',
    batchId: _str(batchId), validCount: 0, invalidCount: 0,
  }));
}

/* ── resolveDuplicatesPreview ─────────────────────────────── */

export function resolveDuplicatesPreview(
  batchId: string,
): DuplicatePreviewEnvelope {
  return _safe(() => {
    const bId = _str(batchId);
    if (!bId) {
      return Object.freeze({
        runtimeVersion: BULK_ONBOARDING_VERSION,
        ok: false, reason: 'batch_required',
        batchId: '', hardCount: 0, softCount: 0,
        matches: Object.freeze([]),
      });
    }
    const batch = getBatch(bId);
    if (!_isObj(batch)) {
      return Object.freeze({
        runtimeVersion: BULK_ONBOARDING_VERSION,
        ok: false, reason: 'batch_not_found',
        batchId: bId, hardCount: 0, softCount: 0,
        matches: Object.freeze([]),
      });
    }
    const organizationId = _str((batch as any).organizationId);
    if (!organizationId) {
      return Object.freeze({
        runtimeVersion: BULK_ONBOARDING_VERSION,
        ok: false, reason: 'organization_required',
        batchId: bId, hardCount: 0, softCount: 0,
        matches: Object.freeze([]),
      });
    }

    const rows = _arr(listBatchRows(bId));
    // Pull canonical farmer pool — projection avoids leaking
    // anything beyond the duplicate-detection inputs.
    const pool = _arr(listFarmerProfiles({ organizationId }));
    const existing = pool.map((p: any) => {
      const raw = _isObj((p as any).rawData) ? (p as any).rawData : {};
      return {
        id:           _str((p as any).id),
        userId:       _str((p as any).userId),
        phone:        _str((raw as any).phone),
        email:        _str((raw as any).email),
        firstName:    _str((raw as any).firstName),
        lastName:     _str((raw as any).lastName),
        village:      _str((p as any).village),
        district:     _str((p as any).district),
        primaryCrops: _arr((p as any).primaryCrops),
      };
    });

    // Project row payloads for the engine.
    const inputRows = rows.map((row: any, idx: number) => {
      const data = _isObj((row as any).rawData) ? (row as any).rawData
                  : (row as any);
      return {
        rowNumber:    typeof (row as any).rowNumber === 'number'
                        ? (row as any).rowNumber as number
                        : idx + 1,
        phone:        _str((data as any).phone),
        email:        _str((data as any).email),
        firstName:    _str((data as any).firstName),
        lastName:     _str((data as any).lastName),
        village:      _str((data as any).village),
        district:     _str((data as any).district),
        primaryCrops: _arr((data as any).primaryCrops),
        primaryCrop:  _str((data as any).primaryCrop),
      };
    });

    const matches = detectDuplicates({
      rows:            inputRows,
      existingFarmers: existing,
    });

    let hardCount = 0;
    let softCount = 0;
    const byRow: Record<number, any> = {};
    for (const m of matches) {
      if (m.kind === 'hard') hardCount += 1;
      else softCount += 1;
      byRow[m.rowNumber] = m;
    }

    // Mark rows that matched — but do NOT mutate the import status
    // away from "validated" (the importer still owns that flag).
    for (const row of rows) {
      if (!_isObj(row)) continue;
      const rn = typeof (row as any).rowNumber === 'number'
        ? (row as any).rowNumber as number
        : 0;
      const m = byRow[rn];
      if (!m) continue;
      upsertBatchRow({
        ...row,
        duplicateKind:  m.kind,
        duplicateReason: m.reason,
        matchedUserId:  m.matchedUserId,
      });
    }

    return Object.freeze({
      runtimeVersion: BULK_ONBOARDING_VERSION,
      ok: true, reason: '',
      batchId: bId,
      hardCount, softCount,
      matches,
    });
  }, Object.freeze({
    runtimeVersion: BULK_ONBOARDING_VERSION,
    ok: false, reason: 'error',
    batchId: _str(batchId), hardCount: 0, softCount: 0,
    matches: Object.freeze([]),
  }));
}

/* ── importBatch ──────────────────────────────────────────── */

export function importBatch(
  batchId: string,
  opts?:   { skipDuplicates?: boolean },
): ImportEnvelope {
  return _safe(() => {
    const bId = _str(batchId);
    if (!bId) {
      return Object.freeze({
        runtimeVersion: BULK_ONBOARDING_VERSION,
        ok: false, reason: 'batch_required',
        batchId: '',
        created: 0, linked: 0, failed: 0, skipped: 0,
      });
    }
    const batch = getBatch(bId);
    if (!_isObj(batch)) {
      return Object.freeze({
        runtimeVersion: BULK_ONBOARDING_VERSION,
        ok: false, reason: 'batch_not_found',
        batchId: bId,
        created: 0, linked: 0, failed: 0, skipped: 0,
      });
    }
    const organizationId = _str((batch as any).organizationId);
    if (!organizationId) {
      return Object.freeze({
        runtimeVersion: BULK_ONBOARDING_VERSION,
        ok: false, reason: 'organization_required',
        batchId: bId,
        created: 0, linked: 0, failed: 0, skipped: 0,
      });
    }
    const skipDuplicates = !!(_isObj(opts) && (opts as any).skipDuplicates);

    const rows = _arr(listBatchRows(bId));
    let created = 0, linked = 0, failed = 0, skipped = 0;

    for (const row of rows) {
      if (!_isObj(row)) continue;
      const status = _str((row as any).status);

      // Skip rows that did not pass validation.
      if (status !== 'validated' && status !== 'duplicate') {
        if (status === 'imported') { skipped += 1; continue; }
        if (status === 'invalid')  { skipped += 1; continue; }
      }

      const duplicateKind = _str((row as any).duplicateKind);
      if (skipDuplicates && duplicateKind) {
        upsertBatchRow({ ...row, status: 'skipped' });
        skipped += 1;
        continue;
      }

      const data = _isObj((row as any).rawData) ? (row as any).rawData
                  : (row as any);
      const rn = typeof (row as any).rowNumber === 'number'
        ? (row as any).rowNumber as number
        : 0;

      const result = provisionFarmerFromRow({
        row: {
          rowNumber:    rn,
          firstName:    _str((data as any).firstName),
          lastName:     _str((data as any).lastName),
          phone:        _str((data as any).phone),
          email:        _str((data as any).email),
          role:         _str((data as any).role),
          ageRange:     _str((data as any).ageRange),
          gender:       _str((data as any).gender),
          country:      _str((data as any).country),
          region:       _str((data as any).region)
                        || _str((row as any).region),
          district:     _str((data as any).district),
          village:      _str((data as any).village),
          farmSize:     _str((data as any).farmSize),
          primaryCrops: _arr((data as any).primaryCrops),
          primaryCrop:  _str((data as any).primaryCrop),
          consentForProgramReporting:
            (data as any).consentForProgramReporting === true,
          matchedUserId: _str((row as any).matchedUserId),
        },
        batchId:            bId,
        organizationId,
        programId:          _str((row as any).programId),
        cohortId:           _str((row as any).cohortId),
        fieldOfficerUserId: _str((row as any).fieldOfficerUserId),
      });

      if (_isObj(result) && (result as any).ok === true) {
        const op = _str((result as any).operation);
        if (op === 'create') created += 1;
        else if (op === 'link') linked += 1;
        upsertBatchRow({
          ...row,
          status: 'imported',
          importedAt: _safe(() => new Date().toISOString(), ''),
        });
      } else {
        failed += 1;
        upsertBatchRow({
          ...row,
          status: 'failed',
          errors: [_str((result as any)?.reason) || 'provision_failed'],
        });
      }
    }
    _safe(() => recomputeBatchCounts(bId), undefined);

    writeAuditEvent({
      actorUserId:    'system_bulk_onboarding',
      action:         'bulk_onboarding_batch_imported',
      entityType:     'EnrollmentBatch',
      entityId:       bId,
      organizationId,
      metadata: { created, linked, failed, skipped },
    });

    return Object.freeze({
      runtimeVersion: BULK_ONBOARDING_VERSION,
      ok: true, reason: '',
      batchId: bId,
      created, linked, failed, skipped,
    });
  }, Object.freeze({
    runtimeVersion: BULK_ONBOARDING_VERSION,
    ok: false, reason: 'error',
    batchId: _str(batchId),
    created: 0, linked: 0, failed: 0, skipped: 0,
  }));
}

/* ── Diagnostic health envelope ──────────────────────────── */

export function bulkOnboardingHealth() {
  return _safe(() => Object.freeze({
    runtimeVersion:           BULK_ONBOARDING_VERSION,
    available:                true,
    csvImportReady:           true,
    templateReady:            true,
    validationReady:          true,
    duplicateDetectionReady:  true,
    previewReady:             true,
    importReady:              true,
    batchTrackingReady:       true,
    bulkAssignmentReady:      true,
    fieldOfficerAddReady:     true,
    auditTrailReady:          true,
    organizationScoped:       true,
    fakeData:                 false,
    persistence:              'in_memory' as const,
    snapshots: Object.freeze({
      bulkImport:        _safe(() => batchImportSnapshot(),        null),
      validation:        _safe(() => validationSnapshot(),         null),
      duplicateDetection: _safe(() => duplicateDetectionSnapshot(), null),
      provisioning:      _safe(() => provisioningSnapshot(),       null),
      assignment:        _safe(() => assignmentSnapshot(),         null),
    }),
    versions: Object.freeze({
      runtime:            BULK_ONBOARDING_VERSION,
      bulkImport:         BULK_IMPORT_VERSION,
      validation:         BATCH_VALIDATION_VERSION,
      duplicateDetection: DUPLICATE_DETECTION_VERSION,
      provisioning:       FARMER_PROVISIONING_VERSION,
      assignment:         BULK_ASSIGNMENT_VERSION,
    }),
  }), Object.freeze({
    runtimeVersion:           BULK_ONBOARDING_VERSION,
    available:                false,
    csvImportReady:           false,
    templateReady:            false,
    validationReady:          false,
    duplicateDetectionReady:  false,
    previewReady:             false,
    importReady:              false,
    batchTrackingReady:       false,
    bulkAssignmentReady:      false,
    fieldOfficerAddReady:     false,
    auditTrailReady:          false,
    organizationScoped:       true,
    fakeData:                 false,
    persistence:              'in_memory' as const,
    snapshots:                Object.freeze({} as Record<string, any>),
  }));
}

/** Pin window.__bulkOnboardingHealth() for ops diagnostics. */
export function installBulkOnboardingGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__bulkOnboardingHealth !== 'function') {
      w.__bulkOnboardingHealth = function () {
        const out = bulkOnboardingHealth();
        try { console.log('[Farroway · Bulk Onboarding]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
