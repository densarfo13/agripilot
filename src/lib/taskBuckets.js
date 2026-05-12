/**
 * taskBuckets.js — group scan tasks into three calm buckets so the
 * farmer never feels overwhelmed.
 *
 *   const buckets = bucketTasks(getActiveScanTasks());
 *   // → { doNow: [...], thisWeek: [...], monitor: [...] }
 *
 * Spec §3 — Task simplification
 * ─────────────────────────────
 *   "Do now"     — overdue, OR high urgency, OR due in the next 24h.
 *                  These belong on screen first.
 *
 *   "This week"  — due in the next 7 days at medium urgency, OR any
 *                  pending task with no due date AND medium urgency.
 *
 *   "Monitor"    — low urgency tasks, follow-up "re-check"
 *                  reminders, and anything that's just a watchful-
 *                  eye item rather than a treatment.
 *
 *   "AI should suppress low-value tasks" — we don't *delete* tasks
 *   that look low-value, but we DO put them in the Monitor bucket
 *   where the UI can render them collapsed by default.
 *
 * Strict-rule audit
 *   • Pure function. Never throws.
 *   • Stable sort within each bucket: due-soonest first, then
 *     higher urgency.
 *   • Completed tasks are skipped at the top — bucketing operates
 *     only on the open queue.
 */

const _MS_PER_DAY = 24 * 60 * 60 * 1000;

const _URGENCY_RANK = Object.freeze({ high: 3, medium: 2, low: 1 });

function _norm(v) {
  return String(v == null ? '' : v).toLowerCase().trim();
}

function _dueMs(task) {
  if (!task || !task.dueAt) return null;
  const t = Date.parse(String(task.dueAt));
  return Number.isNaN(t) ? null : t;
}

function _sortKey(task, nowMs) {
  const dueMs = _dueMs(task);
  // Soonest due first; tasks with no due date go to the END of the
  // bucket so the user reads the time-sensitive items first.
  const dueScore = dueMs == null ? Number.POSITIVE_INFINITY : Math.max(0, dueMs - nowMs);
  const urgencyScore = -(_URGENCY_RANK[_norm(task && task.urgency)] || 0);
  return [dueScore, urgencyScore];
}

function _sortTasks(arr, nowMs) {
  arr.sort((a, b) => {
    const [da, ua] = _sortKey(a, nowMs);
    const [db, ub] = _sortKey(b, nowMs);
    if (da !== db) return da - db;
    return ua - ub;
  });
  return arr;
}

/**
 * @param {Array<object>} tasks    — scanToTask entries
 * @param {object} [options]
 * @param {number} [options.nowMs] — injection point for tests
 * @returns {{ doNow: Array, thisWeek: Array, monitor: Array }}
 */
export function bucketTasks(tasks, options = {}) {
  const list = Array.isArray(tasks) ? tasks : [];
  const nowMs = (typeof options.nowMs === 'number') ? options.nowMs : Date.now();

  const doNow    = [];
  const thisWeek = [];
  const monitor  = [];

  for (const t of list) {
    if (!t || typeof t !== 'object') continue;
    if (t.completed) continue;

    const urgency = _norm(t.urgency);
    const dueMs   = _dueMs(t);
    const dueDelta = dueMs == null ? null : (dueMs - nowMs);

    // ── Do now ─────────────────────────────────────────────
    // overdue OR high-urgency OR due-within-24h.
    if (dueDelta != null && dueDelta <= _MS_PER_DAY) {
      doNow.push(t);
      continue;
    }
    if (urgency === 'high') {
      doNow.push(t);
      continue;
    }

    // ── Monitor ────────────────────────────────────────────
    // low urgency OR follow-up re-check task.
    if (urgency === 'low' || t.isFollowUp === true) {
      monitor.push(t);
      continue;
    }

    // ── This week (default) ────────────────────────────────
    // Anything else with medium urgency, or a due date inside
    // the next 7 days that didn't already hit Do-Now.
    if (dueDelta == null || dueDelta <= 7 * _MS_PER_DAY) {
      thisWeek.push(t);
    } else {
      // Due further out than a week — push to Monitor so the
      // user isn't asked to think about it yet.
      monitor.push(t);
    }
  }

  return {
    doNow:    _sortTasks(doNow, nowMs),
    thisWeek: _sortTasks(thisWeek, nowMs),
    monitor:  _sortTasks(monitor, nowMs),
  };
}

/**
 * Total count of open tasks across the three buckets — handy for
 * dashboard tiles that want a "Y open tasks" headline.
 *
 * @param {ReturnType<bucketTasks>} buckets
 * @returns {number}
 */
export function totalOpenTaskCount(buckets) {
  if (!buckets || typeof buckets !== 'object') return 0;
  return (buckets.doNow    || []).length
       + (buckets.thisWeek || []).length
       + (buckets.monitor  || []).length;
}

export default { bucketTasks, totalOpenTaskCount };
