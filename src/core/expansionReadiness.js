/**
 * expansionReadiness.js — score whether a country is ready to
 * graduate from `planned` → `beta` → `active` (spec §12).
 *
 * Pure scoring; the admin dashboard renders the labels
 * `ready` / `needs_validation` / `not_ready` from this output.
 *
 * Default weight composition (caller can override):
 *
 *   score =
 *      dailyActiveUsersWeight
 *    + taskCompletionWeight
 *    + scanUsageWeight
 *    + languageCoverageWeight
 *    - errorRatePenalty
 *    - translationGapPenalty
 *
 *   ≥ 80 → 'ready'
 *   ≥ 50 → 'needs_validation'
 *   else  → 'not_ready'
 */

const DEFAULT_THRESHOLDS = Object.freeze({
  ready: 80,
  needsValidation: 50,
});

function safeNumber(v, fallback = 0) {
  return Number.isFinite(v) ? Number(v) : fallback;
}

/**
 * calculateExpansionReadiness — main entry.
 *
 * @param  {Object} m   metric bag
 * @param  {number} [m.dailyActiveUsersWeight]
 * @param  {number} [m.taskCompletionWeight]
 * @param  {number} [m.scanUsageWeight]
 * @param  {number} [m.languageCoverageWeight]
 * @param  {number} [m.errorRatePenalty]
 * @param  {number} [m.translationGapPenalty]
 *
 * @returns {'ready' | 'needs_validation' | 'not_ready'}
 */
export function calculateExpansionReadiness(m = {}) {
  const score = readinessScore(m);
  if (score >= DEFAULT_THRESHOLDS.ready) return 'ready';
  if (score >= DEFAULT_THRESHOLDS.needsValidation) return 'needs_validation';
  return 'not_ready';
}

/**
 * readinessScore — same inputs, returns the raw number so
 * the admin dashboard can render a progress bar alongside
 * the label.
 */
export function readinessScore(m = {}) {
  return (
    safeNumber(m.dailyActiveUsersWeight)
    + safeNumber(m.taskCompletionWeight)
    + safeNumber(m.scanUsageWeight)
    + safeNumber(m.languageCoverageWeight)
    - safeNumber(m.errorRatePenalty)
    - safeNumber(m.translationGapPenalty)
  );
}

/**
 * readinessLabel — i18n-friendly label key for the dashboard.
 */
export function readinessLabel(status) {
  switch (status) {
    case 'ready':            return 'expansion.ready';
    case 'needs_validation': return 'expansion.needsValidation';
    default:                 return 'expansion.notReady';
  }
}

export const _internal = Object.freeze({ DEFAULT_THRESHOLDS });
