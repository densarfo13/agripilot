/**
 * CommandCenterGapClosure.ts → window.__commandCenterGapClosureHealth().
 *
 * Composite over the 3 gap-closure integrations:
 *   • SoilGrids                  ← __soilGridsHealth
 *   • Weekly Review              ← __weeklyFarmReviewHealth + __weeklyReviewPageHealth
 *   • Field Officer Dashboard    ← __fieldOfficerDashboardHealth +
 *                                  __fieldOfficerSupervisorMetricsHealth
 *
 * Non-blocking: every backing probe is honest false-by-default until
 * data lands. Command Center is NEVER blocked when soil unavailable.
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

export const COMMAND_CENTER_GAP_CLOSURE_VERSION = 'command-center-gap-closure-v1' as const;

export interface CommandCenterGapClosureEnvelope {
  initialized: true;
  soilIntegrated: boolean;
  weeklyReviewIntegrated: boolean;
  fieldOfficerIntegrated: boolean;
  nonBlocking: true;
  composedFrom: ReadonlyArray<string>;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export function commandCenterGapClosureHealth()
  : Readonly<CommandCenterGapClosureEnvelope> {
  return _safe(() => {
    const soil = _probe('__soilGridsHealth');
    const weeklyData = _probe('__weeklyFarmReviewHealth');
    const weeklyPage = _probe('__weeklyReviewPageHealth');
    const foDash = _probe('__fieldOfficerDashboardHealth');
    const foSup = _probe('__fieldOfficerSupervisorMetricsHealth');

    const composed: string[] = [];
    if (soil) composed.push('__soilGridsHealth');
    if (weeklyData) composed.push('__weeklyFarmReviewHealth');
    if (weeklyPage) composed.push('__weeklyReviewPageHealth');
    if (foDash) composed.push('__fieldOfficerDashboardHealth');
    if (foSup) composed.push('__fieldOfficerSupervisorMetricsHealth');

    const soilIntegrated = !!(soil && ((soil as any).initialized === true));
    const weeklyReviewIntegrated = !!(weeklyData && weeklyPage
      && (weeklyPage as any).initialized === true);
    const fieldOfficerIntegrated = !!(foDash && foSup
      && (foDash as any).initialized === true);

    return Object.freeze<CommandCenterGapClosureEnvelope>({
      initialized: true,
      soilIntegrated, weeklyReviewIntegrated, fieldOfficerIntegrated,
      nonBlocking: true as const,
      composedFrom: Object.freeze(composed) as ReadonlyArray<string>,
      confidence: ([soilIntegrated, weeklyReviewIntegrated, fieldOfficerIntegrated]
        .filter(Boolean).length >= 2 ? 'high' : 'medium') as Confidence,
      explanation:
        'Gap-closure composite over the 3 production integrations (SoilGrids, Weekly Review, ' +
        'Field Officer Dashboard). Honest false until each integration probe reports ready. ' +
        'Command Center never blocks on these — they are additive surfaces.',
      limitations:
        'Soil integration requires GPS coordinates; field officer requires role + org scope. '
        + GUIDANCE_TAIL,
    });
  }, Object.freeze<CommandCenterGapClosureEnvelope>({
    initialized: true,
    soilIntegrated: false, weeklyReviewIntegrated: false, fieldOfficerIntegrated: false,
    nonBlocking: true as const,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    confidence: 'low' as Confidence,
    explanation: 'Command Center gap-closure runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installCommandCenterGapClosureGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__commandCenterGapClosureHealth !== 'function') {
      w.__commandCenterGapClosureHealth = function () {
        const out = commandCenterGapClosureHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · CC Gap Closure]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
