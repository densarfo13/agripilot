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
export const REQUIRED_PRISMA_MODELS = Object.freeze([
  'User',
  'FarmerProfile',
  'Organization',
  'Program',
  'ProgramEnrollment',
  'EnrollmentBatch',
  'EnrollmentBatchRow',
  'SellListing',
  'BuyerInterest',
  'AuditEvent',
  'Artifact',
  'ImpactRecord',
] as const);
