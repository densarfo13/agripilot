/**
 * impactMetrics.js — honest farmer-impact numbers derived from
 * the local event log.
 *
 *   tasksCompletedThisWeek(events)
 *   activeFarmers(events)
 *   labelCompletionRate(events)
 *   avgChecksPerWeek(events)
 *   riskReportsThisWeek(events)
 *   outcomeHelpfulnessRate(events)
 *
 * Each function takes an event array (the caller can pass
 * `getEvents()` from src/data/eventLogger.js or a pre-filtered
 * slice for a single farm / region) and returns a number or a
 * 0..1 ratio. Pure + sync — no I/O inside.
 *
 * Why a separate module from src/metrics/roiMetrics.js
 *   roiMetrics composes a 7-field summary for the WeeklySummary
 *   card. impactMetrics returns the SIX atomic values the
 *   spec calls out, named exactly per the brief, ready for the
 *   NGO ROI dashboard. Both modules read the same canonical
 *   event log so the numbers stay consistent.
 *
 * Wording rules (per spec § 8 — never claim yield)
 *   The function names + return values are honest counts /
 *   ratios; the caller is responsible for the user-visible
 *   labels. Recommended labels:
 *     "X farm checks completed"
 *     "X risks reported"
 *     "X farmers active this week"
 *     "Monitoring improved"
 *   No "yield uplift", no "X% better", no projected impact.
 *
 * Strict-rule audit
 *   * Pure: no I/O, no globals
 *   * Never throws on missing / partial input — defensive
 *     filters, returns 0 on empty arrays
 *   * Honest: every metric is a literal count of farmer-driven
 *     actions; nothing imputed
 */

import { EVENT_TYPES } from '../data/eventLogger.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function _safeArr(events) {
  return Array.isArray(events) ? events.filter(Boolean) : [];
}

function _ts(e) {
  if (!e) return null;
  if (Number.isFinite(e.timestamp)) return e.timestamp;
  if (Number.isFinite(e.ts)) return e.ts;
  return null;
}

function _isInLastDays(e, days) {
  const t = _ts(e);
  if (t == null) return false;
  return t >= (Date.now() - days * DAY_MS);
}

function _farmIdOf(e) {
  if (!e || !e.payload) return null;
  const fid = e.payload.farmId;
  return fid != null ? String(fid) : null;
}

/**
 * tasksCompletedThisWeek(events) → number
 */
export function tasksCompletedThisWeek(events) {
  return _safeArr(events).filter((e) =>
    e.type === EVENT_TYPES.TASK_COMPLETED && _isInLastDays(e, 7)
  ).length;
}

/**
 * activeFarmers(events) → number of distinct farmIds that have
 * ANY event in the last 7 days. Caller-supplied events array
 * may be the global log or a per-NGO filtered slice.
 */
export function activeFarmers(events) {
  const seen = new Set();
  for (const e of _safeArr(events)) {
    if (!_isInLastDays(e, 7)) continue;
    const fid = _farmIdOf(e);
    if (fid) seen.add(fid);
  }
  return seen.size;
}

/**
 * labelCompletionRate(events) → ratio in [0, 1].
 *
 * Numerator:   LABEL_SUBMITTED events in last 7 days.
 * Denominator: TASK_COMPLETED events in last 7 days.
 *
 * The ratio represents "how often a completed task is followed
 * by a label", which is the directly-measurable signal of
 * farmer engagement with the labeling prompt. Returns 0 when
 * the denominator is 0 (avoids dividing by zero + reads as
 * "no labels yet" which is correct for cold-start farms).
 */
export function labelCompletionRate(events) {
  const arr = _safeArr(events).filter((e) => _isInLastDays(e, 7));
  let labels = 0;
  let completes = 0;
  for (const e of arr) {
    if (e.type === EVENT_TYPES.LABEL_SUBMITTED) labels += 1;
    if (e.type === EVENT_TYPES.TASK_COMPLETED) completes += 1;
  }
  if (completes === 0) return 0;
  return Math.min(1, labels / completes);
}

/**
 * avgChecksPerWeek(events) → number.
 *
 * "Check" = any TODAY_VIEWED or TASK_COMPLETED event. Counted
 * over a 4-week window then divided by 4 to smooth a single
 * busy day. Returns 0 when there are no events in the window.
 */
export function avgChecksPerWeek(events) {
  const since = Date.now() - 4 * WEEK_MS;
  let n = 0;
  for (const e of _safeArr(events)) {
    const t = _ts(e);
    if (t == null || t < since) continue;
    if (e.type === EVENT_TYPES.TODAY_VIEWED
     || e.type === EVENT_TYPES.TASK_VIEWED
     || e.type === EVENT_TYPES.TASK_COMPLETED) {
      n += 1;
    }
  }
  return n / 4;
}

/**
 * riskReportsThisWeek(events) → number of farmer-submitted
 * pest + drought reports in the last 7 days.
 */
export function riskReportsThisWeek(events) {
  return _safeArr(events).filter((e) =>
    (e.type === EVENT_TYPES.PEST_REPORTED
      || e.type === EVENT_TYPES.DROUGHT_REPORTED)
    && _isInLastDays(e, 7)
  ).length;
}

/**
 * outcomeHelpfulnessRate(events) → ratio in [0, 1].
 *
 * Outcome events carry payload.outcome ∈ { 'helped',
 * 'not_helpful', 'issue_found', 'issue_resolved', 'unknown' }.
 * "Helpful" tier = { helped, issue_resolved }.
 * Numerator: outcomes in helpful tier.
 * Denominator: total outcomes that aren't 'unknown'.
 * Returns 0 when the denominator is 0.
 */
export function outcomeHelpfulnessRate(events) {
  let helpful = 0;
  let total   = 0;
  for (const e of _safeArr(events)) {
    if (e.type !== EVENT_TYPES.OUTCOME_SUBMITTED) continue;
    const o = String((e.payload && e.payload.outcome) || '').toLowerCase();
    if (!o || o === 'unknown') continue;
    total += 1;
    if (o === 'helped' || o === 'issue_resolved') helpful += 1;
  }
  if (total === 0) return 0;
  return Math.min(1, helpful / total);
}

/**
 * Convenience composer for surfaces (e.g. NGO ROI panel) that
 * want every metric in one call. Returns a frozen object with
 * the exact spec wording on the labels.
 */
export function summariseImpact(events) {
  return Object.freeze({
    tasksCompletedThisWeek:   tasksCompletedThisWeek(events),
    activeFarmers:            activeFarmers(events),
    labelCompletionRate:      labelCompletionRate(events),
    avgChecksPerWeek:         avgChecksPerWeek(events),
    riskReportsThisWeek:      riskReportsThisWeek(events),
    outcomeHelpfulnessRate:   outcomeHelpfulnessRate(events),
    generatedAt:              new Date().toISOString(),
  });
}

export default summariseImpact;
