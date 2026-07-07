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
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireAuth, requireRole } from '../middleware/rbac.js';
// Merged-blocker spec §3 — NGO routes must be org-scoped at the
// middleware level so a reviewer in NGO A can never read NGO B's
// roster even if their JWT carries the correct role. The legacy
// chain authenticated + role-gated, but didn't populate
// req.organizationId — meaning any inline `where: { organizationId }`
// filter would have been undefined and the query would have
// returned every org's data. Adding extractOrganization here
// guarantees a reviewer's queries are bounded to their own org.
import { extractOrganization, orgWhereFarmer } from '../src/middleware/orgScope.js';

const router = express.Router();

// NGO endpoints are role-gated AND org-scoped. Route-level stack:
//   authenticate         — populates req.user (id, role)
//   requireAuth          — 401 guard
//   requireNgoRole       — 403 unless role ∈ NGO role set
//   extractOrganization  — populates req.organizationId; handlers
//                          call orgWhereFarmer(req) to scope queries
//
// Accepted roles (Phase 5 spec §Security):
//   'reviewer'            — legacy NGO operator role
//   'institutional_admin' — NGO admin (server-side name)
//   'field_officer'       — field agent (server-side name)
//   'ngo_admin'           — canonical client-side NGO admin role
//   'field_agent'         — canonical client-side field agent role
//   'ngo'                 — short alias (server normalisation maps this)
//   'admin' / 'super_admin' — always bypass via rbac.js SUPER_ROLES
const requireNgoRole = requireRole(
  'reviewer', 'institutional_admin', 'field_officer',
  'ngo_admin', 'field_agent', 'ngo',
);
const NGO_SCOPE = [authenticate, requireAuth, requireNgoRole, extractOrganization];

const ACTIVE_WINDOW_DAYS = 30;

// ─── GET /api/v2/ngo/overview ──────────────────────────────
// Org-scoped: all queries filter by req.organizationId via
// orgWhereFarmer(req) so NGO A cannot see NGO B's data.
router.get('/overview', ...NGO_SCOPE, async (req, res) => {
  const now = new Date();
  const activeSince = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * 86_400_000);
  const orgWhere = orgWhereFarmer(req); // {} for super_admin, { organizationId } otherwise
  const orgId = orgWhere.organizationId || null;
  // FIX (2026-07-06): FarmProfile has NO `organizationId` column — its org path is
  // `farmer.organizationId`. The flat orgWhereFarmer filter is Farmer-shaped; spreading it
  // onto FarmProfile/V2CropCycle threw PrismaClientValidationError for org-scoped NGO admins
  // (super_admin was unaffected because orgWhere is {} there). Scope via the farmer relation.
  const profileOrgWhere = orgId ? { farmer: { organizationId: orgId } } : {};
  // IssueReport has no relation to FarmProfile/Farmer/Organization, so it can't be nested-
  // filtered; scope it by the org's farm-profile IDs (resolved via the canonical path above).
  const orgProfileIds = orgId
    ? (await prisma.farmProfile.findMany({ where: profileOrgWhere, select: { id: true } })).map((p) => p.id)
    : null;

  const [
    totalFarmers,
    activeFarmers,
    openHighRiskIssues,
    cropsInProgress,
  ] = await Promise.all([
    prisma.farmProfile.count({ where: { status: 'active', ...profileOrgWhere } }),
    prisma.farmProfile.count({
      where: { status: 'active', updatedAt: { gte: activeSince }, ...profileOrgWhere },
    }),
    prisma.issueReport.findMany({
      where: {
        status: { in: ['open', 'in_review'] },
        severity: 'high',
        ...(orgProfileIds ? { farmProfileId: { in: orgProfileIds } } : {}),
      },
      select: { farmProfileId: true },
      distinct: ['farmProfileId'],
    }),
    prisma.v2CropCycle.count({
      where: {
        lifecycleStatus: { in: [
          'planned', 'planting', 'growing', 'flowering', 'harvest_ready',
        ] },
        ...(orgId ? { profile: { farmer: { organizationId: orgId } } } : {}),
      },
    }).catch(() => 0),
  ]);

  res.json({
    totalFarmers,
    activeFarmers,
    inactiveFarmers: Math.max(0, totalFarmers - activeFarmers),
    highRiskFarmers: openHighRiskIssues.length,
    cropsInProgress,
    generatedAt: now.toISOString(),
  });
});

