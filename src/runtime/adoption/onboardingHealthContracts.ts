/**
 * src/runtime/adoption/onboardingHealthContracts.ts — wave-39
 * frozen contracts for the consumer-onboarding health probe.
 *
 * Strict-rule audit
 *   • Pure data declarations. No window / fetch.
 *   • SSR-safe by virtue of having no side effects.
 *   • Frozen.
 */

export const ONBOARDING_HEALTH_RUNTIME_VERSION = 'onboarding-health-v1';

export interface OnboardingHealth {
  runtimeVersion:           string;
  initialized:              boolean;
  farmerOnboardingReady:    boolean;
  gardenerOnboardingReady:  boolean;
  locationSkippable:        boolean;
  demographicsOptional:     boolean;
  firstPlantPathReady:      boolean;
  forcedEnterpriseSetup:    boolean;
  /** Detected onboarding tracks (informational). */
  detectedTracks:           ReadonlyArray<string>;
}

export const FROZEN_ONBOARDING_FALLBACK: Readonly<OnboardingHealth> =
  Object.freeze({
    runtimeVersion:           ONBOARDING_HEALTH_RUNTIME_VERSION,
    initialized:              false,
    farmerOnboardingReady:    false,
    gardenerOnboardingReady:  false,
    locationSkippable:        false,
    demographicsOptional:     false,
    firstPlantPathReady:      false,
    forcedEnterpriseSetup:    true,
    detectedTracks:           Object.freeze([]),
  });
