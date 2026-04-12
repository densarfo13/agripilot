/**
 * Farroway Intelligence Module — Pest Risk Routes (Farmer-Facing)
 *
 * 8 endpoints covering image upload, pest reporting, risk views,
 * alerts, feedback, treatments, and outcomes.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';

// @ts-ignore — JS module
import { authenticate } from '../lib/auth.js';
// @ts-ignore — JS module
import prisma from '../lib/prisma.js';
// @ts-ignore — JS module
import { writeAuditLog } from '../lib/audit.js';
import { evaluateAndCreateAlert, getActiveAlerts } from '../services/alert.service.js';
import { computeComponentScores } from '../services/components.service.js';
import { assessImageQuality, checkImageCompleteness } from '../services/image-quality.service.js';
import { computeDiagnosisConfidence } from '../services/confidence.service.js';
import { generateActionGuidance, generateAlertActionSummary } from '../services/action-engine.service.js';

import {
  computeFarmPestRisk,
  riskLevelFromScore,
  computeVerificationSignal,
} from '../services/scoring.service.js';

import {
  validate,
  createPestImageSchema,
  createPestReportSchema,
  createTreatmentSchema,
  createOutcomeSchema,
  submitFeedbackSchema,
} from '../validation/schemas.js';

import type { AuthRequest } from '../types/index.js';

// @ts-ignore — JS module (email service for pest alert notifications)
let sendPestAlertEmail: any = null;
let shouldSendEmail: any = null;
let PEST_ALERT_MIN_CONFIDENCE: number = 0.6;
try {
  // Lazy-load to avoid circular dependency / missing module errors
  const emailMod = await import('../../src/modules/email/service.js');
  const constMod = await import('../../src/modules/email/constants.js');
  sendPestAlertEmail = emailMod.sendPestAlertEmail;
  shouldSendEmail = emailMod.shouldSendEmail;
  PEST_ALERT_MIN_CONFIDENCE = constMod.PEST_ALERT_MIN_CONFIDENCE ?? 0.6;
} catch { /* email module not available — alerts disabled */ }

const router = Router();

router.use(authenticate);

async function verifyFarmOwnership(userId: string, profileId: string): Promise<boolean> {
  const profile = await prisma.farmProfile.findFirst({
    where: { id: profileId, userId },
    select: { id: true },
  });
  return !!profile;
}

// ---------------------------------------------------------------------------
// 1. POST /images — Upload pest image metadata
// ---------------------------------------------------------------------------
router.post('/images', validate(createPestImageSchema), async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { profileId, imageType, imageUrl, gpsLat, gpsLng } = req.body;

    if (!await verifyFarmOwnership(user.id, profileId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Assess image quality
    const quality = assessImageQuality(imageType, req.body.metadata);

    const image = await prisma.v2PestImage.create({
      data: {
        profileId,
        imageType,
        imageUrl,
        gpsLat: gpsLat ?? null,
        gpsLng: gpsLng ?? null,
        uploadedBy: user.id,
        qualityScore: quality.qualityScore,
        blurScore: quality.blurScore,
        brightnessScore: quality.brightnessScore,
        resolutionOk: quality.resolutionOk,
        qualityPassed: quality.qualityPassed,
        rejectionReason: quality.rejectionReason,
        qualityNotes: quality.qualityNotes,
      },
    });

    // Only create detection if quality passes
    if (quality.qualityPassed && quality.qualityScore > 40) {
      await prisma.v2ImageDetection.create({
        data: {
          imageId: image.id,
          likelyIssue: 'uncertain',
          alternativeIssue: 'pest',
          confidenceScore: quality.qualityScore,
          severityScore: Math.round(quality.qualityScore * 0.6),
          isUncertain: true,
          detectionMetadata: { autoAssessed: true, qualityScore: quality.qualityScore },
        },
      });
    }

    return res.status(201).json({
      data: {
        imageId: image.id,
        qualityScore: quality.qualityScore,
        qualityPassed: quality.qualityPassed,
        rejectionReason: quality.rejectionReason,
        retryGuidance: quality.qualityNotes,
      },
    });
  } catch (err: any) {
    console.error('[pest-risk] POST /images error:', err);
    return res.status(500).json({ error: 'Failed to upload image metadata' });
  }
});

