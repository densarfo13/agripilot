/**
 * src/runtime/persistence/persistenceContracts.ts — frozen
 * types + enums for the Production Persistence runtime.
 *
 * Strict-rule audit
 *   • Pure data declarations only.
 *   • No React / DOM types.
 *   • No PII handled.
 */

export const PERSISTENCE_RUNTIME_VERSION = 'persistence-runtime-v1';

export const PERSISTENCE_MODE = Object.freeze({
  POSTGRES:    'postgres',
  IN_MEMORY:   'in_memory',
  UNAVAILABLE: 'unavailable',
} as const);

export type PersistenceModeValue =
  typeof PERSISTENCE_MODE[keyof typeof PERSISTENCE_MODE];

export interface PersistenceHealth {
  runtimeVersion:           string;
  initialized:              boolean;
  mode:                     PersistenceModeValue;
  databaseUrlPresent:       boolean;
  prismaClientReady:        boolean;
  migrationsApplied:        boolean;
  productionWritesEnabled:  boolean;
  writeEndpointsSafe:       boolean;
  isProduction:             boolean;
  /**
   * Wave-39 — true iff the canonical critical-write list has been
   * end-to-end validated against the live Prisma client (operator
   * runs `npm run validate:persistence`). Reported by the server's
   * /api/health envelope when set; falls back to
   * `productionWritesEnabled` for default-honest behaviour.
   */
  criticalWritesPersisted:  boolean;
  lastProbedAt?:            string;
  probeError?:              string;
}

/** Result of PersistenceGuard.requireWritablePersistence(). */
export interface PersistenceGuardResult {
  ok:               boolean;
  mode:             PersistenceModeValue;
  reason?:          string;
  safeUserMessage?: string;
}

/**
 * Safe user-facing 503 message — NEVER reveals stack traces or
 * config details. Used by all write endpoints when persistence
 * is unavailable.
 */
export const SAFE_503_MESSAGE =
  'Farroway is temporarily unable to save this record. Please try again shortly.';

/**
 * Production-critical models that must exist in the Prisma schema
 * before production writes are considered safe. CI gate
 * check-prisma-production-ready enforces this list.
 */
// Canonical names from THIS codebase's Prisma schema. See also the
// CI gate at scripts/check-prisma-production-ready.mjs. The
// conceptual-vs-actual mapping is:
//   conceptual FarmerProfile       → actual Farmer
//   conceptual ProgramEnrollment   → actual Application
//   conceptual SellListing         → actual CropListing
//   conceptual AuditEvent          → actual AuditLog
//   conceptual Artifact            → actual EvidenceFile
//   conceptual ImpactRecord        → staged ImpactReport
//   conceptual EnrollmentBatch*    → staged EnrollmentBatch*
export const REQUIRED_PRISMA_MODELS = Object.freeze([
  'User',
  'Farmer',
  'Organization',
  'Program',
  'Application',
  'CropListing',
  'BuyerInterest',
  'AuditLog',
  'EvidenceFile',
] as const);

/** Staged models — live in server/prisma/_pending-migrations/. */
export const STAGED_PRISMA_MODELS = Object.freeze([
  'EnrollmentBatch',
  'EnrollmentBatchRow',
  'ImpactReport',
] as const);
