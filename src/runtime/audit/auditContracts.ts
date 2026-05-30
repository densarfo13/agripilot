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
  // Wave-40 — enterprise audit coverage extensions.
  'failed_login', 'mfa_enrolled',
  'farmer_created', 'farmer_updated', 'farmer_deleted',
  'scan_completed',
  'enrollment_created',
  'listing_created',
  'invite_sent', 'invite_accepted', 'invite_resent',
  'admin_action',
] as const);
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * Wave-40 canonical event-coverage contract. Each entry maps the
 * spec event-name to the AUDIT_ACTION token the runtime emits.
 * The audit-health probe reports coverage by checking whether
 * each token is in AUDIT_ACTIONS.
 */
export const AUDIT_EVENT_COVERAGE = Object.freeze([
  { spec: 'login',                  action: 'login' },
  { spec: 'logout',                 action: 'logout' },
  { spec: 'failed login',           action: 'failed_login' },
  { spec: 'MFA enrollment',         action: 'mfa_enrolled' },
  { spec: 'farmer creation',        action: 'farmer_created' },
  { spec: 'farmer update',          action: 'farmer_updated' },
  { spec: 'farmer deletion',        action: 'farmer_deleted' },
  { spec: 'plant creation',         action: 'plant_created' },
  { spec: 'scan completed',         action: 'scan_completed' },
  { spec: 'task completion',        action: 'task_completed' },
  { spec: 'organization creation',  action: 'organization_created' },
  { spec: 'program creation',       action: 'program_created' },
  { spec: 'enrollment creation',    action: 'enrollment_created' },
  { spec: 'buyer interest creation',action: 'buyer_interest_sent' },
  { spec: 'listing creation',       action: 'listing_created' },
  { spec: 'invite send',            action: 'invite_sent' },
  { spec: 'invite accept',          action: 'invite_accepted' },
  { spec: 'admin actions',          action: 'admin_action' },
] as const);

/** Fields engines must NEVER persist in audit metadata. */
export const AUDIT_PII_DROP_LIST = Object.freeze([
  'password', 'token', 'apiKey', 'secret',
  'authorization', 'cookie',
  'phone', 'email', 'fullName',
  'fileName', 'gpsExact',
]);
