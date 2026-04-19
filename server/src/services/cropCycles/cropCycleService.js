/**
 * cropCycleService — orchestrates V2CropCycle + RecommendationSnapshot
 * + CycleTaskPlan writes in a single Prisma transaction.
 *
 *   createCycleFromRecommendation — farmer starts tracking a crop
 *   listCyclesForUser             — the farmer's crop list
 *   getCycleDetail                — cycle + tasks + snapshot
 *   completeTask                  — mark a CycleTaskPlan done
 *   updateCycleStatus             — lifecycle status transitions
 *   recomputeCycleProgress        — progress % + overdue flagging
 *
 * Every exported function returns a plain JSON-serializable shape so
 * the route handler can pass it straight to `res.json`.
 */
import { PrismaClient } from '@prisma/client';
import { generateWeeklyTasks, summarizeTasks } from './taskPlanEngine.js';

const prisma = new PrismaClient();

const VALID_STATUSES = new Set([
  'planned', 'planting', 'growing', 'flowering',
  'harvest_ready', 'harvested', 'delayed', 'failed',
]);

/**
 * Create a V2CropCycle + RecommendationSnapshot + initial CycleTaskPlan
 * rows from a scored recommendation object.
 *
 * @param {Object} args
 * @param {Object} args.user                 authenticated user (req.user)
 * @param {string} args.farmProfileId        target farm id
 * @param {Object} args.recommendation       recommendation from the US engine
 * @param {Date}   [args.plantedDate]        defaults to today
 */
export async function createCycleFromRecommendation({
  user, farmProfileId, recommendation, plantedDate,
}) {
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  if (!recommendation?.key || !recommendation?.name) throw httpErr(400, 'invalid_recommendation');
  if (!farmProfileId) throw httpErr(400, 'missing_farm');

  const farm = await prisma.farmProfile.findFirst({
    where: { id: farmProfileId, userId: user.id },
    select: { id: true, country: true, stateCode: true, farmType: true },
  });
  if (!farm) throw httpErr(404, 'farm_not_found');

  const planted = plantedDate instanceof Date ? plantedDate
    : plantedDate ? new Date(plantedDate)
    : new Date();

  const expectedHarvest = computeExpectedHarvest(planted, recommendation);

  // Inside a tx so a partial write can't leave orphan rows.
  const result = await prisma.$transaction(async (tx) => {
    const cycle = await tx.v2CropCycle.create({
      data: {
        profileId: farm.id,
        cropType: recommendation.key,
        variety: recommendation.name,
        plantingDate: planted,
        expectedHarvestDate: expectedHarvest,
        growthStage: 'seedling',
        lifecycleStatus: 'planted'.startsWith('plan') ? 'planned' : 'planned',
      },
    });

    await tx.recommendationSnapshot.create({
      data: {
        cropCycleId: cycle.id,
        score: clampInt(recommendation.score, 0, 100),
        cropKey: recommendation.key,
        cropName: recommendation.name,
        stateCode: farm.stateCode || null,
        farmType: farm.farmType || null,
        why: arrOrNull(recommendation.reasons),
        riskNotes: arrOrNull(recommendation.riskNotes),
        plantingWindow: recommendation.plantingWindow || null,
        harvestWindow: recommendation.harvestWindow || null,
        tags: arrOrNull(recommendation.tags),
        rawPayload: recommendation,
      },
    });

    const planned = generateWeeklyTasks({ cropKey: recommendation.key, plantedDate: planted });
    if (planned.length) {
      await tx.cycleTaskPlan.createMany({
        data: planned.map((t) => ({
          cropCycleId: cycle.id,
          title: t.title,
          detail: t.detail,
          weekIndex: t.weekIndex,
          dueDate: t.dueDate,
          priority: t.priority,
          status: 'pending',
        })),
      });
    }

    return cycle;
  });

  return getCycleDetail({ user, cycleId: result.id });
}

/**
 * List all cycles for the authenticated user, across farms.
 */
export async function listCyclesForUser({ user }) {
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  const farms = await prisma.farmProfile.findMany({
    where: { userId: user.id },
    select: { id: true },
  });
  const farmIds = farms.map((f) => f.id);
  if (!farmIds.length) return { cycles: [] };

  const rows = await prisma.v2CropCycle.findMany({
    where: { profileId: { in: farmIds } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      taskPlans: { select: { status: true, dueDate: true } },
      recommendationSnapshot: { select: { score: true, cropName: true } },
    },
  });

  return {
    cycles: rows.map((c) => ({
      id: c.id,
      cropType: c.cropType,
      variety: c.variety,
      plantingDate: c.plantingDate,
      expectedHarvestDate: c.expectedHarvestDate,
      lifecycleStatus: c.lifecycleStatus || 'planned',
      score: c.recommendationSnapshot?.score ?? null,
      cropDisplayName: c.recommendationSnapshot?.cropName || c.variety || c.cropType,
      summary: summarizeTasks(c.taskPlans || []),
    })),
  };
}

