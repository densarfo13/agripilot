/**
 * ngoDashboard.js — aggregated endpoints powering the NGO view.
 *
 *   GET /api/v2/ngo/overview           — cards: total / active / high-risk / in-progress
 *   GET /api/v2/ngo/risk-summary       — farm-level risk rollup
 *   GET /api/v2/ngo/crop-analytics     — counts by crop + lifecycle status
 *   GET /api/v2/ngo/harvest-analytics  — totals + recent harvest records
 *
 * All endpoints are role-gated (admin | reviewer). Individual
 * farmers must never see another farm's data. Every aggregate is
 * computed on the fly — cheap enough at NGO scale (up to tens of
 * thousands of farmers) and avoids the consistency headaches of a
 * materialized view for now.
 */
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/authenticate.js';

const prisma = new PrismaClient();
const router = express.Router();

function requireReviewer(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'reviewer') {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}

const ACTIVE_WINDOW_DAYS = 30;

// ─── GET /api/v2/ngo/overview ──────────────────────────────
router.get('/overview', authenticate, requireReviewer, async (_req, res) => {
  const now = new Date();
  const activeSince = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * 86_400_000);

  const [
    totalFarmers,
    activeFarmers,
    openHighRiskIssues,
    cropsInProgress,
  ] = await Promise.all([
    prisma.farmProfile.count({ where: { status: 'active' } }),
    prisma.farmProfile.count({
      where: { status: 'active', updatedAt: { gte: activeSince } },
    }),
    prisma.issueReport.findMany({
      where: { status: { in: ['open', 'in_review'] }, severity: 'high' },
      select: { farmProfileId: true },
      distinct: ['farmProfileId'],
    }),
    prisma.v2CropCycle.count({
      where: {
        lifecycleStatus: { in: [
          'planned', 'planting', 'growing', 'flowering', 'harvest_ready',
        ] },
      },
    }).catch(() => 0),
  ]);

  res.json({
    totalFarmers,
    activeFarmers,
    highRiskFarmers: openHighRiskIssues.length,
    cropsInProgress,
    generatedAt: now.toISOString(),
  });
});

// ─── GET /api/v2/ngo/risk-summary ──────────────────────────
router.get('/risk-summary', authenticate, requireReviewer, async (_req, res) => {
  // For each open/in-review issue with severity >= medium, surface
  // the farm + farmer context so the NGO can triage from one list.
  const issues = await prisma.issueReport.findMany({
    where: {
      status: { in: ['open', 'in_review'] },
      severity: { in: ['medium', 'high'] },
    },
    orderBy: [{ severity: 'desc' }, { reportedAt: 'desc' }],
    take: 200,
  });

  const farmIds = Array.from(new Set(issues.map((i) => i.farmProfileId)));
  const farms = farmIds.length
    ? await prisma.farmProfile.findMany({
        where: { id: { in: farmIds } },
        select: {
          id: true, farmName: true, farmerName: true,
          country: true, stateCode: true, locationName: true,
          crop: true,
        },
      })
    : [];
  const farmsById = Object.fromEntries(farms.map((f) => [f.id, f]));

  res.json({
    items: issues.map((issue) => ({
      ...issue,
      farm: farmsById[issue.farmProfileId] || null,
    })),
  });
});

// ─── GET /api/v2/ngo/crop-analytics ────────────────────────
router.get('/crop-analytics', authenticate, requireReviewer, async (_req, res) => {
  const rows = await prisma.v2CropCycle.groupBy({
    by: ['cropType', 'lifecycleStatus'],
    _count: { _all: true },
  }).catch(() => []);

  // Fold into { crop: { status: count, total: n } }.
  const byCrop = {};
  let grandTotal = 0;
  for (const r of rows) {
    const crop = r.cropType || 'unknown';
    const status = r.lifecycleStatus || 'unspecified';
    byCrop[crop] ||= { total: 0 };
    byCrop[crop][status] = (byCrop[crop][status] || 0) + (r._count?._all || 0);
    byCrop[crop].total += r._count?._all || 0;
    grandTotal += r._count?._all || 0;
  }
  res.json({ total: grandTotal, byCrop });
});

