/**
 * Farroway · Event Contract (event-sourcing-v13)
 *
 * Pure, self-contained canonical event catalog for the v13 event-sourcing
 * runtime. No imports of any kind. No window / localStorage access.
 *
 * This declares the canonical event names the platform is allowed to append
 * to its immutable event log, plus which of those require a tenant / org
 * scope to be considered valid. It is data + pure functions only — it makes
 * NO claims about live data and NEVER throws.
 */

export const CANONICAL_EVENTS = [
  'UserCreated',
  'UserLoggedIn',
  'FarmCreated',
  'GardenCreated',
  'PlantCreated',
  'ScanStarted',
  'ScanCompleted',
  'ScanFailed',
  'DiagnosisCreated',
  'RecommendationCreated',
  'TaskCreated',
  'TaskCompleted',
  'FollowUpScanRequested',
  'FollowUpScanCompleted',
  'OutcomeRecorded',
  'DiseaseTrendDetected',
  'PestTrendDetected',
  'WeatherRiskDetected',
  'HarvestReadinessChecked',
  'BuyerInterestCreated',
  'ListingCreated',
  'NGOProgramCreated',
  'FarmerEnrolled',
  'InterventionAssigned',
  'InterventionCompleted',
  'EvidenceUploaded',
  'ReportGenerated',
] as const;

export type CanonicalEvent = (typeof CANONICAL_EVENTS)[number];

/**
 * Subset of canonical events that MUST carry a tenant / org scope
 * (e.g. an NGO program, a buyer/marketplace org, or a multi-tenant report).
 * Appending one of these without an org scope is a contract violation.
 */
export const ORG_SCOPED_EVENTS = [
  'BuyerInterestCreated',
  'ListingCreated',
  'NGOProgramCreated',
  'FarmerEnrolled',
  'InterventionAssigned',
  'InterventionCompleted',
  'EvidenceUploaded',
  'ReportGenerated',
] as const;

export type OrgScopedEvent = (typeof ORG_SCOPED_EVENTS)[number];

const _canonicalSet: ReadonlySet<string> = new Set(CANONICAL_EVENTS as readonly string[]);
const _orgScopedSet: ReadonlySet<string> = new Set(ORG_SCOPED_EVENTS as readonly string[]);

/** True only for names that are part of the canonical catalog. Never throws. */
export function isCanonicalEvent(name: string): boolean {
  try {
    return typeof name === 'string' && _canonicalSet.has(name);
  } catch {
    return false;
  }
}

/**
 * True when the named event requires a tenant / org scope to be valid.
 * Returns false for unknown names (they are not canonical, so no claim). */
export function requiresOrgScope(name: string): boolean {
  try {
    return typeof name === 'string' && _orgScopedSet.has(name);
  } catch {
    return false;
  }
}
