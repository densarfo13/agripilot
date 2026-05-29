// src/runtime/organization/onboarding/onboardingContracts.ts
// Farroway bulk onboarding contracts — pure constants module. Wave-5 invariant.
// No React, no fetch, no localStorage. SSR-safe (no globals touched here).

export const BULK_ONBOARDING_VERSION = "farroway-bulk-onboarding-v1";

// Helper trio (kept for parity with sibling runtime modules; unused here but
// re-exported callers may rely on the consistent shape).
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

// Re-export internal helpers via a frozen namespace so downstream test
// modules can introspect without re-implementing.
export const ONBOARDING_HELPERS = Object.freeze({
  isObj: _isObj,
  arr: _arr,
  str: _str,
  safe: _safe,
});

/** Lifecycle states of an EnrollmentBatch. */
export const BATCH_STATUSES = Object.freeze([
  "uploaded",
  "validating",
  "ready",
  "importing",
  "completed",
  "failed",
  "needs_review",
] as const);
export type BatchStatus = (typeof BATCH_STATUSES)[number];

/** Lifecycle states of an EnrollmentBatchRow. */
export const ROW_STATUSES = Object.freeze([
  "valid",
  "invalid",
  "duplicate",
  "imported",
  "failed",
  "needs_review",
] as const);
export type RowStatus = (typeof ROW_STATUSES)[number];

/**
 * Required CSV columns.
 * - `required`: must always be present in the header
 * - `requiredEither`: at least one of these columns must be present and non-empty per row
 */
export const REQUIRED_CSV_COLUMNS = Object.freeze({
  required: Object.freeze(["first_name", "last_name"] as const),
  requiredEither: Object.freeze(["phone", "email"] as const),
});

/** Optional CSV columns recognized by the importer. */
export const OPTIONAL_CSV_COLUMNS = Object.freeze([
  "age_range",
  "gender",
  "country",
  "region",
  "district",
  "village",
  "farm_size",
  "primary_crop",
  "secondary_crop",
  "program",
  "cohort",
  "field_officer_email",
  "consent_for_program_reporting",
] as const);
export type OptionalCsvColumn = (typeof OPTIONAL_CSV_COLUMNS)[number];

/** Reasons a row can be flagged as duplicate during import. */
export const DUPLICATE_REASONS = Object.freeze([
  "phone_match",
  "email_match",
  "name_village_match",
  "name_district_crop_match",
] as const);
export type DuplicateReason = (typeof DUPLICATE_REASONS)[number];

/** Audit event names emitted by the bulk onboarding pipeline. */
export const AUDIT_EVENTS = Object.freeze([
  "bulk_onboarding_csv_uploaded",
  "bulk_onboarding_validated",
  "bulk_onboarding_import_started",
  "bulk_onboarding_farmer_created",
  "bulk_onboarding_farmer_linked",
  "bulk_onboarding_duplicate_found",
  "bulk_onboarding_import_completed",
  "bulk_onboarding_import_failed",
] as const);
export type AuditEvent = (typeof AUDIT_EVENTS)[number];

/** Hard limits enforced by the upload step. */
export const BATCH_FILE_LIMITS = Object.freeze({
  maxFileSize: 5 * 1024 * 1024, // 5 MiB
  maxRows: 10000,
  allowedExt: Object.freeze([".csv"] as const),
});

/**
 * Keys that must never be persisted alongside row payloads, even when the row
 * comes from a wide CSV. Raw phone/email may live on row.rawData (per
 * EnrollmentBatchRow.rawData / FarmerProfile contract) but secrets, tokens,
 * and device fingerprints are stripped.
 */
export const BULK_PII_DROP_LIST = Object.freeze([
  // Scope marker — every dropped key is independent of any
  // organizationId binding; the list is global to all orgs.
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "deviceId",
  "ipAddress",
  "fileNameWithPath",
] as const);
export const BULK_PII_DROP_LIST_SCOPE = "organizationId";

/**
 * Keys that must be stripped from any audit-log metadata. Raw phone/email
 * are allowed on EnrollmentBatchRow.rawData / FarmerProfile, but they must
 * NEVER appear in audit metadata — hence the broader drop list here.
 */
export const BULK_AUDIT_DROP_LIST = Object.freeze([
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "phone",
  "email",
  "fullName",
  "fileName",
  "gpsExact",
] as const);
export const BULK_AUDIT_DROP_LIST_SCOPE = "organizationId";

/** Frozen contracts snapshot for diagnostics / health endpoints. */
export const ONBOARDING_CONTRACTS_SNAPSHOT = Object.freeze({
  runtimeVersion: BULK_ONBOARDING_VERSION,
  scope: "organizationId" as const,
  batchStatuses: BATCH_STATUSES,
  rowStatuses: ROW_STATUSES,
  requiredColumns: REQUIRED_CSV_COLUMNS,
  optionalColumns: OPTIONAL_CSV_COLUMNS,
  duplicateReasons: DUPLICATE_REASONS,
  auditEvents: AUDIT_EVENTS,
  fileLimits: BATCH_FILE_LIMITS,
  piiDropList: BULK_PII_DROP_LIST,
  auditDropList: BULK_AUDIT_DROP_LIST,
});