// ---------------------------------------------------------------------------
// 2. POST /report — Create pest report from scan
// ---------------------------------------------------------------------------
router.post('/report', validate(createPestReportSchema), async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { profileId, imageIds, cropCycleId, verificationAnswers, notes } = req.body;

    if (!await verifyFarmOwnership(user.id, profileId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Gate: check image completeness and quality
    const imageCheck = await checkImageCompleteness(profileId, imageIds);
    if (!imageCheck.complete) {
      return res.status(400).json({
        error: 'Image requirements not met',
        missing: imageCheck.missing,
        failedQuality: imageCheck.failedQuality,
      });
    }

    const report = await prisma.v2PestReport.create({
      data: {
        profileId,
        cropCycleId: cropCycleId ?? null,
        reportedBy: user.id,
        status: 'open',
        notes: notes ?? null,
        imageIds: imageIds || [],
      },
    });

    // Store verification answers
    const answerEntries = Object.entries(verificationAnswers || {});
    if (answerEntries.length > 0) {
      await prisma.v2VerificationAnswer.createMany({
        data: answerEntries.map(([questionKey, answerValue]) => ({
          pestReportId: report.id,
          questionKey,
          answerValue: answerValue as string,
        })),
      });
    }

    // Compute all 7 scoring components from real DB data
    const components = await computeComponentScores(profileId);
    const scoringResult = computeFarmPestRisk(components);
    const riskLevel = riskLevelFromScore(scoringResult.score);

    // Compute confidence + uncertainty
    const verificationScore = computeVerificationSignal(verificationAnswers || {});
    const diagnosis = await computeDiagnosisConfidence(
      profileId, imageIds, verificationScore, scoringResult.score, riskLevel,
    );

    // Generate action guidance
    const actionGuidance = generateActionGuidance({
      likelyIssue: diagnosis.likelyIssue,
      severity: diagnosis.severityScore,
      riskLevel,
      isUncertain: diagnosis.isUncertain,
      confidenceScore: diagnosis.confidenceScore,
    });

    // Persist farm risk
    const farmRisk = await prisma.v2FarmPestRisk.create({
      data: {
        profileId,
        imageScore: components.image_score,
        fieldStressScore: components.field_stress_score,
        cropStageVulnerability: components.crop_stage_vulnerability,
        weatherSuitability: components.weather_suitability,
        nearbyOutbreakDensity: components.nearby_outbreak_density,
        farmHistoryScore: components.farm_history_score,
        verificationResponseScore: components.verification_response_score,
        overallRiskScore: scoringResult.score,
        riskLevel,
        computedAt: new Date(),
      },
    });

    // Update report with diagnosis results
    await prisma.v2PestReport.update({
      where: { id: report.id },
      data: {
        riskScore: scoringResult.score,
        riskLevel,
        likelyIssue: diagnosis.likelyIssue,
        alternativeIssue: diagnosis.alternativeIssue,
        confidenceScore: diagnosis.confidenceScore,
        isUncertain: diagnosis.isUncertain,
        actionGuidance: actionGuidance as any,
      },
    });

    // Evaluate alert with action guidance
    let alert = null;
    try {
      alert = await evaluateAndCreateAlert({
        targetType: 'farm',
        targetId: profileId,
        alertLevel: riskLevel === 'urgent' ? 'urgent' : riskLevel === 'high' ? 'high_risk' : 'elevated',
        alertReason: 'pest_report_submitted',
        alertMessage: `Pest report submitted with risk score ${Math.round(scoringResult.score)}`,
        confidenceScore: diagnosis.confidenceScore,
        actionGuidance: generateAlertActionSummary(riskLevel, diagnosis.likelyIssue),
      });
    } catch (_alertErr) {
      // Alert evaluation is non-critical
    }

    // Fire-and-forget pest alert email for high-confidence, actionable reports
    if (
      sendPestAlertEmail &&
      (riskLevel === 'high' || riskLevel === 'urgent') &&
      diagnosis.confidenceScore >= PEST_ALERT_MIN_CONFIDENCE &&
      actionGuidance
    ) {
      (async () => {
        try {
          const userRecord = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true, fullName: true } });
          if (userRecord?.email && (!shouldSendEmail || await shouldSendEmail(user.id, 'pest_alert'))) {
            sendPestAlertEmail({
              to: userRecord.email,
              fullName: userRecord.fullName,
              riskLevel,
              likelyIssue: diagnosis.likelyIssue,
              confidenceScore: diagnosis.confidenceScore,
              actionGuidance,
              appUrl: process.env.FRONTEND_BASE_URL,
              relatedUserId: user.id,
              relatedReportId: report.id,
            });
          }
        } catch { /* email failure is non-critical */ }
      })();
    }

    await writeAuditLog(req, {
      userId: user.id,
      action: 'pest_report_created',
      entityType: 'V2PestReport',
      entityId: report.id,
      metadata: { profileId, riskScore: scoringResult.score, riskLevel, confidenceScore: diagnosis.confidenceScore },
    });

    return res.status(201).json({
      data: {
        reportId: report.id,
        riskScore: scoringResult.score,
        riskLevel,
        likelyIssue: diagnosis.likelyIssue,
        alternativeIssue: diagnosis.alternativeIssue,
        confidenceScore: diagnosis.confidenceScore,
        isUncertain: diagnosis.isUncertain,
        severity: diagnosis.severityScore,
        actionGuidance,
        alert,
      },
    });
  } catch (err: any) {
    console.error('[pest-risk] POST /report error:', err);
    return res.status(500).json({ error: 'Failed to create pest report' });
  }
});