// ─── GET /api/v2/ngo/risk-summary ──────────────────────────
// Org-scoped: neither IssueReport nor FarmProfile carries an
// organizationId column — the org path is farmer.organizationId. Resolve
// the org's farm-profile IDs first, then bound both queries (mirrors the
// /overview fix and the canonical orgWhereApplication shape in orgScope.js).
router.get('/risk-summary', ...NGO_SCOPE, async (req, res) => {
  // For each open/in-review issue with severity >= medium, surface
  // the farm + farmer context so the NGO can triage from one list.
  const orgId = orgWhereFarmer(req).organizationId || null;
  const profileOrgWhere = orgId ? { farmer: { organizationId: orgId } } : {};
  const orgProfileIds = orgId
    ? (await prisma.farmProfile.findMany({ where: profileOrgWhere, select: { id: true } })).map((p) => p.id)
    : null;

  const issues = await prisma.issueReport.findMany({
    where: {
      status: { in: ['open', 'in_review'] },
      severity: { in: ['medium', 'high'] },
      ...(orgProfileIds ? { farmProfileId: { in: orgProfileIds } } : {}),
    },
    orderBy: [{ severity: 'desc' }, { reportedAt: 'desc' }],
    take: 200,
  });

  const farmIds = Array.from(new Set(issues.map((i) => i.farmProfileId)));
  const farms = farmIds.length
    ? await prisma.farmProfile.findMany({
        where: { id: { in: farmIds }, ...profileOrgWhere },
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
// Org-scoped via the cycle's profile → farmer relation (V2CropCycle has no
// organizationId column). super_admin (orgId null) stays cross-org.
router.get('/crop-analytics', ...NGO_SCOPE, async (req, res) => {
  const orgId = orgWhereFarmer(req).organizationId || null;
  const rows = await prisma.v2CropCycle.groupBy({
    by: ['cropType', 'lifecycleStatus'],
    where: orgId ? { profile: { farmer: { organizationId: orgId } } } : {},
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
router.get('/intervention', ...NGO_SCOPE, async (req, res) => {
  const stateCode = typeof req.query.state === 'string' ? req.query.state.toUpperCase() : null;
  const now = new Date();
  const inactivityCutoff = new Date(now.getTime() - 14 * 86_400_000);

  // Org scoping — FarmProfile/IssueReport carry no organizationId column, so
  // resolve the org's farm-profile IDs and scope every read through the
  // farmer relation (or those IDs). super_admin (orgId null) stays cross-org.
  const orgId = orgWhereFarmer(req).organizationId || null;
  const profileOrgWhere = orgId ? { farmer: { organizationId: orgId } } : {};
  const orgProfileIds = orgId
    ? (await prisma.farmProfile.findMany({ where: profileOrgWhere, select: { id: true } })).map((p) => p.id)
    : null;

  // Candidate farms: any with open high-severity issue, overdue tasks,
  // or a cycle but no recent task completion.
  const highSevFarmIds = await prisma.issueReport.findMany({
    where: {
      severity: 'high',
      status: { in: ['open', 'in_review'] },
      ...(orgProfileIds ? { farmProfileId: { in: orgProfileIds } } : {}),
    },
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
  // Bound overdue cycles to the org here — this naturally scopes
  // overdueFarmIds (and the candidate set) without touching the global
  // groupBy above, whose cross-org rows are dropped when they don't resolve
  // to an org-scoped cycle below.
  const overdueCycles = overdueCycleIds.length
    ? await prisma.v2CropCycle.findMany({
        where: {
          id: { in: overdueCycleIds },
          ...(orgId ? { profile: { farmer: { organizationId: orgId } } } : {}),
        },
        select: { id: true, profileId: true },
      })
    : [];
  const overdueFarmIds = overdueCycles.map((c) => c.profileId);

  const candidateFarmIds = Array.from(new Set([...highSevFarmIds, ...overdueFarmIds]));
  if (!candidateFarmIds.length) return res.json({ items: [], total: 0 });

  const farms = await prisma.farmProfile.findMany({
    where: {
      id: { in: candidateFarmIds },
      ...(stateCode ? { stateCode } : {}),
      ...profileOrgWhere,
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
// Org-scoped: only returns farms within the caller's organization.
router.get('/inactive-farmers', ...NGO_SCOPE, async (req, res) => {
  const days = Math.max(7, Math.min(90, parseInt(req.query.days, 10) || 14));
  const cutoff = new Date(Date.now() - days * 86_400_000);
  // FarmProfile has no organizationId column — scope via the farmer relation.
  // (The prior flat `...orgWhereFarmer(req)` spread threw PrismaClientValidationError.)
  const orgId = orgWhereFarmer(req).organizationId || null;
  const profileOrgWhere = orgId ? { farmer: { organizationId: orgId } } : {};
  const farms = await prisma.farmProfile.findMany({
    where: { status: 'active', updatedAt: { lt: cutoff }, ...profileOrgWhere },
    orderBy: { updatedAt: 'asc' },
    select: {
      id: true, farmName: true, farmerName: true,
      stateCode: true, country: true, updatedAt: true,
      primaryCrop: true, region: true,
    },
    take: 200,
  });
  // Compute daysSinceLastActivity so the client risk classifier works.
  const now = Date.now();
  const farmersWithActivity = farms.map((f) => ({
    ...f,
    name: f.farmerName || f.farmName || 'Unnamed',
    crop: f.primaryCrop || null,
    daysSinceLastActivity: f.updatedAt
      ? Math.floor((now - new Date(f.updatedAt).getTime()) / 86_400_000)
      : null,
  }));
  res.json({ cutoffDays: days, farmers: farmersWithActivity, farms: farmersWithActivity });
});

// ─── GET /api/v2/ngo/overdue-clusters ──────────────────────
// Overdue task counts grouped by cycle → farm. Useful for spotting
// a single farm with many stalled cycles at once.
router.get('/overdue-clusters', ...NGO_SCOPE, async (req, res) => {
  const now = new Date();
  // Org scoping — bound the cycle lookup (and thus every downstream farm)
  // through the profile → farmer relation. Cross-org rows in the global
  // groupBy below are dropped when they don't resolve to an org cycle here.
  const orgId = orgWhereFarmer(req).organizationId || null;
  const profileOrgWhere = orgId ? { farmer: { organizationId: orgId } } : {};
  const groups = await prisma.cycleTaskPlan.groupBy({
    by: ['cropCycleId'],
    where: { status: 'pending', dueDate: { lt: now } },
    _count: { _all: true },
  }).catch(() => []);
  if (!groups.length) return res.json({ clusters: [] });

  const cycleIds = groups.map((g) => g.cropCycleId);
  const cycles = await prisma.v2CropCycle.findMany({
    where: {
      id: { in: cycleIds },
      ...(orgId ? { profile: { farmer: { organizationId: orgId } } } : {}),
    },
    select: { id: true, cropType: true, profileId: true, lifecycleStatus: true },
  });
  const farmIds = Array.from(new Set(cycles.map((c) => c.profileId)));
  const farms = await prisma.farmProfile.findMany({
    where: { id: { in: farmIds }, ...profileOrgWhere },
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
// Org-scoped via the record's farm → farmer relation. V2HarvestRecord's FK
// is `farmId` → FarmProfile; neither carries an organizationId column.
router.get('/harvest-analytics', ...NGO_SCOPE, async (req, res) => {
  const orgId = orgWhereFarmer(req).organizationId || null;
  const recent = await prisma.v2HarvestRecord.findMany({
    where: orgId ? { farm: { farmer: { organizationId: orgId } } } : {},
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
