/**
 * src/runtime/intelligenceLoop/ObservationEngine.ts — Phase 1.
 *
 *   import { observeLoopInputs, OBSERVATION_ENGINE_VERSION }
 *     from 'src/runtime/intelligenceLoop/ObservationEngine';
 *
 * What this file owns
 * ───────────────────
 *   Pure collector. Reads the inputs the loop needs and emits
 *   ONE frozen observation envelope. No camera access, no UI
 *   logic, no fetch.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No React, no localStorage writes, no API calls.
 */

export const OBSERVATION_ENGINE_VERSION = 'loop-observation-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr  = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num  = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export interface LoopInputs {
  scanResult?: any;
  plant?:      any;
  weather?:    any;
  /** Coarse region code, NEVER exact GPS. */
  region?:     string;
  history?:    ReadonlyArray<any>;
  timeline?:   ReadonlyArray<any>;
  taskStatus?: ReadonlyArray<any>;
  offline?:    boolean;
}

export function observeLoopInputs(ctx: LoopInputs) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {} as LoopInputs;
    const scan  = c.scanResult || null;
    const plant = c.plant || null;
    const plantId = _str(
      (plant && (plant.id || plant.plantId)) ||
      (scan  && (scan.plantId  || scan.cropId)));
    return Object.freeze({
      runtimeVersion: OBSERVATION_ENGINE_VERSION,
      phase: 'observe',
      plantId,
      scanId:           _str(scan && (scan.scanId || scan.id)),
      scanConfidence:   _num(scan && scan.confidence),
      scanDiseaseHints: Object.freeze(
        _arr(scan && (scan.diseaseIds || scan.diseases))
          .map(_str).filter(Boolean)),
      scanPestHints:    Object.freeze(
        _arr(scan && (scan.pestIds || scan.pests))
          .map(_str).filter(Boolean)),
      lifecycleStage:   _str(plant
        && (plant.lifecycleStage || plant.growthStage)),
      healthScore:      _num(plant && plant.healthScore),
      riskScore:        _num(plant && plant.riskScore),
      region:           _str(c.region),
      weatherSummary:   _isObj(c.weather)
        ? Object.freeze({
            tempC:      _num((c.weather as any).tempC),
            humidity:   _num((c.weather as any).humidity),
            precipProb: _num((c.weather as any).precipProb),
            condition:  _str((c.weather as any).condition),
          })
        : null,
      timelineCount:    _arr(c.timeline).length,
      historyCount:     _arr(c.history).length,
      openTaskCount:    _arr(c.taskStatus)
        .filter((t) => _isObj(t) && !(t as any).completed).length,
      offline:          c.offline === true,
    });
  }, _emptyObservation());
}

function _emptyObservation() {
  return Object.freeze({
    runtimeVersion: OBSERVATION_ENGINE_VERSION,
    phase: 'observe',
    plantId: '', scanId: '',
    scanConfidence: null,
    scanDiseaseHints: Object.freeze([]),
    scanPestHints: Object.freeze([]),
    lifecycleStage: '', healthScore: null, riskScore: null,
    region: '', weatherSummary: null,
    timelineCount: 0, historyCount: 0, openTaskCount: 0,
    offline: false,
  });
}
