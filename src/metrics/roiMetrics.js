/**
 * roiMetrics.js — atomic ROI numbers for the weekly summary +
 * NGO dashboard.
 *
 *   computeRoiMetrics({ windowDays = 7 } = {})
 *     -> {
 *          windowDays,
 *          tasksCompleted,    // tasks marked done in window
 *          checksThisWeek,    // # of distinct days farmer
 *                             //   opened the app in window
 *          labelsSubmitted,   // saved post-task labels (any kind)
 *          pestReports,       // farmer-submitted pest reports
 *          droughtReports,    // farmer-submitted drought reports
 *          engagementRate,    // tasksCompleted / windowDays
 *                             //   (clamped to 0..1)
 *        }
 *
 * Pure: every number comes from local stores
 *   - eventLogger      (TASK_COMPLETED + others)
 *   - labels store     (saveLabel records)
 *   - outbreakStore    (farmer pest / drought reports)
 *   - progressStore    (per-day completion mirror)
 *
 * Strict-rule audit
 *   * No fake yield numbers — every metric is a literal count
 *     of farmer-driven actions
 *   * No external data — works offline
 *   * Returns a usable zero-state when nothing has happened yet
 *     so the WeeklySummary card never renders blank
 *   * Never throws — try/catch around every store read so a
 *     corrupt localStorage entry returns 0 for that metric
 *     instead of crashing the summary
 *   * Coexists with src/ngo/roiSummary.js which composes a
 *     RICHER dashboard. This module is the lighter atomic
 *     primitive WeeklySummary uses.
 */

import { getEvents, EVENT_TYPES } from '../data/eventLogger.js';
import { getLabels } from '../data/labels.js';
import { getOutbreakReports } from '../outbreak/outbreakStore.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function _safeArray(getter) {
  try {
    const v = getter();
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

function _windowStart(windowDays) {
  const days = Number.isFinite(windowDays) && windowDays > 0 ? windowDays : 7;
  return Date.now() - days * DAY_MS;
}

function _isInWindow(ts, since) {
  if (!Number.isFinite(ts)) return false;
  return ts >= since;
}

function _toDateKey(ts) {
  if (!Number.isFinite(ts)) return '';
  try { return new Date(ts).toDateString(); }
  catch { return ''; }
}

export function computeRoiMetrics({ windowDays = 7 } = {}) {
  const since = _windowStart(windowDays);
  const days  = Number.isFinite(windowDays) && windowDays > 0 ? windowDays : 7;

  // ── Events ──────────────────────────────────────────────
  const events = _safeArray(getEvents);
  let tasksCompleted = 0;
  const activeDays = new Set(); // distinct date-strings in window
  for (const e of events) {
    const ts = (e && Number.isFinite(e.ts)) ? e.ts
             : (e && Number.isFinite(e.timestamp)) ? e.timestamp
             : null;
    if (!ts || !_isInWindow(ts, since)) continue;
    if (e.type === EVENT_TYPES.TASK_COMPLETED) tasksCompleted += 1;
    const key = _toDateKey(ts);
    if (key) activeDays.add(key);
  }

  // ── Labels ──────────────────────────────────────────────
  const labels = _safeArray(getLabels);
  let labelsSubmitted = 0;
  for (const l of labels) {
    const ts = l && Number.isFinite(l.timestamp) ? l.timestamp : null;
    if (ts && _isInWindow(ts, since)) labelsSubmitted += 1;
  }

  // ── Outbreak reports (pest + drought) ───────────────────
  const reports = _safeArray(getOutbreakReports);
  let pestReports = 0;
  let droughtReports = 0;
  for (const r of reports) {
    const ts = r && (Number.isFinite(r.ts) ? r.ts
                    : Number.isFinite(r.timestamp) ? r.timestamp
                    : null);
    if (!ts || !_isInWindow(ts, since)) continue;
    const kind = String(r.kind || r.type || '').toLowerCase();
    const issue = String(r.issueType || r.issue || '').toLowerCase();
    if (kind === 'pest' || /pest|insect|caterpillar|worm/.test(issue)) {
      pestReports += 1;
    } else if (kind === 'drought' || /drought|dry|wilt/.test(issue)) {
      droughtReports += 1;
    }
  }

  // ── Engagement: distinct active days / window ───────────
  // Honest, non-inflatable. A farmer who opens the app every day
  // gets 1.0; one who opens it once gets 1/days. No imputed
  // "yield uplift", no projected impact — just behaviour.
  const engagementRate = days > 0
    ? Math.min(1, activeDays.size / days)
    : 0;

  return Object.freeze({
    windowDays:       days,
    tasksCompleted,
    checksThisWeek:   activeDays.size,
    labelsSubmitted,
    pestReports,
    droughtReports,
    engagementRate,
  });
}

export default computeRoiMetrics;
