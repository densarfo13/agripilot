// src/runtime/organization/onboarding/CsvValidator.ts
// Farroway bulk onboarding — CSV row validator facade.
//
// Spec-named module for the Wave 17 hard-gate. Validation logic
// lives inside CSVImportEngine (validateRow / normalizeRow) and
// the contracts module enumerates the canonical CSV columns; this
// file re-exports both surfaces under the spec-mandated name.
//
// Strict-rule audit
//   • Pure runtime. No React. No fetch. No localStorage writes.

import {
  BULK_ONBOARDING_VERSION,
  REQUIRED_CSV_COLUMNS,
  OPTIONAL_CSV_COLUMNS,
} from "./onboardingContracts";

export const CSV_VALIDATOR_RUNTIME_VERSION =
  "farroway-bulk-onboarding-csv-validator-v1";

export const CSV_VALIDATOR_CONTRACT = Object.freeze({
  runtimeVersion: CSV_VALIDATOR_RUNTIME_VERSION,
  bulkOnboardingVersion: BULK_ONBOARDING_VERSION,
  requiredColumns: REQUIRED_CSV_COLUMNS,
  optionalColumns: OPTIONAL_CSV_COLUMNS,
});

export {
  REQUIRED_CSV_COLUMNS,
  OPTIONAL_CSV_COLUMNS,
} from "./onboardingContracts";
