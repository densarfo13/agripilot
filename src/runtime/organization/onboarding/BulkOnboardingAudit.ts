// src/runtime/organization/onboarding/BulkOnboardingAudit.ts
// Farroway bulk onboarding — audit metadata sanitizer.
//
// Spec-named module for the Wave 17 hard-gate. Implements the
// canonical PII scrub used before emitting any
// bulk_onboarding_* AuditEvent so phone / email / fullName
// never leak into audit metadata. The contracts module owns the
// drop list; this file enforces it.
//
// Strict-rule audit
//   • Pure. SSR-safe. Never throws.
//   • Frozen envelopes. No persistence. No fetch. No React.

import {
  BULK_ONBOARDING_VERSION,
  BULK_AUDIT_DROP_LIST,
  AUDIT_EVENTS,
  type AuditEvent,
} from "./onboardingContracts";

export const BULK_ONBOARDING_AUDIT_RUNTIME_VERSION =
  "farroway-bulk-onboarding-audit-v1";

const _isObj = (v: unknown): v is Record<string, unknown> =>
  v != null && typeof v === "object" && !Array.isArray(v);

const _safe = <T>(fn: () => T, fb: T): T => {
  try {
    return fn();
  } catch {
    return fb;
  }
};

/**
 * Returns a shallow-cloned copy of `metadata` with every key in
 * BULK_AUDIT_DROP_LIST removed (case-insensitive). The original
 * object is never mutated. Non-object input collapses to {}.
 */
export function scrubAuditMetadata(
  metadata: unknown,
): Readonly<Record<string, unknown>> {
  return _safe(() => {
    if (!_isObj(metadata)) return Object.freeze({});
    const drop = new Set(
      BULK_AUDIT_DROP_LIST.map((k) => String(k).toLowerCase()),
    );
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(metadata)) {
      if (drop.has(String(k).toLowerCase())) continue;
      out[k] = v;
    }
    return Object.freeze(out);
  }, Object.freeze({}));
}

/**
 * Validates that the given event name is one of the
 * canonical bulk_onboarding_* AuditEvents.
 */
export function isBulkOnboardingAuditEvent(
  name: unknown,
): name is AuditEvent {
  return (
    typeof name === "string" &&
    (AUDIT_EVENTS as readonly string[]).includes(name)
  );
}

/**
 * Composes a frozen audit envelope safe to forward to the
 * server-side audit writer. The runtime version is pinned to the
 * BULK_ONBOARDING_VERSION so consumers can detect contract drift.
 */
export function composeAuditEnvelope(
  event: AuditEvent,
  metadata?: Record<string, unknown>,
): Readonly<{
  runtimeVersion: string;
  event: AuditEvent;
  metadata: Readonly<Record<string, unknown>>;
}> {
  return Object.freeze({
    runtimeVersion: BULK_ONBOARDING_VERSION,
    event,
    metadata: scrubAuditMetadata(metadata),
  });
}

export const BULK_ONBOARDING_AUDIT_CONTRACT = Object.freeze({
  runtimeVersion: BULK_ONBOARDING_AUDIT_RUNTIME_VERSION,
  bulkOnboardingVersion: BULK_ONBOARDING_VERSION,
  auditEvents: AUDIT_EVENTS,
  dropList: BULK_AUDIT_DROP_LIST,
});
