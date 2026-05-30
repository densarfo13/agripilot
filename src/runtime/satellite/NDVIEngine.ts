/**
 * src/runtime/satellite/NDVIEngine.ts — vegetation health
 * classifier from NDVI values. Pure deterministic.
 *
 * When no NDVI value is provided (no provider configured), returns
 * UNKNOWN — never fabricates a value.
 *
 * Pure. Never throws.
 */

import {
  VEGETATION_HEALTH, NDVI_TREND,
  type VegetationHealthValue, type NDVITrendValue,
} from './satelliteContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export interface NDVIInput {
  ndviValue?:    number;          // 0-1 typical; -1 to 1 absolute
  ndviHistory?:  ReadonlyArray<{ value: number; date: string }>;
}

export interface NDVIOutput {
  vegetationHealth: VegetationHealthValue;
  ndviTrend:        NDVITrendValue;
}

export function evaluateNDVI(input: NDVIInput): NDVIOutput {
  return _safe(() => {
    const v = typeof input.ndviValue === 'number'
              && Number.isFinite(input.ndviValue)
              ? input.ndviValue : null;

    let health: VegetationHealthValue = VEGETATION_HEALTH.UNKNOWN;
    if (v != null) {
      if (v >= 0.6)        health = VEGETATION_HEALTH.GOOD;
      else if (v >= 0.3)   health = VEGETATION_HEALTH.WATCH;
      else if (v >= 0)     health = VEGETATION_HEALTH.POOR;
    }

    // Trend: derived from history slope.
    let trend: NDVITrendValue = NDVI_TREND.UNKNOWN;
    if (Array.isArray(input.ndviHistory) && input.ndviHistory.length >= 2) {
      const sorted = [...input.ndviHistory].sort((a, b) => {
        const da = Date.parse(a.date); const db = Date.parse(b.date);
        return (Number.isFinite(da) ? da : 0) - (Number.isFinite(db) ? db : 0);
      });
      const first = sorted[0].value;
      const last  = sorted[sorted.length - 1].value;
      const delta = last - first;
      if (delta > 0.05)       trend = NDVI_TREND.IMPROVING;
      else if (delta < -0.05) trend = NDVI_TREND.DECLINING;
      else                    trend = NDVI_TREND.STABLE;
    }

    return Object.freeze({
      vegetationHealth: health,
      ndviTrend: trend,
    });
  }, Object.freeze({
    vegetationHealth: VEGETATION_HEALTH.UNKNOWN,
    ndviTrend:        NDVI_TREND.UNKNOWN,
  }));
}

export const NDVI_ENGINE_VERSION = 'ndvi-engine-v1';
