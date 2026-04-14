import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { evaluatePesticideCompliance, buildComplianceTimeline, determineConfidence } from '../src/utils/pesticideCompliance.js';

const router = express.Router();

// ─── Buyer-facing status labels ────────────────────────────────
const BUYER_STATUS = {
  compliant: { label: 'Safe to harvest', color: 'green' },
  needs_review: { label: 'Needs review', color: 'amber' },
  non_compliant: { label: 'Not safe', color: 'red' },
};

function mapToBuyerStatus(internalStatus) {
  return BUYER_STATUS[internalStatus] || BUYER_STATUS.needs_review;
}

// ─── GET /api/v2/buyer-trust/farms ─────────────────────────────
// Returns all farms with compliance trust data for buyer view.
// Scoped to the authenticated user's organization.
// Supports filtering by ?status=safe|needs_review|not_safe
router.get('/farms', authenticate, async (req, res) => {
  try {
    const orgId = req.organizationId || null;
    const statusFilter = req.query.status; // safe | needs_review | not_safe

    // Get all farmers with farm profiles in this org
    const farmers = await prisma.farmer.findMany({
      where: {
        ...(orgId ? { organizationId: orgId } : {}),
        accessStatus: 'approved',
      },
      select: {
        id: true,
        fullName: true,
        primaryCrop: true,
        region: true,
        farmProfiles: {
          select: { id: true, farmName: true, crop: true, locationName: true },
          take: 1,
        },
      },
      take: 200,
    });

    // Fetch all pesticide + harvest activities for these farmers in bulk
    const farmerIds = farmers.map(f => f.id);

    const [allPesticide, allHarvest, allValidations] = await Promise.all([
      prisma.farmActivity.findMany({
        where: { farmerId: { in: farmerIds }, activityType: 'pesticide' },
        select: { id: true, farmerId: true, activityDate: true, metadata: true },
        orderBy: { activityDate: 'desc' },
      }),
      prisma.farmActivity.findMany({
        where: { farmerId: { in: farmerIds }, activityType: 'harvesting' },
        select: { id: true, farmerId: true, activityDate: true, quantity: true, unit: true },
        orderBy: { activityDate: 'desc' },
      }),
      prisma.officerValidation.groupBy({
        by: ['seasonId'],
        where: {
          season: { farmerId: { in: farmerIds } },
        },
        _count: true,
      }),
    ]);

    // Get season→farmer mapping for validations
    const validatedSeasonIds = allValidations.map(v => v.seasonId);
    const seasons = validatedSeasonIds.length > 0
      ? await prisma.season.findMany({
          where: { id: { in: validatedSeasonIds } },
          select: { id: true, farmerId: true },
        })
      : [];
    const validatedFarmerIds = new Set(seasons.map(s => s.farmerId));

    // Group by farmer
    const pestByFarmer = {};
    const harvByFarmer = {};
    for (const a of allPesticide) {
      (pestByFarmer[a.farmerId] ||= []).push(a);
    }
    for (const a of allHarvest) {
      (harvByFarmer[a.farmerId] ||= []).push(a);
    }

    // Evaluate each farmer
    const farms = [];
    for (const farmer of farmers) {
      const pest = pestByFarmer[farmer.id] || [];
      const harv = harvByFarmer[farmer.id] || [];
      const hasValidation = validatedFarmerIds.has(farmer.id);

      const compliance = evaluatePesticideCompliance({
        pesticideActivities: pest,
        harvestActivities: harv,
        hasOfficerValidation: hasValidation,
      });

      const buyerStatus = mapToBuyerStatus(compliance.status);
      const profile = farmer.farmProfiles[0] || {};

      // Compute safe harvest date (last pesticide + waiting period)
      let safeHarvestDate = null;
      if (compliance.context.lastPesticideDate) {
        const d = new Date(compliance.context.lastPesticideDate);
        d.setDate(d.getDate() + compliance.rules.harvestWaitingPeriodDays);
        safeHarvestDate = d.toISOString();
      }

      farms.push({
        farmerId: farmer.id,
        farmName: profile.farmName || farmer.fullName,
        farmerName: farmer.fullName,
        crop: profile.crop || farmer.primaryCrop || 'Unknown',
        location: profile.locationName || farmer.region || null,
        status: compliance.status,
        buyerLabel: buyerStatus.label,
        buyerColor: buyerStatus.color,
        confidence: compliance.confidence,
        lastPesticideDate: compliance.context.lastPesticideDate,
        lastHarvestDate: compliance.context.lastHarvestDate,
        safeHarvestDate,
        reason: compliance.reason,
        violationCount: compliance.violations.length,
        totalApplications: compliance.summary.totalApplications,
        timeline: compliance.timeline,
      });
    }

    // Apply filter
    let filtered = farms;
    if (statusFilter === 'safe') {
      filtered = farms.filter(f => f.status === 'compliant');
    } else if (statusFilter === 'needs_review') {
      filtered = farms.filter(f => f.status === 'needs_review');
    } else if (statusFilter === 'not_safe') {
      filtered = farms.filter(f => f.status === 'non_compliant');
    }

    // Summary counts
    const summary = {
      total: farms.length,
      safe: farms.filter(f => f.status === 'compliant').length,
      needsReview: farms.filter(f => f.status === 'needs_review').length,
      notSafe: farms.filter(f => f.status === 'non_compliant').length,
    };

    return res.json({ success: true, farms: filtered, summary });
  } catch (error) {
    console.error('GET /api/v2/buyer-trust/farms failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to load farm trust data' });
  }
});

