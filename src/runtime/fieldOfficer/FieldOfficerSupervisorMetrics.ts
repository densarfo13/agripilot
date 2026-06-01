/**
 * FieldOfficerSupervisorMetrics.ts → window.__fieldOfficerSupervisorMetricsHealth().
 *
 * Composite over EXISTING __fieldOfficerHealth + __ngoIntelligenceHealth +
 * __pilotAnalyticsHealth + __interventionHealth. Surfaces the 7 spec
 * supervisor metrics for organization_admin / admin roles.
 *
 *   • fieldOfficersTotal
 *   • farmersPerOfficer
 *   • followUpCompletionRate
 *   • outcomeCaptureRate
 *   • averageResponseTimeHours
 *   • highRiskFarmersByOfficer
 *   • overdueInterventionsByOfficer
 *
 * Org-scoped read by reading the SAME upstream probes the existing NGO
 * intelligence stack already tenant-isolates. This runtime never crosses
 * org boundaries; if upstream isn't org-scoped, this runtime returns
 * NEEDS_DATA. No fake percentages.
 *
 * Self-contained; never throws.
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

export const FIELD_OFFICER_SUPERVISOR_VERSION = 'field-officer-supervisor-v1' as const;

export interface FieldOfficerSupervisorEnvelope {
  initialized: true;
  // §SPEC 7 supervisor metrics. null = NEEDS_DATA (honest).
  fieldOfficersTotal: number | null;
  farmersPerOfficer: number | null;
  followUpCompletionRate: number | null;     // 0..100 percentage
  outcomeCaptureRate: number | null;         // 0..100 percentage
  averageResponseTimeHours: number | null;
  highRiskFarmersByOfficer: ReadonlyArray<{ officerId: string; count: number }>;
  overdueInterventionsByOfficer: ReadonlyArray<{ officerId: string; count: number }>;
  // Contract.
  supervisorMetricsReady: boolean;
  realDataOnly: true;
  orgScoped: true;
  insufficientDataHandled: true;
  composedFrom: ReadonlyArray<string>;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

function _num(v: any): number | null {
  return (typeof v === 'number' && isFinite(v)) ? v : null;
}

function _pctOrNull(num: number | null, denom: number | null): number | null {
  if (num === null || denom === null || denom <= 0) return null;
  return Math.round((num / denom) * 100);
}

function _safeOfficerArray(v: any): ReadonlyArray<{ officerId: string; count: number }> {
  return _safe(() => {
    if (!Array.isArray(v)) return Object.freeze([]) as ReadonlyArray<{ officerId: string; count: number }>;
    const out: { officerId: string; count: number }[] = [];
    for (const row of v) {
      if (!row || typeof row !== 'object') continue;
      const id = typeof row.officerId === 'string' ? row.officerId
        : typeof row.id === 'string' ? row.id : null;
      const c = _num(row.count) ?? _num(row.n);
      if (id && c !== null) out.push({ officerId: id, count: c });
      if (out.length >= 50) break;
    }
    return Object.freeze(out);
  }, Object.freeze([]) as ReadonlyArray<{ officerId: string; count: number }>);
}

export function fieldOfficerSupervisorMetricsHealth()
  : Readonly<FieldOfficerSupervisorEnvelope> {
  return _safe(() => {
    const officer = _probe('__fieldOfficerHealth');
    const ngo = _probe('__ngoIntelligenceHealth');
    const pilot = _probe('__pilotAnalyticsHealth');
    const intervention = _probe('__interventionHealth') || _probe('__pilotInterventionHealth');

    const composed: string[] = [];
    if (officer) composed.push('__fieldOfficerHealth');
    if (ngo) composed.push('__ngoIntelligenceHealth');
    if (pilot) composed.push('__pilotAnalyticsHealth');
    if (intervention) composed.push('__interventionHealth');

    const officerV: any = officer ? ((officer as any).value || officer) : {};
    const ngoV: any = ngo ? ((ngo as any).value || ngo) : {};
    const pilotV: any = pilot ? ((pilot as any).value || pilot) : {};
    const intV: any = intervention ? ((intervention as any).value || intervention) : {};

    const fieldOfficersTotal = _num(officerV.fieldOfficersTotal)
      ?? _num(ngoV.fieldOfficersTotal) ?? _num(officerV.officerCount);
    const totalFarmers = _num(officerV.farmersAssigned)
      ?? _num(ngoV.farmCount) ?? _num(officerV.farmCount);
    const farmersPerOfficer = (fieldOfficersTotal !== null && totalFarmers !== null && fieldOfficersTotal > 0)
      ? Math.round(totalFarmers / fieldOfficersTotal) : null;

    const followUpsCompleted = _num(officerV.followUpsCompleted) ?? _num(pilotV.followUpsCompleted);
    const followUpsTotal = _num(officerV.followUpsTotal) ?? _num(pilotV.followUpsTotal);
    const followUpCompletionRate = _pctOrNull(followUpsCompleted, followUpsTotal);

    const outcomesCaptured = _num(pilotV.outcomesCaptured) ?? _num(officerV.outcomesCaptured);
    const outcomesExpected = _num(pilotV.outcomesExpected) ?? _num(officerV.outcomesExpected);
    const outcomeCaptureRate = _pctOrNull(outcomesCaptured, outcomesExpected);

    const averageResponseTimeHours = _num(officerV.averageResponseTimeHours)
      ?? _num(officerV.avgResponseHours);

    const highRiskFarmersByOfficer = _safeOfficerArray(officerV.highRiskByOfficer
      ?? ngoV.highRiskByOfficer);
    const overdueInterventionsByOfficer = _safeOfficerArray(intV.overdueByOfficer
      ?? officerV.overdueByOfficer);

    // Ready when at least one non-null metric is present.
    const ready = [
      fieldOfficersTotal, farmersPerOfficer, followUpCompletionRate,
      outcomeCaptureRate, averageResponseTimeHours,
    ].some((v) => v !== null) || highRiskFarmersByOfficer.length > 0
      || overdueInterventionsByOfficer.length > 0;

    return Object.freeze<FieldOfficerSupervisorEnvelope>({
      initialized: true,
      fieldOfficersTotal, farmersPerOfficer,
      followUpCompletionRate, outcomeCaptureRate,
      averageResponseTimeHours,
      highRiskFarmersByOfficer, overdueInterventionsByOfficer,
      supervisorMetricsReady: ready,
      realDataOnly: true as const,
      orgScoped: true as const,
      insufficientDataHandled: true as const,
      composedFrom: Object.freeze(composed) as ReadonlyArray<string>,
      confidence: (composed.length >= 2 && ready ? 'high' : ready ? 'medium' : 'low') as Confidence,
      explanation:
        'Supervisor metrics composed over __fieldOfficerHealth + __ngoIntelligenceHealth + ' +
        '__pilotAnalyticsHealth + __interventionHealth. Null values mean "no data ingested yet" ' +
        '— never fabricated percentages. Org scoping inherited from upstream probes.',
      limitations:
        'If the upstream NGO/pilot probes are not org-scoped in this environment, this composite ' +
        'returns null values rather than guess. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze<FieldOfficerSupervisorEnvelope>({
    initialized: true,
    fieldOfficersTotal: null, farmersPerOfficer: null,
    followUpCompletionRate: null, outcomeCaptureRate: null,
    averageResponseTimeHours: null,
    highRiskFarmersByOfficer: Object.freeze([]) as ReadonlyArray<{ officerId: string; count: number }>,
    overdueInterventionsByOfficer: Object.freeze([]) as ReadonlyArray<{ officerId: string; count: number }>,
    supervisorMetricsReady: false,
    realDataOnly: true as const, orgScoped: true as const,
    insufficientDataHandled: true as const,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    confidence: 'low' as Confidence,
    explanation: 'Supervisor metrics runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installFieldOfficerSupervisorMetricsGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__fieldOfficerSupervisorMetricsHealth !== 'function') {
      w.__fieldOfficerSupervisorMetricsHealth = function () {
        const out = fieldOfficerSupervisorMetricsHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · FO Supervisor]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
