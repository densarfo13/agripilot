/**
 * responseEngine.js — pure functions that turn a recent-action log
 * plus the current cycle state into deltas the rest of the system
 * uses to update progress %, risk band, and next-action wording.
 *
 *   computeProgress({ tasks })           → { percent, completed, skipped, total }
 *   applyActionToRisk({ action, base })  → new risk level
 *   summarizeBehavior(actions, tasks)    → { completionRate, skipRate, streak, recentIssues }
 *   deriveNextActionHint(summary, stage) → short string (UI fallback if Today engine has no primary)
 *
 * Every output is deterministic and independent of wall time so the
 * Today engine and tests can both rely on it.
 */

import { ACTION_TYPES } from './actionTypes.js';

const RISK_BANDS = ['low', 'medium', 'high'];

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

/**
 * computeProgress — derive cycle-level progress from the task plan.
 * Ignores pending rows for the completion % and surfaces skipped count
 * separately so the UI can show "3 done, 1 skipped".
 */
export function computeProgress({ tasks = [] } = {}) {
  if (!Array.isArray(tasks)) return { percent: 0, completed: 0, skipped: 0, total: 0 };
  let completed = 0;
  let skipped = 0;
  let total = 0;
  for (const t of tasks) {
    if (!t || !t.status) continue;
    total += 1;
    if (t.status === 'completed') completed += 1;
    else if (t.status === 'skipped') skipped += 1;
  }
  const denom = total || 1;
  const percent = Math.round((completed / denom) * 100);
  return { percent, completed, skipped, total };
}

/**
 * applyActionToRisk — nudge the cycle risk band in response to a
 * single new action. The Today engine still recomputes a richer
 * risk from overdue + issue counts; this is the monotonic
 * "direct feedback" channel so a farmer who reports a pest
 * immediately feels the risk tick up.
 */
export function applyActionToRisk({ action, base = 'low' }) {
  const current = RISK_BANDS.includes(String(base)) ? base : 'low';
  if (!action?.actionType) return current;
  const type = action.actionType;

  if (type === ACTION_TYPES.ISSUE_REPORTED) {
    const sev = String(action.details?.severity || 'medium').toLowerCase();
    if (sev === 'high') return 'high';
    if (sev === 'medium' && current === 'low') return 'medium';
    return current;
  }

  if (type === ACTION_TYPES.TASK_COMPLETED) {
    // A completion can only DECREASE risk, and only if the task was
    // flagged important enough (priority high or the task resolved
    // an open issue).
    if (action.details?.priority === 'high' && current === 'medium') return 'low';
    return current;
  }

  if (type === ACTION_TYPES.TASK_SKIPPED) {
    // Skipping tends to bump risk up, bounded at 'high'.
    const reason = String(action.details?.reason || '').toLowerCase();
    if (/weather|rain|heat|wind/.test(reason)) return current;    // weather skip is neutral
    if (current === 'low') return 'medium';
    if (current === 'medium') return 'high';
    return 'high';
  }

  if (type === ACTION_TYPES.HARVEST_REPORTED) {
    // Reporting a harvest ends the growth-risk window for this cycle.
    return 'low';
  }

  return current;
}

/**
 * summarizeBehavior — reduce recent actions + task plan into a tiny
 * object the Today engine can cheaply merge into its scoring inputs.
 *
 *   completionRate    fraction of non-pending tasks that were completed
 *   skipRate          fraction skipped
 *   streak            consecutive completed actions (up to 10)
 *   recentIssueCount  issues reported in the last N actions
 */
export function summarizeBehavior(actions = [], tasks = []) {
  const { completed, skipped, total } = computeProgress({ tasks });
  const resolved = completed + skipped;
  const completionRate = resolved ? completed / resolved : 0;
  const skipRate = resolved ? skipped / resolved : 0;

  // Streak: walk the action log backwards until we hit a non-complete.
  const ordered = [...actions].sort((a, b) => {
    const ta = new Date(a.occurredAt).getTime();
    const tb = new Date(b.occurredAt).getTime();
    return tb - ta;
  });
  let streak = 0;
  for (const a of ordered) {
    if (a.actionType === ACTION_TYPES.TASK_COMPLETED) streak += 1;
    else break;
    if (streak >= 10) break;
  }

  const recentIssueCount = ordered
    .slice(0, 10)
    .filter((a) => a.actionType === ACTION_TYPES.ISSUE_REPORTED).length;

  return {
    completionRate: Number(completionRate.toFixed(3)),
    skipRate: Number(skipRate.toFixed(3)),
    streak,
    recentIssueCount,
    totalCompleted: completed,
    totalSkipped: skipped,
  };
}

/**
 * deriveNextActionHint — short farmer-facing sentence that the Today
 * screen can show when the ranking engine has no primary task left,
 * based purely on behavior summary + cycle stage. Used as a fallback
 * so the screen never feels empty.
 */
export function deriveNextActionHint(summary = {}, stage = 'planted') {
  if (summary.recentIssueCount >= 1) return 'Follow up on the issue you reported.';
  if (summary.skipRate >= 0.5)       return 'Several tasks were skipped — pick one to finish today.';
  if (summary.streak >= 3)           return 'Good streak — stay on it.';
  if (stage === 'harvest_ready')     return 'Your crop is ready — report your harvest.';
  if (stage === 'flowering')         return 'Watch your plants closely during flowering.';
  if (stage === 'growing')           return 'Keep up with weekly care.';
  return 'Review your next planned task.';
}

/**
 * priorityBoostFromIssues — when a new issue is reported, tasks
 * matching its category should rise in the Today ranking. Returns
 * an additive boost (0..20) the ranking pipeline can apply.
 */
export function priorityBoostFromIssues(task, openIssues = []) {
  if (!task || !openIssues.length) return 0;
  const title = String(task.title || '').toLowerCase();
  let boost = 0;
  for (const issue of openIssues) {
    const cat = String(issue.category || '').toLowerCase();
    const sev = String(issue.severity || 'medium').toLowerCase();
    const mult = sev === 'high' ? 1.5 : sev === 'medium' ? 1.0 : 0.5;
    if (cat === 'pest' && /scout|inspect|spray|pest/.test(title))     boost += 10 * mult;
    if (cat === 'disease' && /scout|inspect|spray|leaf/.test(title))  boost += 10 * mult;
    if (cat === 'water' && /water|irrig|mulch|moisture/.test(title))  boost += 8  * mult;
    if (cat === 'soil' && /fertiliz|side-dress|compost|soil/.test(title)) boost += 6 * mult;
  }
  return clamp(Math.round(boost), 0, 20);
}

export const _internal = { RISK_BANDS };
