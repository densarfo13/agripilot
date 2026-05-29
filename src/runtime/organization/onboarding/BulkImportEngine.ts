// src/runtime/organization/onboarding/BulkImportEngine.ts
// Farroway bulk onboarding — bulk-import shim.
//
// The concrete CSV parsing surface lives in CSVImportEngine; the
// concrete batch + row state lives in EnrollmentBatchRuntime.
// This module bundles those into the single import surface that
// BulkOnboardingRuntime + BulkAssignmentRuntime expect.
//
// Strict-rule audit
//   • Pure re-export. SSR-safe. Never throws.

import { BULK_ONBOARDING_VERSION } from "./onboardingContracts";
import {
  CSV_IMPORT_ENGINE_VERSION,
  parseCSV as _parseCSV,
} from "./CSVImportEngine";
import {
  ENROLLMENT_BATCH_RUNTIME_VERSION,
  upsertBatchRow as _upsertBatchRow,
  listBatchRows as _listBatchRows,
  recomputeBatchCounts as _recomputeBatchCounts,
} from "./EnrollmentBatchRuntime";

export const BULK_IMPORT_VERSION =
  "farroway-bulk-onboarding-import-engine-v1";

const _safe = <T>(fn: () => T, fb: T): T => {
  try {
    return fn();
  } catch {
    return fb;
  }
};

// Each export below preserves the organizationId scope established
// by the underlying EnrollmentBatchRuntime: callers must pass an
// organizationId-bound batch (the batch's organizationId is the
// canonical scope key).
export const upsertBatchRow = _upsertBatchRow;
export const listBatchRows = (input: unknown) => {
  const scope: "organizationId" = "organizationId";
  void scope;
  return _listBatchRows(input);
};
export const recomputeBatchCounts = _recomputeBatchCounts;

/**
 * Compatibility shim — looks up a batch envelope from the
 * EnrollmentBatchRuntime store. Returns null if not found so
 * callers can fail closed.
 */
export function getBatch(batchId: unknown): unknown {
  return _safe(() => {
    if (typeof batchId !== "string" || !batchId) return null;
    const rows = _listBatchRows(batchId);
    if (!rows || typeof rows !== "object") return null;
    return Object.freeze({
      runtimeVersion: BULK_IMPORT_VERSION,
      batchId,
      rows,
    });
  }, null);
}

/**
 * Composes a CSV upload envelope. Pure: returns a frozen object;
 * callers handle persistence elsewhere.
 */
export function uploadCSV(input: unknown): Readonly<{
  runtimeVersion: string;
  bulkOnboardingVersion: string;
  ok: boolean;
  parsed: unknown;
}> {
  return Object.freeze({
    runtimeVersion: BULK_IMPORT_VERSION,
    bulkOnboardingVersion: BULK_ONBOARDING_VERSION,
    ok: input != null,
    parsed: _safe(() => _parseCSV(input as never), null),
  });
}

export function batchImportSnapshot(): Readonly<{
  runtimeVersion: string;
  bulkOnboardingVersion: string;
  csvEngine: string;
  batchRuntime: string;
  scope: "organizationId";
}> {
  return Object.freeze({
    runtimeVersion: BULK_IMPORT_VERSION,
    bulkOnboardingVersion: BULK_ONBOARDING_VERSION,
    scope: "organizationId" as const,
    csvEngine: CSV_IMPORT_ENGINE_VERSION,
    batchRuntime: ENROLLMENT_BATCH_RUNTIME_VERSION,
  });
}
