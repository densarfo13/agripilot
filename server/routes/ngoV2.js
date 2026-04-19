/**
 * ngoV2.js — decision-support endpoints built on top of the three
 * pure engines (intervention / farmer score / funding).
 *
 *   GET  /api/v2/ngo/interventions            — priority queue
 *   GET  /api/v2/ngo/interventions/summary    — rollup by priority
 *   POST /api/v2/ngo/interventions/recompute  — rerun engine, upsert rows
 *   PATCH /api/v2/ngo/interventions/:id       — reviewer status update
 *
 *   GET  /api/v2/ngo/farmer-scores            — paginated farmer scorecards
 *   POST /api/v2/ngo/farmer-scores/recompute  — batch recompute
 *
 *   GET  /api/v2/ngo/funding-readiness        — funding decisions + filters
 *   POST /api/v2/ngo/funding-readiness/recompute
 *
 * All routes are reviewer-gated. The engines live in
 * server/src/services/ngo/ so they're directly unit-testable.
 */
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/authenticate.js';
import { requireAuth, requireRole } from '../middleware/rbac.js';
import { assessIntervention } from '../src/services/ngo/interventionEngine.js';
import { computeFarmerScore } from '../src/services/ngo/farmerScoringEngine.js';
import { decideFundingEligibility } from '../src/services/ngo/fundingEligibilityEngine.js';

const prisma = new PrismaClient();
const router = express.Router();
const NGO_SCOPE = [authenticate, requireAuth, requireRole('reviewer')];

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const VALID_INTERVENTION_STATUS = new Set(['open', 'in_progress', 'resolved', 'dismissed']);

// ─── Interventions ─────────────────────────────────────────
router.get('/interventions', ...NGO_SCOPE, async (req, res) => {
  const where = {};
  if (typeof req.query.status === 'string') where.status = req.query.status;
  else where.status = { in: ['open', 'in_progress'] };
  if (typeof req.query.priority === 'string') where.priority = req.query.priority;

  const rows = await prisma.intervention.findMany({
    where, orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }], take: 200,
  });
  rows.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));
  res.json({ items: rows });
});

router.get('/interventions/summary', ...NGO_SCOPE, async (_req, res) => {
  const rows = await prisma.intervention.groupBy({
    by: ['priority', 'status'],
    _count: { _all: true },
  });
  const byPriority = { critical: 0, high: 0, medium: 0, low: 0 };
  let openTotal = 0;
  for (const r of rows) {
    if (r.status === 'open' || r.status === 'in_progress') {
      byPriority[r.priority] = (byPriority[r.priority] || 0) + (r._count?._all || 0);
      openTotal += r._count?._all || 0;
    }
  }
  res.json({ openTotal, byPriority });
});

router.patch('/interventions/:id', ...NGO_SCOPE, express.json(), async (req, res) => {
  const status = String(req.body?.status || '').toLowerCase();
  if (!VALID_INTERVENTION_STATUS.has(status)) {
    return res.status(400).json({ error: 'invalid_status' });
  }
  const patch = { status };
  if (status === 'resolved' || status === 'dismissed') patch.resolvedAt = new Date();
  if (typeof req.body?.reviewerNote === 'string') patch.reviewerNote = req.body.reviewerNote.slice(0, 1000);
  if (typeof req.body?.assignedTo === 'string') patch.assignedTo = req.body.assignedTo;
  try {
    const updated = await prisma.intervention.update({
      where: { id: req.params.id }, data: patch,
    });
    res.json({ intervention: updated });
  } catch (err) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'not_found' });
    console.error('[ngoV2] patch intervention', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/interventions/recompute', ...NGO_SCOPE, async (_req, res) => {
  const now = new Date();
  const farms = await prisma.farmProfile.findMany({
    where: { status: 'active' },
    select: { id: true, updatedAt: true },
  });
  if (!farms.length) return res.json({ processed: 0, created: 0 });

  let created = 0;
  for (const farm of farms) {
    const signals = await gatherInterventionSignals(farm, now);
    if (!signals) continue;
    const assessment = assessIntervention(signals);
    if (assessment.priority === 'low') continue;
    await prisma.intervention.create({
      data: {
        farmProfileId: farm.id,
        cropCycleId: signals.cycleId,
        interventionScore: assessment.interventionScore,
        priority: assessment.priority,
        reason: assessment.reason.slice(0, 500),
        recommendedAction: assessment.recommendedAction.slice(0, 500),
        dueAt: assessment.dueAt,
        // Persist the full signals + explain payload so reviewers
        // can audit which components fired. Serializes to Json.
        signals: { ...assessment.signals, explain: assessment.explain },
      },
    });
    created += 1;
  }
  res.json({ processed: farms.length, created });
});

// ─── Farmer scores ─────────────────────────────────────────
router.get('/farmer-scores', ...NGO_SCOPE, async (req, res) => {
  const band = typeof req.query.band === 'string' ? req.query.band : null;
  const where = band ? { scoreBand: band } : {};
  const items = await prisma.farmerScore.findMany({
    where, orderBy: { healthScore: 'desc' }, take: 200,
  });
  res.json({ items });
});

router.post('/farmer-scores/recompute', ...NGO_SCOPE, async (_req, res) => {
  const farms = await prisma.farmProfile.findMany({
    where: { status: 'active' },
    select: { id: true, updatedAt: true },
  });
  if (!farms.length) return res.json({ processed: 0 });

  let processed = 0;
  for (const farm of farms) {
    const signals = await gatherScoreSignals(farm);
    const score = computeFarmerScore(signals);
    // Persist the explain payload alongside signals so reviewers can
    // see exactly which sub-scores fed the composite.
    const persistable = {
      performanceScore: score.performanceScore,
      consistencyScore: score.consistencyScore,
      riskScore: score.riskScore,
      verificationScore: score.verificationScore,
      healthScore: score.healthScore,
      scoreBand: score.scoreBand,
      signals: { ...score.signals, explain: score.explain },
    };
    await prisma.farmerScore.upsert({
      where: { farmProfileId: farm.id },
      update: { ...persistable, computedAt: new Date() },
      create: { farmProfileId: farm.id, ...persistable },
    });
    processed += 1;
  }
  res.json({ processed });
});

