/**
 * engagement.js — task-completion engagement metric.
 *
 *   computeEngagement(events, opts?)
 *     -> {
 *          windowDays,      // window the rest of the row covers
 *          totalEvents,     // events of any type in the window
 *          tasksViewed,     // TASK_VIEWED events (denominator)
 *          tasksCompleted,  // TASK_COMPLETED events (numerator)
 *          completionRate,  // 0..1
 *          activeFarmers,   // unique farmIds with any event
 *        }
 *
 * Pure: pass any event list, get a row back. The dashboard
 * component reads from eventLogger.getEvents() and slices to
 * the window of interest before passing in.
 *
 * Strict-rule audit
 *   * simple metric (single ratio)
 *   * pure / never throws on bad input
 *   * works with limited data: returns a usable zero-state
 *     row when events is empty
 */

const MS_PER_DAY = 86_400_000;

const TASK_VIEWED    = 'TASK_VIEWED';
const TASK_COMPLETED = 'TASK_COMPLETED';

function _withinWindow(ts, sinceMs) {
  if (sinceMs == null) return true;
  const t = Number(ts);
  return Number.isFinite(t) && t >= sinceMs;
}

export function computeEngagement(events, opts = {}) {
  const { windowDays = 7, now = Date.now() } = opts || {};
  const sinceMs = (Number.isFinite(Number(windowDays)) && Number(windowDays) > 0)
    ? now - Number(windowDays) * MS_PER_DAY
    : null;

  if (!Array.isArray(events) || events.length === 0) {
    return Object.freeze({
      windowDays:     Number(windowDays) || 0,
      totalEvents:    0,
      tasksViewed:    0,
      tasksCompleted: 0,
      completionRate: 0,
      activeFarmers:  0,
    });
  }

  let totalEvents = 0;
  let tasksViewed = 0;
  let tasksCompleted = 0;
  const farmers = new Set();

  for (const e of events) {
    if (!e) continue;
    if (!_withinWindow(e.timestamp, sinceMs)) continue;
    totalEvents += 1;
    if (e.type === TASK_VIEWED)    tasksViewed    += 1;
    if (e.type === TASK_COMPLETED) tasksCompleted += 1;
    const fid = e.payload && e.payload.farmId;
    if (fid != null) farmers.add(String(fid));
  }

  // The numerator is "completed". The denominator is the broader
  // "saw this task at all" signal when present, falling back to
  // total events when TASK_VIEWED isn't being logged yet (the
  // app only auto-logs TASK_COMPLETED + PEST_REPORTED today).
  const denom = tasksViewed > 0 ? tasksViewed : totalEvents;
  const completionRate = denom > 0 ? tasksCompleted / denom : 0;

  return Object.freeze({
    windowDays:     Number(windowDays) || 0,
    totalEvents,
    tasksViewed,
    tasksCompleted,
    completionRate,
    activeFarmers:  farmers.size,
  });
}
