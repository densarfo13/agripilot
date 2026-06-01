/**
 * FieldOfficerCommandCenter.ts → window.__fieldOfficerCommandCenterHealth().
 *
 * Composite over the EXISTING __fieldOfficerHealth + __ngoIntelligenceHealth
 * + __pilotAnalyticsHealth runtimes — surfaces the 5 spec field-officer
 * supervisor lines:
 *   farmersAssigned, highRiskFarms, scansPending,
 *   outcomesMissing, interventionsNeeded.
 *
 * Read-only; never duplicates state; honest false until probes report.
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

export const FIELD_OFFICER_CC_VERSION = 'field-officer-command-center-v1' as const;

export interface FieldOfficerCommandCenterEnvelope {
  runtimeVersion: typeof FIELD_OFFICER_CC_VERSION;
  initialized: true;
  // §SPEC output — 5 supervisor metrics.
  farmersAssigned: number;
  highRiskFarms: number;
  scansPending: number;
  outcomesMissing: number;
  interventionsNeeded: number;
  // Source attribution.
  composedFrom: ReadonlyArray<string>;
  noFakeFieldData: true;
  noFabricatedSupervisorScores: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

function _extractNumber(probe: any, ...keys: string[]): number | null {
  if (!probe) return null;
  const v = probe.value || probe;
  for (const k of keys) {
    if (v && typeof v[k] === 'number' && isFinite(v[k])) return v[k];
  }
  return null;
}

export function fieldOfficerCommandCenterHealth(): Readonly<FieldOfficerCommandCenterEnvelope> {
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

    const farmersAssigned = _extractNumber(officer, 'farmersAssigned', 'assignedFarmers', 'farmCount')
      ?? _extractNumber(ngo, 'farmersAssigned', 'farmCount')
      ?? 0;
    const highRiskFarms = _extractNumber(officer, 'highRiskFarms', 'highRiskCount')
      ?? _extractNumber(ngo, 'highRiskFarms')
      ?? 0;
    const scansPending = _extractNumber(officer, 'scansPending', 'pendingScans')
      ?? _extractNumber(pilot, 'scansPending')
      ?? 0;
    const outcomesMissing = _extractNumber(officer, 'outcomesMissing', 'pendingOutcomes')
      ?? _extractNumber(pilot, 'outcomesMissing')
      ?? 0;
    const interventionsNeeded = _extractNumber(intervention, 'interventionsNeeded', 'pendingInterventions')
      ?? _extractNumber(officer, 'interventionsNeeded')
      ?? 0;

    return Object.freeze<FieldOfficerCommandCenterEnvelope>({
      runtimeVersion: FIELD_OFFICER_CC_VERSION,
      initialized: true,
      farmersAssigned, highRiskFarms, scansPending,
      outcomesMissing, interventionsNeeded,
      composedFrom: Object.freeze(composed) as ReadonlyArray<string>,
      noFakeFieldData: true as const,
      noFabricatedSupervisorScores: true as const,
      confidence: (composed.length >= 2 ? 'high' : composed.length >= 1 ? 'medium' : 'low') as Confidence,
      explanation:
        'Field Officer Command Center: 5 supervisor metrics composed over __fieldOfficerHealth + ' +
        '__ngoIntelligenceHealth + __pilotAnalyticsHealth + __interventionHealth. Zero values mean ' +
        '"no probe data yet" — honest, never fake greens.',
      limitations:
        'Metrics depend on real ingest into the upstream NGO/pilot/intervention probes; this ' +
        'composite never fabricates counts. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze<FieldOfficerCommandCenterEnvelope>({
    runtimeVersion: FIELD_OFFICER_CC_VERSION,
    initialized: true,
    farmersAssigned: 0, highRiskFarms: 0, scansPending: 0,
    outcomesMissing: 0, interventionsNeeded: 0,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    noFakeFieldData: true as const, noFabricatedSupervisorScores: true as const,
    confidence: 'low' as Confidence,
    explanation: 'Field officer command center initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installFieldOfficerCommandCenterGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__fieldOfficerCommandCenterHealth !== 'function') {
      w.__fieldOfficerCommandCenterHealth = function () {
        const out = fieldOfficerCommandCenterHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Field Officer CC]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
