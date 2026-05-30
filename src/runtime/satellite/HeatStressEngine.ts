/**
 * src/runtime/satellite/HeatStressEngine.ts — heat-stress
 * classifier from LST (land surface temperature) or weather.
 *
 * Pure. Never throws.
 */

import {
  STRESS_LEVEL, type StressLevelValue,
} from './satelliteContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export interface HeatInput {
  lstC?:         number;          // land surface temperature
  airTempC?:     number;          // 2m air temperature
  consecutiveHotDays?: number;    // count of days above threshold
}

export function evaluateHeatStress(input: HeatInput): StressLevelValue {
  return _safe(() => {
    const lst = typeof input.lstC === 'number'
              && Number.isFinite(input.lstC)
              ? input.lstC : null;
    const air = typeof input.airTempC === 'number'
              && Number.isFinite(input.airTempC)
              ? input.airTempC : null;
    const days = typeof input.consecutiveHotDays === 'number'
                && Number.isFinite(input.consecutiveHotDays)
                ? input.consecutiveHotDays : 0;

    if (lst == null && air == null) return STRESS_LEVEL.UNKNOWN;

    const t = lst != null ? lst : air;
    if (t == null) return STRESS_LEVEL.UNKNOWN;

    if (t >= 40 || days >= 5) return STRESS_LEVEL.HIGH;
    if (t >= 35 || days >= 3) return STRESS_LEVEL.MEDIUM;
    return STRESS_LEVEL.LOW;
  }, STRESS_LEVEL.UNKNOWN);
}

export const HEAT_ENGINE_VERSION = 'heat-stress-engine-v1';
