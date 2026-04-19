/**
 * feedbackService.js — thin persistence + orchestration layer for the
 * farmer action feedback loop. Sits between the route/service layer
 * and the pure feedback helpers in this folder.
 *
 * Exposes:
 *   logAction(prisma, action)            → persist normalized action
 *   getRecentActions(prisma, filter)     → reads for the Today engine
 *   recordTaskCompleted(prisma, args)    → completes + logs + risk
 *   recordTaskSkipped(prisma, args)      → skips + logs + risk
 *   recordIssueReported(prisma, args)    → logs (IssueReport is written
 *                                          elsewhere, we only mirror it)
 *   recordHarvestOutcome(prisma, args)   → writes HarvestOutcome
 *
 * Each function tolerates a Prisma client that doesn't yet have the
 * two new tables migrated (farmer_action_logs, harvest_outcomes) — the
 * catch-and-continue paths let the feedback loop run in a degraded
 * "no persistence" mode until `prisma migrate dev` is run.
 */

import { ACTION_TYPES, normalizeAction } from './actionTypes.js';
import { applyActionToRisk } from './responseEngine.js';
import { computeHarvestOutcome } from './harvestOutcome.js';

/**
 * persistCycleRisk(prisma, cycleId, action)
 *
 * After every action we recompute the action-driven risk band and
 * write it to `V2CropCycle.riskBand`. Swallows errors if the column
 * hasn't been migrated yet — the ranking pipeline still works off
 * the fresh `riskLevel` derived in cropCycleService.
 */
async function persistCycleRisk(prisma, cycleId, action) {
  if (!cycleId) return null;
  try {
    const cycle = await prisma.v2CropCycle.findUnique({
      where: { id: cycleId },
      select: { id: true, riskBand: true },
    });
    if (!cycle) return null;
    const next = applyActionToRisk({ action, base: cycle.riskBand || 'low' });
    if (next === cycle.riskBand) return next;
    await prisma.v2CropCycle.update({
      where: { id: cycleId },
      data: { riskBand: next },
    });
    return next;
  } catch {
    return null; // pre-migration: no-op
  }
}

// ─── generic action logging ────────────────────────────────

export async function logAction(prisma, raw) {
  const action = normalizeAction(raw);
  if (!action) return null;
  try {
    const row = await prisma.farmerActionLog.create({
      data: {
        actionType: action.actionType,
        subjectType: action.subjectType,
        subjectId: action.subjectId,
        farmProfileId: action.farmProfileId,
        cropCycleId: action.cropCycleId,
        userId: action.userId,
        details: action.details,
        occurredAt: new Date(action.occurredAt),
      },
    });
    return row;
  } catch (err) {
    // Model not migrated yet → log once and continue. The pure
    // feedback logic still runs; it just isn't persisted.
    if (String(err?.code || '').startsWith('P20') || /no such table|does not exist/i.test(String(err?.message || ''))) {
      return null;
    }
    throw err;
  }
}

export async function getRecentActions(prisma, { farmProfileId, cropCycleId, limit = 20 } = {}) {
  try {
    const rows = await prisma.farmerActionLog.findMany({
      where: {
        ...(farmProfileId ? { farmProfileId } : {}),
        ...(cropCycleId ? { cropCycleId } : {}),
      },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      actionType: r.actionType,
      subjectType: r.subjectType,
      subjectId: r.subjectId,
      farmProfileId: r.farmProfileId,
      cropCycleId: r.cropCycleId,
      userId: r.userId,
      details: r.details || {},
      occurredAt: r.occurredAt?.toISOString?.() || String(r.occurredAt),
    }));
  } catch {
    return [];
  }
}

// ─── task completion ───────────────────────────────────────

