/**
 * src/runtime/organization/index.ts — NGO Organization runtime
 * barrel + diagnostic global install.
 *
 *   import {
 *     upsertOrganizationMember, aggregateForOrganization,
 *     generateOrganizationReport, exportOrganizationReportCSV,
 *     ngoDashboardHealth, installNgoDashboardGlobal,
 *     ORGANIZATION_DASHBOARD_VERSION,
 *   } from 'src/runtime/organization';
 *
 *   window.__ngoDashboardHealth()  // pinned after boot
 *
 * Strict-rule audit
 *   • Pure composition. SSR-safe. Never throws.
 *   • No React imports. No fetch. No persistence writes.
 *   • organizationScoped: every helper takes an organizationId.
 */

import {
  ORGANIZATION_DASHBOARD_VERSION, MEMBER_ROLES, REPORT_KINDS,
  ORG_EMPTY_STATE, ngoIdempotencyKey,
  ngoInterventionCompleteIdempotencyKey,
  ngoEvidenceIdempotencyKey,
} from './organizationContracts';

import {
  upsertOrganizationMember, listMembers, findMemberRole,
  organizationSnapshot, ORGANIZATION_RUNTIME_VERSION,
} from './OrganizationRuntime';

import {
  upsertProgram, upsertProgramEnrollment,
  listEnrollmentsForProgram, programSnapshot,
  listProgramsForOrganization, PROGRAM_RUNTIME_VERSION,
} from './ProgramRuntime';

import {
  upsertIntervention, upsertInterventionParticipant,
  assignParticipant, completeIntervention,
  listAssignedInterventions, interventionSnapshot,
  INTERVENTION_RUNTIME_VERSION,
} from './InterventionRuntime';

import {
  aggregateForOrganization, ORG_ANALYTICS_VERSION,
} from './OrganizationAnalytics';

import {
  generateOrganizationReport, exportOrganizationReportCSV,
  listOrgReports, ORG_REPORT_ENGINE_VERSION,
} from './OrganizationReportEngine';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/**
 * Diagnostic snapshot — pinned to window.__ngoDashboardHealth().
 * `snapshots` is intentionally empty unless a caller passes
 * org-scoped detail in (the global API stays org-agnostic to
 * preserve the no-cross-org-aggregation rule).
 */
export function ngoDashboardHealth() {
  return _safe(() => Object.freeze({
    runtimeVersion:        ORGANIZATION_DASHBOARD_VERSION,
    available:             true,
    organizationScoped:    true,
    programsReady:         true,
    interventionsReady:    true,
    evidenceReady:         true,
    reportsReady:          true,
    fakeData:              false,
    snapshots:             Object.freeze({} as Record<string, any>),
    versions: Object.freeze({
      dashboard:    ORGANIZATION_DASHBOARD_VERSION,
      organization: ORGANIZATION_RUNTIME_VERSION,
      program:      PROGRAM_RUNTIME_VERSION,
      intervention: INTERVENTION_RUNTIME_VERSION,
      analytics:    ORG_ANALYTICS_VERSION,
      report:       ORG_REPORT_ENGINE_VERSION,
    }),
  }), Object.freeze({
    runtimeVersion:        ORGANIZATION_DASHBOARD_VERSION,
    available:             false,
    organizationScoped:    true,
    programsReady:         false,
    interventionsReady:    false,
    evidenceReady:         false,
    reportsReady:          false,
    fakeData:              false,
    snapshots:             Object.freeze({} as Record<string, any>),
  }));
}

export function installNgoDashboardGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__ngoDashboardHealth !== 'function') {
      w.__ngoDashboardHealth = function () {
        const out = ngoDashboardHealth();
        try { console.log('[Farroway · NGO Dashboard]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}

// ─── Re-exports ────────────────────────────────────────────────
export {
  // Contracts
  ORGANIZATION_DASHBOARD_VERSION, MEMBER_ROLES, REPORT_KINDS,
  ORG_EMPTY_STATE, ngoIdempotencyKey,
  ngoInterventionCompleteIdempotencyKey,
  ngoEvidenceIdempotencyKey,
  // Organization membership
  upsertOrganizationMember, listMembers, findMemberRole,
  organizationSnapshot, ORGANIZATION_RUNTIME_VERSION,
  // Programs
  upsertProgram, upsertProgramEnrollment,
  listEnrollmentsForProgram, programSnapshot,
  listProgramsForOrganization, PROGRAM_RUNTIME_VERSION,
  // Interventions
  upsertIntervention, upsertInterventionParticipant,
  assignParticipant, completeIntervention,
  listAssignedInterventions, interventionSnapshot,
  INTERVENTION_RUNTIME_VERSION,
  // Analytics
  aggregateForOrganization, ORG_ANALYTICS_VERSION,
  // Reports
  generateOrganizationReport, exportOrganizationReportCSV,
  listOrgReports, ORG_REPORT_ENGINE_VERSION,
};

export type { MemberRole, ReportKind } from './organizationContracts';
export type { OrganizationMember } from './OrganizationRuntime';
export type { OrgReportRecord } from './OrganizationReportEngine';