// ---------------------------------------------------------------------------
// 3. GET /farms/:profileId/risk — Farm risk summary
// ---------------------------------------------------------------------------
router.get('/farms/:profileId/risk', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const profileId = req.params.profileId as string;
    if (!await verifyFarmOwnership(user.id, profileId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const latestRisk = await prisma.v2FarmPestRisk.findFirst({
      where: { profileId },
      orderBy: { computedAt: 'desc' },
    });

    const recentReports = await prisma.v2PestReport.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const latestStress = await prisma.v2FieldStressScore.findFirst({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      data: {
        risk: latestRisk,
        recentReports,
        fieldStress: latestStress,
      },
    });
  } catch (err: any) {
    console.error('[pest-risk] GET /farms/:profileId/risk error:', err);
    return res.status(500).json({ error: 'Failed to fetch farm risk summary' });
  }
});

// ---------------------------------------------------------------------------
// 4. GET /farms/:profileId/hotspots — Active hotspots
// ---------------------------------------------------------------------------
router.get('/farms/:profileId/hotspots', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const profileId = req.params.profileId as string;
    if (!await verifyFarmOwnership(user.id, profileId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const hotspots = await prisma.v2HotspotZone.findMany({
      where: { profileId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    const hotspotsWithTrend = hotspots.map((h: any) => {
      const ageHours = (Date.now() - new Date(h.createdAt).getTime()) / (1000 * 60 * 60);
      let trend: string;
      if (ageHours < 24) trend = 'rising';
      else if (ageHours < 72) trend = 'stable';
      else trend = 'declining';
      return { ...h, trend };
    });

    return res.json({ data: hotspotsWithTrend });
  } catch (err: any) {
    console.error('[pest-risk] GET /farms/:profileId/hotspots error:', err);
    return res.status(500).json({ error: 'Failed to fetch hotspots' });
  }
});

// ---------------------------------------------------------------------------
// 5. GET /alerts/me — Current user's alerts
// ---------------------------------------------------------------------------
router.get('/alerts/me', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;

    const userAlerts = await getActiveAlerts('user', user.id);

    const profiles = await prisma.farmProfile.findMany({
      where: { userId: user.id },
      select: { id: true },
    });

    const profileIds = profiles.map((p: any) => p.id);
    let farmAlerts: any[] = [];
    for (const pid of profileIds) {
      const alerts = await getActiveAlerts('farm', pid);
      farmAlerts = farmAlerts.concat(alerts);
    }

    const allAlerts = [...userAlerts, ...farmAlerts];
    const seen = new Set<string>();
    const deduplicated = allAlerts.filter((a: any) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });

    deduplicated.sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return res.json({ data: deduplicated.slice(0, 20) });
  } catch (err: any) {
    console.error('[pest-risk] GET /alerts/me error:', err);
    return res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// ---------------------------------------------------------------------------
// 6. POST /reports/:id/feedback — Diagnosis feedback
// ---------------------------------------------------------------------------
router.post('/reports/:id/feedback', validate(submitFeedbackSchema), async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const reportId = req.params.id;

    const report = await prisma.v2PestReport.findUnique({ where: { id: reportId } });
    if (!report) {
      return res.status(404).json({ error: 'Pest report not found' });
    }
    if (!await verifyFarmOwnership(user.id, report.profileId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { userFeedback, helpfulScore, confirmedIssue, notes } = req.body;

    await prisma.v2DiagnosisFeedback.create({
      data: {
        pestReportId: reportId,
        userId: user.id,
        userFeedback,
        helpfulScore: helpfulScore ?? null,
        confirmedIssue: confirmedIssue ?? null,
        notes: notes ?? null,
      },
    });

    return res.json({ data: { success: true } });
  } catch (err: any) {
    console.error('[pest-risk] POST /reports/:id/feedback error:', err);
    return res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// ---------------------------------------------------------------------------
// 7. POST /reports/:id/treatment — Log treatment
// ---------------------------------------------------------------------------
router.post('/reports/:id/treatment', validate(createTreatmentSchema), async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const reportId = req.params.id;

    const report = await prisma.v2PestReport.findUnique({ where: { id: reportId } });
    if (!report) {
      return res.status(404).json({ error: 'Pest report not found' });
    }
    if (!await verifyFarmOwnership(user.id, report.profileId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { actionTaken, productUsed, notes, actionDate } = req.body;

    const treatment = await prisma.v2TreatmentAction.create({
      data: {
        pestReportId: reportId,
        profileId: report.profileId,
        actionTaken,
        productUsed: productUsed ?? null,
        notes: notes ?? null,
        actionDate: actionDate ? new Date(actionDate) : new Date(),
      },
    });

    await writeAuditLog(req, {
      userId: user.id,
      action: 'treatment_logged',
      entityType: 'V2TreatmentAction',
      entityId: treatment.id,
      metadata: { reportId, profileId: report.profileId },
    });

    return res.status(201).json({ data: { treatmentId: treatment.id } });
  } catch (err: any) {
    console.error('[pest-risk] POST /reports/:id/treatment error:', err);
    return res.status(500).json({ error: 'Failed to log treatment' });
  }
});

// ---------------------------------------------------------------------------
// 8. POST /treatments/:id/outcome — Log outcome
// ---------------------------------------------------------------------------
router.post('/treatments/:id/outcome', validate(createOutcomeSchema), async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const treatmentId = req.params.id;

    const treatment = await prisma.v2TreatmentAction.findUnique({ where: { id: treatmentId } });
    if (!treatment) {
      return res.status(404).json({ error: 'Treatment action not found' });
    }
    if (!await verifyFarmOwnership(user.id, treatment.profileId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { outcomeStatus, followupNotes, followupImageUrl, followupDate } = req.body;

    await prisma.v2TreatmentOutcome.create({
      data: {
        treatmentActionId: treatmentId,
        outcomeStatus,
        followupNotes: followupNotes ?? null,
        followupImageUrl: followupImageUrl ?? null,
        followupDate: followupDate ? new Date(followupDate) : new Date(),
      },
    });

    return res.json({ data: { success: true } });
  } catch (err: any) {
    console.error('[pest-risk] POST /treatments/:id/outcome error:', err);
    return res.status(500).json({ error: 'Failed to log treatment outcome' });
  }
});

export default router;
