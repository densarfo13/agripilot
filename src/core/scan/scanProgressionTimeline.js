/**
 * scanProgressionTimeline.js — before/after comparison + timeline
 * helpers for the scan history.
 *
 *   import {
 *     buildProgressionTimeline, pairBeforeAfter, healthIndicator,
 *   } from 'src/core/scan/scanProgressionTimeline.js';
 *
 *   const tl = buildProgressionTimeline({ scanHistory, issueCategory: 'fungal_risk' });
 *   // tl = { entries: [...], healthIndicator: 'improving' | 'stable' | 'declining' | 'unknown' }
 *
 * What it is — and is NOT
 * ───────────────────────
 *   Two pure helpers the Journal surface uses to render
 *   "before vs after" + a "health improving" indicator.
 *
 *   It is NOT a UI component, NOT a chart library, and NOT a
 *   diagnosis engine. Just data-shape helpers.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

const _str = (v) => String(v == null ? '' : v).toLowerCase();

function _sortByTime(list) {
  return (Array.isArray(list) ? list : [])
    .filter((s) => s && (s.createdAt != null || s.atMs != null))
    .map((s) => ({ ...s, _ts: Number(s.createdAt) || Number(s.atMs) || 0 }))
    .sort((a, b) => a._ts - b._ts);
}

/**
 * Build a progression timeline filtered to a single issue. Each
 * entry is a structural record (no PII; no raw image bytes).
 *
 * @param {object} ctx
 * @returns {{ entries: Array, healthIndicator: string }}
 */
export function buildProgressionTimeline(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const issue = _str(c.issueCategory);
    const sorted = _sortByTime(c.scanHistory).filter((s) =>
      !issue || _str(s.issueCategory) === issue);

    const entries = sorted.map((s) => ({
      id:               s.id || null,
      timestamp:        s._ts,
      issue:            _str(s.issueCategory) || null,
      confidenceLabel:  _str(s.confidenceLabel) || null,
      thumbnailRef:     s.thumbnailRef || null,    // never the bytes
      followupOutcome:  _str(s.followupOutcome) || null,
    }));

    return {
      ok:              true,
      entries,
      issue:           issue || null,
      healthIndicator: healthIndicator({ scanHistory: c.scanHistory, issueCategory: issue }),
    };
  } catch {
    return { ok: false, entries: [], issue: null, healthIndicator: 'unknown' };
  }
}

/**
 * Pair the most-recent scan with the one immediately before it
 * (for the issue). Returns null when there's no pair to compare.
 *
 * @param {object} ctx
 * @returns {{ before, after }|null}
 */
export function pairBeforeAfter(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const issue = _str(c.issueCategory);
    const sorted = _sortByTime(c.scanHistory).filter((s) =>
      !issue || _str(s.issueCategory) === issue);
    if (sorted.length < 2) return null;
    const after  = sorted[sorted.length - 1];
    const before = sorted[sorted.length - 2];
    return { before, after };
  } catch { return null; }
}

/**
 * Tri-state health indicator over the LAST N scans for an issue.
 *   improving  — most recent confidence < prior confidence
 *                AND a recovered/improved outcome appears
 *   declining  — recurring + no improved outcome
 *   stable     — recurring but neutral outcomes
 *   unknown    — not enough data
 *
 * Confidence is treated as ordinal: high(3) > medium(2) > low(1)
 * > needs_review(0). For an "improving" verdict we WANT confidence
 * to DROP (less diagnostic certainty = symptoms easing).
 *
 * @param {object} ctx
 * @returns {string}
 */
export function healthIndicator(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const issue = _str(c.issueCategory);
    const list = _sortByTime(c.scanHistory).filter((s) =>
      !issue || _str(s.issueCategory) === issue);
    if (list.length < 2) return 'unknown';

    const conf = (s) => {
      const c2 = _str(s.confidenceLabel);
      return c2 === 'high' ? 3 : c2 === 'medium' ? 2 : c2 === 'low' ? 1 : 0;
    };
    const recent2 = list.slice(-2);
    const first = recent2[0];
    const last  = recent2[1];
    const lastOutcome = _str(last.followupOutcome);

    if (['recovered', 'improved'].includes(lastOutcome)) return 'improving';
    if (conf(last) < conf(first) && conf(last) > 0)      return 'improving';
    if (conf(last) > conf(first))                        return 'declining';
    // Recurring + no improvement signal → stable (acknowledged
    // but unchanged).
    if (list.length >= 2)                                return 'stable';
    return 'unknown';
  } catch { return 'unknown'; }
}

const _module = { buildProgressionTimeline, pairBeforeAfter, healthIndicator };
export default _module;
