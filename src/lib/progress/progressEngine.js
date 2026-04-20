/**
 * progressEngine.js — deterministic, offline-first Progress Engine.
 *
 * Turns farmer actions (tasks + completions + feedback) into a
 * simple status snapshot the UI can render:
 *
 *   {
 *     progressScore:          0..100,
 *     status:                 'on_track' | 'slight_delay' | 'high_risk',
 *     completedCount:         number,
 *     totalCount:             number,
 *     stageCompletionPercent: 0..100,
 *     completedTodayCount:    number,
 *     nextBestAction: {
 *       kind:     'task' | 'bridge',
 *       taskId:   string | null,
 *       title:    string | null,        // raw server label (if any)
 *       titleKey: string | null,        // i18n key (if any)
 *       bridgeKey: string | null,       // i18n key for bridge actions
 *       dueHint:  string | null,
 *     },
 *   }
 *
 * Contract:
 *   • no network, no backend dependency — purely a function of inputs
 *   • nextBestAction is NEVER null — when all tasks are complete it
 *     returns a "bridge" action with a localisable key
 *   • status codes are stable strings (UI localises them)
 *   • safe on empty / partial inputs
 *
 * Scoring (intentionally simple — spec §2):
 *   base      = (completed / total) * 60          // up to 60
 *   today ≥ 2 = +15        today ≥ 1 = +10        // one-of, not stacked
 *   stage ≥ 70 = +15       stage ≥ 40 = +8        // one-of
 *   overdue + 0 done today = -20
 *   "not helpful" feedback = -min(10, count*5)
 *   clamp to [0, 100]
 *
 * Status (spec §3):
 *   ≥ 70 → on_track
 *   ≥ 40 → slight_delay
 *     <  → high_risk
 */

export const STATUS = Object.freeze({
  ON_TRACK:     'on_track',
  SLIGHT_DELAY: 'slight_delay',
  HIGH_RISK:    'high_risk',
});

export const STATUS_LABEL_KEY = Object.freeze({
  [STATUS.ON_TRACK]:     'progress.on_track',
  [STATUS.SLIGHT_DELAY]: 'progress.slight_delay',
  [STATUS.HIGH_RISK]:    'progress.high_risk',
});

const BRIDGE_KEY = Object.freeze({
  CHECK_TOMORROW:     'progress.check_tomorrow',
  PREPARE_NEXT_STAGE: 'progress.prepare_next_stage',
});

