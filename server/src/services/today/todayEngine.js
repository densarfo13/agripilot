/**
 * todayEngine.js — pure function that picks the single primary
 * task, up to two secondary tasks, risk alerts, and a nextAction
 * summary from a farmer's live context.
 *
 * TaskPriority =
 *     urgency
 *   + riskImpact
 *   + stageRelevance
 *   + overdueBoost
 *   + issueBoost
 *   + seasonalBoost
 *   - complexityPenalty
 *
 * Risk overrides — if any of these fire, the primary slot is
 * replaced with the most relevant synthetic task:
 *   heat risk, pest issue, overdue planting, multiple overdue tasks.
 *
 * Output:
 *   { primaryTask, secondaryTasks[], riskAlerts[],
 *     nextActionSummary, overdueTasksCount, timeEstimateMinutes }
 */

import { getCropStageOverlay } from './cropTaskTemplates.js';

/** Numeric urgency value by priority string. */
const URGENCY = { high: 35, medium: 20, low: 8 };

/** How much a crop-template overlay boosts the matching pending task. */
const STAGE_MATCH_BOOST = 12;

/** Title keywords that mark planting-type tasks for override logic. */
const PLANTING_KEYWORDS = /plant|transplant|sow|seed\s*in|seedling/i;

/** ETA heuristic — mirrors src/lib/taskWording.js on the client. */
function estimateMinutes(task) {
  if (!task) return 15;
  const title = String(task.title || '').toLowerCase();
  if (/scout|check|moisture/.test(title)) return 10;
  if (/plant|sow|transplant/.test(title)) return 30;
  if (/mulch|feed|side-dress/.test(title)) return 25;
  if (/weed/.test(title)) return 35;
  if (/stake|cage|train/.test(title)) return 20;
  if (/harvest/.test(title)) return 45;
  if (/thin/.test(title)) return 10;
  if (task.priority === 'high') return 30;
  if (task.priority === 'low')  return 10;
  return 15;
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function dayDiff(a, b) {
  return Math.floor((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
}

/**
 * @param {Object} ctx
 * @param {Array}  ctx.pendingTasks       CycleTaskPlan rows (status='pending')
 * @param {Object} [ctx.cycle]            V2CropCycle row (stage + dates)
 * @param {Object} [ctx.cropProfile]      Crop profile (heatTolerance etc.)
 * @param {string} [ctx.cropKey]          Canonical crop key (e.g. 'tomato')
 * @param {string} [ctx.riskLevel]        'low' | 'medium' | 'high'
 * @param {string} [ctx.climateSubregion]
 * @param {number} [ctx.currentMonth]     1..12
 * @param {number} [ctx.progressPercent]  0..100
 * @param {Array}  [ctx.openIssues]       IssueReport rows { category, severity, status }
 * @param {number} [ctx.heatBandLevel]    0..1 (state heat band)
 * @param {Date}   [ctx.now]
 */
export function buildTodayFeed(ctx = {}) {
  const now = ctx.now instanceof Date ? ctx.now : new Date();
  const pending = Array.isArray(ctx.pendingTasks) ? ctx.pendingTasks.slice() : [];

  // ─── 1. Score every candidate ────────────────────────────
  const scored = pending.map((task) => ({
    task, ...scoreTask({ task, ctx, now }),
  }));

  // Sort highest-priority first; deterministic tiebreaker on dueDate.
  scored.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    const aDue = a.task.dueDate ? new Date(a.task.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.task.dueDate ? new Date(b.task.dueDate).getTime() : Number.POSITIVE_INFINITY;
    return aDue - bDue;
  });

  // ─── 2. Risk overrides ──────────────────────────────────
  const overrides = buildRiskOverrides({ ctx, scored, now });

  // If an override wins outright, the original top task becomes the
  // first secondary. Otherwise the top-scored task becomes primary.
  let primary = overrides.length ? overrides[0] : scored[0]?.task || null;
  if (primary && overrides.length && scored[0]?.task && overrides[0].id !== scored[0].task.id) {
    scored.unshift({ task: scored[0].task, priorityScore: 0, parts: {} }); // keep the original in the pool
  }

  // ─── 3. Secondary tasks — top two that aren't the primary ─
  const secondaryTasks = [];
  for (const entry of scored) {
    if (secondaryTasks.length >= 2) break;
    if (primary && entry.task?.id === primary.id) continue;
    secondaryTasks.push(entry.task);
  }

  // ─── 4. Risk alerts — one compact line per active concern ─
  const riskAlerts = buildRiskAlerts({ ctx, now, overdueCount: countOverdue(pending, now) });

  // ─── 5. Next action summary ──────────────────────────────
  const overdueTasksCount = countOverdue(pending, now);
  const nextActionSummary = primary
    ? buildNextActionSummary({ primary, overdueTasksCount, riskAlerts })
    : (riskAlerts.length ? riskAlerts[0] : null);

  return {
    primaryTask: primary ? shapeTask(primary) : null,
    secondaryTasks: secondaryTasks.map(shapeTask),
    riskAlerts,
    nextActionSummary,
    overdueTasksCount,
    timeEstimateMinutes: primary ? estimateMinutes(primary) : null,
    priorityScore: primary ? (scored.find((s) => s.task?.id === primary.id)?.priorityScore ?? null) : null,
    debug: { scored: scored.slice(0, 5).map((s) => ({ id: s.task?.id, score: s.priorityScore, parts: s.parts })) },
  };
}

// ─── Helpers ──────────────────────────────────────────────

function scoreTask({ task, ctx, now }) {
  const parts = {
    urgency: URGENCY[String(task.priority || 'medium').toLowerCase()] ?? URGENCY.medium,
    riskImpact: riskImpactFor(ctx),
    stageRelevance: stageRelevanceFor({ task, ctx }),
    overdueBoost: overdueBoostFor({ task, now }),
    issueBoost: issueBoostFor({ task, ctx }),
    seasonalBoost: seasonalBoostFor({ task, ctx }),
    complexityPenalty: complexityPenaltyFor(task),
  };
  const priorityScore = clamp(
    parts.urgency + parts.riskImpact + parts.stageRelevance
    + parts.overdueBoost + parts.issueBoost + parts.seasonalBoost
    - parts.complexityPenalty,
    0, 100,
  );
  return { priorityScore: Math.round(priorityScore), parts };
}

function riskImpactFor(ctx) {
  const lvl = String(ctx?.riskLevel || 'low').toLowerCase();
  return lvl === 'high' ? 18 : lvl === 'medium' ? 9 : 0;
}

function stageRelevanceFor({ task, ctx }) {
  const stage = ctx?.cycle?.lifecycleStatus || 'planned';
  const overlay = getCropStageOverlay({ cropKey: ctx?.cropKey, stage });
  if (!overlay) return 0;
  const overlayTitleLower = overlay.title.toLowerCase();
  const taskTitleLower = String(task.title || '').toLowerCase();
  // Substring match either way so "Plant tomatoes deep and stake" and
  // "Plant seeds or seedlings" both qualify as stage-relevant.
  if (overlayTitleLower.includes(taskTitleLower.slice(0, 10))
      || taskTitleLower.includes(overlayTitleLower.slice(0, 10))) {
    return STAGE_MATCH_BOOST + (overlay.priorityBoost || 0);
  }
  return overlay.priorityBoost || 0;
}

function overdueBoostFor({ task, now }) {
  if (!task.dueDate) return 0;
  const days = dayDiff(now, task.dueDate);
  if (days <= 0) return 0;        // not overdue
  if (days <= 3) return 12;
  if (days <= 7) return 18;
  return 24;                      // >7 days overdue
}

function issueBoostFor({ task, ctx }) {
  const issues = ctx?.openIssues || [];
  if (!issues.length) return 0;
  const taskTitle = String(task.title || '').toLowerCase();
  let boost = 0;
  for (const issue of issues) {
    const cat = String(issue.category || '').toLowerCase();
    if (cat === 'pest' && /scout|pest|spray/.test(taskTitle)) boost += 10;
    if (cat === 'water' && /water|irrig|mulch/.test(taskTitle)) boost += 8;
    if (cat === 'disease' && /scout|inspect|spray/.test(taskTitle)) boost += 10;
  }
  return Math.min(20, boost);
}

function seasonalBoostFor({ task, ctx }) {
  // Rough seasonal sweetener: if the task mentions harvest in the
  // right month range for the cycle, nudge the score up.
  if (!task.dueDate) return 0;
  const month = new Date(task.dueDate).getMonth() + 1;
  const currentMonth = ctx?.currentMonth || (new Date().getMonth() + 1);
  if (Math.abs(month - currentMonth) <= 1 && /harvest|pick/.test(String(task.title || '').toLowerCase())) {
    return 6;
  }
  return 0;
}

function complexityPenaltyFor(task) {
  const title = String(task.title || '').toLowerCase();
  // Penalize "prep" style tasks when higher-urgency work exists.
  if (/defoliate|renovate|orchard/.test(title)) return 8;
  if (task.priority === 'low') return 4;
  return 0;
}

// ─── Risk overrides ──────────────────────────────────────

function buildRiskOverrides({ ctx, scored, now }) {
  const overrides = [];

  // 1. Heat risk — crop heat tolerance low + state heat band high.
  if ((ctx?.cropProfile?.heatTolerance === 'low') && (ctx?.heatBandLevel ?? 0) >= 0.7) {
    overrides.push(syntheticTask({
      id: 'override:heat',
      title: 'Shade or water your crop — heat stress is high',
      detail: 'Afternoon shade cloth and a deeper morning water help.',
      priority: 'high',
      source: 'override:heat',
    }));
    return overrides;
  }

  // 2. Overdue planting — a planting-type task is more than 3 days overdue.
  const overduePlanting = scored.find((s) => {
    if (!s.task.dueDate) return false;
    if (!PLANTING_KEYWORDS.test(s.task.title || '')) return false;
    return dayDiff(now, s.task.dueDate) > 3;
  });
  if (overduePlanting) {
    overrides.push(overduePlanting.task);
    return overrides;
  }

  // 3. Open high-severity pest / disease issue → surface scouting.
  const pestIssue = (ctx?.openIssues || []).find(
    (i) => (i.category === 'pest' || i.category === 'disease')
        && i.severity === 'high'
        && (i.status === 'open' || i.status === 'in_review'),
  );
  if (pestIssue) {
    overrides.push(syntheticTask({
      id: 'override:pest',
      title: 'Address the open pest/disease issue',
      detail: 'Walk the rows, take photos, and decide on a treatment today.',
      priority: 'high',
      source: 'override:pest',
    }));
    return overrides;
  }

  // 4. Multiple overdue tasks (3+) → surface a catch-up block.
  const overdueTasks = scored.filter((s) =>
    s.task.dueDate && dayDiff(now, s.task.dueDate) > 0
  );
  if (overdueTasks.length >= 3) {
    overrides.push(syntheticTask({
      id: 'override:catchup',
      title: `Catch up — ${overdueTasks.length} tasks are overdue`,
      detail: 'Pick the highest-impact one from below and finish it first.',
      priority: 'high',
      source: 'override:catchup',
    }));
    return overrides;
  }

  return overrides;
}

function syntheticTask({ id, title, detail, priority, source }) {
  return {
    id, title, detail, priority,
    status: 'pending',
    dueDate: null,
    isTodayTask: true,
    source,
  };
}

function countOverdue(tasks, now) {
  if (!Array.isArray(tasks)) return 0;
  let n = 0;
  for (const t of tasks) {
    if (t.status !== 'pending') continue;
    if (t.dueDate && new Date(t.dueDate).getTime() < now.getTime()) n += 1;
  }
  return n;
}

function buildRiskAlerts({ ctx, now, overdueCount }) {
  const alerts = [];
  if (ctx?.riskLevel === 'high') alerts.push('Your crop cycle is high risk');
  if (overdueCount >= 3) alerts.push(`${overdueCount} overdue tasks stalling the cycle`);
  else if (overdueCount > 0) alerts.push(`${overdueCount} overdue task${overdueCount > 1 ? 's' : ''}`);
  const highSev = (ctx?.openIssues || []).filter((i) =>
    i.severity === 'high' && (i.status === 'open' || i.status === 'in_review'));
  if (highSev.length) alerts.push(`${highSev.length} open high-severity issue${highSev.length > 1 ? 's' : ''}`);
  if ((ctx?.cropProfile?.heatTolerance === 'low') && (ctx?.heatBandLevel ?? 0) >= 0.7) {
    alerts.push('Heat risk is high today');
  }
  return alerts;
}

function buildNextActionSummary({ primary, overdueTasksCount, riskAlerts }) {
  if (!primary) return null;
  if (primary.source === 'override:catchup') return `Finish ${overdueTasksCount} overdue tasks — start with the highest priority.`;
  if (primary.source === 'override:pest') return 'Walk the rows today and act on the pest issue.';
  if (primary.source === 'override:heat') return 'Keep your crop watered and shaded today.';
  return primary.title;
}

function shapeTask(task) {
  if (!task) return null;
  return {
    id: task.id,
    title: task.title,
    detail: task.detail || null,
    priority: task.priority || 'medium',
    dueDate: task.dueDate || null,
    timeEstimateMinutes: estimateMinutes(task),
    source: task.source || null,
  };
}

export const _internal = { URGENCY, STAGE_MATCH_BOOST };
