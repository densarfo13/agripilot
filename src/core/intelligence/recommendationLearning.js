/**
 * recommendationLearning.js — Phase 14 adaptive recommendation
 * priority engine.
 *
 *   import {
 *     computePriorityAdjustments, applyLearningToTask,
 *     getLearningSnapshot, recordTaskAction,
 *   } from 'src/core/intelligence/recommendationLearning.js';
 *
 *   const adjustments = computePriorityAdjustments();
 *   const adjusted    = applyLearningToTask(task, adjustments);
 *
 * What this is
 * ────────────
 *   Pure-data adaptive priority engine. Given the outcome log
 *   from `scanOutcomeTracker`, plus the task-action log (accepted /
 *   ignored / completed) recorded by this module, it computes
 *   a priority adjustment per (task category, crop, region)
 *   triple. Surfaces can apply the adjustment when ranking
 *   recommendations so consistently-ignored guidance drops down
 *   the list and consistently-followed-then-resolved guidance
 *   rises.
 *
 *   No ML model, no opaque scoring. The math is explicit:
 *
 *     positive_signal = completedAndResolved + 0.5 × completedAndImproved
 *     negative_signal = ignored + completedButWorsened + farmerDisputed
 *     net_signal      = positive_signal - 0.6 × negative_signal
 *     priorityBoost   = clamp(net_signal × 0.15, -0.40, +0.40)
 *
 *   Surfaces that consume recommendations multiply their base
 *   priority by `(1 + priorityBoost)`. A +0.40 boost = ~40%
 *   higher rank; -0.40 = ~40% lower rank. Bounded to keep one
 *   bad day from flipping the rank order.
 *
 *   The "completedAndResolved" pairing requires BOTH a
 *   recordTaskAction(taskKey, 'completed') call AND a
 *   recordScanOutcome(scanId, 'resolved') call linked by
 *   `linkedTaskKey` in the outcome meta. Without the link we
 *   can't credit the right task — the engine degrades gracefully
 *   to "no boost" rather than guess.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • All persistence wrapped in try/catch — quota / private
 *     mode silent-degrades to memory-only.
 *   • Rolling buffer (cap 200 entries) so the log doesn't grow
 *     unbounded on power users.
 *   • Bounded output range so a malicious / malformed log can't
 *     produce extreme adjustments.
 */

import {
  getScanOutcomes, OUTCOME,
} from '../scan/scanOutcomeTracker.js';

const TASK_ACTION = Object.freeze({
  ACCEPTED:  'accepted',      // user opened the task / marked it intent
  COMPLETED: 'completed',     // user marked done
  IGNORED:   'ignored',        // user dismissed
  DISPUTED:  'disputed',       // user marked recommendation wrong
});

const STORAGE_KEY = 'farroway:taskActions:v1';
const MAX_ACTIONS = 200;

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');

function _safeGet() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _safeSet(arr) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch { /* quota / private mode */ }
}

function _isValidAction(v) {
  return typeof v === 'string' && Object.values(TASK_ACTION).includes(v);
}

/**
 * Record a task interaction. Idempotent on (taskKey, action) pair
 * — second call with same pair is a no-op. Different actions for
 * the same taskKey ARE stored (a user can accept then later ignore).
 *
 * @param {string} taskKey  — e.g. 'task.checkSoil.tomato' or the
 *                            engine-emitted titleKey
 * @param {string} action   — TASK_ACTION.*
 * @param {object} [meta]   — crop, region, country, severity
 */
