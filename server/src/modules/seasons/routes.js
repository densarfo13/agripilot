import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize, requireApprovedFarmer, requireFarmerOwnership } from '../../middleware/auth.js';
import { validateParamUUID } from '../../middleware/validate.js';
import { dedupGuard } from '../../middleware/dedup.js';
import { submissionLimiter } from '../../middleware/rateLimiters.js';
import { idempotencyCheck } from '../../middleware/idempotency.js';
import * as svc from './service.js';
import { getSeasonComparison } from './comparison.js';
import { computeProgressScore, getProgressScore, CLASSIFICATION_LABELS } from './scoring.js';
import { createHarvestReport, getHarvestReport, updateHarvestReport } from './harvest.js';
import { getPerformanceProfile, getSeasonPerformanceSummary, getInvestorIntelligence } from './profile.js';
import { computeCredibility, getCredibility, getFarmerCredibilitySummary, CREDIBILITY_LEVELS } from './credibility.js';
import { addProgressImage, getProgressImages } from './imageValidation.js';
import { createOfficerValidation, listOfficerValidations, getValidationSummary } from './officerValidation.js';
import { getAdviceAdherence } from './adviceAdherence.js';
import { getSeasonHistory, compareSeasons } from './seasonHistory.js';
import { getSeasonTrustSummary, getPerformanceExport } from './trustSummary.js';
import prisma from '../../config/database.js';
import { transitionSeasonStatus, checkSeasonStaleness, getStaleSeasons } from './statusTransitions.js';
import { writeAuditLog } from '../audit/service.js';
import { extractOrganization, verifyOrgAccess } from '../../middleware/orgScope.js';
import { sodGuard } from '../../middleware/sodGuard.js';
import { markExecuted } from '../security/service.js';

// ─── Helper: verify farmer belongs to caller's org ────
async function requireFarmerOrgAccess(req, res, next) {
  // Cross-org users (super_admin) skip org check
  if (req.isCrossOrg) return next();
  if (!req.organizationId) return next();

  const farmerId = req.params.farmerId;
  if (!farmerId) return next();

  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
    select: { organizationId: true },
  });

  if (!farmer) {
    return res.status(404).json({ error: 'Farmer not found' });
  }

  if (!verifyOrgAccess(req, farmer.organizationId)) {
    return res.status(403).json({ error: 'Access denied — farmer belongs to a different organization' });
  }

  next();
}

const STAFF_ROLES = ['super_admin', 'institutional_admin', 'field_officer', 'reviewer'];
const VALID_CONDITIONS = ['good', 'average', 'poor'];
const VALID_ADVICE = ['yes', 'no', 'partial'];
const VALID_STAGES = ['pre_planting', 'planting', 'vegetative', 'flowering', 'harvest', 'post_harvest'];
const VALID_IMAGE_STAGES = ['early_growth', 'mid_stage', 'pre_harvest', 'harvest', 'storage'];

const router = Router();
router.use(authenticate);
router.use(extractOrganization);
router.use(requireApprovedFarmer);

// ─── Season ownership middleware ────────────────────────
// For routes that use :seasonId, verify the farmer owns this season
async function requireSeasonAccess(req, res, next) {
  const seasonId = req.params.seasonId || req.params.id;
  if (!seasonId) return next();

  // Staff roles pass through
  if (req.user.role !== 'farmer') return next();

  // Farmer must own the season
  const farmerId = await svc.getSeasonFarmerId(seasonId);
  if (!farmerId) return res.status(404).json({ error: 'Season not found' });

  // Check farmer ownership via user account
  const farmer = await (await import('../../config/database.js')).default.farmer.findUnique({
    where: { id: farmerId },
    select: { userId: true },
  });

  if (!farmer || farmer.userId !== req.user.sub) {
    return res.status(403).json({ error: 'Access denied — not your season' });
  }
  next();
}

// ═══════════════════════════════════════════════════════
//  SEASON CRUD
// ═══════════════════════════════════════════════════════

