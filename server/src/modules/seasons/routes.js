import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize, requireApprovedFarmer, requireFarmerOwnership } from '../../middleware/auth.js';
import { validateParamUUID } from '../../middleware/validate.js';
import * as svc from './service.js';
import { getSeasonComparison } from './comparison.js';
import { computeProgressScore, getProgressScore, CLASSIFICATION_LABELS } from './scoring.js';
import { createHarvestReport, getHarvestReport } from './harvest.js';
import { getPerformanceProfile, getSeasonPerformanceSummary, getInvestorIntelligence } from './profile.js';
import { writeAuditLog } from '../audit/service.js';

const STAFF_ROLES = ['super_admin', 'institutional_admin', 'field_officer', 'reviewer'];
const VALID_CONDITIONS = ['good', 'average', 'poor'];
const VALID_ADVICE = ['yes', 'no', 'partial'];
const VALID_STAGES = ['pre_planting', 'planting', 'vegetative', 'flowering', 'harvest', 'post_harvest'];
const VALID_IMAGE_STAGES = ['early_growth', 'mid_stage', 'pre_harvest', 'harvest', 'storage'];

const router = Router();
router.use(authenticate);
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
  asyncHandler(async (req, res) => {
    const season = await svc.createSeason(req.params.farmerId, req.body);
    writeAuditLog({
      userId: req.user.sub, action: 'season_created',
      details: { farmerId: req.params.farmerId, seasonId: season.id, cropType: req.body.cropType },
    }).catch(() => {});
    res.status(201).json(season);
  }));

// List seasons for a farmer (?status=active&cropType=maize)
router.get('/farmer/:farmerId',
  validateParamUUID('farmerId'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireFarmerOwnership,
  asyncHandler(async (req, res) => {
    res.json(await svc.listSeasons(req.params.farmerId, req.query));
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

    res.json({ ...season, expectedTimeline, expectedStage });
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
  asyncHandler(async (req, res) => {
    const report = await createHarvestReport(req.params.id, req.body);
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
  asyncHandler(async (req, res) => {
    res.json(await getPerformanceProfile(req.params.farmerId));
  }));

// ═══════════════════════════════════════════════════════
//  INVESTOR INTELLIGENCE (read-only, stripped)
// ═══════════════════════════════════════════════════════

router.get('/investor/farmers/:farmerId/intelligence',
  validateParamUUID('farmerId'),
  authorize('super_admin', 'institutional_admin', 'investor_viewer'),
  asyncHandler(async (req, res) => {
    res.json(await getInvestorIntelligence(req.params.farmerId));
  }));

export default router;
