/**
 * weatherSoilTaskEngine — pure rules that translate a normalized
 * Open-Meteo forecast snapshot into calm care-task suggestions.
 *
 *   import { suggestTasksFromForecast } from
 *     'src/intelligence/recommendations/weatherSoilTaskEngine';
 *
 *   const tasks = suggestTasksFromForecast(forecast, { mode: 'farm' });
 *   // → [{ id, title, reason, urgency, kind, estimatedMinutes }]
 *
 * Inputs
 *   The forecast envelope produced by
 *   `server/src/services/weather/weatherProvider.js`. Key fields:
 *     • soilMoisture01cm / soilMoisture13cm (0..0.6 typical)
 *     • rainChancePct                       (0..100)
 *     • rainMmNext24h                       (mm)
 *     • currentTempC / tempHighC
 *     • humidityPct
 *     • windKph
 *     • uvIndexMax
 *     • evapotranspiration / et0
 *
 * Output
 *   Up to 3 calm task suggestions. Sorted by urgency (high →
 *   medium → low). Each carries a stable `id` so the
 *   recommendation memory can dedup across renders.
 *
 * Strict-rule audit
 *   • Pure / no I/O / no React. Frozen exports.
 *   • Never throws. Empty array on missing forecast.
 *   • Garden mode shifts wording via `softenForGarden` at the
 *     surface boundary — this module emits canonical wording
 *     (the orchestrator applies tone).
 *   • NEVER outputs percentages, scores, or AI-style language.
 */

export type ExperienceMode = 'farm' | 'garden';
export type TaskUrgency    = 'high' | 'medium' | 'low';

export interface WeatherSnapshot {
  readonly soilMoisture01cm?: number | null;
  readonly soilMoisture13cm?: number | null;
  readonly soilTemp0cm?: number | null;
  readonly rainChancePct?: number | null;
  readonly rainMmNext24h?: number | null;
  readonly rainMmToday?: number | null;
  readonly currentTempC?: number | null;
  readonly tempHighC?: number | null;
  readonly tempLowC?: number | null;
  readonly humidityPct?: number | null;
  readonly windKph?: number | null;
  readonly uvIndexMax?: number | null;
  readonly evapotranspiration?: number | null;
  readonly et0FaoEvapotranspiration?: number | null;
}

export interface SuggestedTask {
  readonly id: string;
  readonly title: string;
  readonly reason: string;
  readonly urgency: TaskUrgency;
  readonly kind: 'water' | 'inspect' | 'protect' | 'harvest' | 'observe';
  readonly estimatedMinutes: number;
}

interface Options {
  readonly mode?: ExperienceMode;
  readonly maxTasks?: number;
}

// Soil-moisture thresholds (volumetric fraction, 0..1).
// Open-Meteo's 0–1cm + 1–3cm layers stay well below 0.5 in
// most agricultural soils — calibrated against typical sandy
// loam (≈0.2 = healthy, <0.10 = dry, >0.40 = saturated).
const SOIL_DRY      = 0.10;
const SOIL_LOW      = 0.18;
const SOIL_SATURATED = 0.40;

function _num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function _avgSoil(forecast: WeatherSnapshot): number | null {
  const a = _num(forecast.soilMoisture01cm);
  const b = _num(forecast.soilMoisture13cm);
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return (a + b) / 2;
}

/**
 * Generate up to 3 calm task suggestions from the forecast snapshot.
 * Pure / never throws / returns [] on missing forecast.
 */
