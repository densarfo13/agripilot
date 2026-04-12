import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { writeAuditLog } from '../lib/audit.js';
import { computeFarmPestRisk, riskLevelFromScore } from '../services/intelligence/scoringEngine.js';
import { evaluateAndCreateAlert } from '../services/intelligence/alertEngine.js';

const router = express.Router();

// ─── Allowed enum values ────────────────────────────────────────────────────
const VALID_IMAGE_TYPES = ['leaf_closeup', 'whole_plant', 'field_wide', 'hotspot_photo', 'followup'];
const VALID_FEEDBACK_VALUES = ['accurate', 'partially_accurate', 'inaccurate'];
const VALID_OUTCOME_STATUSES = ['improved', 'same', 'worse', 'resolved'];

// ─── Stub helpers for services not yet implemented ──────────────────────────
// These will be replaced by real service imports once the services exist.

async function assessImageQuality(/* imageUrl, imageType */) {
  // Placeholder: returns a neutral quality score until imageAnalysisService is built
  return { qualityScore: 70, qualityNotes: 'auto-assessed (stub)' };
}

async function detectCropIssue(/* imageId */) {
  // Placeholder: returns null detection until imageAnalysisService is built
  return null;
}

async function analyzeImageSet(/* imageIds */) {
  // Placeholder: returns a baseline analysis until imageAnalysisService is built
  return {
    suspectedIssue: null,
    confidenceScore: 0,
    severityScore: 0,
    spreadScope: null,
  };
}

// ─── POST /images — Upload pest image metadata ─────────────────────────────
router.post('/images', authenticate, async (req, res) => {
  try {
    const { profileId, imageType, imageUrl, capturedAt, gpsLat, gpsLng } = req.body;

    // Validate required fields
    if (!profileId) return res.status(400).json({ error: 'profileId is required' });
    if (!imageType) return res.status(400).json({ error: 'imageType is required' });
    if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' });

    if (!VALID_IMAGE_TYPES.includes(imageType)) {
      return res.status(400).json({ error: `imageType must be one of: ${VALID_IMAGE_TYPES.join(', ')}` });
    }

    // Verify profile exists
    const profile = await prisma.farmProfile.findUnique({ where: { id: profileId }, select: { id: true } });
    if (!profile) return res.status(400).json({ error: 'Farm profile not found' });

    // Run image quality assessment
    const quality = await assessImageQuality(imageUrl, imageType);

    // Create pest image record
    const image = await prisma.v2PestImage.create({
      data: {
        profileId,
        uploadedBy: req.user.id,
        imageType,
        imageUrl,
        capturedAt: capturedAt ? new Date(capturedAt) : null,
        gpsLat: gpsLat != null ? parseFloat(gpsLat) : null,
        gpsLng: gpsLng != null ? parseFloat(gpsLng) : null,
        qualityScore: quality.qualityScore,
        qualityNotes: quality.qualityNotes,
      },
    });

    // Run detection
    const detection = await detectCropIssue(image.id);

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'pest_image.uploaded',
      entityType: 'V2PestImage',
      entityId: image.id,
      metadata: { imageType, profileId, qualityScore: quality.qualityScore },
    });

    return res.status(201).json({ data: { image, detection } });
  } catch (error) {
    console.error('POST /api/v2/pest-risk/images failed:', error);
    return res.status(500).json({ error: 'Failed to upload pest image' });
  }
});

