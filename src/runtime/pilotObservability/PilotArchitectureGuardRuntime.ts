/**
 * PilotArchitectureGuardRuntime.ts → window.__pilotArchitectureHealth().
 *
 * V1 PILOT LOCK. Pins the architecture as frozen. The runtime
 * exposes the 10 spec readiness flags + `architectureLocked: true as
 * const`. Composes the 12 allowed pilot systems by reading their
 * canonical health globals — never duplicates state, never adds new
 * intelligence.
 *
 * ALLOWED SYSTEMS (12) — any new system added beyond this list
 * violates the architecture lock and the gate fails:
 *   1. Command Center        ← __commandCenterHealth
 *   2. Daily Assistant       ← __dailyAssistantHealth
 *   3. Scan Intelligence     ← __scanPilotFreezeHealth
 *   4. Outcome Intelligence  ← __outcomeIntelligenceHealth | __scanOutcomeLoopHealth
 *   5. Weekly Review         ← __weeklyFarmReviewHealth
 *   6. Field Officer         ← __fieldOfficerCommandCenterHealth
 *   7. Funding               ← __fundingHealth
 *   8. Sell                  ← __postHarvestHealth | __marketplaceIntelligenceHealth
 *   9. Intelligence Fabric   ← __intelligenceFabricHealth
 *  10. Regional Intelligence ← __regionalIntelligenceFieldHealth
 *  11. Soil Intelligence     ← __soilIntelligenceHealth
 *  12. Market Intelligence   ← __marketIntelligenceHealth
 *
 * Plus the founder console: __founderDashboardHealth.
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

export const PILOT_ARCHITECTURE_GUARD_VERSION = 'pilot-architecture-guard-v1' as const;

/** The 12 allowed pilot systems. Any new system beyond this list
 *  violates the V1 lock. Exported so the gate can read it
 *  statically. */
export const V1_ALLOWED_SYSTEMS: ReadonlyArray<string> = Object.freeze([
  'CommandCenter',
  'DailyAssistant',
  'ScanIntelligence',
  'OutcomeIntelligence',
  'WeeklyReview',
  'FieldOfficer',
  'Funding',
  'Sell',
  'IntelligenceFabric',
  'RegionalIntelligence',
  'SoilIntelligence',
  'MarketIntelligence',
]);

/** Canonical primary global per allowed system. */
export const V1_SYSTEM_GLOBALS: Readonly<Record<string, ReadonlyArray<string>>> = Object.freeze({
  CommandCenter:        Object.freeze(['__commandCenterHealth']),
  DailyAssistant:       Object.freeze(['__dailyAssistantHealth']),
  ScanIntelligence:     Object.freeze(['__scanPilotFreezeHealth', '__scanAccuracyHealth']),
  OutcomeIntelligence:  Object.freeze(['__outcomeIntelligenceHealth', '__scanOutcomeLoopHealth']),
  WeeklyReview:         Object.freeze(['__weeklyFarmReviewHealth']),
  FieldOfficer:         Object.freeze(['__fieldOfficerCommandCenterHealth', '__fieldOfficerDashboardHealth']),
  Funding:              Object.freeze(['__fundingHealth']),
  Sell:                 Object.freeze(['__postHarvestHealth', '__marketplaceIntelligenceHealth']),
  IntelligenceFabric:   Object.freeze(['__intelligenceFabricHealth']),
  RegionalIntelligence: Object.freeze(['__regionalIntelligenceFieldHealth', '__regionalIntelligenceHealth']),
  SoilIntelligence:     Object.freeze(['__soilIntelligenceHealth']),
  MarketIntelligence:   Object.freeze(['__marketIntelligenceHealth', '__marketIntelligenceCompositeHealth']),
});

