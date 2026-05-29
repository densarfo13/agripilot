/**
 * src/runtime/enterprise/enterpriseContracts.ts —
 * Enterprise Agriculture Platform contracts.
 *
 *   import {
 *     ORG_TYPES, ORG_STATUSES, ORG_ROLES,
 *     PROGRAM_STATUSES, COHORT_TYPES, INTERVENTION_TYPES,
 *     INTERVENTION_STATUSES, PARTICIPANT_STATUSES,
 *     REPORT_STATUSES, TRUST_BANDS, TRUST_TYPES,
 *     idempotencyKeyFor,
 *     ENTERPRISE_CONTRACTS_VERSION,
 *   } from 'src/runtime/enterprise/enterpriseContracts';
 *
 * What this is
 * ────────────
 *   Single source of truth for every enumerated value the
 *   enterprise runtime / API / UI reads. Adding a new value
 *   here is the only place to touch — engines downstream
 *   reference these constants rather than hardcoding strings.
 *
 * Strict-rule audit
 *   • Pure constants. No side effects. SSR-safe.
 *   • Composition-only.
 */

export const ENTERPRISE_CONTRACTS_VERSION = 'enterprise-contracts-v1';

export const ORG_TYPES = Object.freeze({
  NGO:         'NGO',
  GOVERNMENT:  'GOVERNMENT',
  COOPERATIVE: 'COOPERATIVE',
  AGRIBUSINESS: 'AGRIBUSINESS',
  UNIVERSITY:  'UNIVERSITY',
  DONOR:       'DONOR',
  INTERNAL:    'INTERNAL',
});

export const ORG_STATUSES = Object.freeze({
  ACTIVE:   'active',
  INACTIVE: 'inactive',
  PILOT:    'pilot',
});

export const ORG_ROLES = Object.freeze({
  OWNER:           'owner',
  ADMIN:           'admin',
  PROGRAM_MANAGER: 'program_manager',
  FIELD_OFFICER:   'field_officer',
  ANALYST:         'analyst',
  VIEWER:          'viewer',
});

export const ROLES_THAT_CAN_WRITE = Object.freeze([
  ORG_ROLES.OWNER, ORG_ROLES.ADMIN, ORG_ROLES.PROGRAM_MANAGER,
  ORG_ROLES.FIELD_OFFICER,
]);

export const PROGRAM_STATUSES = Object.freeze({
  DRAFT:     'draft',
  ACTIVE:    'active',
  PAUSED:    'paused',
  COMPLETED: 'completed',
});

export const COHORT_TYPES = Object.freeze({
  REGION:       'region',
  CROP:         'crop',
  TRAINING:     'training',
  INTERVENTION: 'intervention',
  SEASON:       'season',
  CUSTOM:       'custom',
});

export const INTERVENTION_TYPES = Object.freeze({
  SEED:         'seed',
  FERTILIZER:   'fertilizer',
  TRAINING:     'training',
  IRRIGATION:   'irrigation',
  PEST_CONTROL: 'pest_control',
  FINANCE:      'finance',
  ADVISORY:     'advisory',
  OTHER:        'other',
});

export const INTERVENTION_STATUSES = Object.freeze({
  PLANNED:   'planned',
  DELIVERED: 'delivered',
  ACCEPTED:  'accepted',
  COMPLETED: 'completed',
  FAILED:    'failed',
});

export const PARTICIPANT_STATUSES = Object.freeze({
  ASSIGNED:  'assigned',
  DELIVERED: 'delivered',
  ACCEPTED:  'accepted',
  COMPLETED: 'completed',
  MISSED:    'missed',
});

export const PROGRAM_FARMER_STATUSES = Object.freeze({
  INVITED:   'invited',
  ACTIVE:    'active',
  INACTIVE:  'inactive',
  COMPLETED: 'completed',
});

export const REPORT_STATUSES = Object.freeze({
  DRAFT:     'draft',
  GENERATED: 'generated',
  EXPORTED:  'exported',
});

export const TRUST_TYPES = Object.freeze({
  FARMER:  'farmer',
  FARM:    'farm',
  PROGRAM: 'program',
});

/**
 * Honest trust labels. Spec wording: "trust signal" — never
 * "credit score". Do not imply lending eligibility.
 */
export const TRUST_BANDS = Object.freeze([
  { min: 90, band: 'excellent',       label: 'Excellent' },
  { min: 75, band: 'good',            label: 'Good' },
  { min: 55, band: 'needs_attention', label: 'Needs Attention' },
  { min:  0, band: 'high_risk',       label: 'High Risk' },
]);

export function trustBandFor(score: number) {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return Object.freeze({ min: 0, band: 'unknown', label: 'Unknown' });
  }
  for (const b of TRUST_BANDS) {
    if (score >= b.min) return b;
  }
  return TRUST_BANDS[TRUST_BANDS.length - 1];
}

/**
 * Idempotency keys — spec format (Phase 13):
 *   enterprise:intervention-complete:{interventionId}:{userId}
 *   enterprise:participant-note:{interventionId}:{userId}:{hash}
 *   enterprise:evidence:{interventionId}:{userId}:{hash}
 */
export function idempotencyKeyFor(op: 'intervention-complete'
                                    | 'participant-note'
                                    | 'evidence',
                                  parts: { interventionId?: string;
                                            userId?: string;
                                            hash?: string }) {
  const i = (parts && parts.interventionId) || '';
  const u = (parts && parts.userId) || '';
  const h = (parts && parts.hash) || '';
  if (op === 'intervention-complete') {
    return 'enterprise:intervention-complete:' + i + ':' + u;
  }
  return 'enterprise:' + op + ':' + i + ':' + u + ':' + h;
}

/**
 * Ownership manifest — declarative; consumed by the
 * check:enterprise-runtime-ownership CI gate to enforce
 * boundaries at build time.
 */
export const ENTERPRISE_RUNTIME_OWNERSHIP = Object.freeze({
  organizationRuntime: Object.freeze([
    'organizations', 'organization_members', 'organization_roles',
  ]),
  programRuntime: Object.freeze([
    'programs', 'program_goals', 'program_membership',
  ]),
  cohortRuntime: Object.freeze([
    'farmer_cohorts', 'crop_cohorts', 'region_cohorts',
  ]),
  interventionRuntime: Object.freeze([
    'interventions', 'intervention_completion', 'intervention_outcomes',
  ]),
  impactReportEngine: Object.freeze([
    'impact_summaries', 'grant_reporting',
  ]),
  enterpriseAnalyticsEngine: Object.freeze([
    'aggregate_dashboards', 'program_analytics', 'regional_analytics',
  ]),
  enterpriseTrustEngine: Object.freeze([
    'farmer_trust', 'farm_trust', 'program_trust',
  ]),
  notes: Object.freeze({
    plantRuntime:
      'Plant records remain owned by Plant Runtime; enterprise '
      + 'NEVER creates plant rows directly.',
    scanRuntime:
      'Camera + upload + Plant.id stay with Scan Runtime; '
      + 'enterprise NEVER calls the classifier.',
    offlineRuntime:
      'Offline queues use the existing Offline Runtime; '
      + 'enterprise NEVER writes directly to localStorage.',
    persistence:
      'Wave-5 single-writer remains intact — enterprise emits '
      + 'payloads, the API + queue layers persist.',
  }),
});
