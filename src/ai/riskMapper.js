/**
 * riskMapper.js — probability -> 'HIGH' | 'MEDIUM' | 'LOW'.
 *
 *   mapRisk(prob)                           default thresholds
 *   mapRisk(prob, { highAt, mediumAt })     custom thresholds
 *
 * Defaults align with the v1.2 deterministic rules:
 *   prob > 0.70  -> HIGH
 *   prob > 0.40  -> MEDIUM
 *   prob <= 0.40 -> LOW
 *
 * Strict-rule audit
 *   * pure
 *   * never throws on bad input (returns LOW)
 *   * deterministic
 */

export const RISK_THRESHOLDS = Object.freeze({
  HIGH:   0.70,
  MEDIUM: 0.40,
});

export const RISK_LEVEL = Object.freeze({
  HIGH:   'HIGH',
  MEDIUM: 'MEDIUM',
  LOW:    'LOW',
});

export function mapRisk(prob, opts = {}) {
  const high = Number.isFinite(Number(opts.highAt))
    ? Number(opts.highAt) : RISK_THRESHOLDS.HIGH;
  const med  = Number.isFinite(Number(opts.mediumAt))
    ? Number(opts.mediumAt) : RISK_THRESHOLDS.MEDIUM;

  const p = Number(prob);
  if (!Number.isFinite(p))   return RISK_LEVEL.LOW;
  if (p > high)              return RISK_LEVEL.HIGH;
  if (p > med)               return RISK_LEVEL.MEDIUM;
  return RISK_LEVEL.LOW;
}
