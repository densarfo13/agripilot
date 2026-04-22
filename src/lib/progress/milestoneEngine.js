/**
 * milestoneEngine.js — lightweight achievement detection.
 *
 *   detectMilestones({ completions, tasks, streak, farm, issues, now })
 *     → Milestone[]
 *
 * Milestone:
 *   { type, title, titleKey, message, messageKey, achievedAt }
 *
 * The engine is deterministic + idempotent — it reports every
 * milestone whose condition currently holds. Persistence is handled
 * by progressTracker, which dedups against a localStorage ledger so
 * the UI only celebrates each milestone once.
 *
 * Kept intentionally small + professional — these are encouragements,
 * not gamification. No XP bars, no confetti per-task.
 */

function countFirstCompletion(completions) {
  if (!Array.isArray(completions)) return 0;
  return completions.filter((c) => c && (c.completed || c.status === 'complete')).length;
}

function uniqueCompletionDays(completions) {
  if (!Array.isArray(completions)) return [];
  const seen = new Set();
  for (const c of completions) {
    if (!c || !(c.completed || c.status === 'complete')) continue;
    const ts = c.timestamp || c.completedAt || c.createdAt;
    const d = new Date(ts || 0);
    if (!Number.isFinite(d.getTime())) continue;
    seen.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return Array.from(seen);
}

function farmIsSetUp(farm) {
  if (!farm || typeof farm !== 'object') return false;
  const crop  = farm.crop || farm.cropType;
  const size  = farm.normalizedAreaSqm || farm.size;
  const stage = farm.cropStage || farm.stage;
  const country = farm.countryCode || farm.country;
  return !!(crop && size && stage && country);
}

export function detectMilestones({
  completions = [],
  tasks       = [],
  streak      = null,
  farm        = null,
  issues      = [],
  now         = null,
} = {}) {
  const found = [];
  const completedCount = countFirstCompletion(completions);
  const uniqueDays = uniqueCompletionDays(completions);

  // First task completed — "Great start"
  if (completedCount >= 1) {
    found.push({
      type:       'first_task_completed',
      titleKey:   'progress.milestone.firstTask.title',
      title:      'Great start',
      messageKey: 'progress.milestone.firstTask.message',
      message:    'You completed your first task — the habit starts here.',
    });
  }

  // 3-day streak
  if (streak && streak.longestStreak >= 3) {
    found.push({
      type:       'streak_3',
      titleKey:   'progress.milestone.streak3.title',
      title:      '3 days in a row',
      messageKey: 'progress.milestone.streak3.message',
      message:    'Three days of consistent action — your farm is noticing.',
    });
  }

  // 7-day streak
  if (streak && streak.longestStreak >= 7) {
    found.push({
      type:       'streak_7',
      titleKey:   'progress.milestone.streak7.title',
      title:      '7 days active',
      messageKey: 'progress.milestone.streak7.message',
      message:    'A full week of action — you\u2019re building real momentum.',
    });
  }

  // Unique active days milestones (monthly cadence)
  if (uniqueDays.length >= 30) {
    found.push({
      type:       'active_30_days',
      titleKey:   'progress.milestone.active30.title',
      title:      '30 active days',
      messageKey: 'progress.milestone.active30.message',
      message:    '30 days of care — your consistency is paying off.',
    });
  }

  // First issue reported (from the issues log, any entry counts)
  if (Array.isArray(issues) && issues.length >= 1) {
    found.push({
      type:       'first_issue_reported',
      titleKey:   'progress.milestone.firstIssue.title',
      title:      'First issue logged',
      messageKey: 'progress.milestone.firstIssue.message',
      message:    'Logging issues keeps the farm\u2019s history clear. Well done.',
    });
  }

  // Farm fully set up (crop + area + stage + country)
  if (farmIsSetUp(farm)) {
    found.push({
      type:       'farm_setup_complete',
      titleKey:   'progress.milestone.setup.title',
      title:      'Farm fully set up',
      messageKey: 'progress.milestone.setup.message',
      message:    'Your farm profile is complete — we can now tailor tasks and tips.',
    });
  }

  // First harvest recorded (a task of type 'harvest' that's complete,
  // or a completion with template id harvest.*)
  const harvested =
       (Array.isArray(tasks) && tasks.some((t) => t && t.type === 'harvest' && t.status === 'complete'))
    || (Array.isArray(completions) && completions.some((c) => c && typeof c.taskId === 'string' && /harvest\./.test(c.taskId)));
  if (harvested) {
    found.push({
      type:       'first_harvest_recorded',
      titleKey:   'progress.milestone.harvest.title',
      title:      'First harvest recorded',
      messageKey: 'progress.milestone.harvest.message',
      message:    'Harvest logged — a real milestone for your farm.',
    });
  }

  const ts = new Date(now || Date.now()).toISOString();
  return found.map((m) => Object.freeze({ ...m, achievedAt: ts }));
}

export const _internal = Object.freeze({
  countFirstCompletion, uniqueCompletionDays, farmIsSetUp,
});
