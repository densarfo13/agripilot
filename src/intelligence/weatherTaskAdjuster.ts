/**
 * src/intelligence/weatherTaskAdjuster.ts — weather-driven task
 * cancel/add layer.
 *
 *   import {
 *     adjustTasksForWeather, WEATHER_TASK_ADJUSTER_VERSION,
 *   } from 'src/intelligence/weatherTaskAdjuster';
 *
 *   adjustTasksForWeather({
 *     tasks, weatherForecast,
 *   }) → { kept, cancelled, added }
 *
 * What this is
 * ────────────
 *   Receives a tentative task list + an Open Meteo–shaped
 *   forecast envelope. Returns three lists:
 *     • kept       — tasks that pass through unchanged
 *     • cancelled  — tasks whose justification was nullified
 *     • added      — new tasks the forecast surfaces
 *
 *   Examples:
 *     Heavy rain tomorrow → cancel 'water' + add 'drainage_inspection'
 *     Heat wave tomorrow  → add 'extra_water', cancel 'fertilize'
 *     Frost warning       → add 'cover_plants'
 *
 *   Caller injects the forecast — this engine NEVER fetches.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No fetch / network calls.
 *   • Composition-only over caller-supplied tasks.
 */

export const WEATHER_TASK_ADJUSTER_VERSION = 'weather-task-adjuster-v1';

interface ForecastSlot {
  inHours?: number;
  precipMm?: number;
  precipProbability?: number;
  tempC?: number;
  windKph?: number;
  conditions?: string;
}

interface Forecast {
  next24h?: ForecastSlot;
  next48h?: ForecastSlot;
  next72h?: ForecastSlot;
  slots?: ForecastSlot[];
}

interface AdjustCtx {
  tasks?: any[];
  weatherForecast?: Forecast;
  growType?: string;
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

const HEAVY_RAIN_MM       = 15;
const RAIN_PROBABILITY    = 0.6;
const HEAT_WAVE_TEMP_C    = 33;
const FROST_TEMP_C        = 2;
const HIGH_WIND_KPH       = 35;

function _peekNext24(forecast?: Forecast): ForecastSlot | null {
  if (!_isObj(forecast)) return null;
  if (_isObj(forecast.next24h)) return forecast.next24h;
  const slots = _arr(forecast.slots);
  for (const s of slots) {
    if (_isObj(s) && _num(s.inHours) != null && (s.inHours as number) <= 24) {
      return s;
    }
  }
  return null;
}

function _signals(forecast?: Forecast) {
  const next = _peekNext24(forecast);
  if (!next) {
    return Object.freeze({
      heavyRain: false, rainLikely: false,
      heatWave: false, frost: false, highWind: false,
    });
  }
  return Object.freeze({
    heavyRain:  (_num(next.precipMm) || 0) >= HEAVY_RAIN_MM,
    rainLikely: (_num(next.precipProbability) || 0) >= RAIN_PROBABILITY,
    heatWave:   (_num(next.tempC) || -99) >= HEAT_WAVE_TEMP_C,
    frost:      (_num(next.tempC) || 99) <= FROST_TEMP_C,
    highWind:   (_num(next.windKph) || 0) >= HIGH_WIND_KPH,
  });
}

const CANCELLABLE_BY_RAIN = new Set([
  'water', 'water_due', 'water_overdue', 'water_now',
  'fertilize', // washed away
]);
const CANCELLABLE_BY_FROST = new Set(['transplant', 'sow_outdoor']);
const ADDED_BY_RAIN: ReadonlyArray<any> = [
  Object.freeze({
    kind: 'drainage_inspection', priority: 2,
    labelKey: 'grow.weather.task.drainage',
    labelDefault: 'Inspect drainage before heavy rain.',
    weatherTrigger: 'heavy_rain',
  }),
];
const ADDED_BY_HEAT: ReadonlyArray<any> = [
  Object.freeze({
    kind: 'extra_water', priority: 1,
    labelKey: 'grow.weather.task.extraWater',
    labelDefault: 'Water early before the heat peak.',
    weatherTrigger: 'heat_wave',
  }),
  Object.freeze({
    kind: 'shade_check', priority: 3,
    labelKey: 'grow.weather.task.shadeCheck',
    labelDefault: 'Check shade for heat-sensitive plants.',
    weatherTrigger: 'heat_wave',
  }),
];
const ADDED_BY_FROST: ReadonlyArray<any> = [
  Object.freeze({
    kind: 'cover_plants', priority: 1,
    labelKey: 'grow.weather.task.coverPlants',
    labelDefault: 'Cover sensitive plants before frost.',
    weatherTrigger: 'frost',
  }),
];
const ADDED_BY_WIND: ReadonlyArray<any> = [
  Object.freeze({
    kind: 'stake_check', priority: 2,
    labelKey: 'grow.weather.task.stakeCheck',
    labelDefault: 'Check stakes and supports before high wind.',
    weatherTrigger: 'high_wind',
  }),
];

export function adjustTasksForWeather(ctx: AdjustCtx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {} as AdjustCtx;
    const incoming = _arr(c.tasks);
    const signals = _signals(c.weatherForecast);

    const kept: any[] = [];
    const cancelled: any[] = [];
    const added: any[] = [];

    for (const t of incoming) {
      if (!_isObj(t)) continue;
      const kind = _str(t.kind);
      if ((signals.heavyRain || signals.rainLikely)
          && CANCELLABLE_BY_RAIN.has(kind)) {
        cancelled.push(Object.freeze({
          ...t,
          cancelReason: signals.heavyRain ? 'heavy_rain' : 'rain_likely',
        }));
        continue;
      }
      if (signals.frost && CANCELLABLE_BY_FROST.has(kind)) {
        cancelled.push(Object.freeze({
          ...t, cancelReason: 'frost',
        }));
        continue;
      }
      kept.push(Object.freeze(t));
    }

    if (signals.heavyRain) added.push(...ADDED_BY_RAIN);
    if (signals.heatWave)  added.push(...ADDED_BY_HEAT);
    if (signals.frost)     added.push(...ADDED_BY_FROST);
    if (signals.highWind)  added.push(...ADDED_BY_WIND);

    return Object.freeze({
      runtimeVersion: WEATHER_TASK_ADJUSTER_VERSION,
      signals,
      kept:      Object.freeze(kept),
      cancelled: Object.freeze(cancelled),
      added:     Object.freeze(added),
    });
  }, Object.freeze({
    runtimeVersion: WEATHER_TASK_ADJUSTER_VERSION,
    signals: Object.freeze({
      heavyRain: false, rainLikely: false,
      heatWave: false, frost: false, highWind: false,
    }),
    kept: Object.freeze([]),
    cancelled: Object.freeze([]),
    added: Object.freeze([]),
  }));
}