// Create season for a farmer
router.post('/farmer/:farmerId',
  validateParamUUID('farmerId'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireFarmerOwnership,
  submissionLimiter,
  dedupGuard('create-season'),
  idempotencyCheck,
  asyncHandler(async (req, res) => {
    const season = await svc.createSeason(req.params.farmerId, req.body);
    writeAuditLog({
      userId: req.user.sub, action: 'season_created',
      details: { farmerId: req.params.farmerId, seasonId: season.id, cropType: req.body.cropType },
    }).catch(() => {});
    res.status(201).json(season);
  }));

// List seasons for a farmer (?status=active&cropType=maize&page=1&limit=50)
router.get('/farmer/:farmerId',
  validateParamUUID('farmerId'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireFarmerOwnership,
  asyncHandler(async (req, res) => {
    const result = await svc.listSeasons(req.params.farmerId, req.query);
    res.json(result);
  }));

// Get all stale seasons (admin dashboard) — must be before /:id to avoid param capture
router.get('/ops/stale-seasons',
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    // Org-scoped: institutional_admin sees only their org's stale seasons
    const opts = req.organizationId ? { organizationId: req.organizationId } : {};
    res.json(await getStaleSeasons(opts));
  }));

// Get season by ID
router.get('/:id',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireSeasonAccess,
  asyncHandler(async (req, res) => {
    const season = await svc.getSeasonById(req.params.id);

    // Enrich with expected timeline and current expected stage
    const expectedTimeline = svc.getExpectedTimeline(
      season.plantingDate, season.cropType, season.farmer?.countryCode
    );
    const expectedStage = svc.computeExpectedStage(
      season.plantingDate, season.cropType, season.farmer?.countryCode
    );

    const stalenessWarnings = checkSeasonStaleness(season);

    res.json({ ...season, expectedTimeline, expectedStage, stalenessWarnings });
  }));

// Update season (limited fields)
router.patch('/:id',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireSeasonAccess,
  asyncHandler(async (req, res) => {
    res.json(await svc.updateSeason(req.params.id, req.body));
  }));

// ═══════════════════════════════════════════════════════
//  PROGRESS ENTRIES
// ═══════════════════════════════════════════════════════

// Log progress entry
router.post('/:id/progress',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireSeasonAccess,
  submissionLimiter,
  dedupGuard('progress'),
  asyncHandler(async (req, res) => {
    // Validate enums if provided
    if (req.body.cropCondition && !VALID_CONDITIONS.includes(req.body.cropCondition)) {
      return res.status(400).json({ error: `cropCondition must be one of: ${VALID_CONDITIONS.join(', ')}` });
    }
    if (req.body.followedAdvice && !VALID_ADVICE.includes(req.body.followedAdvice)) {
      return res.status(400).json({ error: `followedAdvice must be one of: ${VALID_ADVICE.join(', ')}` });
    }
    if (req.body.imageStage && !VALID_IMAGE_STAGES.includes(req.body.imageStage)) {
      return res.status(400).json({ error: `imageStage must be one of: ${VALID_IMAGE_STAGES.join(', ')}` });
    }
    const entry = await svc.createProgressEntry(req.params.id, req.body);
    writeAuditLog({
      userId: req.user.sub, action: 'progress_entry_created',
      details: { seasonId: req.params.id, entryType: req.body.entryType },
    }).catch(() => {});
    res.status(201).json(entry);
  }));

// List progress entries (?entryType=activity|condition|advice)
router.get('/:id/progress',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireSeasonAccess,
  asyncHandler(async (req, res) => {
    res.json(await svc.listProgressEntries(req.params.id, req.query));
  }));

// ═══════════════════════════════════════════════════════
//  CROP CONDITION UPDATES
// ═══════════════════════════════════════════════════════

router.post('/:id/condition',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireSeasonAccess,
  submissionLimiter,
  dedupGuard('condition'),
  asyncHandler(async (req, res) => {
    if (!req.body.cropCondition || !VALID_CONDITIONS.includes(req.body.cropCondition)) {
      return res.status(400).json({ error: `cropCondition is required and must be one of: ${VALID_CONDITIONS.join(', ')}` });
    }
    const entry = await svc.createConditionUpdate(req.params.id, req.body);
    res.status(201).json(entry);
  }));

// ═══════════════════════════════════════════════════════
//  STAGE CONFIRMATION
// ═══════════════════════════════════════════════════════

// Confirm or flag stage mismatch
router.post('/:id/stage-confirmation',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireSeasonAccess,
  submissionLimiter,
  dedupGuard('stage-confirmation'),
  asyncHandler(async (req, res) => {
    if (!req.body.confirmedStage || !VALID_STAGES.includes(req.body.confirmedStage)) {
      return res.status(400).json({ error: `confirmedStage is required and must be one of: ${VALID_STAGES.join(', ')}` });
    }
    const confirmation = await svc.createStageConfirmation(req.params.id, req.body);
    writeAuditLog({
      userId: req.user.sub, action: 'stage_confirmed',
      details: { seasonId: req.params.id, expected: confirmation.expectedStage, confirmed: confirmation.confirmedStage, mismatch: confirmation.isMismatch },
    }).catch(() => {});
    res.status(201).json(confirmation);
  }));

