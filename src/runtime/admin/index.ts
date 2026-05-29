/**
 * src/runtime/admin/index.ts — Admin Impact runtime barrel.
 */

export {
  ADMIN_IMPACT_VERSION, AGE_RANGES, GENDERS, FARMER_ROLES,
  ONBOARDING_STATUSES, ORG_TYPES, ORG_STATUSES,
  PROGRAM_STATUSES, ENROLLMENT_STATUSES,
  INTERVENTION_TYPES, INTERVENTION_STATUSES,
  PARTICIPANT_STATUSES, IMPACT_TYPES, REPORT_RECORD_TYPES,
  ADMIN_EMPTY_STATE, DEMOGRAPHIC_PROTECTED_FIELDS,
} from './adminImpactContracts';

export {
  upsertFarmerProfile, findFarmerProfile, listFarmerProfiles,
  demographicDistribution, farmerProfileSnapshot,
  FARMER_PROFILE_VERSION,
} from './FarmerProfileRuntime';
export type { FarmerProfile } from './FarmerProfileRuntime';

export {
  upsertOrganization, upsertProgram, upsertProgramEnrollment,
  upsertIntervention, upsertInterventionParticipant,
  listOrganizations, listPrograms, listInterventions,
  organizationRecordSnapshot, ORG_RECORD_RUNTIME_VERSION,
} from './OrganizationRecordRuntime';

export {
  recordImpact, listImpactRecords, impactLedgerSnapshot,
  IMPACT_LEDGER_VERSION,
} from './ImpactLedgerRuntime';
export type { ImpactRecord } from './ImpactLedgerRuntime';

export {
  generateReportRecord, listReportRecords, reportRecordSnapshot,
  REPORT_RECORD_VERSION,
} from './ReportRecordRuntime';
export type { ReportRecord } from './ReportRecordRuntime';

export {
  adminImpactHealth, installAdminImpactGlobal,
} from './AdminImpactRuntime';
