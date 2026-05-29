// src/runtime/organization/onboarding/BatchRuntime.ts
// Farroway bulk onboarding — batch + row state facade.
//
// Spec-named module for the Wave 17 hard-gate. Re-exports the
// concrete batch/row store implemented by EnrollmentBatchRuntime
// and the bulk-assignment helpers from BulkAssignmentRuntime, and
// tags the spec version.
//
// Strict-rule audit
//   • Pure in-memory store. SSR-safe. Never throws.
//   • Frozen envelopes. No persistence. No React.

import { BULK_ONBOARDING_VERSION } from "./onboardingContracts";

export const BATCH_RUNTIME_VERSION =
  "farroway-bulk-onboarding-batch-runtime-v1";

export const BATCH_RUNTIME_CONTRACT = Object.freeze({
  runtimeVersion: BATCH_RUNTIME_VERSION,
  bulkOnboardingVersion: BULK_ONBOARDING_VERSION,
});

export * from "./EnrollmentBatchRuntime";
export * from "./BulkAssignmentRuntime";
