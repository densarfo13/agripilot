/**
 * weatherAction.js — weather → insight + action mapping.
 *
 *   import { getWeatherAction, normalizeWeather } from './lib/weatherAction.js';
 *
 *   const wx  = normalizeWeather(rawWeather);  // tolerant shape coercion
 *   const act = getWeatherAction(wx);          // { insight, action }
 *
 * Spec rules (May 2026 Home redesign)
 *   • Pure function — same input always produces the same output.
 *   • Never throws. Bad / missing / malformed weather collapses
 *     to the "Normal conditions" branch.
 *   • The branch ordering matches the user spec exactly so the
 *     mapping is auditable line-for-line.
 *   • Output strings are short, low-literacy, and actionable.
 *
 * The mapping ladder (first match wins):
 *   1. rainChance ≥ 60        → "Rain expected later today"  / "Check drainage and avoid watering"
 *   2. temp ≥ 32              → "High heat today"             / "Water early morning or late evening"
 *   3. wind ≥ 25              → "Strong winds expected"       / "Support weak plants"
 *   4. rainChance ≤ 20        → "Dry conditions"              / "Check soil moisture before watering"
 *   5. otherwise              → "Normal conditions"           / "Follow today's task"
 */

/**
 * normalizeWeather(raw) — coerce any of the common payload
 * shapes the codebase produces (`temp` / `tempC` / `tempHighC`
 * / `temperatureC`, `rainChance` / `precipitationProbability` /
 * `pop` / `rainChancePct`, `wind` / `windKph` / `windSpeed`,
 * `condition` / `summary` / `rainfallState`) into the spec
 * envelope: { temp, condition, rainChance, wind }.
 *
 * Returns a frozen object. Missing fields default to null —
 * `getWeatherAction` treats null as "no signal" and falls
 * through to the next branch.
 */
export function normalizeWeather(raw) {
  const w = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  const temp = _firstNumber(w.temp, w.tempC, w.temperatureC, w.tempHighC);
  const rainChance = _firstNumber(
    w.rainChance, w.rainChancePct, w.precipitationProbability, w.pop,
  );
  const wind = _firstNumber(w.wind, w.windKph, w.windSpeed);
  const condition = _firstString(w.condition, w.summary, w.rainfallState, w.rainfall);
  return Object.freeze({
    temp:       temp,
    condition:  condition,
    rainChance: rainChance,
    wind:       wind,
  });
}

/**
 * getWeatherAction(weather) — returns { insight, action }.
 *
 * Accepts either a raw weather payload OR a pre-normalized one;
 * runs the input through normalizeWeather() defensively before
 * mapping so callers never have to think about shape.
 */
export function getWeatherAction(weather) {
  const w = normalizeWeather(weather);

  if (Number.isFinite(w.rainChance) && w.rainChance >= 60) {
    return {
      insight: 'Rain expected later today',
      action:  'Check drainage and avoid watering',
    };
  }

  if (Number.isFinite(w.temp) && w.temp >= 32) {
    return {
      insight: 'High heat today',
      action:  'Water early morning or late evening',
    };
  }

  if (Number.isFinite(w.wind) && w.wind >= 25) {
    return {
      insight: 'Strong winds expected',
      action:  'Support weak plants',
    };
  }

  if (Number.isFinite(w.rainChance) && w.rainChance <= 20) {
    return {
      insight: 'Dry conditions',
      action:  'Check soil moisture before watering',
    };
  }

  return {
    insight: 'Normal conditions',
    action:  'Follow today\u2019s task',
  };
}

// ─── Internal helpers ────────────────────────────────────────

function _firstNumber(...vals) {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function _firstString(...vals) {
  for (const v of vals) {
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

export const _internal = Object.freeze({
  _firstNumber,
  _firstString,
});

export default { getWeatherAction, normalizeWeather };
