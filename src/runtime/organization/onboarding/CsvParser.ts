// src/runtime/organization/onboarding/CsvParser.ts
// Farroway bulk onboarding — CSV parser facade.
//
// Spec-named module for the Wave 17 hard-gate. Re-exports the
// concrete CSV ingestion surface implemented by CSVImportEngine
// and tags the spec version.
//
// Strict-rule audit
//   • Pure runtime. No React. No fetch. No localStorage writes.
//   • Frozen envelopes flow through; this module adds none of its own.

import { BULK_ONBOARDING_VERSION } from "./onboardingContracts";

export const CSV_PARSER_RUNTIME_VERSION =
  "farroway-bulk-onboarding-csv-parser-v1";

export const CSV_PARSER_CONTRACT = Object.freeze({
  runtimeVersion: CSV_PARSER_RUNTIME_VERSION,
  bulkOnboardingVersion: BULK_ONBOARDING_VERSION,
});

export * from "./CSVImportEngine";