// ─── GET /api/v2/ngo/intervention ──────────────────────────
// Farmers needing help now: open high-severity issues OR 3+ overdue
// tasks OR 14+ days of inactivity. Returns actionable rows with
// farm + last-signal context so the NGO can triage directly.
router.get('/intervention', authenticate, requireReviewer, async (req, res) => {
  const stateCode = typeof req.query.state === 'string' ? req.query.state.toUpperCase() : null;
  const now = new Date();
  const inactivityCutoff = new Date(now.getTime() - 14 * 86_400_000);

  // Candidate farms: any with open high-severity issue, overdue tasks,
  // or a cycle but no recent task completion.
  const highSevFarmIds = await prisma.issueReport.findMany({
    where: { severity: 'high', status: { in: ['open', 'in_review'] } },
    select: { farmProfileId: true },
    distinct: ['farmProfileId'],
  }).then((rows) => rows.map((r) => r.farmProfileId));

  const overdueGroups = await prisma.cycleTaskPlan.groupBy({
    by: ['cropCycleId'],
    where: { status: 'pending', dueDate: { lt: now } },
    _count: { _all: true },
    having: { cropCycleId: { _count: { gte: 3 } } },
  }).catch(() => []);
  const overdueCycleIds = overdueGroups.map((r) => r.cropCycleId);
  const overdueCycles = overdueCycleIds.length
    ? await prisma.v2CropCycle.findMany({
        where: { id: { in: overdueCycleIds } }, select: { id: true, profileId: true },
      })
    : [];
  const overdueFarmIds = overdueCycles.map((c) => c.profileId);

  const candidateFarmIds = Array.from(new Set([...highSevFarmIds, ...overdueFarmIds]));
  if (!candidateFarmIds.length) return res.json({ items: [], total: 0 });

  const farms = await prisma.farmProfile.findMany({
    where: {
      id: { in: candidateFarmIds },
      ...(stateCode ? { stateCode } : {}),
    },
    select: {
      id: true, farmName: true, farmerName: true, stateCode: true,
      country: true, crop: true, updatedAt: true,
    },
  });

  const items = farms.map((f) => {
    const reasons = [];
    if (highSevFarmIds.includes(f.id)) reasons.push('open_high_severity_issue');
    const overdueCountsForFarm = overdueCycles
      .filter((c) => c.profileId === f.id)
      .map((c) => overdueGroups.find((g) => g.cropCycleId === c.id)?._count?._all || 0)
      .reduce((a, b) => a + b, 0);
    if (overdueCountsForFarm >= 3) reasons.push('overdue_tasks_3_plus');
    if (f.updatedAt && f.updatedAt < inactivityCutoff) reasons.push('inactive_14d_plus');
    return { farm: f, reasons, overdueCount: overdueCountsForFarm };
  }).sort((a, b) => b.reasons.length - a.reasons.length);

  res.json({ items, total: items.length });
});

// ─── GET /api/v2/ngo/inactive-farmers ──────────────────────
router.get('/inactive-farmers', authenticate, requireReviewer, async (req, res) => {
  const days = Math.max(7, Math.min(90, parseInt(req.query.days, 10) || 14));
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const farms = await prisma.farmProfile.findMany({
    where: { status: 'active', updatedAt: { lt: cutoff } },
    orderBy: { updatedAt: 'asc' },
    select: { id: true, farmName: true, farmerName: true, stateCode: true, country: true, updatedAt: true },
    take: 200,
  });
  res.json({ cutoffDays: days, farms });
});

// ─── GET /api/v2/ngo/overdue-clusters ──────────────────────
// Overdue task counts grouped by cycle → farm. Useful for spotting
// a single farm with many stalled cycles at once.
router.get('/overdue-clusters', authenticate, requireReviewer, async (_req, res) => {
  const now = new Date();
  const groups = await prisma.cycleTaskPlan.groupBy({
    by: ['cropCycleId'],
    where: { status: 'pending', dueDate: { lt: now } },
    _count: { _all: true },
  }).catch(() => []);
  if (!groups.length) return res.json({ clusters: [] });

  const cycleIds = groups.map((g) => g.cropCycleId);
  const cycles = await prisma.v2CropCycle.findMany({
    where: { id: { in: cycleIds } },
    select: { id: true, cropType: true, profileId: true, lifecycleStatus: true },
  });
  const farmIds = Array.from(new Set(cycles.map((c) => c.profileId)));
  const farms = await prisma.farmProfile.findMany({
    where: { id: { in: farmIds } },
    select: { id: true, farmName: true, stateCode: true },
  });
  const farmsById = Object.fromEntries(farms.map((f) => [f.id, f]));

  const clusters = cycles.map((c) => ({
    cycleId: c.id,
    cropType: c.cropType,
    lifecycleStatus: c.lifecycleStatus || 'planned',
    overdueCount: groups.find((g) => g.cropCycleId === c.id)?._count?._all || 0,
    farm: farmsById[c.profileId] || null,
  })).sort((a, b) => b.overdueCount - a.overdueCount).slice(0, 50);

  res.json({ clusters });
});

// ─── GET /api/v2/ngo/harvest-analytics ─────────────────────
router.get('/harvest-analytics', authenticate, requireReviewer, async (_req, res) => {
  // V2HarvestRecord already exists in the schema (farmProfileId + totals).
  const recent = await prisma.v2HarvestRecord.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  }).catch(() => []);

  const totals = recent.reduce((acc, r) => {
    acc.count += 1;
    acc.totalQuantityKg += Number(r.totalQuantityKg || r.quantityKg || 0);
    acc.totalLossesKg += Number(r.lossesKg || 0);
    return acc;
  }, { count: 0, totalQuantityKg: 0, totalLossesKg: 0 });

  res.json({ totals, recent });
});

export default router;