// ─── Funding readiness ─────────────────────────────────────
router.get('/funding-readiness', ...NGO_SCOPE, async (req, res) => {
  const decision = typeof req.query.decision === 'string' ? req.query.decision : null;
  const where = decision ? { decision } : {};
  const items = await prisma.fundingDecision.findMany({
    where, orderBy: { decidedAt: 'desc' }, take: 200,
  });
  res.json({ items });
});

router.post('/funding-readiness/recompute', ...NGO_SCOPE, async (_req, res) => {
  const scores = await prisma.farmerScore.findMany({});
  if (!scores.length) return res.json({ processed: 0 });
  let processed = 0;
  for (const score of scores) {
    const [intervention, cycles] = await Promise.all([
      prisma.intervention.findFirst({
        where: {
          farmProfileId: score.farmProfileId,
          status: { in: ['open', 'in_progress'] },
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.v2CropCycle.findMany({
        where: { profileId: score.farmProfileId },
        select: { lifecycleStatus: true },
      }),
    ]);
    const context = {
      totalCycles: cycles.length,
      completedCycles: cycles.filter((c) => c.lifecycleStatus === 'harvested').length,
      activeCycles: cycles.filter((c) => !['harvested', 'failed'].includes(c.lifecycleStatus || '')).length,
      failedCycles: cycles.filter((c) => c.lifecycleStatus === 'failed').length,
    };
    const result = decideFundingEligibility({ score, intervention, context });
    await prisma.fundingDecision.create({
      data: {
        farmProfileId: score.farmProfileId,
        decision: result.decision,
        reason: result.reason.slice(0, 500),
        healthScore: score.healthScore,
        verificationScore: score.verificationScore,
        // Persist blockers alongside the explain payload so the
        // reviewer UI can surface which thresholds fired.
        blockers: { blockers: result.blockers, explain: result.explain },
      },
    });
    processed += 1;
  }
  res.json({ processed });
});

// ─── helpers ───────────────────────────────────────────────

async function gatherInterventionSignals(farm, now) {
  const cycle = await prisma.v2CropCycle.findFirst({
    where: { profileId: farm.id, lifecycleStatus: { notIn: ['harvested', 'failed'] } },
    orderBy: { createdAt: 'desc' },
  });
  if (!cycle) return null;
  const [overdueCount, issues] = await Promise.all([
    prisma.cycleTaskPlan.count({
      where: { cropCycleId: cycle.id, status: 'pending', dueDate: { lt: now } },
    }),
    prisma.issueReport.findMany({
      where: {
        farmProfileId: farm.id,
        status: { in: ['open', 'in_review'] },
      },
      select: { severity: true },
    }),
  ]);
  const highSevIssues = issues.filter((i) => i.severity === 'high').length;
  const mediumSevIssues = issues.filter((i) => i.severity === 'medium').length;
  const inactivityDays = Math.floor((now.getTime() - new Date(farm.updatedAt).getTime()) / 86_400_000);

  return {
    cycleId: cycle.id,
    cycleRisk: overdueCount >= 3 || highSevIssues >= 2 ? 'high' : overdueCount >= 1 || highSevIssues >= 1 ? 'medium' : 'low',
    overdueCount, highSevIssues, mediumSevIssues,
    inactivityDays,
    missedWindow: false, // left as a stub; wire up once RecommendationSnapshot is read here
    verificationConfidence: null,
  };
}

async function gatherScoreSignals(farm) {
  const [cycles, tasks, harvests, issues, vRecords] = await Promise.all([
    prisma.v2CropCycle.findMany({
      where: { profileId: farm.id },
      select: { id: true, lifecycleStatus: true },
    }),
    prisma.cycleTaskPlan.findMany({
      where: { cropCycle: { profileId: farm.id } },
      select: { status: true, dueDate: true },
    }),
    prisma.v2HarvestRecord.count({ where: { farmId: farm.id } }),
    prisma.issueReport.findMany({
      where: { farmProfileId: farm.id, status: { in: ['open', 'in_review'] } },
      select: { severity: true },
    }),
    prisma.verificationRecord.findMany({
      where: { farmProfileId: farm.id },
      select: { confidence: true },
    }),
  ]);
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const now = new Date();
  const overdueTasks = tasks.filter((t) =>
    t.status === 'pending' && t.dueDate && new Date(t.dueDate) < now
  ).length;
  const completedCycles = cycles.filter((c) => c.lifecycleStatus === 'harvested').length;
  const failedCycles = cycles.filter((c) => c.lifecycleStatus === 'failed').length;
  const openHighSevIssues = issues.filter((i) => i.severity === 'high').length;
  const inactivityDays = Math.floor((now.getTime() - new Date(farm.updatedAt).getTime()) / 86_400_000);
  const confidences = vRecords.map((r) => r.confidence).filter((c) => Number.isFinite(c));
  const verificationConfidence = confidences.length
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : null;

  return {
    totalCycles: cycles.length,
    completedCycles, failedCycles,
    totalTasks, completedTasks, overdueTasks,
    harvestReports: harvests,
    openHighSevIssues,
    inactivityDays,
    verificationConfidence,
  };
}

export default router;