export function suggestTasksFromForecast(
  forecast: WeatherSnapshot | null | undefined,
  opts: Options = {},
): ReadonlyArray<SuggestedTask> {
  if (!forecast || typeof forecast !== 'object') return [];
  const mode = opts.mode === 'garden' ? 'garden' : 'farm';
  const maxTasks = Number.isFinite(opts.maxTasks as number) ? Number(opts.maxTasks) : 3;

  const out: SuggestedTask[] = [];

  const soil      = _avgSoil(forecast);
  const rainProb  = _num(forecast.rainChancePct);
  const rainMm    = _num(forecast.rainMmNext24h) ?? _num(forecast.rainMmToday);
  const tempHigh  = _num(forecast.tempHighC) ?? _num(forecast.currentTempC);
  const humidity  = _num(forecast.humidityPct);
  const windKph   = _num(forecast.windKph);
  const uv        = _num(forecast.uvIndexMax);

  // 1. SOIL TOO DRY + low rain probability → water
  if (soil != null && soil < SOIL_DRY
      && (rainProb == null || rainProb < 40)) {
    out.push(Object.freeze({
      id:    'task_water_dry_soil',
      title: mode === 'garden'
        ? 'Check soil moisture this evening'
        : 'Irrigate fields before heat peaks',
      reason: 'Soil is drier than usual and rain is not expected today.',
      urgency: 'high',
      kind: 'water',
      estimatedMinutes: mode === 'garden' ? 5 : 30,
    }));
  } else if (soil != null && soil < SOIL_LOW
      && (rainProb == null || rainProb < 50)) {
    out.push(Object.freeze({
      id:    'task_water_low_soil',
      title: mode === 'garden'
        ? 'A light watering may help this week'
        : 'Plan irrigation if no rain by tomorrow',
      reason: 'Soil moisture is dipping below the comfortable range.',
      urgency: 'medium',
      kind: 'water',
      estimatedMinutes: mode === 'garden' ? 5 : 20,
    }));
  }

  // 2. RAIN COMING + saturated soil → drainage / protect
  if (rainProb != null && rainProb >= 60
      && rainMm != null && rainMm >= 5
      && soil != null && soil > SOIL_SATURATED) {
    out.push(Object.freeze({
      id:    'task_protect_drainage',
      title: mode === 'garden'
        ? 'Move pots away from heavy run-off'
        : 'Check drainage channels before rain',
      reason: 'Heavy rain is likely and soil is already saturated.',
      urgency: 'high',
      kind: 'protect',
      estimatedMinutes: mode === 'garden' ? 10 : 25,
    }));
  } else if (rainProb != null && rainProb >= 70 && (soil == null || soil < SOIL_SATURATED)) {
    out.push(Object.freeze({
      id:    'task_protect_rain_inbound',
      title: mode === 'garden'
        ? 'Bring delicate plants under cover'
        : 'Cover sensitive seedlings before rain',
      reason: 'Rain looks likely later today.',
      urgency: 'medium',
      kind: 'protect',
      estimatedMinutes: mode === 'garden' ? 5 : 15,
    }));
  }

  // 3. HEAT STRESS — high temp + low humidity + high UV
  if (tempHigh != null && tempHigh >= 32
      && (humidity == null || humidity < 50)
      && (uv == null || uv >= 7)) {
    out.push(Object.freeze({
      id:    'task_heat_stress_inspect',
      title: mode === 'garden'
        ? 'Check leaves for heat stress this afternoon'
        : 'Inspect crops for wilting after midday',
      reason: 'Hot, dry afternoon may stress plants — shade or water at dusk.',
      urgency: 'medium',
      kind: 'inspect',
      estimatedMinutes: mode === 'garden' ? 5 : 20,
    }));
  }

  // 4. WIND — strong wind warning
  if (windKph != null && windKph >= 35) {
    out.push(Object.freeze({
      id:    'task_wind_protect',
      title: mode === 'garden'
        ? 'Secure pots and stakes — wind is picking up'
        : 'Check stakes and trellises — wind warning',
      reason: 'Wind speeds are above what most plants handle comfortably.',
      urgency: 'medium',
      kind: 'protect',
      estimatedMinutes: mode === 'garden' ? 5 : 15,
    }));
  }

  // 5. Calm, observational baseline when no risk fires
  if (out.length === 0) {
    out.push(Object.freeze({
      id:    'task_observe_baseline',
      title: mode === 'garden'
        ? 'Quick check on your plant today'
        : 'Walk the fields when the light is good',
      reason: 'Conditions look steady — a calm observation keeps the rhythm.',
      urgency: 'low',
      kind: 'observe',
      estimatedMinutes: mode === 'garden' ? 3 : 15,
    }));
  }

  // Sort high → medium → low, then by output order.
  const urgencyRank: Record<TaskUrgency, number> = { high: 0, medium: 1, low: 2 };
  out.sort((a, b) => urgencyRank[a.urgency] - urgencyRank[b.urgency]);

  return Object.freeze(out.slice(0, Math.max(1, maxTasks)));
}

/**
 * Convenience — return ONE task for surfaces that follow the
 * "one primary recommendation per screen" rule. Pure / never throws.
 */
export function suggestPrimaryTaskFromForecast(
  forecast: WeatherSnapshot | null | undefined,
  opts: Options = {},
): SuggestedTask | null {
  const list = suggestTasksFromForecast(forecast, { ...opts, maxTasks: 1 });
  return list.length > 0 ? list[0] : null;
}

export default Object.freeze({
  suggestTasksFromForecast,
  suggestPrimaryTaskFromForecast,
});