// List stage confirmations
router.get('/:id/stage-confirmation',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireSeasonAccess,
  asyncHandler(async (req, res) => {
    res.json(await svc.listStageConfirmations(req.params.id));
  }));

// ═══════════════════════════════════════════════════════
//  EXPECTED TIMELINE
// ═══════════════════════════════════════════════════════

router.get('/:id/expected-timeline',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireSeasonAccess,
  asyncHandler(async (req, res) => {
    const season = await svc.getSeasonById(req.params.id);
    const timeline = svc.getExpectedTimeline(
      season.plantingDate, season.cropType, season.farmer?.countryCode
    );
    const currentExpected = svc.computeExpectedStage(
      season.plantingDate, season.cropType, season.farmer?.countryCode
    );
    res.json({ seasonId: season.id, cropType: season.cropType, plantingDate: season.plantingDate, currentExpected, timeline });
  }));

// ═══════════════════════════════════════════════════════
//  COMPARISON (Expected vs Actual)
// ═══════════════════════════════════════════════════════

router.get('/:id/comparison',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireSeasonAccess,
  asyncHandler(async (req, res) => {
    res.json(await getSeasonComparison(req.params.id));
  }));

// ═══════════════════════════════════════════════════════
//  PROGRESS SCORE
// ═══════════════════════════════════════════════════════

// Get or compute progress score
router.get('/:id/progress-score',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireSeasonAccess,
  asyncHandler(async (req, res) => {
    // ?refresh=true forces recompute
    const result = req.query.refresh === 'true'
      ? await computeProgressScore(req.params.id)
      : await getProgressScore(req.params.id);
    res.json(result);
  }));

// Recompute progress score explicitly
router.post('/:id/progress-score',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES),
  requireSeasonAccess,
  dedupGuard('progress-score'),
  asyncHandler(async (req, res) => {
    const result = await computeProgressScore(req.params.id);
    writeAuditLog({
      userId: req.user.sub, action: 'progress_score_computed',
      details: { seasonId: req.params.id, score: result.progressScore, classification: result.performanceClassification },
    }).catch(() => {});
    res.json(result);
  }));

// Classification reference (static — no auth needed beyond base)
router.get('/meta/classifications', (_req, res) => {
  res.json(CLASSIFICATION_LABELS);
});

// ═══════════════════════════════════════════════════════
//  HARVEST REPORTING
// ═══════════════════════════════════════════════════════

// Submit harvest report (closes the season)
router.post('/:id/harvest-report',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireSeasonAccess,
  submissionLimiter,
  dedupGuard('harvest-report'),
  idempotencyCheck,
  asyncHandler(async (req, res) => {
    const report = await createHarvestReport(req.params.id, req.body, req.user.sub);
    writeAuditLog({
      userId: req.user.sub, action: 'harvest_report_created',
      details: { seasonId: req.params.id, totalHarvestKg: report.totalHarvestKg },
    }).catch(() => {});
    res.status(201).json(report);
  }));

// Get harvest report
router.get('/:id/harvest-report',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireSeasonAccess,
  asyncHandler(async (req, res) => {
    res.json(await getHarvestReport(req.params.id));
  }));

// Correct/update harvest report (only on reopened seasons)
router.patch('/:id/harvest-report',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin'),
  requireSeasonAccess,
  dedupGuard('harvest-report-correction'),
  asyncHandler(async (req, res) => {
    const report = await updateHarvestReport(req.params.id, req.body, req.user.sub);
    writeAuditLog({
      userId: req.user.sub, action: 'harvest_report_corrected',
      details: { seasonId: req.params.id, corrections: Object.keys(req.body) },
    }).catch(() => {});
    res.json(report);
  }));

// ═══════════════════════════════════════════════════════
//  SEASON PERFORMANCE SUMMARY
// ═══════════════════════════════════════════════════════

router.get('/:id/performance-summary',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES, 'investor_viewer'),
  requireSeasonAccess,
  asyncHandler(async (req, res) => {
    res.json(await getSeasonPerformanceSummary(req.params.id));
  }));

// ═══════════════════════════════════════════════════════
//  FARMER PERFORMANCE PROFILE (multi-season)
// ═══════════════════════════════════════════════════════

