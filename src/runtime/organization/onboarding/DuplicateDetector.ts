// src/runtime/organization/onboarding/DuplicateDetector.ts
// Farroway bulk onboarding — duplicate detector facade.
//
// Spec-named module for the Wave 17 hard-gate. Re-exports the
// concrete duplicate-detection surface implemented by
// DuplicateDetectionEngine and tags the spec version.
//
// Strict-rule audit
//   • Pure runtime. No React. No fetch. No localStorage writes.

import { BULK_ONBOARDING_VERSION } from "./onboardingContracts";

export const DUPLICATE_DETECTOR_RUNTIME_VERSION =
  "farroway-bulk-onboarding-duplicate-detector-v1";

export const DUPLICATE_DETECTOR_CONTRACT = Object.freeze({
  runtimeVersion: DUPLICATE_DETECTOR_RUNTIME_VERSION,
  bulkOnboardingVersion: BULK_ONBOARDING_VERSION,
});

export * from "./DuplicateDetectionEngine";