// ─── POST /report — Create pest report from scan ───────────────────────────
router.post('/report', authenticate, async (req, res) => {
  try {
    const { profileId, cropCycleId, imageIds, suspectedIssue, notes, verificationAnswers } = req.body;

    // Validate required fields
    if (!profileId) return res.status(400).json({ error: 'profileId is required' });
    if (!Array.isArray(imageIds) || imageIds.length === 0) {
      return res.status(400).json({ error: 'imageIds must be a non-empty array' });
    }

    // Verify profile exists
    const profile = await prisma.farmProfile.findUnique({ where: { id: profileId }, select: { id: true } });
    if (!profile) return res.status(400).json({ error: 'Farm profile not found' });

    // Analyze the image set
    const analysis = await analyzeImageSet(imageIds);

    // Gather scoring components from available data
    const latestStress = await prisma.v2FieldStressScore.findFirst({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
    });

    const components = {
      image_score: analysis.severityScore || 0,
      field_stress_score: latestStress?.stressScore || 0,
      crop_stage_vulnerability: 0, // requires crop cycle stage integration
      weather_suitability: 0,      // requires weather integration
      nearby_outbreak_density: 0,  // requires regional data
      farm_history_score: 0,       // requires historical report count
      verification_response_score: 0,
    };

    // Score verification answers if provided
    if (Array.isArray(verificationAnswers) && verificationAnswers.length > 0) {
      const yesCount = verificationAnswers.filter(a => a.answerValue === 'yes').length;
      components.verification_response_score = (yesCount / verificationAnswers.length) * 100;
    }

    // Compute farm pest risk
    const risk = await computeFarmPestRisk(components);

    // Create the pest report
    const report = await prisma.v2PestReport.create({
      data: {
        profileId,
        reportedBy: req.user.id,
        cropCycleId: cropCycleId || null,
        reportSource: 'farmer_scan',
        suspectedIssue: suspectedIssue || analysis.suspectedIssue || null,
        reportConfidence: analysis.confidenceScore || null,
        spreadScope: analysis.spreadScope || null,
        riskLevel: risk.level,
        riskScore: risk.score,
        notes: notes || null,
        imageIds,
        status: 'open',
      },
    });

    // Create verification answers if provided
    if (Array.isArray(verificationAnswers) && verificationAnswers.length > 0) {
      await prisma.v2VerificationAnswer.createMany({
        data: verificationAnswers.map(a => ({
          pestReportId: report.id,
          questionKey: a.questionKey,
          answerValue: a.answerValue,
        })),
      });
    }

    // Evaluate alert
    const alertResult = await evaluateAndCreateAlert({
      targetType: 'farm',
      targetId: profileId,
      riskScore: risk.score,
      reason: 'pest_detected',
      issueType: suspectedIssue || analysis.suspectedIssue,
    });

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'pest_report.created',
      entityType: 'V2PestReport',
      entityId: report.id,
      metadata: { profileId, riskLevel: risk.level, riskScore: risk.score, imageCount: imageIds.length },
    });

    return res.status(201).json({
      data: {
        report,
        risk: { score: risk.score, level: risk.level, components: risk.components },
        alert: alertResult.created ? alertResult.alert : undefined,
      },
    });
  } catch (error) {
    console.error('POST /api/v2/pest-risk/report failed:', error);
    return res.status(500).json({ error: 'Failed to create pest report' });
  }
});