router.get('/farmer/:farmerId/performance-profile',
  validateParamUUID('farmerId'),
  authorize(...STAFF_ROLES, 'investor_viewer'),
  requireFarmerOrgAccess,
  asyncHandler(async (req, res) => {
    res.json(await getPerformanceProfile(req.params.farmerId));
  }));

// ═══════════════════════════════════════════════════════
//  INVESTOR INTELLIGENCE (read-only, stripped)
// ═══════════════════════════════════════════════════════

router.get('/investor/farmers/:farmerId/intelligence',
  validateParamUUID('farmerId'),
  authorize('super_admin', 'institutional_admin', 'investor_viewer'),
  requireFarmerOrgAccess,
  asyncHandler(async (req, res) => {
    res.json(await getInvestorIntelligence(req.params.farmerId));
  }));

// ═══════════════════════════════════════════════════════
//  CREDIBILITY ASSESSMENT
// ═══════════════════════════════════════════════════════

// Get credibility assessment for a season
router.get('/:id/credibility',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES, 'investor_viewer'),
  requireSeasonAccess,
  asyncHandler(async (req, res) => {
    res.json(await getCredibility(req.params.id));
  }));

// Force recompute credibility
router.post('/:id/recompute-credibility',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES),
  requireSeasonAccess,
  dedupGuard('recompute-credibility'),
  asyncHandler(async (req, res) => {
    const result = await computeCredibility(req.params.id);
    writeAuditLog({
      userId: req.user.sub, action: 'credibility_computed',
      details: { seasonId: req.params.id, score: result.credibilityScore, level: result.credibilityLevel },
    }).catch(() => {});
    res.json(result);
  }));

// Credibility levels reference
router.get('/meta/credibility-levels', (_req, res) => {
  res.json(CREDIBILITY_LEVELS);
});

// Multi-season credibility summary for a farmer
router.get('/farmer/:farmerId/credibility-summary',
  validateParamUUID('farmerId'),
  authorize(...STAFF_ROLES, 'investor_viewer'),
  requireFarmerOrgAccess,
  asyncHandler(async (req, res) => {
    res.json(await getFarmerCredibilitySummary(req.params.farmerId));
  }));

// ═══════════════════════════════════════════════════════
//  PROGRESS IMAGES
// ═══════════════════════════════════════════════════════

// Upload progress image with metadata
router.post('/:id/progress-image',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireSeasonAccess,
  submissionLimiter,
  dedupGuard('progress-image'),
  asyncHandler(async (req, res) => {
    if (req.body.imageStage && !VALID_IMAGE_STAGES.includes(req.body.imageStage)) {
      return res.status(400).json({ error: `imageStage must be one of: ${VALID_IMAGE_STAGES.join(', ')}` });
    }
    const result = await addProgressImage(req.params.id, req.body);
    writeAuditLog({
      userId: req.user.sub, action: 'progress_image_added',
      details: { seasonId: req.params.id, imageStage: req.body.imageStage },
    }).catch(() => {});
    res.status(201).json(result);
  }));

// List progress images with validation metadata
router.get('/:id/progress-images',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireSeasonAccess,
  asyncHandler(async (req, res) => {
    res.json(await getProgressImages(req.params.id));
  }));

// ═══════════════════════════════════════════════════════
//  OFFICER VALIDATION
// ═══════════════════════════════════════════════════════