// ─── Helpers ──────────────────────────────────────────────────────
function clamp(n, lo, hi) {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function toTs(x) {
  if (x == null) return 0;
  if (typeof x === 'number') return x;
  if (x instanceof Date) return x.getTime();
  const n = Date.parse(String(x));
  return Number.isFinite(n) ? n : 0;
}

function sameDay(aTs, bTs) {
  if (!aTs || !bTs) return false;
  const a = new Date(aTs); const b = new Date(bTs);
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

/**
 * Build a Set of taskIds that have been marked completed.
 * Completions with `completed === false` are ignored.
 */
function completedIdSet(completions) {
  const s = new Set();
  for (const c of (completions || [])) {
    if (!c || !c.taskId) continue;
    if (c.completed === false) continue;
    s.add(String(c.taskId));
  }
  return s;
}

function countCompletedToday(completions, now) {
  const nowTs = toTs(now) || Date.now();
  let n = 0;
  for (const c of (completions || [])) {
    if (!c || c.completed === false) continue;
    if (sameDay(toTs(c.timestamp), nowTs)) n += 1;
  }
  return n;
}

function countNotHelpful(feedback) {
  let n = 0;
  for (const f of (feedback || [])) {
    if (f && f.feedback === 'no') n += 1;
  }
  return n;
}

/**
 * Derive stageCompletionPercent from inputs.
 *
 * Preference order:
 *   1. Explicit `stageCompletionPercent` (caller knows best)
 *   2. If tasks carry a `stage` field, compute from the subset that
 *      matches the active stage.
 *   3. Fall back to completedCount / totalCount.
 */
function deriveStagePercent({
  stageCompletionPercent,
  tasks,
  completedIds,
  currentStage,
  completedCount,
  totalCount,
}) {
  if (Number.isFinite(stageCompletionPercent)) {
    return clamp(Math.round(stageCompletionPercent), 0, 100);
  }
  if (currentStage && Array.isArray(tasks)) {
    const stageTasks = tasks.filter(
      (t) => t && (t.stage === currentStage || t.cropStage === currentStage),
    );
    if (stageTasks.length > 0) {
      const doneInStage = stageTasks.filter(
        (t) => completedIds.has(String(t.id)),
      ).length;
      return Math.round((doneInStage / stageTasks.length) * 100);
    }
  }
  if (totalCount > 0) return Math.round((completedCount / totalCount) * 100);
  return 0;
}

// ─── Next best action ─────────────────────────────────────────────
/**
 * getNextBestAction — always returns a usable action.
 *
 *   • First incomplete task (priority-preferred).
 *   • If all complete → bridge action, never empty.
 */
export function getNextBestAction(tasks, completions, opts = {}) {
  const completed = completedIdSet(completions);
  const list = Array.isArray(tasks) ? tasks : [];

  // 1) Priority-sorted scan: high/1 > normal/2 > low/3 (stable for undefined)
  const incomplete = list.filter((t) => t && t.id && !completed.has(String(t.id)));
  incomplete.sort((a, b) => priorityRank(a) - priorityRank(b));

  if (incomplete.length > 0) {
    const t = incomplete[0];
    return {
      kind: 'task',
      taskId: String(t.id),
      title: t.title || null,
      titleKey: t.titleKey || null,
      bridgeKey: null,
      dueHint: t.dueHint || t.due || null,
    };
  }

  // 2) Bridge action — pick the more hopeful message when the farmer
  // is deep into the current stage, otherwise a calm "check tomorrow".
  const stagePct = Number.isFinite(opts.stageCompletionPercent)
    ? opts.stageCompletionPercent : 0;
  const bridgeKey = stagePct >= 80
    ? BRIDGE_KEY.PREPARE_NEXT_STAGE
    : BRIDGE_KEY.CHECK_TOMORROW;

  return {
    kind: 'bridge',
    taskId: null,
    title: null,
    titleKey: null,
    bridgeKey,
    dueHint: null,
  };
}

function priorityRank(task) {
  const p = (task && (task.priority || task.rank)) || '';
  const s = String(p).toLowerCase();
  if (s === 'high' || s === '1' || s === 'primary') return 0;
  if (s === 'low'  || s === '3') return 2;
  return 1; // normal / unknown
}

// ─── Main export ──────────────────────────────────────────────────
/**
 * computeProgress — pure snapshot from the given inputs.
 *
 *   computeProgress({
 *     farm,                    // optional: { id, cropStage, ... }
 *     tasks,                   // array of task-like objects (id required)
 *     completions,             // array of { taskId, farmId?, completed, timestamp }
 *     feedback,                // optional array of { taskId, feedback, timestamp }
 *     stageCompletionPercent,  // optional explicit override
 *     now,                     // optional Date/number for deterministic tests
 *   })
 */
export function computeProgress({
  farm = null,
  tasks = [],
  completions = [],
  feedback = [],
  stageCompletionPercent,
  now,
  // Daily-loop inputs — optional so existing callers keep working.
  // Pass { streak, lastVisit } from the dailyLoop module to surface
  // them on the snapshot without forcing a second call in the UI.
  streak,
  lastVisit,
} = {}) {
  const taskList = Array.isArray(tasks) ? tasks.filter((t) => t && t.id) : [];
  const completedIds = completedIdSet(completions);

  const totalCount = taskList.length;
  // Count completed that are relevant (either in the tasks list, or
  // recorded anyway — the spec counts farmer actions).
  let completedCount = 0;
  if (totalCount > 0) {
    for (const t of taskList) {
      if (completedIds.has(String(t.id))) completedCount += 1;
    }
  } else {
    completedCount = completedIds.size; // still honour raw actions
  }
  // Never report more completions than total when we know total.
  if (totalCount > 0 && completedCount > totalCount) completedCount = totalCount;

  const completedToday = countCompletedToday(completions, now);

  const currentStage = (farm && (farm.cropStage || farm.stage)) || null;
  const stagePct = deriveStagePercent({
    stageCompletionPercent,
    tasks: taskList,
    completedIds,
    currentStage,
    completedCount,
    totalCount,
  });

  // ─── Scoring (spec §2) ───
  const base = totalCount > 0
    ? Math.round((completedCount / totalCount) * 60)
    : 0;

  let bonusToday = 0;
  if (completedToday >= 2) bonusToday = 15;
  else if (completedToday >= 1) bonusToday = 10;

  let bonusStage = 0;
  if (stagePct >= 70) bonusStage = 15;
  else if (stagePct >= 40) bonusStage = 8;

  let penalty = 0;
  const hasOverdue = taskList.some((t) => t && (t.overdue === true || t.isOverdue === true));
  if (hasOverdue && completedToday === 0) penalty -= 20;

  const notHelpful = countNotHelpful(feedback);
  if (notHelpful > 0) penalty -= Math.min(10, notHelpful * 5);

  const progressScore = clamp(base + bonusToday + bonusStage + penalty, 0, 100);

  // ─── Status band (spec §3) ───
  let status = STATUS.HIGH_RISK;
  if (progressScore >= 70) status = STATUS.ON_TRACK;
  else if (progressScore >= 40) status = STATUS.SLIGHT_DELAY;

  // ─── Next best action (spec §4) ───
  const nextBestAction = getNextBestAction(taskList, completions, {
    stageCompletionPercent: stagePct,
  });

  // Daily-loop surface (spec §7). Defaults preserve backward compat.
  const streakVal    = Number.isFinite(streak) ? Math.max(0, Math.floor(streak)) : 0;
  const lastVisitVal = (typeof lastVisit === 'string' && lastVisit) ? lastVisit : null;
  const dailyCompletionFlag = completedToday >= 1;

  return Object.freeze({
    progressScore,
    status,
    completedCount,
    totalCount,
    stageCompletionPercent: stagePct,
    completedTodayCount: completedToday,
    nextBestAction: Object.freeze(nextBestAction),
    // ─── Daily loop ───
    streak:              streakVal,
    lastVisit:           lastVisitVal,
    completedToday,      // alias of completedTodayCount in spec-matching naming
    dailyCompletionFlag,
  });
}

export const _internal = Object.freeze({
  BRIDGE_KEY,
  priorityRank,
  deriveStagePercent,
});

export default computeProgress;
