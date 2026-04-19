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
import { canTransition, isValidStatus, transitionError, ACTIVE_STATUSES } from './statusMachine.js';
import { assessCycleRisk } from './cycleRiskEngine.js';
import { buildTodayFeed } from '../today/todayEngine.js';
import { getWeatherForFarm } from '../weather/weatherProvider.js';
import {
  recordTaskCompleted,
  recordTaskSkipped,
  recordIssueReported,
  recordHarvestOutcome,
  getRecentActions,
} from '../feedback/feedbackService.js';
import { summarizeBehavior } from '../feedback/responseEngine.js';
import {
  getBaseRisk,
  getBehaviorRisk,
  getWeatherRiskPayload,
  getOverallRisk,
} from '../risk/overallRiskEngine.js';
import { resolveRegionProfile } from '../region/regionProfile.js';

const prisma = new PrismaClient();

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

  // Duplicate-cycle guard: block when the same farm already has an
  // active cycle for the same crop. "Active" = anything that isn't
  // harvested/failed. Farmers can have sequential cycles over time;
  // they just can't have two concurrent ones for the same crop.
  const existing = await prisma.v2CropCycle.findFirst({
    where: {
      profileId: farm.id,
      cropType: recommendation.key,
      lifecycleStatus: { in: ACTIVE_STATUSES },
    },
    select: { id: true },
  });
  if (existing) throw httpErr(409, 'duplicate_active_cycle');

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

/** Mark a single task done, log the action, and refresh cycle progress. */
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

  return recordTaskCompleted(prisma, {
    user,
    task: { ...task, farmProfileId: farm.id },
    note,
  });
}

/** Mark a task skipped and log the skip (with optional reason). */
export async function skipTask({ user, taskId, reason }) {
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  const task = await prisma.cycleTaskPlan.findUnique({
    where: { id: taskId },
    include: { cropCycle: { select: { id: true, profileId: true } } },
  });
  if (!task) throw httpErr(404, 'task_not_found');
  if (task.status === 'completed') throw httpErr(409, 'already_completed');

  const farm = await prisma.farmProfile.findFirst({
    where: { id: task.cropCycle.profileId, userId: user.id },
    select: { id: true },
  });
  if (!farm) throw httpErr(403, 'forbidden');

  return recordTaskSkipped(prisma, {
    user,
    task: { ...task, farmProfileId: farm.id },
    reason,
  });
}

/**
 * Report an issue AND mirror it into the action log so the Today
 * engine can surface issue-driven priority boosts immediately.
 */
export async function reportIssue({ user, cycleId, category, severity, description, photoUrl }) {
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  const cycle = await prisma.v2CropCycle.findUnique({
    where: { id: cycleId },
    select: { id: true, profileId: true },
  });
  if (!cycle) throw httpErr(404, 'cycle_not_found');
  const farm = await prisma.farmProfile.findFirst({
    where: { id: cycle.profileId, userId: user.id },
    select: { id: true, farmerUuid: true },
  });
  if (!farm) throw httpErr(403, 'forbidden');

  const issue = await prisma.issueReport.create({
    data: {
      farmProfileId: farm.id,
      cropCycleId: cycle.id,
      category: String(category || 'other').toLowerCase(),
      severity: ['low', 'medium', 'high'].includes(String(severity || '').toLowerCase())
        ? String(severity).toLowerCase() : 'medium',
      description: typeof description === 'string' ? description.slice(0, 2000) : '',
      photoUrl: typeof photoUrl === 'string' ? photoUrl.slice(0, 1000) : null,
      status: 'open',
    },
  });
  await recordIssueReported(prisma, { user, issue });
  return { issue };
}

/**
 * Submit a harvest outcome. Writes HarvestOutcome, logs the action,
 * and transitions the cycle to 'harvested' so downstream consumers
 * see a closed loop.
 */
export async function submitHarvest({ user, cycleId, actualYieldKg, qualityBand, notes }) {
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  const cycle = await prisma.v2CropCycle.findUnique({
    where: { id: cycleId },
    include: { taskPlans: true },
  });
  if (!cycle) throw httpErr(404, 'cycle_not_found');
  const farm = await prisma.farmProfile.findFirst({
    where: { id: cycle.profileId, userId: user.id },
    select: { id: true },
  });
  if (!farm) throw httpErr(403, 'forbidden');

  const actions = await getRecentActions(prisma, { cropCycleId: cycle.id, limit: 200 });
  const result = await recordHarvestOutcome(prisma, {
    user,
    cycle,
    tasks: cycle.taskPlans || [],
    actions,
    input: { actualYieldKg, qualityBand, notes },
  });

  // Move the cycle into a terminal 'harvested' state if the current
  // state allows it. Uses the status machine so illegal transitions
  // fail cleanly.
  try {
    if (canTransition(cycle.lifecycleStatus, 'harvested')) {
      await prisma.v2CropCycle.update({
        where: { id: cycle.id },
        data: { lifecycleStatus: 'harvested' },
      });
    }
  } catch { /* non-fatal */ }

  return { outcome: result.outcome };
}