// ─── GET /api/v2/buyer-trust/farms/:farmerId ────────────────────
// Single farm detail with full timeline for buyer view
router.get('/farms/:farmerId', authenticate, async (req, res) => {
  try {
    const { farmerId } = req.params;

    const farmer = await prisma.farmer.findUnique({
      where: { id: farmerId },
      select: {
        id: true,
        fullName: true,
        primaryCrop: true,
        region: true,
        organizationId: true,
        farmProfiles: {
          select: { id: true, farmName: true, crop: true, locationName: true },
          take: 1,
        },
      },
    });

    if (!farmer) return res.status(404).json({ success: false, error: 'Farmer not found' });

    if (req.organizationId && farmer.organizationId !== req.organizationId) {
      return res.status(403).json({ success: false, error: 'Farmer not in your organization' });
    }

    const [pest, harv, valCount] = await Promise.all([
      prisma.farmActivity.findMany({
        where: { farmerId, activityType: 'pesticide' },
        select: { id: true, activityDate: true, metadata: true },
        orderBy: { activityDate: 'desc' },
      }),
      prisma.farmActivity.findMany({
        where: { farmerId, activityType: 'harvesting' },
        select: { id: true, activityDate: true, quantity: true, unit: true },
        orderBy: { activityDate: 'desc' },
        take: 20,
      }),
      prisma.officerValidation.count({
        where: { season: { farmerId } },
      }),
    ]);

    const compliance = evaluatePesticideCompliance({
      pesticideActivities: pest,
      harvestActivities: harv,
      hasOfficerValidation: valCount > 0,
    });

    const buyerStatus = mapToBuyerStatus(compliance.status);
    const profile = farmer.farmProfiles[0] || {};

    let safeHarvestDate = null;
    if (compliance.context.lastPesticideDate) {
      const d = new Date(compliance.context.lastPesticideDate);
      d.setDate(d.getDate() + compliance.rules.harvestWaitingPeriodDays);
      safeHarvestDate = d.toISOString();
    }

    return res.json({
      success: true,
      farm: {
        farmerId: farmer.id,
        farmName: profile.farmName || farmer.fullName,
        farmerName: farmer.fullName,
        crop: profile.crop || farmer.primaryCrop || 'Unknown',
        location: profile.locationName || farmer.region || null,
        status: compliance.status,
        buyerLabel: buyerStatus.label,
        buyerColor: buyerStatus.color,
        confidence: compliance.confidence,
        lastPesticideDate: compliance.context.lastPesticideDate,
        lastHarvestDate: compliance.context.lastHarvestDate,
        safeHarvestDate,
        reason: compliance.reason,
        action: compliance.action,
        violationCount: compliance.violations.length,
        violations: compliance.violations,
        totalApplications: compliance.summary.totalApplications,
        timeline: compliance.timeline,
        rules: compliance.rules,
      },
    });
  } catch (error) {
    console.error('GET /api/v2/buyer-trust/farms/:farmerId failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to load farm trust detail' });
  }
});

export default router;
