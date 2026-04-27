/**
 * behavior.js — "are farmers actually checking their farms?"
 *
 *   computeBehavior(events, opts?)
 *     -> {
 *          windowDays,
 *          checks,            // total TASK_COMPLETED in window
 *          activeFarmers,     // unique farmIds completing tasks
 *          avgChecksPerWeek,  // count / (windowDays/7)
 *          avgChecksPerFarmerPerWeek,
 *                            // checks / activeFarmers / weeks
 *        }
 *
 * Pure. Pass an events array (typically from eventLogger.
 * getEvents()) and an optional `opts.windowDays` (default 7).
 *
 * Strict-rule audit
 *   * simple metric: counts + a divide
 *   * works with limited data: returns 0s for an empty window
 *     instead of NaN
 *   * pure / never throws
 */

const MS_PER_DAY = 86_400_000;
const TASK_COMPLETED = 'TASK_COMPLETED';

function _withinWindow(ts, sinceMs) {
  if (sinceMs == null) return true;
  const t = Number(ts);
  return Number.isFinite(t) && t >= sinceMs;
}

export function computeBehavior(events, opts = {}) {
  const { windowDays = 7, now = Date.now() } = opts || {};
  const wd = Number.isFinite(Number(windowDays)) && Number(windowDays) > 0
    ? Number(windowDays) : 7;
  const sinceMs = now - wd * MS_PER_DAY;

  if (!Array.isArray(events) || events.length === 0) {
    return Object.freeze({
      windowDays: wd,
      checks: 0,
      activeFarmers: 0,
      avgChecksPerWeek: 0,
      avgChecksPerFarmerPerWeek: 0,
    });
  }

  let checks = 0;
  const farmers = new Set();
  for (const e of events) {
    if (!e) continue;
    if (e.type !== TASK_COMPLETED) continue;
    if (!_withinWindow(e.timestamp, sinceMs)) continue;
    checks += 1;
    const fid = e.payload && e.payload.farmId;
    if (fid != null) farmers.add(String(fid));
  }

  const weeks = Math.max(wd / 7, 1 / 7);
  const avgChecksPerWeek = checks / weeks;
  const avgChecksPerFarmerPerWeek = farmers.size > 0
    ? checks / farmers.size / weeks
    : 0;

  return Object.freeze({
    windowDays: wd,
    checks,
    activeFarmers: farmers.size,
    avgChecksPerWeek: Math.round(avgChecksPerWeek * 10) / 10,
    avgChecksPerFarmerPerWeek: Math.round(avgChecksPerFarmerPerWeek * 10) / 10,
  });
}
