/**
 * src/intelligence/diseaseForecast.ts — disease forecast from
 * weather + plant.
 *
 *   import {
 *     diseaseForecast, DISEASE_KIND, DISEASE_FORECAST_VERSION,
 *   } from 'src/intelligence/diseaseForecast';
 *
 *   diseaseForecast({ plantId, weather })
 *
 * Returns frozen envelope:
 *   {
 *     forecasts: [{
 *       disease, probability, severity, contributors,
 *     }],
 *     topForecast: { disease, probability } | null,
 *     runtimeVersion,
 *   }
 *
 * Honest heuristic — no LLM.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No fetch.
 *   • Honest 'unknown' when no signals.
 */

import { findPlant } from '../data/plants/index.js';

export const DISEASE_FORECAST_VERSION = 'disease-forecast-v1';

export const DISEASE_KIND = Object.freeze({
  POWDERY_MILDEW:  'powdery_mildew',
  BLIGHT:          'blight',
  RUST:            'rust',
  BLACK_SPOT:      'black_spot',
  DOWNY_MILDEW:    'downy_mildew',
  ROOT_ROT:        'root_rot',
  LEAF_SPOT:       'leaf_spot',
  BACTERIAL_LEAF_SPOT: 'bacterial_leaf_spot',
});

const PLANT_DB_DISEASE_ALIASES: Record<string, string> = {
  early_blight: 'blight',
  late_blight: 'blight',
};

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

interface DiseaseCtx {
  plantId?: string;
  weather?: {
    tempC?: number;
    humidity?: number;
    recentRainfallMm?: number;
    leafWetnessHours?: number;
  };
  now?: number;
}

interface Contributors {
  plantSusceptible: boolean;
  humidity:  number;
  temperature: number;
  rainfall:  number;
  leafWetness: number;
}

function _probability(c: Contributors): number {
  // 0–1 probability from contributor weights
  let s = 0;
  if (c.plantSusceptible) s += 0.35;
  s += Math.min(0.25, c.humidity);
  s += Math.min(0.20, c.temperature);
  s += Math.min(0.10, c.rainfall);
  s += Math.min(0.10, c.leafWetness);
  return Math.min(1, Math.round(s * 100) / 100);
}

function _severityFromProb(p: number): string {
  if (p >= 0.7) return 'high';
  if (p >= 0.4) return 'medium';
  if (p > 0)    return 'low';
  return 'unknown';
}

function _contributorsFor(disease: string, weather: any,
                          plantSusceptible: boolean): Contributors {
  const t = _num(weather && weather.tempC);
  const h = _num(weather && weather.humidity);
  const r = _num(weather && weather.recentRainfallMm) || 0;
  const lw = _num(weather && weather.leafWetnessHours) || 0;

  const c: Contributors = {
    plantSusceptible,
    humidity: 0, temperature: 0, rainfall: 0, leafWetness: 0,
  };
  if (disease === DISEASE_KIND.POWDERY_MILDEW) {
    if (h != null && h >= 70 && h <= 90) c.humidity = 0.20;
    if (t != null && t >= 15 && t <= 26)  c.temperature = 0.15;
    if (lw >= 4)                          c.leafWetness = 0.08;
  } else if (disease === DISEASE_KIND.DOWNY_MILDEW) {
    if (h != null && h >= 80)            c.humidity = 0.20;
    if (t != null && t >= 10 && t <= 25)  c.temperature = 0.10;
    if (lw >= 6)                          c.leafWetness = 0.10;
    if (r >= 5)                           c.rainfall   = 0.08;
  } else if (disease === DISEASE_KIND.BLIGHT) {
    if (h != null && h >= 75)            c.humidity = 0.15;
    if (t != null && t >= 10 && t <= 24)  c.temperature = 0.15;
    if (r >= 10)                          c.rainfall   = 0.10;
    if (lw >= 6)                          c.leafWetness = 0.08;
  } else if (disease === DISEASE_KIND.RUST) {
    if (h != null && h >= 80)            c.humidity = 0.20;
    if (t != null && t >= 15 && t <= 25)  c.temperature = 0.15;
    if (r >= 5)                           c.rainfall   = 0.08;
  } else if (disease === DISEASE_KIND.BLACK_SPOT) {
    if (h != null && h >= 70)            c.humidity = 0.15;
    if (t != null && t >= 18 && t <= 28)  c.temperature = 0.15;
    if (lw >= 6)                          c.leafWetness = 0.10;
  } else if (disease === DISEASE_KIND.ROOT_ROT) {
    if (r >= 15)                          c.rainfall   = 0.20;
    if (h != null && h >= 80)            c.humidity = 0.10;
  } else if (disease === DISEASE_KIND.LEAF_SPOT
          || disease === DISEASE_KIND.BACTERIAL_LEAF_SPOT) {
    if (h != null && h >= 75)            c.humidity = 0.15;
    if (lw >= 4)                          c.leafWetness = 0.08;
    if (r >= 5)                           c.rainfall   = 0.05;
  }
  return c;
}

export function diseaseForecast(ctx: DiseaseCtx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {} as DiseaseCtx;
    const plant = _str(c.plantId) ? findPlant(c.plantId) : null;

    // Build the plant-susceptibility map from DB
    const susceptibleSet = new Set<string>();
    for (const d of _arr(plant && plant.diseases)) {
      const k = _str(d);
      const norm = PLANT_DB_DISEASE_ALIASES[k] || k;
      if (Object.values(DISEASE_KIND).indexOf(norm) !== -1) {
        susceptibleSet.add(norm);
      }
    }

    const forecasts: any[] = [];
    for (const disease of Object.values(DISEASE_KIND)) {
      const contributors = _contributorsFor(disease, c.weather,
        susceptibleSet.has(disease));
      const probability  = _probability(contributors);
      if (probability <= 0.05) continue;
      forecasts.push(Object.freeze({
        disease,
        probability,
        severity: _severityFromProb(probability),
        contributors: Object.freeze(contributors),
      }));
    }
    forecasts.sort((a, b) => b.probability - a.probability);

    const top = forecasts.length > 0
      ? Object.freeze({
          disease: forecasts[0].disease,
          probability: forecasts[0].probability,
        })
      : null;

    return Object.freeze({
      runtimeVersion: DISEASE_FORECAST_VERSION,
      forecasts: Object.freeze(forecasts),
      topForecast: top,
    });
  }, Object.freeze({
    runtimeVersion: DISEASE_FORECAST_VERSION,
    forecasts: Object.freeze([]),
    topForecast: null,
  }));
}
