/**
 * src/runtime/yield/YieldSignalEngine.ts — derives the
 * "hasSufficientData" boolean + composes the farmer-facing
 * safeMessage. Used by YieldIntelligenceRuntime as the gate
 * between "show yield card" and "show 'not enough data' line".
 *
 * Pure. Never throws.
 */

import {
  YIELD_RISK,
  type YieldRiskValue,
} from './yieldContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export interface YieldSignalInput {
  plantId?:          string;
  scanHealthScore?:  number;
  severityLevel?:    string;
  growthStage?:      string;
  weatherRiskLevel?: string;
  pestPressure?:     string;
  taskCompletionRate?: number;
}

/** Threshold: need at least 2 meaningful signals to estimate risk. */
export function hasSufficientData(input: YieldSignalInput): boolean {
  return _safe(() => {
    let signals = 0;
    if (input.scanHealthScore != null) signals++;
    if (input.severityLevel)            signals++;
    if (input.growthStage)              signals++;
    if (input.weatherRiskLevel)         signals++;
    if (input.pestPressure)             signals++;
    if (input.taskCompletionRate != null) signals++;
    return signals >= 2;
  }, false);
}

/**
 * composeSafeMessage — farmer-facing one-liner. NEVER uses
 * "guaranteed", "exactly", or any banned wording. The CI gate
 * enforces this.
 */
export function composeSafeMessage(
  yieldRisk: YieldRiskValue,
  riskDrivers: ReadonlyArray<{ signal: string }>,
): string {
  return _safe(() => {
    if (yieldRisk === YIELD_RISK.UNKNOWN) {
      return 'Not enough data yet — scan again in a few days to see a yield estimate.';
    }
    const dominant = riskDrivers[0]?.signal || '';
    const driverLabel =
      dominant === 'disease'    ? 'Leaf health and recent disease signals'
    : dominant === 'pest'       ? 'Recent pest pressure'
    : dominant === 'weather'    ? 'Recent weather risk'
    : dominant === 'satellite'  ? 'Field-level vegetation signals'
    : dominant === 'moisture'   ? 'Moisture stress signals'
    : dominant === 'heat'       ? 'Heat stress signals'
    : dominant === 'trend'      ? 'Declining vegetation trend'
    : dominant === 'health'     ? 'Recent scan health signals'
    : 'Recent signals';

    if (yieldRisk === YIELD_RISK.HIGH) {
      return `${driverLabel} may significantly reduce yield. Inspect closely and scan again in 2-3 days.`;
    }
    if (yieldRisk === YIELD_RISK.MEDIUM) {
      return `${driverLabel} may reduce yield. Monitor and scan again in 3-5 days.`;
    }
    return 'Conditions look stable for now. Continue normal care and scan again next week.';
  }, 'Not enough data yet — scan again in a few days to see a yield estimate.');
}

export const YIELD_SIGNAL_ENGINE_VERSION = 'yield-signal-engine-v1';
