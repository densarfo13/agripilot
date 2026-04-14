import express from 'express';
import { authenticate, authorize } from '../src/middleware/auth.js';
import { extractOrganization } from '../src/middleware/orgScope.js';
import prisma from '../src/config/database.js';
import { asyncHandler } from '../src/middleware/errorHandler.js';
import {
  buildActivityFilters,
  buildTimeWindows,
  summarizeCompleteness,
  DEFAULT_ACTIVITY_WINDOW_DAYS,
} from '../src/utils/farmerOps.js';
import {
  evaluatePesticideCompliance,
  summarizeCompliance,
} from '../src/utils/pesticideCompliance.js';

const router = express.Router();

router.use(authenticate, authorize('super_admin', 'institutional_admin'), extractOrganization);

// ─── GET / ─────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const orgFilter = req.organizationId ? { organizationId: req.organizationId } : {};
  const windowDays = parseInt(req.query.windowDays || String(DEFAULT_ACTIVITY_WINDOW_DAYS), 10);
  const tw = buildTimeWindows({ activityWindowDays: windowDays });

  const { activeFarmerWhere, inactiveFarmerWhere, setupIncompleteWhere } = buildActivityFilters({
    organizationId: req.organizationId,
    windowDays,
  });

  // Base farmer counts
  const [totalFarmers, approvedFarmers] = await Promise.all([
    prisma.farmer.count({ where: orgFilter }),
    prisma.farmer.count({ where: { ...orgFilter, registrationStatus: 'approved' } }),
  ]);

  // Time-bound activity status counts (single source of truth)
  const [activeFarmers, inactiveFarmers, setupIncomplete] = await Promise.all([
    prisma.farmer.count({ where: activeFarmerWhere }),
    prisma.farmer.count({ where: inactiveFarmerWhere }),
    prisma.farmer.count({ where: setupIncompleteWhere }),
  ]);

  // Season-scoped org filter for progress entries and validations
  const seasonOrgFilter = req.organizationId
    ? { farmSeason: { farmer: { organizationId: req.organizationId } } }
    : {};

  const [totalUpdates, validatedUpdates, pendingValidations, recentUpdates] = await Promise.all([
    prisma.seasonProgressEntry.count({ where: seasonOrgFilter }),
    prisma.officerValidation.count({ where: { ...seasonOrgFilter, status: 'approved' } }),
    prisma.officerValidation.count({ where: { ...seasonOrgFilter, status: 'pending' } }),
    prisma.seasonProgressEntry.count({
      where: { ...seasonOrgFilter, createdAt: { gte: tw.activityCutoff } },
    }),
  ]);

  // Needs attention: active season but zero progress entries
  const needsAttention = await prisma.farmer.count({
    where: {
      ...orgFilter,
      registrationStatus: 'approved',
      farmSeasons: {
        some: { status: 'active' },
        every: { progressEntries: { none: {} } },
      },
    },
  });

  // Onboarding rate: farmers with at least one season / total
  const farmersWithSeason = await prisma.farmer.count({
    where: { ...orgFilter, farmSeasons: { some: {} } },
  });

  const onboardingRate = totalFarmers > 0
    ? ((farmersWithSeason / totalFarmers) * 100).toFixed(1) + '%'
    : '0%';

  // First update rate
  const farmersWithEntry = await prisma.farmer.count({
    where: {
      ...orgFilter,
      farmSeasons: { some: { progressEntries: { some: {} } } },
    },
  });

  const firstUpdateRate = farmersWithSeason > 0
    ? ((farmersWithEntry / farmersWithSeason) * 100).toFixed(1) + '%'
    : '0%';

  // Land boundary and seed scan counts
  const [landBoundaryCount, seedScanCount, seedWarningCount] = await Promise.all([
    prisma.v2LandBoundary.count(),
    prisma.v2SeedScan.count(),
    prisma.v2SeedScan.count({ where: { authenticity: { in: ['warning', 'failed'] } } }),
  ]);

  // Duplicate flags count
  const duplicateFlagged = await prisma.farmer.count({
    where: { ...orgFilter, duplicateFlag: { in: ['possible_duplicate', 'review_needed'] } },
  });

  // Profile completeness summary (sample up to 500 for performance)
  const farmerSample = await prisma.farmer.findMany({
    where: { ...orgFilter, registrationStatus: 'approved' },
    select: {
      fullName: true, phone: true, region: true,
      primaryCrop: true, landSizeHectares: true, countryCode: true,
    },
    take: 500,
  });
  const completeness = summarizeCompleteness(farmerSample);

  // ── Pesticide compliance summary (farm-specific) ──────
  const farmersWithPesticide = await prisma.farmer.findMany({
    where: { ...orgFilter, farmActivities: { some: { activityType: 'pesticide' } } },
    select: { id: true },
    take: 500,
  });

  let pesticideComplianceSummary = { compliant: 0, needsReview: 0, nonCompliant: 0, totalEvaluated: 0 };

  if (farmersWithPesticide.length > 0) {
    const farmerIds = farmersWithPesticide.map(f => f.id);
    const [allPesticideActs, allHarvestActs] = await Promise.all([
      prisma.farmActivity.findMany({
        where: { farmerId: { in: farmerIds }, activityType: 'pesticide' },
        orderBy: { activityDate: 'desc' },
        select: { id: true, farmerId: true, activityDate: true, metadata: true },
      }),
      prisma.farmActivity.findMany({
        where: { farmerId: { in: farmerIds }, activityType: 'harvesting' },
        orderBy: { activityDate: 'desc' },
        select: { id: true, farmerId: true, activityDate: true, quantity: true, unit: true },
      }),
    ]);

    // Group by farmer — strict farm isolation
    const pestByFarmer = {};
    for (const act of allPesticideActs) {
      if (!pestByFarmer[act.farmerId]) pestByFarmer[act.farmerId] = [];
      pestByFarmer[act.farmerId].push(act);
    }
    const harvByFarmer = {};
    for (const act of allHarvestActs) {
      if (!harvByFarmer[act.farmerId]) harvByFarmer[act.farmerId] = [];
      harvByFarmer[act.farmerId].push(act);
    }

    const results = Object.keys(pestByFarmer).map(fId =>
      evaluatePesticideCompliance({
        pesticideActivities: pestByFarmer[fId],
        harvestActivities: harvByFarmer[fId] || [],
      })
    );
    pesticideComplianceSummary = summarizeCompliance(results);
  }

  res.json({
    totalFarmers,
    activeFarmers,
    inactiveFarmers,
    setupIncomplete,
    totalUpdates,
    recentUpdates,
    validatedUpdates,
    pendingValidations,
    needsAttention,
    onboardingRate,
    firstUpdateRate,
    landBoundaryCount,
    seedScanCount,
    seedWarningCount,
    duplicateFlagged,
    profileCompleteness: {
      complete: completeness.complete,
      incomplete: completeness.incomplete,
      completePct: completeness.completePct,
      commonMissing: completeness.commonMissing.slice(0, 5),
    },
    pesticideCompliance: pesticideComplianceSummary,
    timeWindow: {
      windowDays: tw.windowDays,
      label: tw.windowLabel,
      cutoff: tw.activityCutoff.toISOString(),
    },
  });
}));

export default router;
