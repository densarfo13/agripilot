/**
 * detection.js — early-detection metric.
 *
 *   computeDetection(reports, opts?)
 *     -> {
 *          windowDays,
 *          reports,           // total in window
 *          reportsPerWeek,
 *          reportsByIssue,    // { pest, disease, unknown }
 *          uniqueRegions,     // distinct (country|region) pairs
 *        }
 *
 * Pure. Pass an outbreak report array (e.g.
 * outbreakStore.getOutbreakReports()) + an optional window.
 *
 * Strict-rule audit
 *   * simple metric: counts + a divide
 *   * works with limited data: zero-state on empty input
 *   * never throws
 */

const MS_PER_DAY = 86_400_000;

function _withinWindow(createdAt, sinceMs) {
  if (sinceMs == null) return true;
  const ts = (typeof createdAt === 'string') ? Date.parse(createdAt) : Number(createdAt);
  return Number.isFinite(ts) && ts >= sinceMs;
}

function _norm(s) {
  if (s == null) return '';
  return String(s).trim().toLowerCase();
}

export function computeDetection(reports, opts = {}) {
  const { windowDays = 7, now = Date.now() } = opts || {};
  const wd = Number.isFinite(Number(windowDays)) && Number(windowDays) > 0
    ? Number(windowDays) : 7;
  const sinceMs = now - wd * MS_PER_DAY;

  const empty = Object.freeze({
    windowDays: wd,
    reports: 0,
    reportsPerWeek: 0,
    reportsByIssue: Object.freeze({ pest: 0, disease: 0, unknown: 0 }),
    uniqueRegions: 0,
  });
  if (!Array.isArray(reports) || reports.length === 0) return empty;

  let count = 0;
  let pest = 0, disease = 0, unknown = 0;
  const regions = new Set();
  for (const r of reports) {
    if (!r) continue;
    if (!_withinWindow(r.createdAt, sinceMs)) continue;
    count += 1;
    const issue = _norm(r.issueType);
    if      (issue === 'pest')    pest    += 1;
    else if (issue === 'disease') disease += 1;
    else                           unknown += 1;
    const country = _norm(r.location && r.location.country);
    const region  = _norm(r.location && r.location.region);
    if (country && region) regions.add(`${country}|${region}`);
  }

  const weeks = Math.max(wd / 7, 1 / 7);
  const reportsPerWeek = Math.round((count / weeks) * 10) / 10;

  return Object.freeze({
    windowDays: wd,
    reports: count,
    reportsPerWeek,
    reportsByIssue: Object.freeze({ pest, disease, unknown }),
    uniqueRegions: regions.size,
  });
}