export async function recordTaskCompleted(prisma, { user, task, note }) {
  const updated = await prisma.cycleTaskPlan.update({
    where: { id: task.id },
    data: {
      status: 'completed',
      completedAt: new Date(),
      completedBy: user?.id || null,
      note: typeof note === 'string' ? note.slice(0, 500) : undefined,
    },
  });
  const action = {
    actionType: ACTION_TYPES.TASK_COMPLETED,
    subjectType: 'task',
    subjectId: task.id,
    cropCycleId: task.cropCycleId,
    farmProfileId: task.farmProfileId || null,
    userId: user?.id || null,
    details: { taskTitle: task.title, priority: task.priority || 'medium' },
  };
  await logAction(prisma, action);
  const riskBand = await persistCycleRisk(prisma, task.cropCycleId, action);
  return { task: updated, riskBand };
}

// ─── task skipping ─────────────────────────────────────────

export async function recordTaskSkipped(prisma, { user, task, reason }) {
  const cleanReason = typeof reason === 'string' ? reason.slice(0, 200) : null;
  const updated = await prisma.cycleTaskPlan.update({
    where: { id: task.id },
    data: {
      status: 'skipped',
      completedAt: new Date(),
      completedBy: user?.id || null,
      note: cleanReason || undefined,
    },
  });
  const action = {
    actionType: ACTION_TYPES.TASK_SKIPPED,
    subjectType: 'task',
    subjectId: task.id,
    cropCycleId: task.cropCycleId,
    farmProfileId: task.farmProfileId || null,
    userId: user?.id || null,
    details: { taskTitle: task.title, priority: task.priority || 'medium', reason: cleanReason },
  };
  await logAction(prisma, action);
  const riskBand = await persistCycleRisk(prisma, task.cropCycleId, action);
  return { task: updated, riskBand };
}

// ─── issue mirror ──────────────────────────────────────────

export async function recordIssueReported(prisma, { user, issue }) {
  const action = {
    actionType: ACTION_TYPES.ISSUE_REPORTED,
    subjectType: 'issue',
    subjectId: issue.id,
    cropCycleId: issue.cropCycleId || null,
    farmProfileId: issue.farmProfileId || null,
    userId: user?.id || null,
    details: { category: issue.category, severity: issue.severity },
  };
  await logAction(prisma, action);
  const riskBand = await persistCycleRisk(prisma, issue.cropCycleId, action);
  return { issue, riskBand };
}

// ─── harvest outcome ───────────────────────────────────────

export async function recordHarvestOutcome(prisma, { user, cycle, tasks = [], actions = [], input = {} }) {
  const outcome = computeHarvestOutcome({ cycle, tasks, actions, input });
  let row = null;
  try {
    const payload = {
      cropKey: outcome.cropKey,
      actualYieldKg: outcome.actualYieldKg,
      yieldUnit: outcome.yieldUnit || 'kg',
      qualityBand: outcome.qualityBand,
      completedTasksCount: outcome.completedTasksCount,
      skippedTasksCount: outcome.skippedTasksCount,
      overdueTasksCount: outcome.overdueTasksCount,
      issueCount: outcome.issueCount,
      issueTags: outcome.issues && outcome.issues.length ? outcome.issues : undefined,
      harvestedAt: outcome.harvestedAt ? new Date(outcome.harvestedAt) : undefined,
      outcomeClass: outcome.outcomeClass || undefined,
      notes: outcome.notes,
    };
    row = await prisma.harvestOutcome.upsert({
      where: { cropCycleId: cycle.id },
      create: {
        farmProfileId: cycle.profileId || null,
        cropCycleId: cycle.id,
        ...payload,
      },
      update: payload,
    });
  } catch {
    row = null; // degrade if table not migrated
  }
  const action = {
    actionType: ACTION_TYPES.HARVEST_REPORTED,
    subjectType: 'harvest',
    subjectId: row?.id || cycle.id,
    cropCycleId: cycle.id,
    farmProfileId: cycle.profileId || null,
    userId: user?.id || null,
    details: {
      actualYieldKg: outcome.actualYieldKg,
      qualityBand: outcome.qualityBand,
      cropKey: outcome.cropKey,
    },
  };
  await logAction(prisma, action);
  const riskBand = await persistCycleRisk(prisma, cycle.id, action);
  return { outcome, row, riskBand };
}

// ─── risk delta for a just-logged action ───────────────────

export function nudgeRisk({ action, base }) {
  return applyActionToRisk({ action, base });
}