// Validation queue — active seasons with recent progress needing officer review
router.get('/validation-queue',
  authorize('super_admin', 'institutional_admin', 'field_officer'),
  extractOrganization,
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const officerId = req.user.sub;
    const isAdmin = ['super_admin', 'institutional_admin'].includes(req.user.role);

    // Build where clause: active seasons in caller's org (or assigned to officer)
    const where = { status: 'active' };
    if (!isAdmin) {
      where.farmer = { assignedOfficerId: officerId };
    } else if (req.organizationId) {
      where.farmer = { organizationId: req.organizationId };
    }

    const seasons = await prisma.farmSeason.findMany({
      where,
      include: {
        farmer: { select: { id: true, fullName: true, region: true, district: true, profileImageUrl: true, primaryCrop: true } },
        progressEntries: {
          orderBy: { entryDate: 'desc' },
          take: 5,
          select: { id: true, entryType: true, activityType: true, cropCondition: true, imageUrl: true, imageStage: true, entryDate: true, description: true, createdAt: true },
        },
        officerValidations: {
          orderBy: { validatedAt: 'desc' },
          take: 1,
          select: { id: true, validationType: true, validatedAt: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip: offset,
      take: limit,
    });

    // Build queue items — each season becomes a queue card
    const queue = seasons.map(s => {
      const lastValidation = s.officerValidations[0] || null;
      const recentEntries = s.progressEntries;
      const latestEntry = recentEntries[0] || null;
      const imageEntries = recentEntries.filter(e => e.imageUrl);
      const daysSinceValidation = lastValidation
        ? Math.floor((Date.now() - new Date(lastValidation.validatedAt)) / 86400000)
        : null;
      const daysSinceEntry = latestEntry
        ? Math.floor((Date.now() - new Date(latestEntry.entryDate)) / 86400000)
        : null;

      // Priority: no validation > stale validation > recent validation
      let priority = 'normal';
      if (!lastValidation) priority = 'high';
      else if (daysSinceValidation > 14) priority = 'high';
      else if (daysSinceValidation > 7) priority = 'medium';

      return {
        seasonId: s.id,
        farmerId: s.farmer.id,
        farmerName: s.farmer.fullName,
        farmerRegion: s.farmer.region,
        farmerDistrict: s.farmer.district,
        farmerImage: s.farmer.profileImageUrl,
        cropType: s.cropType,
        currentStage: s.currentStage || null,
        plantingDate: s.plantingDate,
        latestEntry: latestEntry ? {
          id: latestEntry.id,
          type: latestEntry.entryType,
          activityType: latestEntry.activityType,
          condition: latestEntry.cropCondition,
          imageUrl: latestEntry.imageUrl,
          imageStage: latestEntry.imageStage,
          date: latestEntry.entryDate,
          description: latestEntry.description,
        } : null,
        recentImages: imageEntries.map(e => ({ url: e.imageUrl, stage: e.imageStage, date: e.entryDate })),
        lastValidationDate: lastValidation?.validatedAt || null,
        daysSinceValidation,
        daysSinceEntry,
        entryCount: recentEntries.length,
        priority,
      };
    });

    // Sort: high priority first, then by days since validation desc
    queue.sort((a, b) => {
      const pMap = { high: 3, medium: 2, normal: 1 };
      if (pMap[a.priority] !== pMap[b.priority]) return pMap[b.priority] - pMap[a.priority];
      return (b.daysSinceValidation || 999) - (a.daysSinceValidation || 999);
    });

    res.json({ queue, total: queue.length });
  }));

// Submit officer validation for a season
router.post('/:id/officer-validate',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin', 'field_officer'),
  requireSeasonAccess,
  dedupGuard('officer-validate'),
  asyncHandler(async (req, res) => {
    const validation = await createOfficerValidation(req.params.id, req.user.sub, req.body);
    writeAuditLog({
      userId: req.user.sub, action: 'officer_validation_created',
      details: { seasonId: req.params.id, validationType: req.body.validationType },
    }).catch(() => {});
    res.status(201).json(validation);
  }));

// List officer validations for a season
router.get('/:id/officer-validations',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES, 'investor_viewer'),
  requireSeasonAccess,
  asyncHandler(async (req, res) => {
    res.json(await listOfficerValidations(req.params.id));
  }));

// Get officer validation summary for a season
router.get('/:id/validation-summary',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES, 'investor_viewer'),
  requireSeasonAccess,
  asyncHandler(async (req, res) => {
    res.json(await getValidationSummary(req.params.id));
  }));

// ═══════════════════════════════════════════════════════
//  ADVICE ADHERENCE
// ═══════════════════════════════════════════════════════

// Get advice adherence analysis for a season
router.get('/:id/advice-adherence',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES, 'investor_viewer'),
  requireSeasonAccess,
  asyncHandler(async (req, res) => {
    res.json(await getAdviceAdherence(req.params.id));
  }));

// ═══════════════════════════════════════════════════════
//  SEASON HISTORY & COMPARISON
// ═══════════════════════════════════════════════════════

// Get full season history with trends for a farmer
router.get('/farmer/:farmerId/season-history',
  validateParamUUID('farmerId'),
  authorize(...STAFF_ROLES, 'investor_viewer'),
  requireFarmerOrgAccess,
  asyncHandler(async (req, res) => {
    res.json(await getSeasonHistory(req.params.farmerId));
  }));

// Compare two seasons side-by-side
router.get('/compare/:seasonId1/:seasonId2',
  validateParamUUID('seasonId1'),
  validateParamUUID('seasonId2'),
  authorize(...STAFF_ROLES, 'investor_viewer'),
  asyncHandler(async (req, res) => {
    res.json(await compareSeasons(req.params.seasonId1, req.params.seasonId2));
  }));

