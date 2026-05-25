/**
 * scanProgressTracker.js — extends the progression timeline with
 * per-scan action history + tri-state outcome marking.
 *
 *   import {
 *     markScanOutcome, buildScanProgressReport, OUTCOME,
 *   } from 'src/core/scan/scanProgressTracker.js';
 *
 *   markScanOutcome({ scanId, outcome: OUTCOME.IMPROVED, actionTaken: 'pruned lower leaves' });
 *   const report = buildScanProgressReport({ scanHistory, issueCategory: 'fungal_risk' });
 *   // report = { timeline, healthIndicator, actionsLog, summary }
 *
 * What it is — and is NOT
 * ───────────────────────
 *   The spec asks for a `scanProgressTracker` that tracks outcomes
 *   over time AND treatment/action history. The progression
 *   timeline + health indicator already exist in
 *   `scanProgressionTimeline.js`; this module adds:
 *
 *     • `markScanOutcome()` — persist the user's tri-state outcome
 *       (improved / unchanged / worse) + the action they took.
 *     • `buildScanProgressReport()` — aggregate timeline +
 *       indicator + action log into one report envelope.
 *
 *   Storage is localStorage — same pattern as farmMemoryEngine.
 *   Outcome rows carry scanId + outcome + actionTaken + atMs —
 *   no PII, no image bytes.
 *
 * Strict-rule audit
 *   • Pure-runtime. Never throws. SSR-safe.
 */

import {
  buildProgressionTimeline, healthIndicator,
} from './scanProgressionTimeline.js';

const _LS_KEY = 'farroway_scan_progress_v1';

export const OUTCOME = Object.freeze({
  IMPROVED:  'improved',
  UNCHANGED: 'unchanged',
  WORSE:     'worse',
  IGNORED:   'ignored',
});

const _VALID_OUTCOME = new Set(Object.values(OUTCOME));

function _safeLs() {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage || null;
  } catch { return null; }
}

function _readLog() {
  try {
    const ls = _safeLs();
    if (!ls) return [];
    const raw = ls.getItem(_LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function _writeLog(list) {
  try {
    const ls = _safeLs();
    if (!ls) return false;
    // Keep the last 200 entries — bounded growth.
    const next = Array.isArray(list) ? list.slice(-200) : [];
    ls.setItem(_LS_KEY, JSON.stringify(next));
    return true;
  } catch { return false; }
}

/**
 * Persist a tri-state outcome for a scan + optional action note.
 *
 * @param {{ scanId, outcome, actionTaken?, atMs? }} input
 * @returns {boolean}
 */
export function markScanOutcome(input) {
  try {
    if (!input || typeof input !== 'object') return false;
    if (!input.scanId) return false;
    if (!_VALID_OUTCOME.has(input.outcome)) return false;
    const log = _readLog();
    log.push({
      scanId:     String(input.scanId),
      outcome:    input.outcome,
      actionTaken: input.actionTaken ? String(input.actionTaken).slice(0, 120) : null,
      atMs:       Number.isFinite(input.atMs) ? input.atMs : Date.now(),
    });
    return _writeLog(log);
  } catch { return false; }
}

/**
 * Aggregate the timeline + health indicator + per-scan action log
 * into one report the surface renders.
 *
 * @param {object} ctx
 * @returns {object}
 */
export function buildScanProgressReport(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const timeline = buildProgressionTimeline(c);
    const indicator = healthIndicator(c);
    const actionsLog = _readLog().filter((row) => {
      if (!c.scanHistory) return true;
      // Only return rows for scans the caller still knows about.
      try {
        const known = new Set(c.scanHistory.map((s) => s && s.id).filter(Boolean));
        return known.size === 0 || known.has(row.scanId);
      } catch { return true; }
    });

    // Summary counts — improved vs unchanged vs worse across the
    // narrowed action log. Used by the Journal surface to render
    // "X of N actions improved the issue."
    let improved = 0; let unchanged = 0; let worse = 0; let ignored = 0;
    for (const row of actionsLog) {
      if (row.outcome === OUTCOME.IMPROVED)  improved += 1;
      else if (row.outcome === OUTCOME.UNCHANGED) unchanged += 1;
      else if (row.outcome === OUTCOME.WORSE)    worse += 1;
      else if (row.outcome === OUTCOME.IGNORED)  ignored += 1;
    }

    return {
      ok:              true,
      timeline:        timeline.entries,
      healthIndicator: indicator,
      actionsLog,
      summary: {
        total:       actionsLog.length,
        improved,
        unchanged,
        worse,
        ignored,
      },
      disclaimer: {
        key:      'scan.progress.disclaimer',
        fallback: 'Progress is what you record — outcomes are your observations, not a diagnosis.',
      },
    };
  } catch {
    return {
      ok: false, timeline: [], healthIndicator: 'unknown',
      actionsLog: [], summary: { total: 0, improved: 0, unchanged: 0, worse: 0, ignored: 0 },
      disclaimer: {
        key: 'scan.progress.disclaimer',
        fallback: 'Progress report unavailable.',
      },
    };
  }
}

/** Test-only reset. */
export function _resetScanProgressForTests() {
  try {
    const ls = _safeLs();
    if (!ls) return;
    try { ls.removeItem(_LS_KEY); } catch { /* ignore */ }
  } catch { /* ignore */ }
}

const _module = {
  OUTCOME, markScanOutcome, buildScanProgressReport,
  _resetScanProgressForTests,
};
export default _module;
