/**
 * riskEngine.js — composer over drought + pest engines.
 *
 *   computeFarmRisks(farm, cluster?, opts?)
 *     -> { drought, pest, top }
 *
 *   computeFarmRisks accepts an optional `weather` override on
 *   opts, so callers that already pulled weather from the
 *   existing WeatherContext can pipe it in without re-reading
 *   the static defaults.
 *
 * Spec section 7 - "only show 1 main risk".
 * `top` is the highest-priority risk (HIGH > MEDIUM > LOW). If
 * pest and drought are tied at the same level, pest wins (more
 * actionable signal in the v1 demo flow). The full record is
 * still returned so NGO surfaces can show both columns.
 *
 * Spec section 8 - "smart task override".
 * suggestTaskOverride(risks) returns:
 *     { override: true,  taskId: 'scout_pests' | 'water_crops' }
 *     { override: false }
 *   so a caller can flip the day's main task without coupling
 *   to a specific task engine.
 *
 * Strict-rule audit
 *   * pure: no I/O when opts.weather is supplied; otherwise
 *     reads the static defaults from getWeatherSignals()
 *   * never throws on missing inputs
 *   * deterministic - same inputs always produce the same output
 */

import { getWeatherSignals, buildSignalsFromWeather } from '../weather/weatherEngine.js';
import { computeDroughtRisk, DROUGHT_LEVEL } from './droughtEngine.js';
import { computePestRisk,    PEST_LEVEL    } from './pestRiskEngine.js';

const RANK = Object.freeze({ HIGH: 3, MEDIUM: 2, LOW: 1 });

function _rank(level) { return RANK[level] || 0; }

/**
 * computeFarmRisks(farm, cluster?, opts?)
 *
 * opts:
 *   weather      pre-fetched weather payload OR { rainLast3Days,
 *                temperatureHigh, humidityHigh } signals.
 *                When omitted, uses getWeatherSignals() defaults.
 *
 * Output:
 *   {
 *     drought: 'HIGH' | 'MEDIUM' | 'LOW',
 *     pest:    'HIGH' | 'MEDIUM' | 'LOW',
 *     top:     { kind: 'pest' | 'drought' | null, level }
 *   }
 */
export function computeFarmRisks(farm, cluster = null, opts = {}) {
  const weather = (opts && opts.weather)
    ? (typeof opts.weather.rainLast3Days === 'boolean'
        ? opts.weather
        : buildSignalsFromWeather(opts.weather))
    : getWeatherSignals();

  const drought = computeDroughtRisk(farm, weather);
  const pest    = computePestRisk(farm, weather, cluster);

  // Priority pick. Pest tie-breaks above drought because the
  // pest cluster signal is the more specific one - a generic
  // dry-spell drought banner is fine to lose to a fresh
  // outbreak.
  let top = { kind: null, level: 'LOW' };
  const pRank = _rank(pest), dRank = _rank(drought);
  if (pRank >= dRank && pRank > 0) top = { kind: 'pest',    level: pest    };
  else if (dRank > 0)              top = { kind: 'drought', level: drought };

  return Object.freeze({ drought, pest, top });
}

/**
 * suggestTaskOverride(risks)
 *
 * Returns the spec's "task override" decision per section 8.
 * Only fires when the top risk is HIGH; otherwise the existing
 * task engine wins.
 */
export function suggestTaskOverride(risks) {
  if (!risks || !risks.top) return Object.freeze({ override: false });
  if (risks.top.level !== 'HIGH') return Object.freeze({ override: false });
  if (risks.top.kind === 'pest')    return Object.freeze({ override: true, taskId: 'scout_pests' });
  if (risks.top.kind === 'drought') return Object.freeze({ override: true, taskId: 'water_crops' });
  return Object.freeze({ override: false });
}

export const RISK_LEVEL = Object.freeze({ HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' });
export { DROUGHT_LEVEL, PEST_LEVEL };