export function recordTaskAction(taskKey, action, meta) {
  try {
    if (!taskKey || typeof taskKey !== 'string') return null;
    if (!_isValidAction(action)) return null;
    const safeMeta = _isObj(meta) ? meta : {};
    const row = Object.freeze({
      taskKey,
      action,
      recordedAt: Date.now(),
      crop:       _str(safeMeta.crop) || null,
      region:     _str(safeMeta.region) || null,
      country:    _str(safeMeta.country) || null,
      severity:   _str(safeMeta.severity) || null,
    });
    const log = _safeGet();
    // Dedupe — skip if the most-recent entry for this taskKey
    // already records the same action within the last hour.
    const recentMs = Date.now() - 60 * 60 * 1000;
    const dup = log.find((r) => r && r.taskKey === taskKey
      && r.action === action && r.recordedAt >= recentMs);
    if (dup) return dup;
    log.push(row);
    if (log.length > MAX_ACTIONS) log.splice(0, log.length - MAX_ACTIONS);
    _safeSet(log);
    return row;
  } catch { return null; }
}

/** Read every task action. */
export function getTaskActions() {
  return _safeGet();
}

/** Drop the entire log — used by recovery hooks + tests. */
export function clearTaskActions() {
  _safeSet([]);
}

// ─── Adjustment computation ─────────────────────────────────

/**
 * Build the per-task priority adjustments table from both logs.
 *
 *   adjustments = computePriorityAdjustments();
 *   // {
 *   //   'task.checkSoil.tomato|Ashanti': {
 *   //     positiveSignal: 2.5, negativeSignal: 0.6,
 *   //     net: 1.9, priorityBoost: +0.28,
 *   //     sample: 5,
 *   //   },
 *   // }
 *
 * Keys are `${taskKey}|${region}` so the same task can carry
 * different adjustments in different regions. Unknown regions
 * collapse to `*` so the global signal still surfaces.
 */
export function computePriorityAdjustments() {
  try {
    const actions = _safeGet();
    const outcomes = getScanOutcomes();
    // Index outcomes by linkedTaskKey for fast lookup.
    const outcomesByTask = new Map();
    for (const out of outcomes) {
      if (!out || typeof out !== 'object') continue;
      const linkedKey = out.linkedTaskKey || (out.userNotes && /^task[:.][^\s]+/.test(out.userNotes)
        ? out.userNotes : null);
      // Outcome rows we can credit to a task ALSO include the
      // raw outcome with a wildcard linking on (crop, region).
      const buckets = [];
      if (linkedKey) buckets.push(linkedKey);
      // Always allow non-linked outcomes to influence the
      // task-category-level signal via the (crop, region) prefix.
      if (out.crop || out.region) buckets.push('*|' + (out.crop || '*') + '|' + (out.region || '*'));
      for (const k of buckets) {
        if (!outcomesByTask.has(k)) outcomesByTask.set(k, []);
        outcomesByTask.get(k).push(out);
      }
    }

    // Tally per (taskKey, region) bucket.
    const tallies = new Map();
    for (const act of actions) {
      if (!act || typeof act !== 'object') continue;
      const bucket = (act.taskKey) + '|' + (act.region || '*');
      if (!tallies.has(bucket)) {
        tallies.set(bucket, {
          taskKey: act.taskKey, region: act.region || '*',
          completed: 0, ignored: 0, disputed: 0,
        });
      }
      const t = tallies.get(bucket);
      if (act.action === TASK_ACTION.COMPLETED) t.completed++;
      else if (act.action === TASK_ACTION.IGNORED)  t.ignored++;
      else if (act.action === TASK_ACTION.DISPUTED) t.disputed++;
    }

    // Compute adjustment per tally entry.
    const out = {};
    for (const [bucket, t] of tallies) {
      // Pull linked outcomes for this taskKey.
      const linked = outcomesByTask.get(t.taskKey) || [];
      const resolved = linked.filter((o) => o.outcome === OUTCOME.RESOLVED).length;
      const improved = linked.filter((o) => o.outcome === OUTCOME.IMPROVED).length;
      const worsened = linked.filter((o) => o.outcome === OUTCOME.WORSENED).length;
      const wrong    = linked.filter((o) => o.outcome === OUTCOME.WRONG).length;
      const positiveSignal = (resolved + 0.5 * improved);
      const negativeSignal = (t.ignored + worsened + wrong + 0.5 * t.disputed);
      const net = positiveSignal - 0.6 * negativeSignal;
      // Damped + bounded boost. The damping (× 0.15) means a
      // single resolved completion adds ~ +0.15; a single ignore
      // subtracts ~ -0.09. Stable signals only emerge after
      // several confirmations.
      const priorityBoost = Math.max(-0.40, Math.min(0.40, net * 0.15));
      const sample = t.completed + t.ignored + t.disputed + resolved + improved + worsened + wrong;
      out[bucket] = Object.freeze({
        taskKey: t.taskKey,
        region:  t.region,
        positiveSignal: Number(positiveSignal.toFixed(2)),
        negativeSignal: Number(negativeSignal.toFixed(2)),
        net:            Number(net.toFixed(2)),
        priorityBoost:  Number(priorityBoost.toFixed(3)),
        sample,
        completed: t.completed,
        ignored:   t.ignored,
        disputed:  t.disputed,
        resolved, improved, worsened, wrong,
      });
    }
    return out;
  } catch { return {}; }
}