export interface PilotArchitectureHealthEnvelope {
  initialized: true;
  // §SPEC 10 readiness flags — literal-true except where backed by probe.
  architectureLocked: true;
  commandCenterReady: boolean;
  dailyAssistantReady: boolean;
  intelligenceFabricReady: boolean;
  scanReady: boolean;
  outcomeReady: boolean;
  weeklyReviewReady: boolean;
  fieldOfficerReady: boolean;
  founderDashboardReady: boolean;
  pilotReady: boolean;
  // System-by-system roll call.
  systemsReady: Readonly<Record<string, boolean>>;
  readySystemCount: number;
  totalSystems: 12;
  // Honesty.
  noNewIntelligenceEngines: true;
  noNewArchitectureFamilies: true;
  composedFrom: ReadonlyArray<string>;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

function _anyProbeReady(names: ReadonlyArray<string>): boolean {
  return _safe(() => {
    for (const n of names) {
      const p = _probe(n);
      if (!p) continue;
      const v: any = (p as any).value || p;
      if (v.initialized === true) return true;
    }
    return false;
  }, false);
}

export function pilotArchitectureHealth()
  : Readonly<PilotArchitectureHealthEnvelope> {
  return _safe(() => {
    const systemsReady: Record<string, boolean> = {};
    const composed: string[] = [];
    for (const name of V1_ALLOWED_SYSTEMS) {
      const globals = V1_SYSTEM_GLOBALS[name];
      const ready = _anyProbeReady(globals);
      systemsReady[name] = ready;
      if (ready) {
        for (const g of globals) {
          if (_probe(g)) { composed.push(g); break; }
        }
      }
    }

    const commandCenterReady = systemsReady.CommandCenter;
    const dailyAssistantReady = systemsReady.DailyAssistant;
    const intelligenceFabricReady = systemsReady.IntelligenceFabric;
    const scanReady = systemsReady.ScanIntelligence;
    const outcomeReady = systemsReady.OutcomeIntelligence;
    const weeklyReviewReady = systemsReady.WeeklyReview;
    const fieldOfficerReady = systemsReady.FieldOfficer;
    const founderDashboardReady = !!_anyProbeReady(['__founderDashboardHealth']);

    const readySystemCount = Object.values(systemsReady).filter(Boolean).length;
    const criticals = commandCenterReady && dailyAssistantReady
      && intelligenceFabricReady && scanReady && outcomeReady;
    const pilotReady = criticals && readySystemCount >= 9;

    return Object.freeze<PilotArchitectureHealthEnvelope>({
      initialized: true,
      architectureLocked: true as const,
      commandCenterReady,
      dailyAssistantReady,
      intelligenceFabricReady,
      scanReady,
      outcomeReady,
      weeklyReviewReady,
      fieldOfficerReady,
      founderDashboardReady,
      pilotReady,
      systemsReady: Object.freeze(systemsReady),
      readySystemCount,
      totalSystems: 12 as const,
      noNewIntelligenceEngines: true as const,
      noNewArchitectureFamilies: true as const,
      composedFrom: Object.freeze(composed) as ReadonlyArray<string>,
      confidence: (readySystemCount >= 10 ? 'high'
        : readySystemCount >= 6 ? 'medium' : 'low') as Confidence,
      explanation:
        'V1 Pilot Architecture Guard. The 12 allowed systems are listed in V1_ALLOWED_SYSTEMS; ' +
        'each readiness flag flips true only when its source probe reports initialized:true. ' +
        'pilotReady = criticals (CC + DA + Fabric + Scan + Outcome) all true AND ' +
        '>= 9/12 systems ready. architectureLocked is literal-true — the gate forbids ' +
        'new intelligence engines or architecture families.',
      limitations:
        'Lock attests the V1 contract; it does not prevent runtime regressions on individual ' +
        'systems — those are caught by their own gates. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze<PilotArchitectureHealthEnvelope>({
    initialized: true,
    architectureLocked: true as const,
    commandCenterReady: false, dailyAssistantReady: false,
    intelligenceFabricReady: false, scanReady: false, outcomeReady: false,
    weeklyReviewReady: false, fieldOfficerReady: false,
    founderDashboardReady: false, pilotReady: false,
    systemsReady: Object.freeze({}),
    readySystemCount: 0, totalSystems: 12 as const,
    noNewIntelligenceEngines: true as const,
    noNewArchitectureFamilies: true as const,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    confidence: 'low' as Confidence,
    explanation: 'Pilot architecture guard initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installPilotArchitectureGuardGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__pilotArchitectureHealth !== 'function') {
      w.__pilotArchitectureHealth = function () {
        const out = pilotArchitectureHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Pilot Architecture Guard]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
