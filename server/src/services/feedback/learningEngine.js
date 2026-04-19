/**
 * learningEngine.js — turns past HarvestOutcome rows into
 * per-(crop × region) confidence multipliers the scoring engine
 * can apply to new recommendations.
 *
 * Rule-based only; no ML. The point is a gentle, auditable nudge:
 *   repeated excellent tomato harvests in Maryland → future
 *   recommendations for tomato in Maryland get a small bump.
 *   repeated poor/failed outcomes → a small trim.
 */

const OUTCOME_CLASS = Object.freeze({
  SUCCESSFUL: 'successful',
  DELAYED:    'delayed',
  HIGH_RISK:  'high_risk',
  FAILED:     'failed',
});

const QUALITY_WEIGHTS = Object.freeze({
  excellent: 1.0,
  good:       0.5,
  fair:       0.0,
  poor:     -0.5,
});

/**
 * deriveOutcomeClass(outcome) — maps the stored HarvestOutcome row
 * to one of the four buckets the spec calls for.
 *
 *   quality excellent + no issues + on-time  → successful
 *   quality good/excellent + late/no-yield   → delayed
 *   quality fair/poor + issues               → high_risk
 *   quality poor + no yield + many skips     → failed
 */
export function deriveOutcomeClass(outcome = {}) {
  const q = String(outcome.qualityBand || '').toLowerCase();
  const yieldOk = Number.isFinite(outcome.actualYieldKg) && outcome.actualYieldKg > 0;
  const issues = Number(outcome.issueCount) || 0;
  const skipped = Number(outcome.skippedTasksCount) || 0;
  const completed = Number(outcome.completedTasksCount) || 0;
  const completionRate = (completed + skipped) ? completed / (completed + skipped) : 0;

  // "Failed" requires real evidence of neglect — a cycle that simply
  // has no yield reported yet but had no tasks either is just delayed.
  if (!yieldOk && skipped >= 5) return OUTCOME_CLASS.FAILED;
  if (!yieldOk && (completed + skipped) > 0 && completionRate < 0.3) return OUTCOME_CLASS.FAILED;
  if (q === 'poor' && issues >= 2) return OUTCOME_CLASS.HIGH_RISK;
  if (q === 'poor') return OUTCOME_CLASS.HIGH_RISK;
  if (q === 'fair' && issues >= 2) return OUTCOME_CLASS.HIGH_RISK;
  if (!yieldOk) return OUTCOME_CLASS.DELAYED;
  if (q === 'excellent' || q === 'good') return OUTCOME_CLASS.SUCCESSFUL;
  return OUTCOME_CLASS.DELAYED;
}

/**
 * applyOutcomeToConfidence(cropKey, outcomes)
 *
 * Given a list of past outcome records for ONE crop (typically scoped
 * to the current region), return a confidence multiplier in [0.7, 1.3]
 * the scoring engine will multiply into deriveConfidence's "points".
 */
export function applyOutcomeToConfidence(cropKey, outcomes = []) {
  const relevant = (outcomes || []).filter(
    (o) => o && String(o.cropKey || o.crop || '').toLowerCase() === String(cropKey || '').toLowerCase(),
  );
  if (!relevant.length) return 1;

  let raw = 0;
  for (const o of relevant) {
    const q = String(o.qualityBand || '').toLowerCase();
    const w = QUALITY_WEIGHTS[q] ?? 0;
    const klass = deriveOutcomeClass(o);
    const bonus = klass === OUTCOME_CLASS.SUCCESSFUL ? 0.2
      : klass === OUTCOME_CLASS.FAILED ? -0.3
      : klass === OUTCOME_CLASS.HIGH_RISK ? -0.1
      : 0;
    raw += w + bonus;
  }
  // Normalize into [-1, 1] by dividing by the record count, then
  // map to [0.7, 1.3].
  const avg = raw / relevant.length;
  const bounded = Math.max(-1, Math.min(1, avg));
  const multiplier = 1 + bounded * 0.3;
  return Number(multiplier.toFixed(3));
}

/**
 * getLearningAdjustments(outcomes, scope)
 *
 * Bundles per-crop multipliers the scoring engine can consume in a
 * single call:
 *   { multipliers: { tomato: 1.12, lettuce: 0.9, ... }, classesByCrop }
 *
 * `scope` optionally narrows by stateCode (e.g. past Maryland
 * harvests only). When there are no outcomes we return an empty map
 * and callers fall back to neutral confidence.
 */
export function getLearningAdjustments(outcomes = [], scope = {}) {
  const filtered = (outcomes || []).filter((o) => {
    if (!o) return false;
    if (scope.stateCode && o.stateCode && String(o.stateCode).toUpperCase() !== String(scope.stateCode).toUpperCase()) return false;
    return true;
  });
  const byCrop = new Map();
  for (const o of filtered) {
    const k = String(o.cropKey || o.crop || '').toLowerCase();
    if (!k) continue;
    if (!byCrop.has(k)) byCrop.set(k, []);
    byCrop.get(k).push(o);
  }
  const multipliers = {};
  const classesByCrop = {};
  for (const [k, rows] of byCrop.entries()) {
    multipliers[k] = applyOutcomeToConfidence(k, rows);
    classesByCrop[k] = rows.map(deriveOutcomeClass);
  }
  return { multipliers, classesByCrop, samplesByCrop: Object.fromEntries(Array.from(byCrop.entries()).map(([k, v]) => [k, v.length])) };
}

export const _internal = { QUALITY_WEIGHTS, OUTCOME_CLASS };
export { OUTCOME_CLASS };
