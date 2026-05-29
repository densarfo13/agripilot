/**
 * src/runtime/organization/OrganizationAnalytics.ts — single
 * org-scoped aggregator. Composes the admin runtime (farmer
 * profiles, impact ledger, organization records) and the
 * Artifact registry to produce ONE frozen analytics envelope
 * for the NGO dashboard.
 *
 * Strict-rule audit
 *   • Pure runtime. Frozen envelope. Never throws.
 *   • organizationScoped: every read passes organizationId
 *     through to the underlying admin/artifact APIs.
 *   • No cross-org aggregation — fails closed without an id.
 *   • No fake metrics — empty pools surface ORG_EMPTY_STATE.
 */

import {
  listFarmerProfiles, listImpactRecords, listInterventions,
  listPrograms,
} from '../admin';
import {
  listArtifactsByUser,
} from '../artifacts';
import {
  ORG_EMPTY_STATE, ORGANIZATION_DASHBOARD_VERSION,
} from './organizationContracts';

export const ORG_ANALYTICS_VERSION = 'org-analytics-runtime-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr  = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

const _zeroEnvelope = (organizationId: string, reason: string) => Object.freeze({
  runtimeVersion:           ORG_ANALYTICS_VERSION,
  organizationId,
  farmersEnrolled:          0,
  activeFarmers:            0,
  programs:                 0,
  interventions:            0,
  completedInterventions:   0,
  farmsCount:               0,
  gardensCount:             0,
  plantsTracked:            0,
  scansCount:               0,
  tasksCompleted:           0,
  evidenceArtifactsCount:   0,
  emptyState:               ORG_EMPTY_STATE,
  organizationScoped:       true,
  fakeMetrics:              false,
  reason,
});

/**
 * Aggregate everything for ONE organization. Returns a frozen
 * envelope. Fails closed (zero envelope + ORG_EMPTY_STATE +
 * reason) when organizationId is missing.
 */
export function aggregateForOrganization(organizationId: string) {
  return _safe(() => {
    const orgId = _str(organizationId);
    if (!orgId) return _zeroEnvelope('', 'organizationId_required');

    // Org-scoped reads — all underlying APIs accept the filter.
    const farmers       = _arr(listFarmerProfiles({ organizationId: orgId }));
    const programs      = _arr(listPrograms({ organizationId: orgId }));
    const interventions = _arr(listInterventions({ organizationId: orgId }));
    const impactRecords = _arr(listImpactRecords({ organizationId: orgId }));

    let activeFarmers = 0;
    const userIds = new Set<string>();
    const farmIds = new Set<string>();
    const gardenIds = new Set<string>();
    for (const p of farmers) {
      if (!_isObj(p)) continue;
      const uid = _str((p as any).userId);
      if (uid) userIds.add(uid);
      if (_str((p as any).onboardingStatus) === 'active') activeFarmers++;
    }

    const completedInterventions = interventions.filter((i) =>
      _isObj(i) && _str((i as any).status) === 'completed').length;

    const plantIds = new Set<string>();
    let scansCount     = 0;
    let tasksCompleted = 0;
    let evidenceArtifactsCount = 0;
    for (const r of impactRecords) {
      if (!_isObj(r)) continue;
      const type = _str((r as any).type);
      const pid  = _str((r as any).plantId);
      const fid  = _str((r as any).farmId);
      const gid  = _str((r as any).gardenId);
      if (pid) plantIds.add(pid);
      if (fid) farmIds.add(fid);
      if (gid) gardenIds.add(gid);
      if (type === 'scan_completed') scansCount++;
      if (type === 'task_completed') tasksCompleted++;
      if (_str((r as any).evidenceArtifactId)) evidenceArtifactsCount++;
    }

    // Compose Artifact registry — count per-user artifacts owned
    // by the org's enrolled farmers. Org-scoped via userIds set.
    let artifactCount = 0;
    for (const uid of userIds) {
      const list = _arr(listArtifactsByUser(uid));
      artifactCount += list.length;
      for (const a of list) {
        if (_isObj(a) && _str((a as any).plantId)) {
          plantIds.add(_str((a as any).plantId));
        }
      }
    }
    if (artifactCount > evidenceArtifactsCount) {
      evidenceArtifactsCount = artifactCount;
    }

    const farmersEnrolled        = farmers.length;
    const programsCount          = programs.length;
    const interventionsCount     = interventions.length;
    const farmsCount             = farmIds.size;
    const gardensCount           = gardenIds.size;
    const plantsTracked          = plantIds.size;

    const totalSignal = farmersEnrolled + programsCount
      + interventionsCount + plantsTracked + scansCount
      + tasksCompleted + evidenceArtifactsCount;

    return Object.freeze({
      runtimeVersion:           ORG_ANALYTICS_VERSION,
      organizationId:           orgId,
      farmersEnrolled,
      activeFarmers,
      programs:                 programsCount,
      interventions:            interventionsCount,
      completedInterventions,
      farmsCount,
      gardensCount,
      plantsTracked,
      scansCount,
      tasksCompleted,
      evidenceArtifactsCount,
      emptyState:               totalSignal === 0 ? ORG_EMPTY_STATE : '',
      organizationScoped:       true,
      fakeMetrics:              false,
      reason:                   '',
    });
  }, _zeroEnvelope(_str(organizationId), 'error'));
}

export { ORGANIZATION_DASHBOARD_VERSION };
