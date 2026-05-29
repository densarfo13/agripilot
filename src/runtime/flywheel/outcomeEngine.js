/**
 * runtime/flywheel/outcomeEngine.js — Phase 14 did-it-help engine.
 *
 *   import {
 *     computeOutcomes, OUTCOME_KIND, OUTCOME_VERDICT,
 *   } from 'src/runtime/flywheel/outcomeEngine.js';
 *
 * What this is
 * ────────────
 *   Measures whether the platform actually helped. For each
 *   completed recommendation, looks at the surrounding signals
 *   over a 14-day window and emits a verdict:
 *
 *     • improved  — disease ↓ / yield ↑ / task completion ↑
 *     • neutral   — no measurable change
 *     • worsened  — disease ↑ / yield ↓ / task completion ↓
 *     • unknown   — not enough data in window
 *
 *   Aggregate envelope:
 *     {
 *       perOutcome: [{ recId, kind, verdict, deltas, evidenceCount }],
 *       totals:     { improved, neutral, worsened, unknown },
 *       helpRate,   // improved / (improved + worsened) — honest
 *       runtimeVersion,
 *     }
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No persistence writes.
 *   • Returns unknown rather than fake confidence.
 */

import { EVENT_KIND } from './eventEngine.js';

export const OUTCOME_ENGINE_VERSION = 'outcome-engine-v1';

export const OUTCOME_KIND = Object.freeze({
  DISEASE:         'DISEASE',
  YIELD:           'YIELD',
  TASK_COMPLETION: 'TASK_COMPLETION',
  HEALTH_SCORE:    'HEALTH_SCORE',
});

export const OUTCOME_VERDICT = Object.freeze({
  IMPROVED: 'improved',
  NEUTRAL:  'neutral',
  WORSENED: 'worsened',
  UNKNOWN:  'unknown',
});

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

const WINDOW_MS = 14 * 86400000;

function _within(ts, anchorMs, windowMs) {
  const t = _safe(() => new Date(ts).getTime(), NaN);
  if (!Number.isFinite(t)) return false;
  return t >= anchorMs - windowMs && t <= anchorMs + windowMs;
}

function _signalsAround(events, anchorMs, predicate) {
  let before = 0, after = 0;
  let beforeSum = 0, afterSum = 0;
  for (const e of _arr(events)) {
    if (!_isObj(e)) continue;
    if (!predicate(e)) continue;
    const t = _safe(() => new Date(e.timestamp).getTime(), NaN);
    if (!Number.isFinite(t)) continue;
    const lag = anchorMs - t;
    if (lag > WINDOW_MS || -lag > WINDOW_MS) continue;
    const score = _num(e.metadata && e.metadata.healthScore);
    if (lag >= 0) {
      before++;
      if (score != null) beforeSum += score;
    } else {
      after++;
      if (score != null) afterSum += score;
    }
  }
  return Object.freeze({
    beforeCount: before, afterCount: after,
    beforeMean:  before > 0 ? beforeSum / before : null,
    afterMean:   after  > 0 ? afterSum / after  : null,
  });
}

function _verdictFromDelta(delta, threshold) {
  if (delta == null) return OUTCOME_VERDICT.UNKNOWN;
  if (delta >= threshold)  return OUTCOME_VERDICT.IMPROVED;
  if (delta <= -threshold) return OUTCOME_VERDICT.WORSENED;
  return OUTCOME_VERDICT.NEUTRAL;
}

export function computeOutcomes(ctx) {
  return _safe(() => {
    const c       = _isObj(ctx) ? ctx : {};
    const events  = _arr(c.events);
    const totals  = { improved: 0, neutral: 0, worsened: 0, unknown: 0 };
    const perOutcome = [];

    // Each completed recommendation becomes one outcome row.
    const completed = events.filter((e) =>
      _isObj(e) && e.eventType === EVENT_KIND.RECOMMENDATION_COMPLETED);

    for (const ev of completed) {
      const recId    = _str(ev.metadata && ev.metadata.recommendationId);
      const targetK  = _str(ev.metadata && ev.metadata.outcomeKind)
                    || OUTCOME_KIND.HEALTH_SCORE;
      const anchorMs = _safe(() => new Date(ev.timestamp).getTime(), NaN);
      if (!Number.isFinite(anchorMs)) {
        totals.unknown++;
        perOutcome.push(Object.freeze({
          recId, kind: targetK, verdict: OUTCOME_VERDICT.UNKNOWN,
          delta: null, evidenceCount: 0,
        }));
        continue;
      }

      let predicate; let threshold;
      if (targetK === OUTCOME_KIND.DISEASE) {
        predicate = (e) =>
          e.eventType === EVENT_KIND.SCAN_NEEDS_REVIEW
       || e.eventType === EVENT_KIND.SCAN_COMPLETED;
        threshold = 1; // count-based
      } else if (targetK === OUTCOME_KIND.YIELD) {
        predicate = (e) => e.eventType === EVENT_KIND.YIELD_FORECAST_GENERATED;
        threshold = 1;
      } else if (targetK === OUTCOME_KIND.TASK_COMPLETION) {
        predicate = (e) => e.eventType === EVENT_KIND.TASK_COMPLETED;
        threshold = 1;
      } else {
        predicate = (e) => e.eventType === EVENT_KIND.HEALTH_SCORE_CHANGED;
        threshold = 5; // health score points
      }

      const sig = _signalsAround(events, anchorMs, predicate);
      let delta = null;
      if (targetK === OUTCOME_KIND.HEALTH_SCORE) {
        if (sig.beforeMean != null && sig.afterMean != null) {
          delta = Math.round((sig.afterMean - sig.beforeMean) * 10) / 10;
        }
      } else if (targetK === OUTCOME_KIND.DISEASE) {
        // Disease "improved" = fewer needs-review scans after
        delta = sig.beforeCount - sig.afterCount;
      } else {
        delta = sig.afterCount - sig.beforeCount;
      }

      let verdict;
      if (sig.beforeCount + sig.afterCount < 2) {
        verdict = OUTCOME_VERDICT.UNKNOWN;
      } else {
        verdict = _verdictFromDelta(delta, threshold);
      }
      totals[verdict]++;
      perOutcome.push(Object.freeze({
        recId, kind: targetK, verdict,
        delta, evidenceCount: sig.beforeCount + sig.afterCount,
      }));
    }

    const helpDenom = totals.improved + totals.worsened;
    const helpRate  = helpDenom === 0
      ? 0
      : Math.round((totals.improved / helpDenom) * 100) / 100;

    return Object.freeze({
      runtimeVersion: OUTCOME_ENGINE_VERSION,
      perOutcome: Object.freeze(perOutcome),
      totals:     Object.freeze(totals),
      helpRate,
      windowMs:   WINDOW_MS,
    });
  }, Object.freeze({
    runtimeVersion: OUTCOME_ENGINE_VERSION,
    perOutcome: Object.freeze([]),
    totals: Object.freeze({ improved: 0, neutral: 0, worsened: 0, unknown: 0 }),
    helpRate: 0,
    windowMs: WINDOW_MS,
  }));
}
