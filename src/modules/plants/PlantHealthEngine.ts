/**
 * src/modules/plants/PlantHealthEngine.ts — per-plant health score.
 *
 *   import {
 *     computePlantHealthScore, PLANT_HEALTH_BANDS,
 *     PLANT_HEALTH_VERSION,
 *   } from 'src/modules/plants/PlantHealthEngine';
 *
 *   computePlantHealthScore({
 *     plantId, recentScans, missedWaterings,
 *     diseaseRisk, careCompliance, indoorCareScore,
 *   });
 *
 * What this is
 * ────────────
 *   0–100 per-plant health composite. Different signal mix from
 *   the garden-wide gardenHealth — this one focuses on a single
 *   plant's recent care + scan history:
 *
 *     scanQuality        (0.30)  recent scans' confidence avg
 *     diseaseRisk        (0.25)  inverse of top disease probability
 *     careCompliance     (0.25)  caller-supplied 0..1
 *     missedWaterings    (0.10)  penalty per skip
 *     indoorCareScore    (0.10)  composeIndoorCare healthScore / 100
 *
 *   Returns:
 *     {
 *       overall, band, components, plantId, runtimeVersion,
 *     }
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only — reads injected signals.
 *   • Honest 'unknown' band when no signals are present.
 *   • No persistence writes.
 */

import { findPlant } from '../../data/plants/index.js';
import { diseaseForecast } from '../../intelligence/diseaseForecast';
import { composeIndoorCare } from '../../runtime/grow/indoorPlantCare.js';

export const PLANT_HEALTH_VERSION = 'plant-health-engine-v1';

export const PLANT_HEALTH_WEIGHTS = Object.freeze({
  scanQuality:     0.30,
  diseaseRisk:     0.25,
  careCompliance:  0.25,
  missedWaterings: 0.10,
  indoorCareScore: 0.10,
});

export const PLANT_HEALTH_BANDS = Object.freeze([
  { min: 85, band: 'thriving' },
  { min: 70, band: 'healthy' },
  { min: 50, band: 'fair' },
  { min: 0,  band: 'struggling' },
]);

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _clamp01(n: unknown): number | null {
  const x = _num(n);
  if (x == null) return null;
  return Math.max(0, Math.min(1, x));
}

interface PlantHealthCtx {
  plantId?:         string;
  recentScans?:     Array<{ confidence?: number }>;
  missedWaterings?: number;
  diseaseRisk?:     number;      // 0..1, caller-supplied OR derived
  careCompliance?:  number;      // 0..1
  indoorCareScore?: number;      // 0..100
  weather?:         any;         // optional — used to derive diseaseRisk
  lastWateredAt?:   string;
  lastRepottedAt?:  string;
  ambient?:         any;
  now?:             number;
}

function _scanQuality(scans: any[]): number | null {
  if (!scans || scans.length === 0) return null;
  let sum = 0; let n = 0;
  for (const s of scans) {
    if (!_isObj(s)) continue;
    const c = _num(s.confidence);
    if (c == null) continue;
    sum += c; n++;
  }
  return n === 0 ? null : sum / n;
}

function _missedWateringsScore(missed: unknown): number | null {
  const m = _num(missed);
  if (m == null) return null;
  // 0 missed → 1.0 (full credit). 5+ → 0.0.
  return Math.max(0, 1 - (m / 5));
}

function _bandOf(score: number): string {
  for (const b of PLANT_HEALTH_BANDS) {
    if (score >= b.min) return b.band;
  }
  return 'struggling';
}

export function computePlantHealthScore(ctx: PlantHealthCtx) {
  return _safe(() => {
    const c     = _isObj(ctx) ? ctx : {} as PlantHealthCtx;
    const plant = _str(c.plantId) ? findPlant(c.plantId) : null;

    // Derive disease-risk component if caller didn't supply one
    let derivedDiseaseRisk = _num(c.diseaseRisk);
    if (derivedDiseaseRisk == null && plant) {
      const f = diseaseForecast({
        plantId: _str(plant.id),
        weather: c.weather,
      } as any);
      const top = (f as any).topForecast;
      derivedDiseaseRisk = top && typeof top.probability === 'number'
        ? top.probability
        : null;
    }

    // Derive indoorCareScore for houseplants if caller didn't supply one
    let derivedIndoor = _num(c.indoorCareScore);
    if (derivedIndoor == null && plant
        && (_str(plant.type) === 'houseplant')) {
      const care = composeIndoorCare({
        plantId: _str(plant.id),
        lastWateredAt: c.lastWateredAt,
        lastRepottedAt: c.lastRepottedAt,
        ambient: c.ambient,
        now: c.now,
      } as any);
      derivedIndoor = _num((care as any).healthScore);
    }

    const components = {
      scanQuality:     _clamp01(_scanQuality(_arr(c.recentScans))),
      diseaseRisk:     derivedDiseaseRisk == null
                         ? null
                         : Math.max(0, 1 - derivedDiseaseRisk),
      careCompliance:  _clamp01(c.careCompliance),
      missedWaterings: _missedWateringsScore(c.missedWaterings),
      indoorCareScore: derivedIndoor == null
                         ? null
                         : Math.max(0, Math.min(1, derivedIndoor / 100)),
    };

    let totalWeight = 0;
    let weightedSum = 0;
    const componentScores: Record<string, any> = {};
    for (const k of Object.keys(PLANT_HEALTH_WEIGHTS)) {
      const v = (components as any)[k];
      const w = (PLANT_HEALTH_WEIGHTS as any)[k];
      if (v == null) {
        componentScores[k] = Object.freeze({ score: null, weight: w });
        continue;
      }
      componentScores[k] = Object.freeze({
        score: Math.round(v * 100), weight: w,
      });
      weightedSum += v * w;
      totalWeight += w;
    }

    const overall = totalWeight === 0
      ? 0
      : Math.round((weightedSum / totalWeight) * 100);
    const band = totalWeight === 0 ? 'unknown' : _bandOf(overall);

    return Object.freeze({
      runtimeVersion: PLANT_HEALTH_VERSION,
      plantId:        plant ? _str(plant.id) : _str(c.plantId),
      overall, band,
      components:     Object.freeze(componentScores),
      derivedDiseaseRisk,
      derivedIndoorCareScore: derivedIndoor,
    });
  }, Object.freeze({
    runtimeVersion: PLANT_HEALTH_VERSION,
    plantId: '', overall: 0, band: 'unknown',
    components: Object.freeze({}),
    derivedDiseaseRisk: null,
    derivedIndoorCareScore: null,
  }));
}
