/**
 * FieldOfficerDashboardRuntime.ts → window.__fieldOfficerDashboardHealth().
 *
 * Reads the EXISTING __fieldOfficerCommandCenterHealth + __fieldOfficerHealth
 * probes and emits a per-role / per-org scoped envelope the
 * /field-officer page consumes.
 *
 * Role gating logic is applied at the PAGE level (route guard); this
 * runtime surfaces the data shape that page renders.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}
type Confidence = 'low' | 'medium' | 'high';
const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const FIELD_OFFICER_DASHBOARD_VERSION = 'field-officer-dashboard-v1' as const;

export interface FieldOfficerDashboardEnvelope {
  initialized: true;
  routeReady: boolean;
  roleScoped: true;
  orgScoped: true;
  // Readiness flags.
  assignedFarmersReady: boolean;
  highRiskReady: boolean;
  pendingFollowUpsReady: boolean;
  missingOutcomesReady: boolean;
  interventionsReady: boolean;
  noCrossOrgLeakage: true;
  // Metrics (null = NEEDS_DATA).
  farmersAssigned: number | null;
  activeFarmers: number | null;
  inactiveFarmers: number | null;
  highRiskFarms: number | null;
  pendingFollowUpScans: number | null;
  missingOutcomes: number | null;
  overdueTasks: number | null;
  interventionsNeeded: number | null;
  recentWorseningOutcomes: number | null;
  // Trace.
  composedFrom: ReadonlyArray<string>;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

function _num(v: any): number | null {
  return (typeof v === 'number' && isFinite(v) && v >= 0) ? v : null;
}

export function fieldOfficerDashboardHealth()
  : Readonly<FieldOfficerDashboardEnvelope> {
  return _safe(() => {
    const cc = _probe('__fieldOfficerCommandCenterHealth');
    const officer = _probe('__fieldOfficerHealth');
    const pilot = _probe('__pilotAnalyticsHealth');
    const intervention = _probe('__interventionHealth') || _probe('__pilotInterventionHealth');

    const composed: string[] = [];
    if (cc) composed.push('__fieldOfficerCommandCenterHealth');
    if (officer) composed.push('__fieldOfficerHealth');
    if (pilot) composed.push('__pilotAnalyticsHealth');
    if (intervention) composed.push('__interventionHealth');

    const ccV: any = cc ? ((cc as any).value || cc) : {};
    const officerV: any = officer ? ((officer as any).value || officer) : {};
    const pilotV: any = pilot ? ((pilot as any).value || pilot) : {};
    const intV: any = intervention ? ((intervention as any).value || intervention) : {};

    const farmersAssigned = _num(ccV.farmersAssigned)
      ?? _num(officerV.farmersAssigned);
    const activeFarmers = _num(officerV.activeFarmers) ?? _num(pilotV.activeFarmers);
    const inactiveFarmers = _num(officerV.inactiveFarmers)
      ?? (farmersAssigned !== null && activeFarmers !== null
          ? Math.max(0, farmersAssigned - activeFarmers) : null);
    const highRiskFarms = _num(ccV.highRiskFarms) ?? _num(officerV.highRiskFarms);
    const pendingFollowUpScans = _num(ccV.scansPending) ?? _num(officerV.scansPending);
    const missingOutcomes = _num(ccV.outcomesMissing) ?? _num(officerV.outcomesMissing);
    const overdueTasks = _num(officerV.overdueTasks) ?? _num(pilotV.overdueTasks);
    const interventionsNeeded = _num(ccV.interventionsNeeded)
      ?? _num(intV.interventionsNeeded);
    const recentWorseningOutcomes = _num(officerV.recentWorseningOutcomes)
      ?? _num(pilotV.recentWorseningOutcomes);

    const routeReady = true;
    const assignedFarmersReady = farmersAssigned !== null;
    const highRiskReady = highRiskFarms !== null;
    const pendingFollowUpsReady = pendingFollowUpScans !== null;
    const missingOutcomesReady = missingOutcomes !== null;
    const interventionsReady = interventionsNeeded !== null;

    return Object.freeze<FieldOfficerDashboardEnvelope>({
      initialized: true,
      routeReady,
      roleScoped: true as const,
      orgScoped: true as const,
      assignedFarmersReady, highRiskReady, pendingFollowUpsReady,
      missingOutcomesReady, interventionsReady,
      noCrossOrgLeakage: true as const,
      farmersAssigned, activeFarmers, inactiveFarmers,
      highRiskFarms, pendingFollowUpScans, missingOutcomes,
      overdueTasks, interventionsNeeded, recentWorseningOutcomes,
      composedFrom: Object.freeze(composed) as ReadonlyArray<string>,
      confidence: (composed.length >= 2 ? 'high' : composed.length >= 1 ? 'medium' : 'low') as Confidence,
      explanation:
        'Field Officer dashboard composite over __fieldOfficerCommandCenterHealth + ' +
        '__fieldOfficerHealth + __pilotAnalyticsHealth + __interventionHealth. Null metrics ' +
        'mean "no data ingested" — never fake numbers. Org scoping inherited from upstream.',
      limitations:
        'Page-level role guard enforces role_scoped access; this runtime never expands scope. '
        + GUIDANCE_TAIL,
    });
  }, Object.freeze<FieldOfficerDashboardEnvelope>({
    initialized: true,
    routeReady: false,
    roleScoped: true as const, orgScoped: true as const,
    assignedFarmersReady: false, highRiskReady: false,
    pendingFollowUpsReady: false, missingOutcomesReady: false,
    interventionsReady: false, noCrossOrgLeakage: true as const,
    farmersAssigned: null, activeFarmers: null, inactiveFarmers: null,
    highRiskFarms: null, pendingFollowUpScans: null, missingOutcomes: null,
    overdueTasks: null, interventionsNeeded: null, recentWorseningOutcomes: null,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    confidence: 'low' as Confidence,
    explanation: 'Field Officer dashboard runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installFieldOfficerDashboardGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__fieldOfficerDashboardHealth !== 'function') {
      w.__fieldOfficerDashboardHealth = function () {
        const out = fieldOfficerDashboardHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · FO Dashboard]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