// ═══════════════════════════════════════════════════════
//  TRUST SUMMARY & EXPORT
// ═══════════════════════════════════════════════════════

// Season-level trust summary (concise intelligence view)
router.get('/:id/trust-summary',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES, 'investor_viewer'),
  requireSeasonAccess,
  asyncHandler(async (req, res) => {
    res.json(await getSeasonTrustSummary(req.params.id));
  }));

// Farmer-level performance export (bridge-ready)
router.get('/farmer/:farmerId/performance-export',
  validateParamUUID('farmerId'),
  authorize(...STAFF_ROLES, 'investor_viewer'),
  requireFarmerOrgAccess,
  asyncHandler(async (req, res) => {
    res.json(await getPerformanceExport(req.params.farmerId));
  }));

// ═══════════════════════════════════════════════════════
//  SEASON STATUS TRANSITIONS
// ═══════════════════════════════════════════════════════

// Abandon a season (farmer or staff)
router.post('/:id/abandon',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireSeasonAccess,
  dedupGuard('abandon'),
  asyncHandler(async (req, res) => {
    const { season, previousStatus } = await transitionSeasonStatus(req.params.id, 'abandoned', {
      userId: req.user.sub,
      role: req.user.role,
      reason: req.body.reason || 'Season abandoned',
    });
    writeAuditLog({
      userId: req.user.sub, action: 'season_abandoned',
      details: { seasonId: req.params.id, previousStatus, reason: req.body.reason },
    }).catch(() => {});
    res.json({ message: 'Season abandoned', season });
  }));

// Declare crop failure (farmer or staff)
router.post('/:id/crop-failure',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireSeasonAccess,
  dedupGuard('crop-failure'),
  asyncHandler(async (req, res) => {
    // Atomic: status transition + cropFailureReported flag in single updateMany
    const { season, previousStatus } = await transitionSeasonStatus(req.params.id, 'failed', {
      userId: req.user.sub,
      role: req.user.role,
      reason: req.body.reason || 'Crop failure declared',
      extraData: { cropFailureReported: true },
    });
    writeAuditLog({
      userId: req.user.sub, action: 'season_crop_failure',
      details: { seasonId: req.params.id, previousStatus, reason: req.body.reason },
    }).catch(() => {});
    res.json({ message: 'Crop failure recorded', season });
  }));

// Close/complete a harvested season (admin review)
router.post('/:id/close',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin'),
  requireSeasonAccess,
  dedupGuard('close-season'),
  asyncHandler(async (req, res) => {
    const { season, previousStatus } = await transitionSeasonStatus(req.params.id, 'completed', {
      userId: req.user.sub,
      role: req.user.role,
      reason: req.body.reason || 'Season reviewed and closed',
    });
    writeAuditLog({
      userId: req.user.sub, action: 'season_closed',
      details: { seasonId: req.params.id, previousStatus, reason: req.body.reason },
    }).catch(() => {});
    res.json({ message: 'Season closed', season });
  }));

// Reopen a season (SoD-protected — requires prior approved ApprovalRequest)
router.post('/:id/reopen',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin'),
  requireSeasonAccess,
  dedupGuard('reopen-season'),
  sodGuard({ requestType: 'season_reopen', getTargetId: req => req.params.id }),
  asyncHandler(async (req, res) => {
    if (!req.body.reason) {
      return res.status(400).json({ error: 'A reason is required to reopen a season' });
    }
    const { season, previousStatus } = await transitionSeasonStatus(req.params.id, 'active', {
      userId: req.user.sub,
      role: req.user.role,
      reason: req.body.reason,
    });
    // Mark the approval request as executed (idempotent — best effort)
    markExecuted(req.approvalRequest.id).catch(() => {});
    writeAuditLog({
      userId: req.user.sub, action: 'season_reopened',
      details: {
        seasonId: req.params.id, previousStatus, reason: req.body.reason,
        approvalRequestId: req.approvalRequest.id,
        approvedById: req.approvalRequest.approvedById,
      },
    }).catch(() => {});
    res.json({ message: 'Season reopened', season, previousStatus });
  }));

// Get staleness warnings for a specific season
router.get('/:id/staleness',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES),
  requireSeasonAccess,
  asyncHandler(async (req, res) => {
    const season = await svc.getSeasonById(req.params.id);
    const warnings = checkSeasonStaleness(season);
    res.json({ seasonId: req.params.id, status: season.status, warnings });
  }));

export default router;
