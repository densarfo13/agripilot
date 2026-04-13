import express from 'express';
import { authenticate, authorize } from '../src/middleware/auth.js';
import { extractOrganization } from '../src/middleware/orgScope.js';
import prisma from '../src/config/database.js';
import { asyncHandler } from '../src/middleware/errorHandler.js';

const router = express.Router();

router.use(authenticate, authorize('super_admin', 'institutional_admin'), extractOrganization);

// ─── GET / ─────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const orgFilter = req.organizationId ? { organizationId: req.organizationId } : {};

  // Base farmer counts
  const [totalFarmers, approvedFarmers] = await Promise.all([
    prisma.farmer.count({ where: orgFilter }),
    prisma.farmer.count({ where: { ...orgFilter, registrationStatus: 'approved' } }),
  ]);

  // Farmers with at least one active season
  // NOTE: This "activeFarmers" definition (approved + active season) differs from
  // pilotMetrics service which defines activeFarmers as "logged in".  The dashboard
  // analytics intentionally uses the season-based definition for field relevance.
  const farmersWithActiveSeason = await prisma.farmer.count({
    where: {
      ...orgFilter,
      registrationStatus: 'approved',
      farmSeasons: { some: { status: 'active' } },
    },
  });

  // Setup incomplete: approved but no farm profile (farmLocations) OR no season
  const setupIncomplete = await prisma.farmer.count({
    where: {
      ...orgFilter,
      registrationStatus: 'approved',
      OR: [
        { farmLocations: { none: {} } },
        { farmSeasons: { none: {} } },
      ],
    },
  });

  // Season-scoped org filter for progress entries and validations
  const seasonOrgFilter = req.organizationId
    ? { farmSeason: { farmer: { organizationId: req.organizationId } } }
    : {};

  const [totalUpdates, validatedUpdates, pendingValidations] = await Promise.all([
    prisma.seasonProgressEntry.count({ where: seasonOrgFilter }),
    prisma.officerValidation.count({ where: { ...seasonOrgFilter, status: 'approved' } }),
    prisma.officerValidation.count({ where: { ...seasonOrgFilter, status: 'pending' } }),
  ]);

  // Needs attention: farmers with stale data or issues
  // Defined as approved farmers who have no progress entries across any season
  // and have at least one active season (i.e. active but silent)
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

  // First update rate: farmers with at least one progress entry / total farmers with seasons
  const farmersWithEntry = await prisma.farmer.count({
    where: {
      ...orgFilter,
      farmSeasons: { some: { progressEntries: { some: {} } } },
    },
  });

  const firstUpdateRate = farmersWithSeason > 0
    ? ((farmersWithEntry / farmersWithSeason) * 100).toFixed(1) + '%'
    : '0%';

  // Land boundary and seed scan counts (V2 models, profile-scoped)
  const [landBoundaryCount, seedScanCount, seedWarningCount] = await Promise.all([
    prisma.v2LandBoundary.count(),
    prisma.v2SeedScan.count(),
    prisma.v2SeedScan.count({ where: { authenticity: { in: ['warning', 'failed'] } } }),
  ]);

  res.json({
    totalFarmers,
    activeFarmers: farmersWithActiveSeason,
    setupIncomplete,
    totalUpdates,
    validatedUpdates,
    pendingValidations,
    needsAttention,
    onboardingRate,
    firstUpdateRate,
    landBoundaryCount,
    seedScanCount,
    seedWarningCount,
  });
}));

export default router;
