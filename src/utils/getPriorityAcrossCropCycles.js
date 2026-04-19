/**
 * getPriorityAcrossCropCycles — when a farmer has multiple active
 * crop cycles, the Today screen picks ONE primary task across all
 * of them. This module is the cross-cycle ranker.
 *
 *   rankCropCyclesForToday(cycles, now) → sorted cycles by a simple
 *     priority score: overdue count + open-issue count + stage
 *     weight + planting-window proximity.
 *
 *   getPriorityAcrossCropCycles({ cycles, tasksByCycle, issuesByCycle,
 *                                 now }) → { primaryCycleId,
 *                                            rankedCycleIds,
 *                                            scoreByCycleId }
 *
 *   buildUnifiedTodayPayload({ cycles, todayByCycle, now }) →
 *     unified { primaryTask, secondaryTasks, cycleContext[] }
 *     where secondary tasks may come from a second cycle when the
 *     primary cycle's secondary slot is empty.
 *
 * Pure. The Today engine composes per-cycle buildTodayFeed()
 * results and then calls these to produce one screen.
 */

const MS_DAY = 86_400_000;

const STAGE_WEIGHT = {
  harvest_ready: 40,
  flowering:     25,
  growing:       15,
  planting:      20,
  planned:       10,
  delayed:       30,
  failed:         5,
  harvested:      0,
};

function countOverdue(tasks = [], nowMs = Date.now()) {
  return (tasks || []).filter((t) =>
    t?.status === 'pending' && t.dueDate && new Date(t.dueDate).getTime() < nowMs
  ).length;
}

function plantingUrgency(cycle, nowMs) {
  if (!cycle?.plantingDate) return 0;
  const planted = new Date(cycle.plantingDate).getTime();
  if (!Number.isFinite(planted)) return 0;
  const daysSincePlant = (nowMs - planted) / MS_DAY;
  // Newly-planted cycles need attention more than very mature ones.
  if (daysSincePlant < 0)    return 15;            // future planting
  if (daysSincePlant < 7)    return 25;
  if (daysSincePlant < 21)   return 15;
  return 5;
}

export function scoreCycleForToday({ cycle, tasks, issues, nowMs }) {
  const base = STAGE_WEIGHT[cycle?.lifecycleStatus] ?? 10;
  const overdue = countOverdue(tasks, nowMs) * 10;
  const openIssues = (issues || []).filter((i) =>
    ['open', 'in_review'].includes(i.status)
  );
  const issueScore = openIssues.length * 12
    + openIssues.filter((i) => i.severity === 'high').length * 8;
  const plantWindow = plantingUrgency(cycle, nowMs);
  return Math.min(200, base + overdue + issueScore + plantWindow);
}

export function rankCropCyclesForToday(cycles = [], { tasksByCycleId = {}, issuesByCycleId = {}, now = new Date() } = {}) {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const rows = (cycles || []).map((cycle) => ({
    cycle,
    score: scoreCycleForToday({
      cycle,
      tasks: tasksByCycleId[cycle.id] || [],
      issues: issuesByCycleId[cycle.id] || [],
      nowMs,
    }),
  }));
  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tiebreak: most-recent updatedAt first (fresher cycle wins).
    const au = a.cycle.updatedAt ? new Date(a.cycle.updatedAt).getTime() : 0;
    const bu = b.cycle.updatedAt ? new Date(b.cycle.updatedAt).getTime() : 0;
    return bu - au;
  });
  return rows;
}

export function getPriorityAcrossCropCycles(ctx = {}) {
  const ranked = rankCropCyclesForToday(ctx.cycles || [], ctx);
  return {
    primaryCycleId: ranked[0]?.cycle?.id || null,
    rankedCycleIds: ranked.map((r) => r.cycle.id),
    scoreByCycleId: Object.fromEntries(ranked.map((r) => [r.cycle.id, r.score])),
  };
}

/**
 * buildUnifiedTodayPayload — per-cycle Today payloads in, one
 * cross-cycle Today payload out.
 *
 *   todayByCycleId: { [cycleId]: { primaryTask, secondaryTasks, … } }
 *
 * Picks the ranked cycle's primary as the unified primary; if that
 * cycle has an empty secondary slot (or only one), we pull a second
 * secondary from the next-ranked cycle so the farmer sees across
 * their plots without crowding the UI.
 *
 * Each task is decorated with a cycleContext:
 *   { cycleId, cropKey, variety? }
 * so the UI can render a subtle "on tomatoes" chip next to the
 * title without needing a separate lookup.
 */
export function buildUnifiedTodayPayload({ cycles = [], todayByCycleId = {}, tasksByCycleId = {}, issuesByCycleId = {}, now = new Date() } = {}) {
  const ranked = rankCropCyclesForToday(cycles, { tasksByCycleId, issuesByCycleId, now });
  if (!ranked.length) {
    return {
      primaryTask: null,
      secondaryTasks: [],
      cycleContext: [],
      primaryCycleId: null,
    };
  }

  const decorate = (task, cycle) => task ? {
    ...task,
    cycleContext: { cycleId: cycle.id, cropKey: cycle.cropType, variety: cycle.variety || null },
  } : null;

  const top = ranked[0];
  const topPayload = todayByCycleId[top.cycle.id] || {};
  const primary = decorate(topPayload.primaryTask || null, top.cycle);
  const secondaries = (topPayload.secondaryTasks || [])
    .map((t) => decorate(t, top.cycle));

  // Pull one more secondary from the next ranked cycle if we have
  // fewer than 2 secondaries on the primary cycle.
  if (secondaries.length < 2 && ranked.length > 1) {
    for (const other of ranked.slice(1)) {
      const otherPayload = todayByCycleId[other.cycle.id] || {};
      const candidate = otherPayload.primaryTask || otherPayload.secondaryTasks?.[0];
      if (candidate) {
        secondaries.push(decorate(candidate, other.cycle));
        if (secondaries.length >= 2) break;
      }
    }
  }

  return {
    primaryTask: primary,
    secondaryTasks: secondaries.slice(0, 2),
    cycleContext: ranked.map((r) => ({
      cycleId: r.cycle.id,
      cropKey: r.cycle.cropType,
      score: r.score,
      isPrimary: r.cycle.id === top.cycle.id,
    })),
    primaryCycleId: top.cycle.id,
  };
}

export const _internal = { STAGE_WEIGHT, countOverdue, plantingUrgency };
