/**
 * pestRiskEngine.js — pure predictive pest-risk score.
 *
 *   computePestRisk(farm, weather, cluster?)
 *     -> 'HIGH' | 'MEDIUM' | 'LOW'
 *
 * Scoring (per spec, simple - no ML):
 *   +1   weather.humidityHigh
 *   +1   weather.temperatureHigh
 *   +2   cluster.reportCount >= 3
 *
 *   score >= 3   -> HIGH
 *   score == 2   -> MEDIUM
 *   otherwise    -> LOW
 *
 * `cluster` is the matched outbreak cluster from
 * outbreakClusterEngine.detectActiveClusters() - same shape the
 * existing OutbreakAlertBanner consumes. When no cluster
 * matches, the cluster term contributes 0.
 *
 * Strict-rule audit
 *   * pure: no I/O, no globals
 *   * never throws on missing inputs
 *   * deterministic
 */

export const PEST_LEVEL = Object.freeze({
  HIGH:   'HIGH',
  MEDIUM: 'MEDIUM',
  LOW:    'LOW',
});

export function computePestRisk(farm, weather, cluster) {
  if (!farm)    return PEST_LEVEL.LOW;
  if (!weather) return PEST_LEVEL.LOW;

  let score = 0;
  if (weather.humidityHigh)    score += 1;
  if (weather.temperatureHigh) score += 1;
  if (cluster && Number(cluster.reportCount) >= 3) score += 2;

  if (score >= 3) return PEST_LEVEL.HIGH;
  if (score === 2) return PEST_LEVEL.MEDIUM;
  return PEST_LEVEL.LOW;
}

export const _internal = Object.freeze({ PEST_LEVEL });