// ─── GET /farms/:profileId/risk — Farm risk summary ────────────────────────
router.get('/farms/:profileId/risk', authenticate, async (req, res) => {
  try {
    const { profileId } = req.params;

    // Get latest farm pest risk
    const latestRisk = await prisma.v2FarmPestRisk.findFirst({
      where: { profileId },
      orderBy: { computedAt: 'desc' },
    });

    // Get recent pest reports (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentReports = await prisma.v2PestReport.findMany({
      where: {
        profileId,
        createdAt: { gte: thirtyDaysAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get latest field stress
    const fieldStress = await prisma.v2FieldStressScore.findFirst({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      data: {
        riskScore: latestRisk?.overallRiskScore ?? null,
        riskLevel: latestRisk?.riskLevel ?? null,
        components: latestRisk ? {
          imageScore: latestRisk.imageScore,
          fieldStressScore: latestRisk.fieldStressScore,
          cropStageVulnerability: latestRisk.cropStageVulnerability,
          weatherSuitability: latestRisk.weatherSuitability,
          nearbyOutbreakDensity: latestRisk.nearbyOutbreakDensity,
          farmHistoryScore: latestRisk.farmHistoryScore,
          verificationResponseScore: latestRisk.verificationResponseScore,
        } : null,
        recentReports,
        fieldStress,
      },
    });
  } catch (error) {
    console.error('GET /api/v2/pest-risk/farms/:profileId/risk failed:', error);
    return res.status(500).json({ error: 'Failed to load farm risk summary' });
  }
});

// ─── GET /farms/:profileId/hotspots — Farm hotspot zones ───────────────────
router.get('/farms/:profileId/hotspots', authenticate, async (req, res) => {
  try {
    const { profileId } = req.params;

    const hotspots = await prisma.v2HotspotZone.findMany({
      where: {
        profileId,
        status: 'active',
      },
      orderBy: { inspectionPriority: 'desc' },
    });

    return res.json({ data: { hotspots } });
  } catch (error) {
    console.error('GET /api/v2/pest-risk/farms/:profileId/hotspots failed:', error);
    return res.status(500).json({ error: 'Failed to load hotspot zones' });
  }
});

// ─── GET /alerts/me — Farmer's active alerts ───────────────────────────────
router.get('/alerts/me', authenticate, async (req, res) => {
  try {
    // Find the farmer's profile
    const profile = await prisma.farmProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });

    if (!profile) {
      return res.json({ data: { alerts: [] } });
    }

    const alerts = await prisma.v2AlertEvent.findMany({
      where: {
        targetType: 'farm',
        targetId: profile.id,
        sentStatus: 'sent',
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return res.json({ data: { alerts } });
  } catch (error) {
    console.error('GET /api/v2/pest-risk/alerts/me failed:', error);
    return res.status(500).json({ error: 'Failed to load alerts' });
  }
});

// ─── POST /reports/:id/feedback — Submit diagnosis feedback ────────────────
router.post('/reports/:id/feedback', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { userFeedback, helpfulScore, confirmedIssue, notes } = req.body;

    if (!userFeedback) return res.status(400).json({ error: 'userFeedback is required' });
    if (!VALID_FEEDBACK_VALUES.includes(userFeedback)) {
      return res.status(400).json({ error: `userFeedback must be one of: ${VALID_FEEDBACK_VALUES.join(', ')}` });
    }
    if (helpfulScore != null && (helpfulScore < 1 || helpfulScore > 5)) {
      return res.status(400).json({ error: 'helpfulScore must be between 1 and 5' });
    }

    // Verify report exists
    const report = await prisma.v2PestReport.findUnique({ where: { id }, select: { id: true } });
    if (!report) return res.status(404).json({ error: 'Pest report not found' });

    const feedback = await prisma.v2DiagnosisFeedback.create({
      data: {
        pestReportId: id,
        userId: req.user.id,
        userFeedback,
        helpfulScore: helpfulScore != null ? parseInt(helpfulScore, 10) : null,
        confirmedIssue: confirmedIssue || null,
        notes: notes || null,
      },
    });

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'diagnosis.feedback',
      entityType: 'V2DiagnosisFeedback',
      entityId: feedback.id,
      metadata: { pestReportId: id, userFeedback, helpfulScore },
    });

    return res.status(201).json({ data: { feedback } });
  } catch (error) {
    console.error('POST /api/v2/pest-risk/reports/:id/feedback failed:', error);
    return res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// ─── POST /reports/:id/treatment — Log treatment action ────────────────────
router.post('/reports/:id/treatment', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { actionTaken, actionDate, productUsed, notes } = req.body;

    if (!actionTaken) return res.status(400).json({ error: 'actionTaken is required' });
    if (!actionDate) return res.status(400).json({ error: 'actionDate is required' });

    // Verify report exists and get profileId
    const report = await prisma.v2PestReport.findUnique({ where: { id }, select: { id: true, profileId: true } });
    if (!report) return res.status(404).json({ error: 'Pest report not found' });

    const treatment = await prisma.v2TreatmentAction.create({
      data: {
        profileId: report.profileId,
        pestReportId: id,
        actionTaken,
        actionDate: new Date(actionDate),
        productUsed: productUsed || null,
        notes: notes || null,
      },
    });

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'treatment.logged',
      entityType: 'V2TreatmentAction',
      entityId: treatment.id,
      metadata: { pestReportId: id, actionTaken },
    });

    return res.status(201).json({ data: { treatment } });
  } catch (error) {
    console.error('POST /api/v2/pest-risk/reports/:id/treatment failed:', error);
    return res.status(500).json({ error: 'Failed to log treatment' });
  }
});

// ─── POST /treatments/:id/outcome — Log treatment outcome ─────────────────
router.post('/treatments/:id/outcome', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { outcomeStatus, outcomeScore, followupNotes, followupImageUrl, followupDate } = req.body;

    if (!outcomeStatus) return res.status(400).json({ error: 'outcomeStatus is required' });
    if (!VALID_OUTCOME_STATUSES.includes(outcomeStatus)) {
      return res.status(400).json({ error: `outcomeStatus must be one of: ${VALID_OUTCOME_STATUSES.join(', ')}` });
    }
    if (!followupDate) return res.status(400).json({ error: 'followupDate is required' });

    // Verify treatment exists
    const treatment = await prisma.v2TreatmentAction.findUnique({ where: { id }, select: { id: true } });
    if (!treatment) return res.status(404).json({ error: 'Treatment action not found' });

    const outcome = await prisma.v2TreatmentOutcome.create({
      data: {
        treatmentActionId: id,
        outcomeStatus,
        outcomeScore: outcomeScore != null ? parseFloat(outcomeScore) : null,
        followupNotes: followupNotes || null,
        followupImageUrl: followupImageUrl || null,
        followupDate: new Date(followupDate),
      },
    });

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'treatment.outcome',
      entityType: 'V2TreatmentOutcome',
      entityId: outcome.id,
      metadata: { treatmentActionId: id, outcomeStatus },
    });

    return res.status(201).json({ data: { outcome } });
  } catch (error) {
    console.error('POST /api/v2/pest-risk/treatments/:id/outcome failed:', error);
    return res.status(500).json({ error: 'Failed to log treatment outcome' });
  }
});

export default router;
