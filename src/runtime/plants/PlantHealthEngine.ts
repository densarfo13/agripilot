/**
 * src/runtime/plants/PlantHealthEngine.ts — runtime-tier plant
 * health (composes catalog scoring + time-series).
 *
 *   import {
 *     scoreManagedPlant, appendHealthSnapshot,
 *     PLANT_HEALTH_RUNTIME_VERSION,
 *   } from 'src/runtime/plants/PlantHealthEngine';
 *
 *   const next = scoreManagedPlant(plant, ctx);
 *
 * What this is
 * ────────────
 *   Calls the catalog `computePlantHealthScore` for the actual
 *   math, then folds the result back into the managed Plant
 *   record (updating .healthScore + .riskScore + appending a
 *   history snapshot). Returns a new frozen Plant + the raw
 *   score envelope.
 *
 *   Risk score is computed as `100 - healthScore` so dashboards
 *   can show either polarity without re-running the engine.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only over catalog PlantHealthEngine.
 *   • No persistence writes.
 *   • Frozen envelopes.
 */

import {
  computePlantHealthScore,
  PLANT_HEALTH_BANDS, PLANT_HEALTH_WEIGHTS,
} from '../../modules/plants/PlantHealthEngine';
import {
  ManagedPlant, freezePlant, appendPlantHistory,
} from './PlantRuntime';

export const PLANT_HEALTH_RUNTIME_VERSION = 'plant-health-runtime-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

interface ScoreCtx {
  recentScans?:     any[];
  missedWaterings?: number;
  diseaseRisk?:     number;
  careCompliance?:  number;
  indoorCareScore?: number;
  weather?:         any;
  lastWateredAt?:   string;
  lastRepottedAt?:  string;
  ambient?:         any;
  now?:             number;
}

/**
 * Score the managed plant and fold the result back into a NEW
 * frozen Plant record. Health/risk snapshot is appended to
 * history for the memory graph.
 */
export function scoreManagedPlant(plant: ManagedPlant, ctx: ScoreCtx) {
  return _safe(() => {
    if (!_isObj(plant)) return Object.freeze({
      runtimeVersion: PLANT_HEALTH_RUNTIME_VERSION,
      ok: false, reason: 'no_plant',
      plant, score: null,
    });
    const c        = _isObj(ctx) ? ctx : {} as ScoreCtx;
    const scanList = _isObj(c) && Array.isArray(c.recentScans)
      ? c.recentScans
      : (Array.isArray(plant.scans) ? plant.scans.slice() : []);
    const env = computePlantHealthScore({
      plantId: _str(plant.commonName)
        ? (_str((plant as any).plantId)
           || _str(plant.id).replace(/^plant_/, ''))
        : '',
      // pass the catalog-resolved id when present
      recentScans:     scanList,
      missedWaterings: c.missedWaterings,
      diseaseRisk:     c.diseaseRisk,
      careCompliance:  c.careCompliance,
      indoorCareScore: c.indoorCareScore,
      weather:         c.weather,
      lastWateredAt:   c.lastWateredAt,
      lastRepottedAt:  c.lastRepottedAt,
      ambient:         c.ambient,
      now:             c.now,
    } as any);
    const score = _num((env as any).overall) ?? 0;
    const risk  = Math.max(0, 100 - score);
    const stamped = appendPlantHistory(plant, {
      kind: 'health_snapshot',
      ...({ score, risk, band: _str((env as any).band), at: _now() } as any),
    });
    const next = freezePlant({
      ...stamped,
      healthScore: score,
      riskScore:   risk,
    }) as ManagedPlant;
    return Object.freeze({
      runtimeVersion: PLANT_HEALTH_RUNTIME_VERSION,
      ok: true, reason: '',
      plant: next,
      score: env,
    });
  }, Object.freeze({
    runtimeVersion: PLANT_HEALTH_RUNTIME_VERSION,
    ok: false, reason: 'error',
    plant, score: null,
  }));
}

/**
 * Append a caller-provided health snapshot (used when the score
 * came from a different source — e.g. server-side analysis) to
 * a plant's history WITHOUT re-running the engine.
 */
export function appendHealthSnapshot(plant: ManagedPlant,
                                       snapshot: {
                                         score?: number;
                                         risk?:  number;
                                         band?:  string;
                                         at?:    string;
                                       }) {
  return _safe(() => {
    if (!_isObj(plant)) return plant;
    const score = _num(snapshot && snapshot.score);
    const risk  = _num(snapshot && snapshot.risk)
                ?? (score == null ? null : 100 - score);
    const stamped = appendPlantHistory(plant, {
      kind: 'health_snapshot',
      ...({
        score: score ?? plant.healthScore,
        risk:  risk  ?? plant.riskScore,
        band:  _str(snapshot && snapshot.band),
        at:    _str(snapshot && snapshot.at) || _now(),
      } as any),
    });
    if (score == null) return stamped;
    return freezePlant({
      ...stamped,
      healthScore: score,
      riskScore:   risk == null ? stamped.riskScore : risk,
    });
  }, plant);
}

export { PLANT_HEALTH_BANDS, PLANT_HEALTH_WEIGHTS };
