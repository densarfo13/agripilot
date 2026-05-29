/**
 * src/runtime/audit/auditContracts.ts — Frozen contracts for
 * append-only audit logging.
 *
 * Strict-rule audit
 *   • Pure data. No engine imports.
 */

export const AUDIT_RUNTIME_VERSION = 'farroway-audit-runtime-v1';

/** Exhaustive list of audit-worthy actions. */
export const AUDIT_ACTIONS = Object.freeze([
  'login', 'logout',
  'scan_created', 'plant_created',
  'task_completed', 'artifact_created',
  'sell_ready_marked', 'buyer_interest_sent',
  'organization_created', 'program_created',
  'cohort_created',
  'intervention_created', 'intervention_completed',
  'report_exported', 'role_changed',
  'permission_denied',
] as const);
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Fields engines must NEVER persist in audit metadata. */
export const AUDIT_PII_DROP_LIST = Object.freeze([
  'password', 'token', 'apiKey', 'secret',
  'authorization', 'cookie',
  'phone', 'email', 'fullName',
  'fileName', 'gpsExact',
]);
