/**
 * src/runtime/organization/organizationContracts.ts — Frozen
 * contracts for the NGO Organization Dashboard runtime.
 *
 * Strict-rule audit
 *   • Pure data. No engine imports. SSR-safe.
 *   • organizationScoped: every helper that consumes these
 *     contracts MUST take an organizationId.
 *   • No PII. No fake metrics.
 */

export const ORGANIZATION_DASHBOARD_VERSION =
  'organization-dashboard-runtime-v1';

/** NGO membership roles. Frozen. */
export const MEMBER_ROLES = Object.freeze([
  'ngo_admin',
  'field_officer',
  'organization_viewer',
] as const);
export type MemberRole = (typeof MEMBER_ROLES)[number];

/** Report kinds the NGO dashboard can request. Frozen. */
export const REPORT_KINDS = Object.freeze([
  'program_summary',
  'intervention_summary',
  'farmer_activity',
  'evidence_summary',
] as const);
export type ReportKind = (typeof REPORT_KINDS)[number];

/** Honest empty-state string for empty pools. */
export const ORG_EMPTY_STATE = 'Not enough data yet';

const _str = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/**
 * Idempotency key for marking an intervention complete by a
 * specific user. Shape: ngo:intervention-complete:{id}:{user}
 */
export function ngoInterventionCompleteIdempotencyKey(
  interventionId: string,
  userId: string,
): string {
  return _safe(() =>
    'ngo:intervention-complete:' + _str(interventionId)
      + ':' + _str(userId),
    'ngo:intervention-complete::',
  );
}

/**
 * Idempotency key for evidence attachment.
 * Shape: ngo:evidence:{interventionId}:{userId}:{hash}
 */
export function ngoEvidenceIdempotencyKey(
  interventionId: string,
  userId: string,
  hash: string,
): string {
  return _safe(() =>
    'ngo:evidence:' + _str(interventionId)
      + ':' + _str(userId)
      + ':' + _str(hash),
    'ngo:evidence:::',
  );
}

/** Convenience namespace for callers that prefer a grouped import. */
export const ngoIdempotencyKey = Object.freeze({
  interventionComplete: ngoInterventionCompleteIdempotencyKey,
  evidence:             ngoEvidenceIdempotencyKey,
});