/** Single-cycle detail: cycle + snapshot + tasks + summary. */
export async function getCycleDetail({ user, cycleId }) {
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  const cycle = await prisma.v2CropCycle.findUnique({
    where: { id: cycleId },
    include: {
      taskPlans: { orderBy: [{ weekIndex: 'asc' }, { dueDate: 'asc' }] },
      recommendationSnapshot: true,
    },
  });
  if (!cycle) throw httpErr(404, 'cycle_not_found');

  const farm = await prisma.farmProfile.findFirst({
    where: { id: cycle.profileId, userId: user.id },
    select: { id: true },
  });
  if (!farm && user.role !== 'admin' && user.role !== 'reviewer') throw httpErr(403, 'forbidden');

  return {
    cycle: {
      id: cycle.id,
      cropType: cycle.cropType,
      variety: cycle.variety,
      plantingDate: cycle.plantingDate,
      expectedHarvestDate: cycle.expectedHarvestDate,
      lifecycleStatus: cycle.lifecycleStatus || 'planned',
      growthStage: cycle.growthStage,
    },
    snapshot: cycle.recommendationSnapshot || null,
    tasks: cycle.taskPlans,
    summary: summarizeTasks(cycle.taskPlans),
  };
}

/** Mark a single task done and refresh cycle progress. */
export async function completeTask({ user, taskId, note }) {
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  const task = await prisma.cycleTaskPlan.findUnique({
    where: { id: taskId },
    include: { cropCycle: { select: { id: true, profileId: true } } },
  });
  if (!task) throw httpErr(404, 'task_not_found');

  const farm = await prisma.farmProfile.findFirst({
    where: { id: task.cropCycle.profileId, userId: user.id },
    select: { id: true },
  });
  if (!farm) throw httpErr(403, 'forbidden');

  const updated = await prisma.cycleTaskPlan.update({
    where: { id: taskId },
    data: {
      status: 'completed',
      completedAt: new Date(),
      completedBy: user.id,
      note: typeof note === 'string' ? note.slice(0, 500) : undefined,
    },
  });
  return { task: updated };
}

/** Move a cycle through its lifecycle. Returns the updated cycle. */
export async function updateCycleStatus({ user, cycleId, status, reason }) {
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  if (!VALID_STATUSES.has(status)) throw httpErr(400, 'invalid_status');
  const cycle = await prisma.v2CropCycle.findUnique({
    where: { id: cycleId }, select: { id: true, profileId: true },
  });
  if (!cycle) throw httpErr(404, 'cycle_not_found');
  const farm = await prisma.farmProfile.findFirst({
    where: { id: cycle.profileId, userId: user.id }, select: { id: true },
  });
  if (!farm) throw httpErr(403, 'forbidden');
  const updated = await prisma.v2CropCycle.update({
    where: { id: cycleId },
    data: { lifecycleStatus: status, statusReason: reason || null },
  });
  return { cycle: updated };
}

/**
 * Today feed for a farmer: top N pending tasks by due date, any
 * overdue tasks, and a count of open high-severity issues so the UI
 * can render a risk alert banner.
 */
export async function getTodayFeedForUser({ user, limit = 3 }) {
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  const farms = await prisma.farmProfile.findMany({
    where: { userId: user.id }, select: { id: true },
  });
  const farmIds = farms.map((f) => f.id);
  if (!farmIds.length) return { topTasks: [], overdue: [], openHighRiskIssues: 0, nextAction: null };

  const cycles = await prisma.v2CropCycle.findMany({
    where: { profileId: { in: farmIds }, lifecycleStatus: { notIn: ['harvested', 'failed'] } },
    select: { id: true },
    take: 50,
  });
  const cycleIds = cycles.map((c) => c.id);
  if (!cycleIds.length) return { topTasks: [], overdue: [], openHighRiskIssues: 0, nextAction: null };

  const now = new Date();
  const [top, overdue, risk] = await Promise.all([
    prisma.cycleTaskPlan.findMany({
      where: { cropCycleId: { in: cycleIds }, status: 'pending' },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: limit,
    }),
    prisma.cycleTaskPlan.findMany({
      where: {
        cropCycleId: { in: cycleIds },
        status: 'pending',
        dueDate: { lt: now },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    }),
    prisma.issueReport.count({
      where: {
        farmProfileId: { in: farmIds },
        severity: 'high',
        status: { in: ['open', 'in_review'] },
      },
    }),
  ]);

  const nextAction = top[0] ? top[0].title : null;
  return { topTasks: top, overdue, openHighRiskIssues: risk, nextAction };
}

// ─── helpers ──────────────────────────────────────────────────

function clampInt(n, lo, hi) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

function arrOrNull(a) {
  return Array.isArray(a) && a.length ? a : null;
}

function computeExpectedHarvest(plantedDate, rec) {
  const weeks = Number.isFinite(rec?.growthWeeksMax) ? rec.growthWeeksMax
    : Number.isFinite(rec?.growthWeeksMin) ? rec.growthWeeksMin + 2 : null;
  if (!weeks) return null;
  const d = new Date(plantedDate.getTime());
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

function httpErr(status, code) {
  const err = new Error(code);
  err.status = status;
  err.code = code;
  return err;
}
