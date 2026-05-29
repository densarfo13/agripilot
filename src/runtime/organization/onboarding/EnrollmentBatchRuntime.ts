// src/runtime/organization/onboarding/EnrollmentBatchRuntime.ts
// Farroway in-memory enrollment batch + row store.
// Wave-5 invariant: in_memory persistence only. No localStorage writes.
// All returned envelopes are FROZEN. _safe wraps fallible code.

import {
  BATCH_STATUSES,
  ROW_STATUSES,
  DUPLICATE_REASONS,
  type BatchStatus,
  type RowStatus,
  type DuplicateReason,
} from "./onboardingContracts";

export const ENROLLMENT_BATCH_RUNTIME_VERSION =
  "farroway-enrollment-batch-runtime-v1";

// ---------------------------------------------------------------------------
// Helper trio
// ---------------------------------------------------------------------------
const _isObj = (v: unknown): v is Record<string, unknown> =>
  v != null && typeof v === "object";
const _arr = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const _str = (v: unknown): string => (typeof v === "string" ? v : "");
const _safe = <T>(fn: () => T, fb: T): T => {
  try {
    return fn();
  } catch {
    return fb;
  }
};

const _nonEmptyStr = (v: unknown): string => {
  const s = _str(v).trim();
  return s;
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnrollmentBatch {
  readonly batchId: string;
  readonly organizationId: string;
  readonly programId: string | null;
  readonly cohortId: string | null;
  readonly uploadedByUserId: string;
  readonly fileName: string;
  readonly status: BatchStatus;
  readonly totalRows: number;
  readonly validRows: number;
  readonly invalidRows: number;
  readonly duplicateRows: number;
  readonly importedRows: number;
  readonly failedRows: number;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface EnrollmentBatchRow {
  readonly batchId: string;
  readonly rowNumber: number;
  readonly rawData: Readonly<Record<string, unknown>>;
  readonly normalizedData: Readonly<Record<string, unknown>> | null;
  readonly status: RowStatus;
  readonly errorMessage: string;
  readonly duplicateReason: DuplicateReason | null;
  readonly matchedUserId: string | null;
  readonly createdUserId: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface BatchRuntimeSnapshot {
  readonly runtimeVersion: string;
  readonly organizationId: string | null;
  readonly batchCount: number;
  readonly rowCount: number;
  readonly batchesByStatus: Readonly<Record<BatchStatus, number>>;
  readonly rowsByStatus: Readonly<Record<RowStatus, number>>;
}

// ---------------------------------------------------------------------------
// In-memory stores. NOTE: persistence layer is in_memory until supervised
// Prisma deploy lands. Do not introduce localStorage / fetch here.
// ---------------------------------------------------------------------------

const _batches = new Map<string, EnrollmentBatch>();
const _rows = new Map<string, EnrollmentBatchRow>(); // key: `${batchId}:${rowNumber}`

const _rowKey = (batchId: string, rowNumber: number): string =>
  `${batchId}:${rowNumber}`;

const _now = (): number => _safe(() => Date.now(), 0);

const _isBatchStatus = (v: unknown): v is BatchStatus =>
  typeof v === "string" && (BATCH_STATUSES as ReadonlyArray<string>).includes(v);

const _isRowStatus = (v: unknown): v is RowStatus =>
  typeof v === "string" && (ROW_STATUSES as ReadonlyArray<string>).includes(v);

const _isDuplicateReason = (v: unknown): v is DuplicateReason =>
  typeof v === "string" &&
  (DUPLICATE_REASONS as ReadonlyArray<string>).includes(v);

// ---------------------------------------------------------------------------
// upsertBatch
// ---------------------------------------------------------------------------

export interface UpsertBatchInput {
  batchId?: string;
  organizationId: string;
  programId?: string | null;
  cohortId?: string | null;
  uploadedByUserId: string;
  fileName: string;
  totalRows?: number;
  status?: BatchStatus;
}

export interface UpsertResult<T> {
  readonly ok: boolean;
  readonly reason: string;
  readonly record: T | null;
}

const FROZEN_BATCH_FAIL: UpsertResult<EnrollmentBatch> = Object.freeze({
  ok: false,
  reason: "upsert_error",
  record: null,
});

const FROZEN_ROW_FAIL: UpsertResult<EnrollmentBatchRow> = Object.freeze({
  ok: false,
  reason: "upsert_error",
  record: null,
});

let _batchSeq = 0;
const _nextBatchId = (): string => {
  _batchSeq += 1;
  return `batch_${_now()}_${_batchSeq}`;
};

/**
 * Creates or updates an EnrollmentBatch. Required: organizationId,
 * uploadedByUserId, fileName. Fails closed if organizationId missing.
 */
export function upsertBatch(input: unknown): UpsertResult<EnrollmentBatch> {
  return _safe<UpsertResult<EnrollmentBatch>>(() => {
    if (!_isObj(input)) {
      return Object.freeze({
        ok: false,
        reason: "invalid_input",
        record: null,
      });
    }
    const i = input as UpsertBatchInput;

    const organizationId = _nonEmptyStr(i.organizationId);
    if (organizationId === "") {
      return Object.freeze({
        ok: false,
        reason: "missing_organization_id",
        record: null,
      });
    }
    const uploadedByUserId = _nonEmptyStr(i.uploadedByUserId);
    if (uploadedByUserId === "") {
      return Object.freeze({
        ok: false,
        reason: "missing_uploaded_by_user_id",
        record: null,
      });
    }
    const fileName = _nonEmptyStr(i.fileName);
    if (fileName === "") {
      return Object.freeze({
        ok: false,
        reason: "missing_file_name",
        record: null,
      });
    }

    const status: BatchStatus = _isBatchStatus(i.status) ? i.status : "uploaded";

    const totalRows =
      typeof i.totalRows === "number" && i.totalRows >= 0 ? Math.floor(i.totalRows) : 0;

    const now = _now();
    const existingId = _nonEmptyStr(i.batchId);
    const batchId = existingId !== "" ? existingId : _nextBatchId();
    const existing = _batches.get(batchId) ?? null;

    const programId =
      i.programId === undefined
        ? existing?.programId ?? null
        : _nonEmptyStr(i.programId) === ""
          ? null
          : _nonEmptyStr(i.programId);
    const cohortId =
      i.cohortId === undefined
        ? existing?.cohortId ?? null
        : _nonEmptyStr(i.cohortId) === ""
          ? null
          : _nonEmptyStr(i.cohortId);

    const record: EnrollmentBatch = Object.freeze({
      batchId,
      organizationId,
      programId,
      cohortId,
      uploadedByUserId,
      fileName,
      status,
      totalRows: existing ? Math.max(existing.totalRows, totalRows) : totalRows,
      validRows: existing?.validRows ?? 0,
      invalidRows: existing?.invalidRows ?? 0,
      duplicateRows: existing?.duplicateRows ?? 0,
      importedRows: existing?.importedRows ?? 0,
      failedRows: existing?.failedRows ?? 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });

    _batches.set(batchId, record);
    return Object.freeze({ ok: true, reason: "ok", record });
  }, FROZEN_BATCH_FAIL);
}

// ---------------------------------------------------------------------------
// upsertBatchRow
// ---------------------------------------------------------------------------

export interface UpsertBatchRowInput {
  batchId: string;
  rowNumber: number;
  rawData: Record<string, unknown>;
  normalizedData?: Record<string, unknown> | null;
  status: RowStatus;
  errorMessage?: string;
  duplicateReason?: DuplicateReason | null;
  matchedUserId?: string | null;
  createdUserId?: string | null;
}

export function upsertBatchRow(
  input: unknown,
): UpsertResult<EnrollmentBatchRow> {
  return _safe<UpsertResult<EnrollmentBatchRow>>(() => {
    if (!_isObj(input)) {
      return Object.freeze({
        ok: false,
        reason: "invalid_input",
        record: null,
      });
    }
    const i = input as UpsertBatchRowInput;

    const batchId = _nonEmptyStr(i.batchId);
    if (batchId === "") {
      return Object.freeze({
        ok: false,
        reason: "missing_batch_id",
        record: null,
      });
    }
    if (!_batches.has(batchId)) {
      return Object.freeze({
        ok: false,
        reason: "batch_not_found",
        record: null,
      });
    }
    if (typeof i.rowNumber !== "number" || !Number.isFinite(i.rowNumber) || i.rowNumber < 0) {
      return Object.freeze({
        ok: false,
        reason: "invalid_row_number",
        record: null,
      });
    }
    if (!_isRowStatus(i.status)) {
      return Object.freeze({
        ok: false,
        reason: "invalid_row_status",
        record: null,
      });
    }
    if (!_isObj(i.rawData)) {
      return Object.freeze({
        ok: false,
        reason: "missing_raw_data",
        record: null,
      });
    }

    const rowNumber = Math.floor(i.rowNumber);
    const key = _rowKey(batchId, rowNumber);
    const existing = _rows.get(key) ?? null;
    const now = _now();

    const rawData = Object.freeze({ ...i.rawData });
    const normalizedData = _isObj(i.normalizedData)
      ? Object.freeze({ ...(i.normalizedData as Record<string, unknown>) })
      : i.normalizedData === undefined
        ? existing?.normalizedData ?? null
        : null;

    const duplicateReason =
      i.duplicateReason === undefined
        ? existing?.duplicateReason ?? null
        : i.duplicateReason === null
          ? null
          : _isDuplicateReason(i.duplicateReason)
            ? i.duplicateReason
            : null;

    const record: EnrollmentBatchRow = Object.freeze({
      batchId,
      rowNumber,
      rawData,
      normalizedData,
      status: i.status,
      errorMessage: _str(i.errorMessage),
      duplicateReason,
      matchedUserId:
        i.matchedUserId === undefined
          ? existing?.matchedUserId ?? null
          : _nonEmptyStr(i.matchedUserId) === ""
            ? null
            : _nonEmptyStr(i.matchedUserId),
      createdUserId:
        i.createdUserId === undefined
          ? existing?.createdUserId ?? null
          : _nonEmptyStr(i.createdUserId) === ""
            ? null
            : _nonEmptyStr(i.createdUserId),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });

    _rows.set(key, record);
    return Object.freeze({ ok: true, reason: "ok", record });
  }, FROZEN_ROW_FAIL);
}

// ---------------------------------------------------------------------------
// setBatchStatus + recomputeBatchCounts
// ---------------------------------------------------------------------------

export function setBatchStatus(
  batchId: unknown,
  status: unknown,
): UpsertResult<EnrollmentBatch> {
  return _safe<UpsertResult<EnrollmentBatch>>(() => {
    const id = _nonEmptyStr(batchId);
    if (id === "") {
      return Object.freeze({
        ok: false,
        reason: "missing_batch_id",
        record: null,
      });
    }
    if (!_isBatchStatus(status)) {
      return Object.freeze({
        ok: false,
        reason: "invalid_batch_status",
        record: null,
      });
    }
    const existing = _batches.get(id);
    if (!existing) {
      return Object.freeze({
        ok: false,
        reason: "batch_not_found",
        record: null,
      });
    }
    const next: EnrollmentBatch = Object.freeze({
      ...existing,
      status,
      updatedAt: _now(),
    });
    _batches.set(id, next);
    return Object.freeze({ ok: true, reason: "ok", record: next });
  }, FROZEN_BATCH_FAIL);
}

/**
 * Recomputes totalRows / validRows / invalidRows / duplicateRows /
 * importedRows / failedRows for a batch from the current row store.
 * needs_review rows are counted toward neither valid nor invalid totals.
 */
export function recomputeBatchCounts(
  batchId: unknown,
): UpsertResult<EnrollmentBatch> {
  return _safe<UpsertResult<EnrollmentBatch>>(() => {
    const id = _nonEmptyStr(batchId);
    if (id === "") {
      return Object.freeze({
        ok: false,
        reason: "missing_batch_id",
        record: null,
      });
    }
    const existing = _batches.get(id);
    if (!existing) {
      return Object.freeze({
        ok: false,
        reason: "batch_not_found",
        record: null,
      });
    }

    let total = 0;
    let valid = 0;
    let invalid = 0;
    let duplicate = 0;
    let imported = 0;
    let failed = 0;

    for (const row of _rows.values()) {
      if (row.batchId !== id) continue;
      total += 1;
      switch (row.status) {
        case "valid":
          valid += 1;
          break;
        case "invalid":
          invalid += 1;
          break;
        case "duplicate":
          duplicate += 1;
          break;
        case "imported":
          imported += 1;
          break;
        case "failed":
          failed += 1;
          break;
        case "needs_review":
        default:
          break;
      }
    }

    const next: EnrollmentBatch = Object.freeze({
      ...existing,
      totalRows: total,
      validRows: valid,
      invalidRows: invalid,
      duplicateRows: duplicate,
      importedRows: imported,
      failedRows: failed,
      updatedAt: _now(),
    });
    _batches.set(id, next);
    return Object.freeze({ ok: true, reason: "ok", record: next });
  }, FROZEN_BATCH_FAIL);
}

// ---------------------------------------------------------------------------
// listBatches / listBatchRows
// ---------------------------------------------------------------------------

export interface ListBatchesInput {
  organizationId: string;
  limit?: number;
}

const EMPTY_BATCH_LIST: ReadonlyArray<EnrollmentBatch> = Object.freeze([]);
const EMPTY_ROW_LIST: ReadonlyArray<EnrollmentBatchRow> = Object.freeze([]);

/** Org-scoped list of batches; fails closed (empty) if organizationId missing. */
export function listBatches(
  input: unknown,
): ReadonlyArray<EnrollmentBatch> {
  return _safe<ReadonlyArray<EnrollmentBatch>>(() => {
    if (!_isObj(input)) return EMPTY_BATCH_LIST;
    const i = input as ListBatchesInput;
    const organizationId = _nonEmptyStr(i.organizationId);
    if (organizationId === "") return EMPTY_BATCH_LIST;

    const limit =
      typeof i.limit === "number" && i.limit > 0 ? Math.floor(i.limit) : Infinity;

    const out: EnrollmentBatch[] = [];
    for (const b of _batches.values()) {
      if (b.organizationId === organizationId) out.push(b);
    }
    // Newest first
    out.sort((a, b) => b.createdAt - a.createdAt);
    const sliced = Number.isFinite(limit) ? out.slice(0, limit) : out;
    return Object.freeze(sliced);
  }, EMPTY_BATCH_LIST);
}

export interface ListBatchRowsInput {
  batchId: string;
  organizationId?: string;
  status?: RowStatus;
  limit?: number;
}

/** Scoped by batchId (which inherits its parent batch's organizationId). */
export function listBatchRows(
  input: unknown,
): ReadonlyArray<EnrollmentBatchRow> {
  return _safe<ReadonlyArray<EnrollmentBatchRow>>(() => {
    if (!_isObj(input)) return EMPTY_ROW_LIST;
    const i = input as ListBatchRowsInput;
    const batchId = _nonEmptyStr(i.batchId);
    if (batchId === "") return EMPTY_ROW_LIST;
    const organizationId = _nonEmptyStr(i.organizationId);
    void organizationId;

    const statusFilter: RowStatus | null = _isRowStatus(i.status) ? i.status : null;
    const limit =
      typeof i.limit === "number" && i.limit > 0 ? Math.floor(i.limit) : Infinity;

    const out: EnrollmentBatchRow[] = [];
    for (const r of _rows.values()) {
      if (r.batchId !== batchId) continue;
      if (statusFilter !== null && r.status !== statusFilter) continue;
      out.push(r);
    }
    out.sort((a, b) => a.rowNumber - b.rowNumber);
    const sliced = Number.isFinite(limit) ? out.slice(0, limit) : out;
    return Object.freeze(sliced);
  }, EMPTY_ROW_LIST);
}

// ---------------------------------------------------------------------------
// batchRuntimeSnapshot
// ---------------------------------------------------------------------------

const _zeroBatchesByStatus = (): Record<BatchStatus, number> => {
  const o = {} as Record<BatchStatus, number>;
  for (const s of BATCH_STATUSES) o[s] = 0;
  return o;
};
const _zeroRowsByStatus = (): Record<RowStatus, number> => {
  const o = {} as Record<RowStatus, number>;
  for (const s of ROW_STATUSES) o[s] = 0;
  return o;
};

const EMPTY_SNAPSHOT: BatchRuntimeSnapshot = Object.freeze({
  runtimeVersion: ENROLLMENT_BATCH_RUNTIME_VERSION,
  organizationId: null,
  batchCount: 0,
  rowCount: 0,
  batchesByStatus: Object.freeze(_zeroBatchesByStatus()),
  rowsByStatus: Object.freeze(_zeroRowsByStatus()),
});

/**
 * Frozen counts envelope. When orgId is provided, scopes batches (and the
 * rows belonging to those batches) to that organization.
 *
 * Empty-state surfaces a frozen envelope, not a thrown error. UI layer should
 * render the literal "Not enough data yet" when batchCount + rowCount === 0.
 */
export function batchRuntimeSnapshot(orgId?: unknown): BatchRuntimeSnapshot {
  return _safe<BatchRuntimeSnapshot>(() => {
    const organizationId =
      orgId === undefined || orgId === null ? null : _nonEmptyStr(orgId);

    // Org-scoped helpers must fail closed when orgId is provided but empty.
    if (orgId !== undefined && orgId !== null && organizationId === "") {
      return EMPTY_SNAPSHOT;
    }

    const batchesByStatus = _zeroBatchesByStatus();
    const rowsByStatus = _zeroRowsByStatus();
    let batchCount = 0;
    let rowCount = 0;

    const includedBatchIds = new Set<string>();

    for (const b of _batches.values()) {
      if (organizationId !== null && b.organizationId !== organizationId) continue;
      batchCount += 1;
      batchesByStatus[b.status] += 1;
      includedBatchIds.add(b.batchId);
    }

    for (const r of _rows.values()) {
      if (organizationId !== null && !includedBatchIds.has(r.batchId)) continue;
      rowCount += 1;
      rowsByStatus[r.status] += 1;
    }

    return Object.freeze({
      runtimeVersion: ENROLLMENT_BATCH_RUNTIME_VERSION,
      organizationId,
      batchCount,
      rowCount,
      batchesByStatus: Object.freeze(batchesByStatus),
      rowsByStatus: Object.freeze(rowsByStatus),
    });
  }, EMPTY_SNAPSHOT);
}

// ---------------------------------------------------------------------------
// Test-only reset hook (NOT exported via index). Wave-5 invariant: callers
// must not use this in production; it exists purely to keep test isolation
// sane while persistence is in_memory.
// ---------------------------------------------------------------------------
export function __resetEnrollmentBatchRuntimeForTests(): void {
  _safe(() => {
    _batches.clear();
    _rows.clear();
    _batchSeq = 0;
  }, undefined);
}
