/**
 * src/runtime/enterprise/EnterpriseRuntime.ts — keystone
 * composite over the 7 enterprise engines.
 *
 *   import {
 *     enterpriseRuntime, ENTERPRISE_RUNTIME_VERSION,
 *   } from 'src/runtime/enterprise/EnterpriseRuntime';
 *
 *   enterpriseRuntime({
 *     organizationId, currentUserId,
 *     organizations, members, programs, participants,
 *     cohorts, interventions, interventionParticipants,
 *     farms, gardens, plants, events,
 *     focusProgramId, focusCohortId,
 *   });
 *
 * What this is
 * ────────────
 *   Single chokepoint. Composes Organization + Program + Cohort
 *   + Intervention + Analytics + Trust + Impact engines into
 *   one frozen envelope per request. Routes + UI read from this
 *   composite so the contract is stable.
 *
 *   No persistence; route layer handles writes through the
 *   wave-5 single-writer (or returns 503 until the migration
 *   ships).
 *
 *   Composition-only. Frozen returns. SSR-safe.
 */

import {
  normalizeOrganization, listMembersFor,
  getMemberRole, canMemberWrite,
  ORGANIZATION_RUNTIME_VERSION,
} from './OrganizationRuntime';
import {
  normalizeProgram, listProgramsFor,
  PROGRAM_RUNTIME_VERSION,
} from './ProgramRuntime';
import {
  listCohortsFor, COHORT_RUNTIME_VERSION,
} from './CohortRuntime';
import {
  normalizeIntervention, summarizeIntervention,
  INTERVENTION_RUNTIME_VERSION,
} from './InterventionRuntime';
import {
  organizationSummary, programSummary, cohortSummary, regionSummary,
  ENTERPRISE_ANALYTICS_VERSION,
} from './EnterpriseAnalyticsEngine';
import {
  farmerTrustScore, programTrustScore, trustSummary,
  ENTERPRISE_TRUST_VERSION,
} from './EnterpriseTrustEngine';
import {
  composeImpactReport, IMPACT_REPORT_VERSION,
} from './ImpactReportEngine';
import {
  ENTERPRISE_RUNTIME_OWNERSHIP, ENTERPRISE_CONTRACTS_VERSION,
} from './enterpriseContracts';

export const ENTERPRISE_RUNTIME_VERSION = 'enterprise-runtime-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

export function enterpriseRuntime(ctx: any) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {};
    const orgId  = _str(c.organizationId);
    const userId = _str(c.currentUserId);

    const organization = _arr(c.organizations)
      .map(normalizeOrganization)
      .find((o) => o && o.id === orgId) || null;
    const members  = listMembersFor(_arr(c.members), orgId);
    const role     = getMemberRole(_arr(c.members), orgId, userId);
    const canWrite = canMemberWrite(role);

    const programs = listProgramsFor(_arr(c.programs), orgId);
    const cohorts  = listCohortsFor(_arr(c.cohorts), { organizationId: orgId });
    const interventions = _arr(c.interventions)
      .map(normalizeIntervention)
      .filter((i) => i && i.organizationId === orgId);
    const interventionSummaries = interventions.map((i) =>
      summarizeIntervention(i!.id, _arr(c.interventionParticipants)));

    const orgSummary = organizationSummary(c as any);
    const focusProgram = _str(c.focusProgramId)
      ? programSummary({ ...c, programId: _str(c.focusProgramId) } as any)
      : null;
    const focusCohort = _str(c.focusCohortId)
      ? cohortSummary({ ...c, cohortId: _str(c.focusCohortId) } as any)
      : null;
    const focusRegion = _str(c.focusRegion)
      ? regionSummary({ ...c, region: _str(c.focusRegion) } as any)
      : null;

    const report = composeImpactReport({
      organizationId: orgId,
      programId:      _str(c.focusProgramId),
      farms:          _arr(c.farms),
      gardens:        _arr(c.gardens),
      plants:         _arr(c.plants),
      events:         _arr(c.events),
      programs:       _arr(c.programs),
      participants:   _arr(c.participants),
      interventions:  interventions as any[],
    });

    // Trust summary across program-trust scores
    const programTrust = programs.map((p) => programTrustScore({
      programId:                _str(p.id),
      participantCount:         _arr(c.participants).filter((x: any) =>
                                  _isObj(x) && _str(x.programId) === _str(p.id)).length,
      activeParticipantCount:   _arr(c.participants).filter((x: any) =>
                                  _isObj(x) && _str(x.programId) === _str(p.id)
                                  && x.status === 'active').length,
      interventionsTotal:       interventions.filter((i) =>
                                  i && i.programId === _str(p.id)).length,
      interventionsCompleted:   interventions.filter((i) =>
                                  i && i.programId === _str(p.id)
                                  && i.status === 'completed').length,
      taskCompletionRatePct:    0,
      evidenceCompletenessPct:  0,
    } as any));
    const programTrustRoll = trustSummary(programTrust);

    return Object.freeze({
      runtimeVersion: ENTERPRISE_RUNTIME_VERSION,
      generatedAt:    _now(),
      organization,
      currentUser: Object.freeze({
        userId, role,
        canWrite,
      }),
      members,
      programs,
      cohorts,
      interventions,
      interventionSummaries,
      summary:       orgSummary,
      focusProgram,
      focusCohort,
      focusRegion,
      impactReport:  report,
      trust: Object.freeze({
        programTrust,
        programTrustRoll,
      }),
      ownership: ENTERPRISE_RUNTIME_OWNERSHIP,
      versions: Object.freeze({
        contracts:        ENTERPRISE_CONTRACTS_VERSION,
        organization:     ORGANIZATION_RUNTIME_VERSION,
        program:          PROGRAM_RUNTIME_VERSION,
        cohort:           COHORT_RUNTIME_VERSION,
        intervention:     INTERVENTION_RUNTIME_VERSION,
        analytics:        ENTERPRISE_ANALYTICS_VERSION,
        trust:            ENTERPRISE_TRUST_VERSION,
        impactReport:     IMPACT_REPORT_VERSION,
      }),
      deferred: Object.freeze({
        persistence:
          'wave-5 single-writer preserved — engines emit '
          + 'payloads, route + offline layers persist',
        prismaTables:
          '9 Prisma tables staged at server/prisma/_pending-'
          + 'migrations/enterprise_agriculture_platform/ — '
          + 'awaiting supervised DBA window',
        pdfReports:
          'CSV export shipped; PDF requires a separate PDF utility',
        crossOrgScoping:
          'route layer enforces organization scope; never expose '
          + "one organization's farmers to another organization",
      }),
    });
  }, Object.freeze({
    runtimeVersion: ENTERPRISE_RUNTIME_VERSION,
    generatedAt: '', organization: null,
    currentUser: Object.freeze({ userId: '', role: '', canWrite: false }),
    members: Object.freeze([]), programs: Object.freeze([]),
    cohorts: Object.freeze([]), interventions: Object.freeze([]),
    interventionSummaries: Object.freeze([]),
    summary: Object.freeze({}), focusProgram: null,
    focusCohort: null, focusRegion: null,
    impactReport: null, trust: Object.freeze({}),
    ownership: Object.freeze({}), versions: Object.freeze({}),
    deferred: Object.freeze({}),
  }));
}

// Helper for callers that need just the trust score for one farmer.
export { farmerTrustScore, programTrustScore, trustSummary };
