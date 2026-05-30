/**
 * src/runtime/satellite/VegetationTrendEngine.ts — composes
 * NDVI trend + recent weather to produce a "trend confidence" score.
 *
 * Pure. Never throws.
 */

import { NDVI_TREND, type NDVITrendValue } from './satelliteContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export interface VegetationTrendInput {
  ndviTrend:    NDVITrendValue;
  cloudCover?:  number;     // 0-1; high cloud cover reduces confidence
  daysSinceLastObservation?: number;
}

export interface VegetationTrendOutput {
  trendConfidence: number;     // 0-100
}

export function evaluateVegetationTrend(input: VegetationTrendInput): VegetationTrendOutput {
  return _safe(() => {
    let conf = 70;

    // Drop confidence for high cloud cover.
    if (typeof input.cloudCover === 'number' && Number.isFinite(input.cloudCover)) {
      if (input.cloudCover > 0.7)      conf -= 30;
      else if (input.cloudCover > 0.4) conf -= 15;
    }

    // Drop confidence for stale observations.
    if (typeof input.daysSinceLastObservation === 'number'
        && Number.isFinite(input.daysSinceLastObservation)) {
      if (input.daysSinceLastObservation > 14)      conf -= 30;
      else if (input.daysSinceLastObservation > 7)  conf -= 15;
    }

    // UNKNOWN trend forces low confidence.
    if (input.ndviTrend === NDVI_TREND.UNKNOWN) conf = Math.min(conf, 25);

    conf = Math.max(0, Math.min(100, conf));

    return Object.freeze({ trendConfidence: conf });
  }, Object.freeze({ trendConfidence: 0 }));
}

export const VEGETATION_TREND_ENGINE_VERSION = 'vegetation-trend-engine-v1';
