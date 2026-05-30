/**
 * src/runtime/satellite/SatelliteRuntime.ts — top-level facade
 * for the Satellite Intelligence suite.
 *
 * Provider-ready architecture: composes NDVI / Moisture / Heat /
 * Trend / Boundary engines. The runtime itself NEVER calls a
 * remote satellite API — that's left to a future provider
 * adapter. When no provider data is passed in, the runtime
 * returns `unavailable: true` and a polite safeMessage; it
 * NEVER fabricates values.
 *
 * Strict-rule audit
 *   • Composition over architecture. NEVER imports React or DOM.
 *   • Pure runtime. Never throws.
 *   • Frozen envelopes.
 *   • Safe wording — CI gate enforces.
 *   • No fake satellite data.
 *   • Single window global: __satelliteIntelligenceHealth.
 */

import {
  SATELLITE_RUNTIME_VERSION,
  VEGETATION_HEALTH, NDVI_TREND, STRESS_LEVEL,
  type SatelliteResult, type SatelliteHealth,
} from './satelliteContracts';
import { evaluateNDVI }              from './NDVIEngine';
import { evaluateMoistureStress }    from './MoistureStressEngine';
import { evaluateHeatStress }        from './HeatStressEngine';
import { evaluateVegetationTrend }   from './VegetationTrendEngine';
import { evaluateBoundary }          from './FarmBoundarySignalEngine';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function _providerConfigured(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    // Provider-ready hook: a future Sentinel adapter pins
    // window.__satelliteProvider.ready when env keys are wired.
    return !!(w.__satelliteProvider && w.__satelliteProvider.ready);
  }, false);
}

// ─── Public entry ─────────────────────────────────────────────────

export interface SatelliteEvaluateInput {
  farmId?:        string;
  scanId?:        string;
  farmBoundary?:  ReadonlyArray<{ lat: number; lng: number }>;
  gpsPoint?:      { lat: number; lng: number };
  region?:        string;
  cropType?:      string;
  /** Provider-supplied NDVI value (0-1 typical). */
  ndviValue?:     number;
  /** Provider-supplied NDVI history. */
  ndviHistory?:   ReadonlyArray<{ value: number; date: string }>;
  soilMoisturePct?: number;
  ndwiValue?:     number;
  recentRainfallMm?: number;
  lstC?:          number;
  airTempC?:      number;
  consecutiveHotDays?: number;
  cloudCover?:    number;
  daysSinceLastObservation?: number;
  timestamp?:     string;
}

function _safeMessageFor(
  health: SatelliteResult['vegetationHealth'],
  trend:  SatelliteResult['ndviTrend'],
  moisture: SatelliteResult['moistureRisk'],
  heat:   SatelliteResult['heatStress'],
  unavailable: boolean,
): string {
  if (unavailable) {
    return 'Satellite data is not available for this farm yet.';
  }
  if (health === VEGETATION_HEALTH.POOR) {
    return 'Vegetation signal looks poor — inspect the field and scan affected areas.';
  }
  if (health === VEGETATION_HEALTH.WATCH || trend === NDVI_TREND.DECLINING) {
    return 'Vegetation trend appears to be declining — walk the field and capture a fresh scan.';
  }
  if (moisture === STRESS_LEVEL.HIGH) {
    return 'Moisture stress may be increasing — inspect soil moisture.';
  }
  if (heat === STRESS_LEVEL.HIGH) {
    return 'Heat stress likely — water early or late in the day where possible.';
  }
  return 'Vegetation health looks stable.';
}

export function evaluate(input: SatelliteEvaluateInput): SatelliteResult {
  const fallback = (reason: string): SatelliteResult =>
    Object.freeze({
      farmId: input?.farmId,
      scanId: input?.scanId,
      vegetationHealth: VEGETATION_HEALTH.UNKNOWN,
      ndviTrend:        NDVI_TREND.UNKNOWN,
      moistureRisk:     STRESS_LEVEL.UNKNOWN,
      heatStress:       STRESS_LEVEL.UNKNOWN,
      confidence:       0,
      safeMessage:      _safeMessageFor(
                          VEGETATION_HEALTH.UNKNOWN,
                          NDVI_TREND.UNKNOWN,
                          STRESS_LEVEL.UNKNOWN,
                          STRESS_LEVEL.UNKNOWN,
                          true),
      unavailable:      true,
      unavailableReason: reason,
      providerConfigured: _providerConfigured(),
      timestamp:        _str(input?.timestamp),
    });

  return _safe(() => {
    const providerOk = _providerConfigured();
    if (!providerOk) return fallback('no_provider');

    const boundary = evaluateBoundary({
      farmBoundary: input.farmBoundary,
      gpsPoint:     input.gpsPoint,
      region:       input.region,
    });
    if (!boundary.hasContext) return fallback('no_boundary');

    // No provider-supplied values → unavailable.
    if (input.ndviValue == null
        && input.soilMoisturePct == null
        && input.lstC == null) {
      return fallback('no_data');
    }

    const ndvi = evaluateNDVI({
      ndviValue:   input.ndviValue,
      ndviHistory: input.ndviHistory,
    });
    const moisture = evaluateMoistureStress({
      soilMoisturePct:  input.soilMoisturePct,
      ndwiValue:        input.ndwiValue,
      recentRainfallMm: input.recentRainfallMm,
    });
    const heat = evaluateHeatStress({
      lstC:               input.lstC,
      airTempC:           input.airTempC,
      consecutiveHotDays: input.consecutiveHotDays,
    });
    const trendOut = evaluateVegetationTrend({
      ndviTrend:                 ndvi.ndviTrend,
      cloudCover:                input.cloudCover,
      daysSinceLastObservation:  input.daysSinceLastObservation,
    });

    return Object.freeze({
      farmId: input.farmId,
      scanId: input.scanId,
      vegetationHealth: ndvi.vegetationHealth,
      ndviTrend:        ndvi.ndviTrend,
      moistureRisk:     moisture,
      heatStress:       heat,
      confidence:       trendOut.trendConfidence,
      safeMessage:      _safeMessageFor(
                          ndvi.vegetationHealth,
                          ndvi.ndviTrend,
                          moisture, heat, false),
      unavailable:      false,
      providerConfigured: true,
      timestamp:        _str(input.timestamp),
    });
  }, fallback('error'));
}

// ─── Diagnostic envelope ──────────────────────────────────────────

export function satelliteIntelligenceHealth(): SatelliteHealth {
  return _safe(() => Object.freeze({
    runtimeVersion:           SATELLITE_RUNTIME_VERSION,
    initialized:              true,
    providerConfigured:       _providerConfigured(),
    ndviReady:                true,
    moistureRiskReady:        true,
    heatStressReady:          true,
    unavailableHandledSafely: true,
    fakeSatelliteData:        false,
  }), Object.freeze({
    runtimeVersion:           SATELLITE_RUNTIME_VERSION,
    initialized:              false,
    providerConfigured:       false,
    ndviReady:                false,
    moistureRiskReady:        false,
    heatStressReady:          false,
    unavailableHandledSafely: false,
    fakeSatelliteData:        false,
  }));
}

export function installSatelliteIntelligenceGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__satelliteIntelligenceHealth !== 'function') {
      w.__satelliteIntelligenceHealth = function () {
        const out = satelliteIntelligenceHealth();
        try { console.log('[Farroway · Satellite Intelligence]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
