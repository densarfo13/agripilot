/**
 * droughtEngine.js — pure drought-risk score.
 *
 *   computeDroughtRisk(farm, weather, daysSinceRain?)
 *     -> 'HIGH' | 'MEDIUM' | 'LOW'
 *
 * Logic v1 (per spec, simple - no ML):
 *   * No farm                                -> LOW
 *   * No rain in last 3 days + temperature
 *     high                                   -> HIGH
 *   * No rain in last 3 days alone           -> MEDIUM
 *   * Otherwise                              -> LOW
 *
 * `daysSinceRain` is accepted for forward-compat but the v1
 * thresholds key on weather.rainLast3Days only. When a real
 * "days since rain" metric becomes available the threshold
 * additions are a single-line edit here.
 *
 * Strict-rule audit
 *   * pure: no I/O, no globals
 *   * never throws on missing inputs
 *   * deterministic - same inputs, same output
 */

export const DROUGHT_LEVEL = Object.freeze({
  HIGH:   'HIGH',
  MEDIUM: 'MEDIUM',
  LOW:    'LOW',
});

export function computeDroughtRisk(farm, weather, daysSinceRain = 3) {
  if (!farm)    return DROUGHT_LEVEL.LOW;
  if (!weather) return DROUGHT_LEVEL.LOW;

  const noRain = !weather.rainLast3Days;
  const hot    = !!weather.temperatureHigh;

  if (noRain && hot) return DROUGHT_LEVEL.HIGH;
  if (noRain)        return DROUGHT_LEVEL.MEDIUM;

  // daysSinceRain is reserved for a richer signal in v2.
  // When it comes in, a "MEDIUM if daysSinceRain >= 5" rule
  // belongs here.
  void daysSinceRain;

  return DROUGHT_LEVEL.LOW;
}

export const _internal = Object.freeze({ DROUGHT_LEVEL });
