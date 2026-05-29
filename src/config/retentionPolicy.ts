// Farroway — Retention Policy (config)
// Days per category. -1 means "never auto-expire".
// No PII semantics here; this is purely the time-window policy.

export const RETENTION_POLICY_VERSION = "farroway-retention-policy-v1";

export const RETENTION_POLICY = Object.freeze({
  // Spec category keys (Farroway retention policy v1 spec).
  scan_photos: 180,
  plant_records: -1,
  audit_events: 365,
  monitoring_events: 90,
  consent_records: -1,
  review_submissions: 365,
  crash_reports: 90,
  session_tokens: 30,
  // Legacy / domain-specific keys — retained for back-compat
  // with existing call sites. The spec keys above are the
  // canonical surface for new code.
  audit_logs: 365,
  artifacts: 365,
  reports: 365,
  user_profiles: -1,
  diagnostics: 90,
  buyer_interests: 180,
  organization_records: -1,
} as const);

/**
 * Surprise-deletion guard. The retention windows above are
 * advisory by default — nothing is hard-deleted automatically.
 * A future scheduled job may turn this on for specific
 * categories, but only after the user-data-rights workflow
 * (export + grace period) is in place.
 */
export const autoDeleteEnabled = false;

// If a scan photo is attached to a plant or evidence record, it is kept
// longer than the bare scan_photos window (the attached record's policy wins).
export const SCAN_PHOTO_KEEP_IF_ATTACHED = true;

export type RetentionPolicyKey = keyof typeof RETENTION_POLICY;