/**
 * Move a cycle through its lifecycle, enforcing allowed transitions.
 * Invalid transitions return 409 `invalid_status_transition`.
 */
export async function updateCycleStatus({ user, cycleId, status, reason }) {
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  if (!isValidStatus(status)) throw httpErr(400, 'invalid_status');
  const cycle = await prisma.v2CropCycle.findUnique({
    where: { id: cycleId }, select: { id: true, profileId: true, lifecycleStatus: true },
  });
  if (!cycle) throw httpErr(404, 'cycle_not_found');
  const farm = await prisma.farmProfile.findFirst({
    where: { id: cycle.profileId, userId: user.id }, select: { id: true },
  });
  if (!farm) throw httpErr(403, 'forbidden');
  if (!canTransition(cycle.lifecycleStatus, status)) {
    throw transitionError(cycle.lifecycleStatus, status);
  }
  const updated = await prisma.v2CropCycle.update({
    where: { id: cycleId },
    data: { lifecycleStatus: status, statusReason: reason || null },
  });
  return { cycle: updated };
}

/**
 * Compute live risk for a cycle. Composes cycle + tasks + issues
 * from the DB and runs the pure risk engine.
 */
export async function computeCycleRisk({ user, cycleId }) {
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  const cycle = await prisma.v2CropCycle.findUnique({
    where: { id: cycleId },
    include: {
      taskPlans: true,
      recommendationSnapshot: true,
    },
  });
  if (!cycle) throw httpErr(404, 'cycle_not_found');
  const farm = await prisma.farmProfile.findFirst({
    where: { id: cycle.profileId, userId: user.id }, select: { id: true },
  });
  const isReviewer = user.role === 'admin' || user.role === 'reviewer';
  if (!farm && !isReviewer) throw httpErr(403, 'forbidden');

  const issues = await prisma.issueReport.findMany({
    where: { cropCycleId: cycleId },
    select: { severity: true, status: true, category: true },
  });

  return assessCycleRisk({
    tasks: cycle.taskPlans,
    issues,
    cycle,
    snapshot: cycle.recommendationSnapshot,
  });
}

/**
 * Today feed for a farmer: top N pending tasks by due date, any
 * overdue tasks, and a count of open high-severity issues so the UI
 * can render a risk alert banner.
 */
