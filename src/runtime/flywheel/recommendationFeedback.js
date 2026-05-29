/**
 * runtime/flywheel/recommendationFeedback.js — Phase 14 closed-
 * loop recommendation tracker.
 *
 *   import {
 *     RECOMMENDATION_LIFECYCLE,
 *     computeRecommendationFunnel,
 *   } from 'src/runtime/flywheel/recommendationFeedback.js';
 *
 * What this is
 * ────────────
 *   Reads the event log for 4 recommendation-lifecycle events:
 *     shown · accepted · ignored · completed
 *   Plus the outcome record from outcomeEngine.js for the 5th step.
 *
 *   Returns a frozen envelope:
 *     {
 *       perRecommendation:  { [recId]: { shownAt, acceptedAt, ... } },
 *       totals:             { shown, accepted, ignored, completed },
 *       acceptanceRate, completionRate, ignoreRate,
 *       runtimeVersion,
 *     }
 *
 *   This is how Farroway closes the loop: did the farmer act on
 *   what we suggested? It feeds the outcomeEngine.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No persistence writes.
 *   • Counts only — no PII handled.
 */

import { EVENT_KIND } from './eventEngine.js';

export const RECOMMENDATION_FEEDBACK_VERSION = 'recommendation-feedback-v1';

export const RECOMMENDATION_LIFECYCLE = Object.freeze({
  SHOWN:     'shown',
  ACCEPTED:  'accepted',
  IGNORED:   'ignored',
  COMPLETED: 'completed',
  OUTCOME:   'outcome',
});

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

const KIND_TO_LIFECYCLE = Object.freeze({
  [EVENT_KIND.RECOMMENDATION_SHOWN]:     RECOMMENDATION_LIFECYCLE.SHOWN,
  [EVENT_KIND.RECOMMENDATION_ACCEPTED]:  RECOMMENDATION_LIFECYCLE.ACCEPTED,
  [EVENT_KIND.RECOMMENDATION_IGNORED]:   RECOMMENDATION_LIFECYCLE.IGNORED,
  [EVENT_KIND.RECOMMENDATION_COMPLETED]: RECOMMENDATION_LIFECYCLE.COMPLETED,
});

function _rate(num, den) {
  if (!den) return 0;
  return Math.round((num / den) * 100) / 100;
}

export function computeRecommendationFunnel(ctx) {
  return _safe(() => {
    const c       = _isObj(ctx) ? ctx : {};
    const events  = _arr(c.events);
    const outcomes = _arr(c.outcomeRecords);

    const perRec = {};

    for (const e of events) {
      if (!_isObj(e)) continue;
      const lc = KIND_TO_LIFECYCLE[_str(e.eventType)];
      if (!lc) continue;
      const recId = _str(e.metadata && e.metadata.recommendationId)
                 || _str(e.metadata && e.metadata.recId);
      if (!recId) continue;
      if (!perRec[recId]) perRec[recId] = {
        recId,
        kind:       _str(e.metadata && e.metadata.kind),
        shownAt:    '', acceptedAt: '', ignoredAt: '',
        completedAt: '', outcomeAt: '', outcomeOk: null,
      };
      const slot = perRec[recId];
      const ts   = _str(e.timestamp);
      if (lc === RECOMMENDATION_LIFECYCLE.SHOWN     && !slot.shownAt)     slot.shownAt = ts;
      if (lc === RECOMMENDATION_LIFECYCLE.ACCEPTED  && !slot.acceptedAt)  slot.acceptedAt = ts;
      if (lc === RECOMMENDATION_LIFECYCLE.IGNORED   && !slot.ignoredAt)   slot.ignoredAt = ts;
      if (lc === RECOMMENDATION_LIFECYCLE.COMPLETED && !slot.completedAt) slot.completedAt = ts;
    }

    // Outcomes — caller injects, sourced from outcomeEngine
    for (const o of outcomes) {
      if (!_isObj(o)) continue;
      const recId = _str(o.recommendationId);
      if (!recId || !perRec[recId]) continue;
      perRec[recId].outcomeAt = _str(o.measuredAt) || perRec[recId].outcomeAt;
      perRec[recId].outcomeOk = (typeof o.helped === 'boolean')
        ? o.helped
        : perRec[recId].outcomeOk;
    }

    const list = Object.values(perRec).map((r) => Object.freeze(r));
    const totals = {
      shown:     list.filter((r) => r.shownAt).length,
      accepted:  list.filter((r) => r.acceptedAt).length,
      ignored:   list.filter((r) => r.ignoredAt).length,
      completed: list.filter((r) => r.completedAt).length,
      withOutcome: list.filter((r) => r.outcomeAt).length,
    };

    return Object.freeze({
      runtimeVersion: RECOMMENDATION_FEEDBACK_VERSION,
      perRecommendation: Object.freeze(list),
      totals: Object.freeze(totals),
      acceptanceRate: _rate(totals.accepted, totals.shown),
      ignoreRate:     _rate(totals.ignored, totals.shown),
      completionRate: _rate(totals.completed, totals.accepted),
    });
  }, Object.freeze({
    runtimeVersion: RECOMMENDATION_FEEDBACK_VERSION,
    perRecommendation: Object.freeze([]),
    totals: Object.freeze({ shown: 0, accepted: 0, ignored: 0,
                            completed: 0, withOutcome: 0 }),
    acceptanceRate: 0, ignoreRate: 0, completionRate: 0,
  }));
}
