/**
 * src/runtime/satellite/MoistureStressEngine.ts — moisture-stress
 * classifier from soil moisture or NDWI signals.
 *
 * Pure. Never throws.
 */

import {
  STRESS_LEVEL, type StressLevelValue,
} from './satelliteContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export interface MoistureInput {
  soilMoisturePct?: number;       // 0-100
  ndwiValue?:       number;       // -1 to 1
  recentRainfallMm?: number;
}

export function evaluateMoistureStress(input: MoistureInput): StressLevelValue {
  return _safe(() => {
    const sm = typeof input.soilMoisturePct === 'number'
              && Number.isFinite(input.soilMoisturePct)
              ? input.soilMoisturePct : null;
    const ndwi = typeof input.ndwiValue === 'number'
                && Number.isFinite(input.ndwiValue)
                ? input.ndwiValue : null;
    const rain = typeof input.recentRainfallMm === 'number'
                && Number.isFinite(input.recentRainfallMm)
                ? input.recentRainfallMm : null;

    if (sm == null && ndwi == null) return STRESS_LEVEL.UNKNOWN;

    // Direct soil moisture rules.
    if (sm != null) {
      if (sm < 15)  return STRESS_LEVEL.HIGH;
      if (sm < 30)  return STRESS_LEVEL.MEDIUM;
      return STRESS_LEVEL.LOW;
    }
    // NDWI fallback (water content; lower = drier).
    if (ndwi != null) {
      if (ndwi < -0.1) return STRESS_LEVEL.HIGH;
      if (ndwi < 0.1)  return STRESS_LEVEL.MEDIUM;
      return STRESS_LEVEL.LOW;
    }
    // Rainfall dampener.
    if (rain != null && rain > 30) return STRESS_LEVEL.LOW;

    return STRESS_LEVEL.UNKNOWN;
  }, STRESS_LEVEL.UNKNOWN);
}

export const MOISTURE_ENGINE_VERSION = 'moisture-stress-engine-v1';
