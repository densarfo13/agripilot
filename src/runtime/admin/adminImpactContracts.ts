/**
 * src/runtime/admin/adminImpactContracts.ts — Frozen contracts
 * for the admin / NGO impact ledger.
 *
 * Strict-rule audit
 *   • Pure data. No engine imports. SSR-safe.
 *   • Demographics are OPTIONAL and include
 *     "prefer_not_to_say" — never required for normal app use.
 */

export const ADMIN_IMPACT_VERSION = 'farroway-admin-impact-v1';

/** Demographic enums — every list includes "prefer_not_to_say". */
export const AGE_RANGES = Object.freeze([
  '18_25', '26_35', '36_45', '46_60', '60_plus',
  'prefer_not_to_say',
] as const);
export type AgeRange = (typeof AGE_RANGES)[number];

export const GENDERS = Object.freeze([
  'male', 'female', 'other', 'prefer_not_to_say',
] as const);
export type Gender = (typeof GENDERS)[number];

export const FARMER_ROLES = Object.freeze([
  'farmer', 'gardener', 'grower',
] as const);
export type FarmerRole = (typeof FARMER_ROLES)[number];

export const ONBOARDING_STATUSES = Object.freeze([
  'started', 'profile_completed', 'farm_created',
  'first_scan_done', 'first_task_done', 'active',
] as const);
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export const ORG_TYPES = Object.freeze([
  'NGO', 'GOVERNMENT', 'COOPERATIVE', 'AGRIBUSINESS', 'INTERNAL',
] as const);

export const ORG_STATUSES = Object.freeze([
  'pilot', 'active', 'inactive',
] as const);

export const PROGRAM_STATUSES = Object.freeze([
  'draft', 'active', 'completed', 'paused',
] as const);

export const ENROLLMENT_STATUSES = Object.freeze([
  'invited', 'active', 'inactive', 'completed',
] as const);

export const INTERVENTION_TYPES = Object.freeze([
  'training', 'seed', 'fertilizer', 'irrigation',
  'pest_control', 'finance', 'advisory', 'other',
] as const);

export const INTERVENTION_STATUSES = Object.freeze([
  'planned', 'delivered', 'completed', 'failed',
] as const);

export const PARTICIPANT_STATUSES = Object.freeze([
  'assigned', 'delivered', 'completed', 'missed',
] as const);

export const IMPACT_TYPES = Object.freeze([
  'scan_completed', 'plant_created', 'task_completed',
  'intervention_completed', 'treatment_applied',
  'harvest_recorded', 'health_improved',
  'buyer_interest_received',
] as const);
export type ImpactType = (typeof IMPACT_TYPES)[number];

export const REPORT_RECORD_TYPES = Object.freeze([
  'founder_summary', 'organization_summary',
  'program_impact', 'intervention_summary',
] as const);

/** Empty-state honesty string. */
export const ADMIN_EMPTY_STATE = 'Not enough data yet';

/** Fields engines must NEVER expose to non-owner roles. */
export const DEMOGRAPHIC_PROTECTED_FIELDS = Object.freeze([
  'ageRange', 'gender', 'fullName', 'phone', 'email',
  'village', 'district',
]);
