/**
 * Farroway Intelligence Module — Pest Risk Routes (Farmer-Facing)
 *
 * 8 endpoints covering image upload, pest reporting, risk views,
 * alerts, feedback, treatments, and outcomes.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';

// @ts-ignore — JS module
import { authenticate } from '../../src/middleware/auth.js';
// @ts-ignore — JS module
import prisma from '../../lib/prisma.js';
// @ts-ignore — JS module
import { writeAuditLog } from '../../lib/audit.js';
// @ts-ignore — JS module
import { evaluateAndCreateAlert, getActiveAlerts } from '../../services/intelligence/alertEngine.js';

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

const router = Router();

// All routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// 1. POST /images — Upload pest image metadata
// ---------------------------------------------------------------------------
router.post('/images', validate(createPestImageSchema), async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { profileId, imageType, imageUrl, gpsLat, gpsLng } = req.body;

    const image = await prisma.v2PestImage.create({
      data: {
        profileId,
        imageType,
        imageUrl,
        gpsLat: gpsLat ?? null,
        gpsLng: gpsLng ?? null,
        uploadedBy: user.id,
      },
    });

    // Stub image quality assessment (score 70-95)
    const qualityScore = Math.round(70 + Math.random() * 25);

    await prisma.v2PestImage.update({
      where: { id: image.id },
      data: { qualityScore },
    });

    // If quality is acceptable, create a stub detection record
    if (qualityScore > 60) {
      await prisma.v2ImageDetection.create({
        data: {
          pestImageId: image.id,
          likelyIssue: 'uncertain',
          confidence: qualityScore,
          rawOutput: { stub: true, qualityScore },
        },
      });
    }

    return res.status(201).json({
      data: { imageId: image.id, qualityScore },
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

    // Create the pest report
    const report = await prisma.v2PestReport.create({
      data: {
        profileId,
        cropCycleId: cropCycleId ?? null,
        reportedBy: user.id,
        status: 'open',
        notes: notes ?? null,
      },
    });

    // Link images to the report
    if (imageIds && imageIds.length > 0) {
      await prisma.v2PestImage.updateMany({
        where: { id: { in: imageIds } },
        data: { pestReportId: report.id },
      });
    }

    // Create verification answer records
    const answerEntries = Object.entries(verificationAnswers || {});
    if (answerEntries.length > 0) {
      await prisma.v2VerificationAnswer.createMany({
        data: answerEntries.map(([question, answer]) => ({
          pestReportId: report.id,
          question,
          answer: answer as string,
        })),
      });
    }

    // Aggregate image detections if images exist
    let imageScore = 50; // default
    if (imageIds && imageIds.length > 0) {
      const detections = await prisma.v2ImageDetection.findMany({
        where: { pestImageId: { in: imageIds } },
      });
      if (detections.length > 0) {
        imageScore = Math.round(
          detections.reduce((sum: number, d: any) => sum + (d.confidence || 0), 0) / detections.length,
        );
      }
    }

    // Compute verification response score
    const verificationResponseScore = computeVerificationSignal(verificationAnswers || {});

    // Compute farm pest risk score
    const components = {
      image_score: imageScore,
      verification_score: verificationResponseScore,
      crop_vulnerability_score: 50, // stub — requires crop cycle lookup
      weather_score: 50, // stub — requires weather data
      historical_score: 30, // stub — requires history lookup
      proximity_score: 30, // stub — requires geospatial query
      verification_response_score: verificationResponseScore,
    };

    const scoringResult = computeFarmPestRisk(components);
    const riskLevel = riskLevelFromScore(scoringResult.score);

    // Persist farm pest risk record
    const farmRisk = await prisma.v2FarmPestRisk.create({
      data: {
        profileId,
        pestReportId: report.id,
        riskScore: scoringResult.score,
        riskLevel,
        components: scoringResult.components,
        computedAt: new Date(),
      },
    });

    // Evaluate alert
    let alert = null;
    try {
      const alertResult = await evaluateAndCreateAlert({
        targetType: 'farm',
        targetId: profileId,
        riskScore: scoringResult.score,
        reason: 'pest_report_submitted',
        issueType: 'pest',
        components: scoringResult.components,
      });
      alert = alertResult;
    } catch (_alertErr) {
      // Alert evaluation is non-critical; continue
    }

    // Audit log
    await writeAuditLog(req, {
      userId: user.id,
      action: 'pest_report_created',
      entityType: 'V2PestReport',
      entityId: report.id,
      metadata: { profileId, riskScore: scoringResult.score, riskLevel },
    });

    return res.status(201).json({
      data: {
        reportId: report.id,
        riskScore: scoringResult.score,
        riskLevel,
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
    const { profileId } = req.params;

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
      orderBy: { computedAt: 'desc' },
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
    const { profileId } = req.params;

    const hotspots = await prisma.v2HotspotZone.findMany({
      where: { profileId, status: 'active' },
      orderBy: { detectedAt: 'desc' },
    });

    // Calculate simple trend for each hotspot
    const hotspotsWithTrend = hotspots.map((h: any) => {
      const ageHours = (Date.now() - new Date(h.detectedAt).getTime()) / (1000 * 60 * 60);
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

    // Fetch alerts targeted at the user directly
    const userAlerts = await getActiveAlerts('user', user.id);

    // Also fetch alerts for the user's farm profiles
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

    // Combine, deduplicate by id, sort by createdAt desc, take 20
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

    const { actionTaken, productUsed, notes, actionDate } = req.body;

    const treatment = await prisma.v2TreatmentAction.create({
      data: {
        pestReportId: reportId,
        profileId: report.profileId,
        actionTaken,
        productUsed: productUsed ?? null,
        notes: notes ?? null,
        actionDate: actionDate ? new Date(actionDate) : new Date(),
        recordedBy: user.id,
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
    const treatmentId = req.params.id;

    const treatment = await prisma.v2TreatmentAction.findUnique({ where: { id: treatmentId } });
    if (!treatment) {
      return res.status(404).json({ error: 'Treatment action not found' });
    }

    const { outcomeStatus, followupNotes, followupImageUrl, followupDate } = req.body;

    await prisma.v2TreatmentOutcome.create({
      data: {
        treatmentActionId: treatmentId,
        outcomeStatus,
        followupNotes: followupNotes ?? null,
        followupImageUrl: followupImageUrl ?? null,
        followupDate: followupDate ? new Date(followupDate) : null,
      },
    });

    return res.json({ data: { success: true } });
  } catch (err: any) {
    console.error('[pest-risk] POST /treatments/:id/outcome error:', err);
    return res.status(500).json({ error: 'Failed to log treatment outcome' });
  }
});

export default router;
