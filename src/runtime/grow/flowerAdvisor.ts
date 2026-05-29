/**
 * runtime/grow/flowerAdvisor.ts — Phase 4 flower intelligence.
 *
 *   import { flowerAdvisor, FLOWER_ADVISOR_VERSION }
 *     from 'src/runtime/grow/flowerAdvisor';
 *
 *   const advice = flowerAdvisor({ plantId: 'rose', weather, season });
 *
 * What this is
 * ────────────
 *   Composes the spec'd envelope per flower:
 *     {
 *       todayTasks:      [...],
 *       waterNeed:       'low' | 'medium' | 'high',
 *       fertilizerNeed:  'now' | 'soon' | 'not_yet',
 *       bloomForecast:   { season, eta_days, confidence },
 *       pollinatorScore: 0..10,
 *       riskAlerts:      [...],
 *       runtimeVersion,
 *     }
 *
 *   Pure compute over the plant database + caller-injected
 *   weather/season signals. No fake confidence — bloomForecast
 *   returns `unknown` band when data is thin.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only — reads plant DB.
 *   • All copy via tSafe envelopes.
 */

import { findPlant } from '../../data/plants/index.js';

export const FLOWER_ADVISOR_VERSION = 'flower-advisor-v1';

interface Weather {
  tempC?: number;
  humidity?: number;
  rainfallMm?: number;
  forecastRainProbability?: number;
}

interface FlowerCtx {
  plantId?: string;
  plant?: any;
  weather?: Weather;
  season?: string;
  lastWateredAt?: string;
  lastFertilizedAt?: string;
  now?: number;
}

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

const MS_PER_DAY = 86400000;

function _waterNeedToday(plant: any, weather: Weather | undefined,
                          lastWateredAt: string, nowMs: number)
                          : 'high' | 'medium' | 'low' | 'skip' {
  const base = _str(plant && plant.water) || 'medium';
  // Skip if rain forecast is strong
  if (_isObj(weather) && _num(weather.forecastRainProbability) != null
      && (weather.forecastRainProbability as number) >= 0.7) {
    return 'skip';
  }
  // High demand if recent days have been dry + plant is medium/high
  const lastMs = _safe(() => new Date(lastWateredAt).getTime(), NaN);
  const sinceDays = Number.isFinite(lastMs)
    ? Math.floor((nowMs - lastMs) / MS_PER_DAY)
    : 99;
  if (base === 'high'   && sinceDays >= 1) return 'high';
  if (base === 'medium' && sinceDays >= 2) return 'medium';
  if (base === 'low'    && sinceDays >= 4) return 'low';
  return 'skip';
}

function _fertilizerNeed(plant: any, lastFertilizedAt: string,
                          nowMs: number): 'now' | 'soon' | 'not_yet' {
  const lastMs = _safe(() => new Date(lastFertilizedAt).getTime(), NaN);
  if (!Number.isFinite(lastMs)) return 'soon';
  const sinceDays = Math.floor((nowMs - lastMs) / MS_PER_DAY);
  if (sinceDays >= 28) return 'now';
  if (sinceDays >= 21) return 'soon';
  return 'not_yet';
}

function _bloomForecast(plant: any, season: string) {
  const seasons = _arr(plant && plant.bloomSeason);
  if (seasons.length === 0) {
    return Object.freeze({ season: '', etaDays: null,
      confidence: 'unknown' as const });
  }
  if (season && seasons.indexOf(season) !== -1) {
    return Object.freeze({
      season, etaDays: 0, confidence: 'high' as const,
    });
  }
  return Object.freeze({
    season: _str(seasons[0]), etaDays: null,
    confidence: 'low' as const,
  });
}

