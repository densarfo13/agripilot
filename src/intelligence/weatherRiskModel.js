/**
 * weatherRiskModel.js — pure derivation of a weather risk band.
 *
 * Input  : the raw weather payload the existing WeatherContext
 *          already produces (boolean / scalar fields).
 * Output : { level: 'low'|'medium'|'high'|'unknown', signals: string[] }
 *
 * Strict rules
 * ────────────
 *   • Pure function, no side effects, no I/O.
 *   • Defensive on every input — partial weather objects must still
 *     yield a sensible level. Missing data → 'unknown' (NOT 'low').
 *   • The output is a band, not a numeric score. Numeric scores
 *     leak into UI as "5/10" without context; bands map cleanly to
 *     localised pill labels in the existing FarmHealthCard.
 *   • Never throws.
 *
 * Reasoning tags (`signals`)
 * ──────────────────────────
 * Each tag is a stable code (`heavy_rain`, `dry_spell`, `high_wind`)
 * the caller can pipe to a translation key. The model never emits
 * a localised string.
 */

const _CFG = Object.freeze({
  // Numeric thresholds; conservative midpoints so a near-miss still
  // bumps to 'medium' rather than 'low'.
  rainHeavyMm:  20,    // > heavy rain in last 24h
  rainModerateMm: 6,
  windHighKph: 35,
  heatHighC:   34,
  drySpellDays: 7,
});

export const WEATHER_LEVELS = Object.freeze({
  HIGH:    'high',
  MEDIUM:  'medium',
  LOW:     'low',
  UNKNOWN: 'unknown',
});

/**
 * @param {object|null|undefined} weather
 * @returns {{ level: string, signals: string[] }}
 */
export function deriveWeatherRisk(weather) {
  try {
    if (!weather || typeof weather !== 'object') {
      return _result('unknown', []);
    }

    const signals = [];

    // Explicit boolean / categorical hints from the existing
    // WeatherContext (kept for backwards compat with downstream
    // consumers that already check these flags).
    if (weather.severe || weather.heavyRain) signals.push('heavy_rain');
    if (weather.highWind)                    signals.push('high_wind');
    if (weather.veryDry || weather.drySpell) signals.push('dry_spell');
    if (weather.hot)                         signals.push('hot');

    // Numeric hints — interpreted leniently so partial payloads
    // still register a signal.
    const rainMm = _num(weather.rainMm24h ?? weather.rain24h);
    if (Number.isFinite(rainMm)) {
      if (rainMm > _CFG.rainHeavyMm)   signals.push('heavy_rain');
      else if (rainMm > _CFG.rainModerateMm) signals.push('moderate_rain');
    }
    const windKph = _num(weather.windKph ?? weather.windSpeedKph);
    if (Number.isFinite(windKph) && windKph > _CFG.windHighKph) signals.push('high_wind');

    const tempC = _num(weather.tempC ?? weather.temperatureC);
    if (Number.isFinite(tempC) && tempC > _CFG.heatHighC) signals.push('hot');

    const dryDays = _num(weather.daysSinceRain);
    if (Number.isFinite(dryDays) && dryDays >= _CFG.drySpellDays) signals.push('dry_spell');

    // Categorical 'risk' flag from a pre-computed upstream source
    // (some pipelines already produce it). Prefer it when present.
    if (weather.risk === 'high'   || weather.risk === 'severe') return _result('high',   _dedupe(signals));
    if (weather.risk === 'medium' || weather.risk === 'moderate') return _result('medium', _dedupe(signals));

    if (signals.length === 0) return _result('low', []);

    // Promote to high when ANY of the high-impact tags are present
    // (rain, wind, heat compounding) — these are the ones that
    // damage standing crops.
    const highImpact = new Set(['heavy_rain', 'high_wind', 'hot']);
    const hasHigh = signals.some(s => highImpact.has(s));
    return _result(hasHigh ? 'high' : 'medium', _dedupe(signals));
  } catch {
    return _result('unknown', []);
  }
}

function _num(v) {
  if (typeof v === 'number') return v;
  if (v == null) return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function _dedupe(arr) {
  return Array.from(new Set(arr));
}

function _result(level, signals) {
  return Object.freeze({ level, signals: Object.freeze(signals.slice()) });
}
