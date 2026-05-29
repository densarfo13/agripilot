/**
 * src/runtime/intelligence/OutcomeEngine.ts — Closes the loop
 * by scoring OODA recommendations against observed outcomes.
 *
 *   import {
 *     scoreOutcome, summariseOutcomes,
 *     OUTCOME_ENGINE_VERSION,
 *   } from 'src/runtime/intelligence/OutcomeEngine';
 *
 * What this file owns
 * ───────────────────
 *   When a grower completes a recommended task or marks a
 *   treatment applied, this engine produces an outcome score
 *   used internally for OODA tuning. Outputs stay INTERNAL —
 *   no leaderboard, no comparative ranking, no fake metrics.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No persistence writes. No PII handled.
 *   • Scores are internal only — never surfaced to growers.
 */

export const OUTCOME_ENGINE_VERSION = 'outcome-engine-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr  = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _num  = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

interface OutcomeCtx {
  /** The OODA envelope that produced the recommendation. */
  ooda?:           any;
  /** Was the recommended action taken? */
  actionTaken?:    boolean;
  /** Plant health score AFTER the action (0-100). */
  healthAfter?:    number;
  /** Plant health score BEFORE the action (0-100). */
  healthBefore?:   number;
  /** Days between action and outcome observation. */
  daysElapsed?:    number;
}

/**
 * Score one outcome on a 0-100 scale. Honest math: if the
 * inputs are insufficient to draw a conclusion, returns null
 * rather than fabricating a score.
 */
export function scoreOutcome(ctx: OutcomeCtx) {
  return _safe(() => {
    if (!_isObj(ctx)) return _emptyOutcome();
    const taken = ctx.actionTaken === true;
    const before = _num(ctx.healthBefore);
    const after  = _num(ctx.healthAfter);
    if (!taken || before == null || after == null) {
      return Object.freeze({
        runtimeVersion: OUTCOME_ENGINE_VERSION,
        score: null,
        delta: null,
        verdict: 'insufficient_data',
        explanation: 'Not enough data yet to score this outcome.',
      });
    }
    const delta = after - before;
    // Linear: -50..+50 delta → 0..100 score.
    const clamped = Math.max(-50, Math.min(50, delta));
    const score = Math.round((clamped + 50));
    const verdict =
        delta >= 10 ? 'improved'
      : delta <= -10 ? 'declined'
      : 'stable';
    return Object.freeze({
      runtimeVersion: OUTCOME_ENGINE_VERSION,
      score, delta,
      verdict,
      explanation: '',
    });
  }, _emptyOutcome());
}

function _emptyOutcome() {
  return Object.freeze({
    runtimeVersion: OUTCOME_ENGINE_VERSION,
    score: null, delta: null,
    verdict: 'unknown',
    explanation: '',
  });
}

/**
 * Aggregate a list of scored outcomes — counts only, no
 * comparative ranking, no fake percentages.
 */
export function summariseOutcomes(outcomes: ReadonlyArray<any>) {
  return _safe(() => {
    const list = _arr(outcomes);
    let improved = 0, stable = 0, declined = 0, unknown = 0;
    for (const o of list) {
      if (!_isObj(o)) { unknown++; continue; }
      const v = _str((o as any).verdict);
      if      (v === 'improved') improved++;
      else if (v === 'stable')   stable++;
      else if (v === 'declined') declined++;
      else                        unknown++;
    }
    return Object.freeze({
      runtimeVersion: OUTCOME_ENGINE_VERSION,
      total: list.length,
      improved, stable, declined, unknown,
    });
  }, Object.freeze({
    runtimeVersion: OUTCOME_ENGINE_VERSION,
    total: 0, improved: 0, stable: 0, declined: 0, unknown: 0,
  }));
}
