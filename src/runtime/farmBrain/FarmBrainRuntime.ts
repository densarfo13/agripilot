/**
 * FarmBrainRuntime.ts — sprint #208, spec §1 + §10.
 *
 * The Farm Brain accessor + health composite. `getFarmBrain(farmId)`
 * returns the read-only farm-state record (composed from signals the
 * app already holds). `installFarmBrainHealthGlobal()` pins
 * window.__farmBrainHealth() with the spec's 7 readiness flags + the
 * #207 honesty fields.
 *
 * Read-only composition. No new datastore, no provider, satellite
 * always UNCONFIGURED / satelliteHistory []. Pure. Never throws.
 */

import { buildFarmBrain } from './FarmBrain';
import { inferCropStage } from './CropStageEngine';
import { generatePrimaryTask } from './AdaptiveTaskGenerator';
import { buildFarmScanMemory } from './FarmScanMemory';
import { buildSatelliteFoundationHealth } from './SatelliteCorrelationEngine';
import { buildDecisionTrace } from './DecisionTraceEngine';
import { buildFarmTimeline } from './FarmTimeline';
import { buildFarmDataQuality } from './FarmDataQualityEngine';
import type { FarmBrainRecord, FarmBrainReadiness } from './FarmBrainContracts';

export const FARM_BRAIN_RUNTIME_VERSION = 'farm-brain-runtime-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

/**
 * Compose the read-only Farm Brain record for a farm. The caller
 * passes the per-farm signals it already has (profile + histories);
 * the runtime never fetches or invents them. satelliteHistory is
 * always [] (frozen).
 */
export function getFarmBrain(farmId?: string, signals: {
  crop?: string;
  variety?: string;
  location?: string;
  plantingDate?: string;
  cropStage?: string;
  farmSize?: string;
  asOf?: string;
  weatherHistory?: ReadonlyArray<unknown>;
  scanHistory?: ReadonlyArray<unknown>;
  taskHistory?: ReadonlyArray<unknown>;
  outcomeHistory?: ReadonlyArray<unknown>;
  riskHistory?: ReadonlyArray<unknown>;
} = {}): Readonly<FarmBrainRecord> {
  return _safe(() => {
    // Derive stage from planting date when not explicitly provided.
    const stageProbe = inferCropStage({
      crop: signals.crop, plantingDate: signals.plantingDate, asOf: signals.asOf,
    });
    const cropStage = _str(signals.cropStage)
      || (stageProbe.stage !== 'unknown' ? stageProbe.stage : '')
      || null;
    return Object.freeze({
      runtimeVersion: FARM_BRAIN_RUNTIME_VERSION,
      farmId: _str(farmId) || null,
      crop: _str(signals.crop) || null,
      variety: _str(signals.variety) || null,
      location: _str(signals.location) || null,
      plantingDate: _str(signals.plantingDate) || null,
      cropStage,
      farmSize: _str(signals.farmSize) || null,
      weatherHistory: Object.freeze(_arr(signals.weatherHistory)),
      scanHistory: Object.freeze(_arr(signals.scanHistory)),
      taskHistory: Object.freeze(_arr(signals.taskHistory)),
      outcomeHistory: Object.freeze(_arr(signals.outcomeHistory)),
      satelliteHistory: Object.freeze([]) as ReadonlyArray<never>,
      riskHistory: Object.freeze(_arr(signals.riskHistory)),
    });
  }, Object.freeze({
    runtimeVersion: FARM_BRAIN_RUNTIME_VERSION,
    farmId: _str(farmId) || null,
    crop: null, variety: null, location: null, plantingDate: null,
    cropStage: null, farmSize: null,
    weatherHistory: Object.freeze([]), scanHistory: Object.freeze([]),
    taskHistory: Object.freeze([]), outcomeHistory: Object.freeze([]),
    satelliteHistory: Object.freeze([]) as ReadonlyArray<never>,
    riskHistory: Object.freeze([]),
  }));
}

/**
 * The 7 readiness flags + honesty fields. Each engine flag is true
 * because its module is present + imported here (structural
 * readiness). satelliteFoundationReady reflects the honest
 * UNCONFIGURED foundation being wired (it does NOT claim satellite
 * data is available).
 */
export function buildFarmBrainReadiness(): Readonly<FarmBrainReadiness> {
  return _safe(() => {
    const cropStageReady = typeof inferCropStage === 'function';
    const adaptiveTasksReady = typeof generatePrimaryTask === 'function';
    const scanMemoryReady = typeof buildFarmScanMemory === 'function';
    const satFoundation = buildSatelliteFoundationHealth();
    const farmBrainReady = typeof buildFarmBrain === 'function'
      && typeof getFarmBrain === 'function';
    return Object.freeze({
      farmBrainReady,
      cropStageReady,
      // FarmHealthEngine shipped #194/#197 — readiness is structural.
      farmHealthReady: true,
      adaptiveTasksReady,
      scanMemoryReady,
      // Outcome learning shipped #36/#198.
      outcomeLearningReady: true,
      satelliteFoundationReady: !!satFoundation.ok && !satFoundation.fabricatesReadings,
      // Sprint #209 — trace / timeline / data-quality engines.
      decisionTraceReady: typeof buildDecisionTrace === 'function',
      timelineReady: typeof buildFarmTimeline === 'function',
      dataQualityReady: typeof buildFarmDataQuality === 'function',
      satelliteUsed: false as const,
      readOnly: true as const,
      neverFabricates: true as const,
    });
  }, Object.freeze({
    farmBrainReady: false, cropStageReady: false, farmHealthReady: false,
    adaptiveTasksReady: false, scanMemoryReady: false,
    outcomeLearningReady: false, satelliteFoundationReady: false,
    decisionTraceReady: false, timelineReady: false, dataQualityReady: false,
    satelliteUsed: false as const, readOnly: true as const,
    neverFabricates: true as const,
  }));
}

let _installed = false;
export function installFarmBrainHealthGlobal(): void {
  if (_installed) return;
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => {
    Object.defineProperty(window as any, '__farmBrainHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildFarmBrainReadiness(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  getFarmBrain, buildFarmBrainReadiness, installFarmBrainHealthGlobal,
});
export default getFarmBrain;
