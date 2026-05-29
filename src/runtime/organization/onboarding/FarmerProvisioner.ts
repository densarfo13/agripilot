// src/runtime/organization/onboarding/FarmerProvisioner.ts
// Farroway bulk onboarding — farmer provisioner facade.
//
// Spec-named module for the Wave 17 hard-gate. Re-exports the
// concrete provisioning surface implemented by
// FarmerProvisioningRuntime and tags the spec version.
//
// Strict-rule audit
//   • Pure runtime. No React. No fetch. No localStorage writes.
//   • Never emits PII into audit metadata.

import { BULK_ONBOARDING_VERSION } from "./onboardingContracts";

export const FARMER_PROVISIONER_RUNTIME_VERSION =
  "farroway-bulk-onboarding-farmer-provisioner-v1";

export const FARMER_PROVISIONER_CONTRACT = Object.freeze({
  runtimeVersion: FARMER_PROVISIONER_RUNTIME_VERSION,
  bulkOnboardingVersion: BULK_ONBOARDING_VERSION,
});

export * from "./FarmerProvisioningRuntime";
