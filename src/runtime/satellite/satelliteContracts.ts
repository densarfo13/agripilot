/**
 * src/runtime/satellite/satelliteContracts.ts — frozen types
 * for the Satellite Intelligence runtime.
 *
 * Honest-degradation rule: when no provider is configured, the
 * runtime returns `vegetationHealth: 'unknown'` etc. with an
 * `unavailable` envelope flag. It NEVER fabricates NDVI values or
 * fakes provider data. The CI gate enforces this.
 *
 * Strict-rule audit
 *   • Pure data declarations.
 *   • No React / DOM types.
 *   • No PII.
 */

export const SATELLITE_RUNTIME_VERSION = 'satellite-intelligence-v1';

export const VEGETATION_HEALTH = Object.freeze({
  GOOD:    'good',
  WATCH:   'watch',
  POOR:    'poor',
  UNKNOWN: 'unknown',
} as const);

export type VegetationHealthValue =
  typeof VEGETATION_HEALTH[keyof typeof VEGETATION_HEALTH];

export const NDVI_TREND = Object.freeze({
  IMPROVING: 'improving',
  STABLE:    'stable',
  DECLINING: 'declining',
  UNKNOWN:   'unknown',
} as const);

export type NDVITrendValue =
  typeof NDVI_TREND[keyof typeof NDVI_TREND];

export const STRESS_LEVEL = Object.freeze({
  LOW:     'low',
  MEDIUM:  'medium',
  HIGH:    'high',
  UNKNOWN: 'unknown',
} as const);

export type StressLevelValue =
  typeof STRESS_LEVEL[keyof typeof STRESS_LEVEL];

export interface SatelliteResult {
  farmId?:             string;
  scanId?:             string;
  vegetationHealth:    VegetationHealthValue;
  ndviTrend:           NDVITrendValue;
  moistureRisk:        StressLevelValue;
  heatStress:          StressLevelValue;
  confidence:          number;     // 0-100
  safeMessage:         string;     // farmer-facing one-liner
  unavailable:         boolean;
  unavailableReason?:  string;     // 'no_provider' | 'no_boundary' | 'rate_limited' | ...
  providerConfigured:  boolean;
  timestamp:           string;
}

export interface SatelliteHealth {
  runtimeVersion:           string;
  initialized:              boolean;
  providerConfigured:       boolean;
  ndviReady:                boolean;
  moistureRiskReady:        boolean;
  heatStressReady:          boolean;
  unavailableHandledSafely: boolean;
  fakeSatelliteData:        boolean;     // ALWAYS false in production
}

export const SATELLITE_BANNED_WORDING = Object.freeze([
  'guaranteed satellite reading',
  'exact ndvi',
  'confirmed satellite',
] as const);
