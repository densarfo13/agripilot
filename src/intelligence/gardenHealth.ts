/**
 * src/intelligence/gardenHealth.ts — 0–100 garden health score.
 *
 *   import { gardenHealth, GARDEN_HEALTH_VERSION }
 *     from 'src/intelligence/gardenHealth';
 *
 *   gardenHealth({
 *     plantHealthScores, diseaseForecast,
 *     wateringCompliance, growthRate,
 *   })
 *
 * Returns frozen envelope:
 *   {
 *     overall, band, components: {
 *       plantHealth, diseaseRisk, wateringCompliance, growthRate,
 *     }, runtimeVersion,
 *   }
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Honest 0 / 'unknown' on missing input.
 *   • No persistence writes.
 */

export const GARDEN_HEALTH_VERSION = 'garden-health-v1';

export const GARDEN_HEALTH_WEIGHTS = Object.freeze({
  plantHealth:         0.35,
  diseaseRisk:         0.25,
  wateringCompliance:  0.20,
  growthRate:          0.20,
});

export const GARDEN_HEALTH_BANDS = Object.freeze([
  { min: 85, band: 'thriving' },
  { min: 70, band: 'healthy'  },
  { min: 50, band: 'fair'     },
  { min:  0, band: 'struggling' },
]);

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

interface HealthCtx {
  plantHealthScores?: number[];   // 0..100 per plant
  diseaseForecast?:    { forecasts?: Array<{ probability?: number }> };
  wateringCompliance?: number;    // 0..1
  growthRate?:         number;    // 0..1 (0 = stalled, 1 = on-track)
}

function _avg(arr: number[]): number | null {
  if (arr.length === 0) return null;
  let s = 0;
  for (const v of arr) s += v;
  return s / arr.length;
}

function _diseaseRiskComponent(forecast?: { forecasts?: Array<{ probability?: number }> }): number | null {
  if (!_isObj(forecast)) return null;
  const probs = _arr(forecast.forecasts)
    .map((f) => _num(f && f.probability))
    .filter((v): v is number => v != null);
  if (probs.length === 0) return 1; // no risk = perfect
  // top probability dominates the component
  const top = Math.max(...probs);
  return Math.max(0, 1 - top);
}

function _bandOf(score: number): string {
  for (const b of GARDEN_HEALTH_BANDS) {
    if (score >= b.min) return b.band;
  }
  return 'struggling';
}

export function gardenHealth(ctx: HealthCtx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {} as HealthCtx;

    const plantHealthAvg = _avg(
      _arr(c.plantHealthScores).map(_num).filter((v): v is number => v != null)
    );
    const plantHealth = plantHealthAvg != null
      ? plantHealthAvg / 100
      : null;

    const diseaseRisk        = _diseaseRiskComponent(c.diseaseForecast);
    const wateringCompliance = _num(c.wateringCompliance);
    const growthRate         = _num(c.growthRate);

    const components = { plantHealth, diseaseRisk,
                         wateringCompliance, growthRate };

    let totalWeight = 0;
    let weightedSum = 0;
    const componentScores: Record<string, any> = {};
    for (const k of Object.keys(GARDEN_HEALTH_WEIGHTS)) {
      const v = (components as any)[k];
      const w = (GARDEN_HEALTH_WEIGHTS as any)[k];
      if (v == null) {
        componentScores[k] = Object.freeze({ score: null, weight: w });
        continue;
      }
      componentScores[k] = Object.freeze({ score: Math.round(v * 100), weight: w });
      weightedSum += v * w;
      totalWeight += w;
    }

    const overall = totalWeight === 0
      ? 0
      : Math.round((weightedSum / totalWeight) * 100);
    const band = totalWeight === 0 ? 'unknown' : _bandOf(overall);

    return Object.freeze({
      runtimeVersion: GARDEN_HEALTH_VERSION,
      overall, band,
      components: Object.freeze(componentScores),
    });
  }, Object.freeze({
    runtimeVersion: GARDEN_HEALTH_VERSION,
    overall: 0, band: 'unknown',
    components: Object.freeze({}),
  }));
}
