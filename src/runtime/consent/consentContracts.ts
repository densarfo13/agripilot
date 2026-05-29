/**
 * src/runtime/consent/consentContracts.ts — Consent runtime contracts.
 *
 * Frozen enumerations + policy version constants for the
 * Farroway consent runtime. Pure runtime: no React, no fetch,
 * no localStorage. SSR-safe.
 */

export const CONSENT_RUNTIME_VERSION =
  "farroway-consent-runtime-v1";

/**
 * The closed set of consent purposes the runtime recognises.
 * Anything outside this list is rejected by the registry and
 * treated as unknown/deny by the policy.
 */
export const CONSENT_TYPES = Object.freeze([
  // Spec consent types (Farroway consent runtime v1 spec).
  "collect_photos",
  "collect_location",
  "collect_diagnostics",
  "collect_usage",
  "share_for_review",
  "export_data",
  "delete_account",
  "receive_notifications",
  // Legacy / domain-specific types — retained for backward
  // compatibility with existing call sites. The spec types above
  // are the canonical surface for new code.
  "demographics_collection",
  "program_reporting",
  "evidence_photo_sharing",
  "location_use",
  "scan_photo_use",
  "buyer_contact_sharing",
  "analytics_diagnostics",
  "notifications",
] as const);

export type ConsentType = (typeof CONSENT_TYPES)[number];

/**
 * Where the consent decision was captured. Mirrors how the UI
 * actually surfaces a prompt so audits can trace provenance.
 */
export const CONSENT_SOURCES = Object.freeze([
  "onboarding_prompt",
  "in_context_prompt",
  "settings_page",
  "api",
] as const);

export type ConsentSource = (typeof CONSENT_SOURCES)[number];

/**
 * Policy version stamped on every record so a future policy
 * change can require re-consent without losing the history.
 */
export const CONSENT_POLICY_VERSION = "v1.0.0";

export interface ConsentRecord {
  userId: string;
  type: ConsentType;
  granted: boolean;
  source: ConsentSource;
  version: string;
  recordedAt: number;
}