export async function getTodayFeedForUser({ user, limit = 3, weather = null }) {
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  const farms = await prisma.farmProfile.findMany({
    where: { userId: user.id },
    select: { id: true, latitude: true, longitude: true },
  });
  const farmIds = farms.map((f) => f.id);
  if (!farmIds.length) return { topTasks: [], overdue: [], openHighRiskIssues: 0, nextAction: null, weatherAlerts: [], weatherRisk: null };

  const cycles = await prisma.v2CropCycle.findMany({
    where: { profileId: { in: farmIds }, lifecycleStatus: { notIn: ['harvested', 'failed'] } },
    select: { id: true },
    take: 50,
  });
  const cycleIds = cycles.map((c) => c.id);
  if (!cycleIds.length) return { topTasks: [], overdue: [], openHighRiskIssues: 0, nextAction: null, weatherAlerts: [], weatherRisk: null };

  const now = new Date();
  const [pending, allTasks, openIssues, cycleWithContext, recentActions] = await Promise.all([
    prisma.cycleTaskPlan.findMany({
      where: { cropCycleId: { in: cycleIds }, status: 'pending' },
      take: 30,
    }),
    prisma.cycleTaskPlan.findMany({
      where: { cropCycleId: { in: cycleIds } },
      select: { id: true, status: true, priority: true, dueDate: true },
      take: 500,
    }),
    prisma.issueReport.findMany({
      where: {
        farmProfileId: { in: farmIds },
        status: { in: ['open', 'in_review'] },
      },
      select: { category: true, severity: true, status: true },
    }),
    prisma.v2CropCycle.findFirst({
      where: { id: { in: cycleIds } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, cropType: true, variety: true,
        lifecycleStatus: true, plantingDate: true, expectedHarvestDate: true,
        riskBand: true,
      },
    }),
    getRecentActions(prisma, { limit: 50 }).then((rows) =>
      rows.filter((r) => !r.cropCycleId || cycleIds.includes(r.cropCycleId))
    ),
  ]);

  // Derive overall risk level from the mix of overdue + issues so
  // the today engine's risk overrides fire at the right time.
  const overdueCount = pending.filter((t) =>
    t.dueDate && new Date(t.dueDate).getTime() < now.getTime()
  ).length;
  const highSevCount = openIssues.filter((i) => i.severity === 'high').length;
  const derivedRisk = (overdueCount >= 3 || highSevCount >= 2) ? 'high'
    : (overdueCount >= 1 || highSevCount >= 1) ? 'medium' : 'low';
  // The action-driven riskBand persisted on the cycle acts as a
  // sticky floor — once a farmer raises risk via a skip or issue,
  // the Today engine keeps honoring it even if the instant derivation
  // would say "low". max(band) of {derived, persisted}.
  const RISK_ORDER = { low: 0, medium: 1, high: 2 };
  const persisted = cycleWithContext?.riskBand || 'low';
  const riskLevel = RISK_ORDER[persisted] > RISK_ORDER[derivedRisk] ? persisted : derivedRisk;

  // If the caller didn't supply pre-fetched weather, fall back to the
  // default provider using the first farm's coordinates. Any provider
  // failure resolves to null and the feed runs in no-weather mode.
  let effectiveWeather = weather;
  if (!effectiveWeather) {
    const farmWithCoords = farms.find(
      (f) => Number.isFinite(f.latitude) && Number.isFinite(f.longitude),
    );
    if (farmWithCoords) {
      effectiveWeather = await getWeatherForFarm(farmWithCoords);
    }
  }

  const feed = buildTodayFeed({
    pendingTasks: pending,
    allTasks,
    recentActions,
    cycle: cycleWithContext,
    cropKey: cycleWithContext?.cropType || null,
    riskLevel,
    openIssues,
    currentMonth: now.getMonth() + 1,
    weather: effectiveWeather,
    now,
  });

  // Behavior summary — derived from allTasks + recentActions so the
  // client can render streak / skip / issue chips without re-deriving.
  const behaviorSummary = feed.behaviorSummary
    || summarizeBehavior(recentActions, allTasks);

  // ─── Combined risk payload ────────────────────────────────
  // base = crop × region × season (needs farm region data); weather
  // comes from the engine; behavior from the summary we just built.
  // If we can't load region (no farm w/ a state), base reduces to a
  // low-risk baseline rather than fabricating factors.
  let regionProfile = null;
  try {
    const firstFarm = await prisma.farmProfile.findFirst({
      where: { userId: user.id }, select: { country: true, stateCode: true, locationName: true },
    });
    if (firstFarm) {
      regionProfile = resolveRegionProfile({
        country: firstFarm.country || 'US',
        state: firstFarm.stateCode || firstFarm.locationName,
      });
    }
  } catch { /* ignore */ }

  const baseRisk = getBaseRisk({
    region: regionProfile,
    seasonFit: 100,
    plantingStatus: 'plant_now',
    climateFit: 80,
    fitLevel: 'medium',
  });
  const weatherRiskCh = effectiveWeather ? getWeatherRiskPayload(effectiveWeather) : null;
  const behaviorRiskCh = getBehaviorRisk(behaviorSummary);
  const overallRisk = getOverallRisk({
    base: baseRisk,
    weather: weatherRiskCh,
    behavior: behaviorRiskCh,
  });

  return {
    primaryTask: feed.primaryTask,
    secondaryTasks: feed.secondaryTasks,
    riskAlerts: feed.riskAlerts,
    weatherAlerts: feed.weatherAlerts || [],
    weatherRisk: feed.weatherRisk || null,
    behaviorSummary,
    overallRisk,
    regionProfile,
    nextActionSummary: feed.nextActionSummary,
    overdueTasksCount: feed.overdueTasksCount,
    timeEstimateMinutes: feed.timeEstimateMinutes,
    priorityScore: feed.priorityScore,
    // Backwards-compat: old callers read topTasks / overdue / nextAction.
    topTasks: [feed.primaryTask, ...feed.secondaryTasks].filter(Boolean),
    nextAction: feed.nextActionSummary,
    openHighRiskIssues: highSevCount,
  };
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