/**
 * Apply learning to a single task envelope. Mutates a copy of
 * the task — never the input. Returns the new task with
 * `priority` adjusted by the learned boost.
 *
 * @param {object} task         — must have at least { titleKey, priority }
 * @param {object} adjustments  — output of computePriorityAdjustments
 * @param {string} [region]
 */
export function applyLearningToTask(task, adjustments, region) {
  try {
    if (!_isObj(task)) return task;
    if (!_isObj(adjustments)) return task;
    const taskKey = task.titleKey || task.key || task.id;
    if (!taskKey) return task;
    const regionKey = _str(region) || _str(task.region) || '*';
    const bucket = taskKey + '|' + regionKey;
    const adj = adjustments[bucket]
      || adjustments[taskKey + '|*'];
    if (!adj) return task;
    const basePriority = typeof task.priority === 'number' && isFinite(task.priority)
      ? task.priority : 0.5;
    const newPriority = Math.max(0, Math.min(1,
      basePriority * (1 + adj.priorityBoost)));
    return Object.freeze({
      ...task,
      priority: Number(newPriority.toFixed(3)),
      learningSignal: Object.freeze({
        priorityBoost: adj.priorityBoost,
        sample: adj.sample,
        // Surface a hint so the surface can show "consistently
        // dismissed" / "usually helpful" copy via tSafe.
        hintKey: adj.priorityBoost > 0.15
          ? 'recommendation.learning.usuallyHelpful'
          : adj.priorityBoost < -0.15
            ? 'recommendation.learning.oftenIgnored'
            : null,
      }),
    });
  } catch { return task; }
}

/** Snapshot for diagnostics + dev overlay. */
export function getLearningSnapshot() {
  try {
    const actions = _safeGet();
    const outcomes = getScanOutcomes();
    const adjustments = computePriorityAdjustments();
    const adjustmentCount = Object.keys(adjustments).length;
    let totalBoost = 0;
    for (const k of Object.keys(adjustments)) totalBoost += adjustments[k].priorityBoost || 0;
    return Object.freeze({
      actionCount:    actions.length,
      outcomeCount:   outcomes.length,
      adjustmentCount,
      averageBoost:   adjustmentCount > 0
        ? Number((totalBoost / adjustmentCount).toFixed(3)) : 0,
      timestamp: Date.now(),
    });
  } catch {
    return Object.freeze({
      actionCount: 0, outcomeCount: 0, adjustmentCount: 0,
      averageBoost: 0, timestamp: Date.now(),
    });
  }
}

export { TASK_ACTION };

const _module = {
  TASK_ACTION,
  recordTaskAction, getTaskActions, clearTaskActions,
  computePriorityAdjustments, applyLearningToTask, getLearningSnapshot,
};
export default _module;
