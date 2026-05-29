// src/runtime/organization/onboarding/BatchValidationEngine.ts
// Farroway bulk onboarding — batch validation shim.
//
// Re-exports validateRow from CSVImportEngine and pins the spec
// version so callers (BulkOnboardingRuntime) can verify contract
// alignment.
//
// Strict-rule audit
//   • Pure re-export. SSR-safe. Never throws.

import { BULK_ONBOARDING_VERSION } from "./onboardingContracts";
import {
  CSV_IMPORT_ENGINE_VERSION,
  validateRow as _validateRow,
} from "./CSVImportEngine";

export const BATCH_VALIDATION_VERSION =
  "farroway-bulk-onboarding-validation-engine-v1";

export const validateRow = _validateRow;

export function validationSnapshot(): Readonly<{
  runtimeVersion: string;
  bulkOnboardingVersion: string;
  csvEngine: string;
  scope: "organizationId";
}> {
  return Object.freeze({
    runtimeVersion: BATCH_VALIDATION_VERSION,
    bulkOnboardingVersion: BULK_ONBOARDING_VERSION,
    scope: "organizationId" as const,
    csvEngine: CSV_IMPORT_ENGINE_VERSION,
  });
}