function _pollinatorScore(plant: any): number {
  const attracts = _arr(plant && plant.attracts);
  // Light scoring: bees +3, butterflies +2.5, hummingbirds +2.5,
  // birds +1, ladybugs +1, beneficial_wasps +1. Capped at 10.
  let score = 0;
  for (const a of attracts) {
    const s = _str(a);
    if (s === 'bees') score += 3;
    else if (s === 'butterflies' || s === 'swallowtail_butterflies') score += 2.5;
    else if (s === 'hummingbirds') score += 2.5;
    else if (s === 'birds' || s === 'ladybugs' || s === 'beneficial_wasps') score += 1;
    else score += 0.5;
  }
  return Math.min(10, Math.round(score * 10) / 10);
}

function _riskAlerts(plant: any, weather: Weather | undefined) {
  const diseases = _arr(plant && plant.diseases);
  const alerts: any[] = [];
  if (diseases.indexOf('aphids') !== -1) {
    alerts.push(Object.freeze({
      kind: 'aphid_risk',
      severity: 'medium',
      messageKey: 'grow.alert.aphidRisk',
      messageDefault: 'Aphid risk elevated for this flower.',
    }));
  }
  if (_isObj(weather) && _num(weather.humidity) != null
      && (weather.humidity as number) >= 80
      && diseases.indexOf('powdery_mildew') !== -1) {
    alerts.push(Object.freeze({
      kind: 'mildew_risk',
      severity: 'medium',
      messageKey: 'grow.alert.mildewRisk',
      messageDefault: 'High humidity raises powdery mildew risk.',
    }));
  }
  return Object.freeze(alerts);
}

export function flowerAdvisor(ctx: FlowerCtx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {} as FlowerCtx;
    const plant = c.plant
      ? c.plant
      : (_str(c.plantId) ? findPlant(c.plantId) : null);
    if (!plant) {
      return Object.freeze({
        runtimeVersion: FLOWER_ADVISOR_VERSION,
        plantId: _str(c.plantId), found: false,
        todayTasks: Object.freeze([]),
        waterNeed: 'unknown', fertilizerNeed: 'unknown',
        bloomForecast: Object.freeze({
          season: '', etaDays: null, confidence: 'unknown' as const,
        }),
        pollinatorScore: 0,
        riskAlerts: Object.freeze([]),
      });
    }
    const now = _num(c.now) || Date.now();
    const water = _waterNeedToday(plant, c.weather,
      _str(c.lastWateredAt), now);
    const fert  = _fertilizerNeed(plant, _str(c.lastFertilizedAt), now);
    const bloom = _bloomForecast(plant, _str(c.season));
    const score = _pollinatorScore(plant);
    const alerts = _riskAlerts(plant, c.weather);

    const tasks: any[] = [];
    if (water !== 'skip') {
      tasks.push(Object.freeze({
        kind: 'water', priority: 1,
        labelKey: 'grow.task.water',
        labelDefault: water === 'high' ? 'Water generously'
                    : water === 'medium' ? 'Water lightly'
                    : 'Water sparingly',
      }));
    }
    if (fert === 'now') {
      tasks.push(Object.freeze({
        kind: 'fertilize', priority: 2,
        labelKey: 'grow.task.fertilize',
        labelDefault: 'Apply bloom fertilizer',
      }));
    }
    for (const a of alerts) {
      tasks.push(Object.freeze({
        kind: a.kind, priority: 3,
        labelKey: a.messageKey, labelDefault: a.messageDefault,
      }));
    }

    return Object.freeze({
      runtimeVersion: FLOWER_ADVISOR_VERSION,
      plantId: _str(plant.id), found: true,
      todayTasks:      Object.freeze(tasks),
      waterNeed:       water,
      fertilizerNeed:  fert,
      bloomForecast:   bloom,
      pollinatorScore: score,
      riskAlerts:      alerts,
    });
  }, Object.freeze({
    runtimeVersion: FLOWER_ADVISOR_VERSION,
    plantId: '', found: false,
    todayTasks: Object.freeze([]),
    waterNeed: 'unknown', fertilizerNeed: 'unknown',
    bloomForecast: Object.freeze({
      season: '', etaDays: null, confidence: 'unknown' as const,
    }),
    pollinatorScore: 0,
    riskAlerts: Object.freeze([]),
  }));
}
