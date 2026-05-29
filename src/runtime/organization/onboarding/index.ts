/**
 * src/runtime/organization/onboarding/index.ts — Bulk-onboarding
 * runtime barrel. Re-exports EVERYTHING from the seven files in
 * the directory: the contracts module, the two part-1 engines
 * (CSV import + row validation), and the four part-2 modules
 * (duplicate detection, provisioning, bulk assignment, composite
 * facade).
 *
 *   import {
 *     uploadCSV, validateBatch,
 *     resolveDuplicatesPreview, importBatch,
 *     bulkOnboardingHealth, installBulkOnboardingGlobal,
 *   } from 'src/runtime/organization/onboarding';
 *
 *   window.__bulkOnboardingHealth()  // pinned after boot
 *
 * Strict-rule audit
 *   • Pure re-export. SSR-safe. Never throws.
 *   • No fetch / persistence / React.
 */

import { BULK_ONBOARDING_VERSION } from './onboardingContracts';

export const ONBOARDING_BARREL_RUNTIME_VERSION =
  'farroway-bulk-onboarding-barrel-v1';

export const ONBOARDING_BARREL_CONTRACT = Object.freeze({
  runtimeVersion: ONBOARDING_BARREL_RUNTIME_VERSION,
  bulkOnboardingVersion: BULK_ONBOARDING_VERSION,
});

// ─── Part 1: contracts + parsing/validation facades ─────────────
export * from './onboardingContracts';
export * from './CsvParser';
export * from './CsvValidator';

// ─── Part 2: detection / provisioning / batch state / audit ─────
export * from './DuplicateDetector';
export * from './FarmerProvisioner';
export * from './BatchRuntime';
export * from './BulkOnboardingAudit';

// ─── Composite facade — exposes installBulkOnboardingGlobal() ───
export * from './BulkOnboardingRuntime';
