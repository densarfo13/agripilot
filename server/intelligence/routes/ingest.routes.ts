/**
 * Farroway Intelligence Module — Ingestion Routes (Admin)
 *
 * 5 endpoints for satellite/drone data ingestion, farm/region scoring
 * triggers, and alert evaluation.
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
import { ingestSatelliteScan } from '../../services/intelligence/satelliteService.js';
// @ts-ignore — JS module
import { ingestDroneScan } from '../../services/intelligence/droneService.js';
// @ts-ignore — JS module
import { computeDistrictRisk } from '../../services/intelligence/outbreakService.js';
// @ts-ignore — JS module
import { evaluateAndCreateAlert } from '../../services/intelligence/alertEngine.js';

import { requireAdmin } from '../guards/roles.guard.js';
import {
  validate,
  ingestSatelliteSchema,
  ingestDroneSchema,
} from '../validation/schemas.js';
import {
  computeFarmPestRisk,
  riskLevelFromScore,
  computeVerificationSignal,
} from '../services/scoring.service.js';
import type { AuthRequest } from '../types/index.js';

const router = Router();

// All routes require authentication + admin role
router.use(authenticate, requireAdmin);

// ---------------------------------------------------------------------------
// 1. POST /satellite/ingest — Ingest satellite scan
// ---------------------------------------------------------------------------
router.post('/satellite/ingest', validate(ingestSatelliteSchema), async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { profileId, scanDate, imagerySource, cloudCover, rawMetadata } = req.body;

    const result = await ingestSatelliteScan({
      profileId,
      scanDate,
      imagerySource,
      cloudCover,
      rawMetadata,
    });

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    await writeAuditLog(req, {
      userId: user.id,
      action: 'satellite_scan_ingested',
      entityType: 'V2SatelliteScan',
      entityId: result.scan?.id ?? null,
      metadata: { profileId, scanDate },
    });

    return res.status(201).json({
      data: { scan: result.scan, stressScore: result.stressScore },
    });
  } catch (err: any) {
    console.error('[ingest] POST /satellite/ingest error:', err);
    return res.status(500).json({ error: 'Failed to ingest satellite scan' });
  }
});

// ---------------------------------------------------------------------------
// 2. POST /drone/ingest — Ingest drone scan
// ---------------------------------------------------------------------------
router.post('/drone/ingest', validate(ingestDroneSchema), async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { profileId, hotspotZoneId, flightDate, imageBundleUrl, metadata } = req.body;

    const result = await ingestDroneScan({
      profileId,
      hotspotZoneId,
      flightDate,
      imageBundleUrl,
      metadata,
    });

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    await writeAuditLog(req, {
      userId: user.id,
      action: 'drone_scan_ingested',
      entityType: 'V2DroneScan',
      entityId: result.scan?.id ?? null,
      metadata: { profileId, flightDate },
    });

    return res.status(201).json({
      data: { scan: result.scan, validation: result.validation },
    });
  } catch (err: any) {
    console.error('[ingest] POST /drone/ingest error:', err);
    return res.status(500).json({ error: 'Failed to ingest drone scan' });
  }
});

// ---------------------------------------------------------------------------
// 3. POST /score/farm — Trigger farm pest risk scoring
// ---------------------------------------------------------------------------
router.post('/score/farm', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { profileId } = req.body;

    if (!profileId) {
      return res.status(400).json({ error: 'profileId is required' });
    }

    const profile = await prisma.farmProfile.findUnique({ where: { id: profileId } });
    if (!profile) {
      return res.status(404).json({ error: 'Farm profile not found' });
    }

    // Gather scoring components from DB
    // Latest image detections
    const recentImages = await prisma.v2PestImage.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { detections: true },
    });

    const imageScores = recentImages.flatMap((img: any) =>
      (img.detections || []).map((d: any) => d.confidence || 0),
    );
    const imageScore = imageScores.length > 0
      ? Math.round(imageScores.reduce((a: number, b: number) => a + b, 0) / imageScores.length)
      : 0;

    // Latest verification answers from recent reports
    const recentReport = await prisma.v2PestReport.findFirst({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
      include: { verificationAnswers: true },
    });

    let verificationResponseScore = 0;
    if (recentReport?.verificationAnswers) {
      const answerMap: Record<string, string> = {};
      for (const a of recentReport.verificationAnswers as any[]) {
        answerMap[a.question] = a.answer;
      }
      verificationResponseScore = computeVerificationSignal(answerMap);
    }

    // Latest field stress score
    const latestStress = await prisma.v2FieldStressScore.findFirst({
      where: { profileId },
      orderBy: { computedAt: 'desc' },
    });

    const components = {
      image_score: imageScore,
      verification_score: verificationResponseScore,
      crop_vulnerability_score: 50, // stub
      weather_score: latestStress?.weatherCorrelation ?? 50,
      historical_score: 30, // stub
      proximity_score: 30, // stub
      verification_response_score: verificationResponseScore,
    };

    const scoringResult = computeFarmPestRisk(components);
    const riskLevel = riskLevelFromScore(scoringResult.score);

    const farmRisk = await prisma.v2FarmPestRisk.create({
      data: {
        profileId,
        pestReportId: recentReport?.id ?? null,
        riskScore: scoringResult.score,
        riskLevel,
        components: scoringResult.components,
        computedAt: new Date(),
      },
    });

    await writeAuditLog(req, {
      userId: user.id,
      action: 'farm_risk_scored',
      entityType: 'V2FarmPestRisk',
      entityId: farmRisk.id,
      metadata: { profileId, riskScore: scoringResult.score, riskLevel },
    });

    return res.json({
      data: {
        riskId: farmRisk.id,
        riskScore: scoringResult.score,
        riskLevel,
        components: scoringResult.components,
      },
    });
  } catch (err: any) {
    console.error('[ingest] POST /score/farm error:', err);
    return res.status(500).json({ error: 'Failed to compute farm risk score' });
  }
});

// ---------------------------------------------------------------------------
// 4. POST /score/region — Trigger region risk scoring
// ---------------------------------------------------------------------------
router.post('/score/region', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { regionKey } = req.body;

    if (!regionKey) {
      return res.status(400).json({ error: 'regionKey is required' });
    }

    const result = await computeDistrictRisk(regionKey);

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    await writeAuditLog(req, {
      userId: user.id,
      action: 'region_risk_scored',
      entityType: 'V2DistrictRiskScore',
      entityId: result.districtRisk?.id ?? null,
      metadata: { regionKey, riskScore: result.districtRisk?.riskScore },
    });

    return res.json({ data: result });
  } catch (err: any) {
    console.error('[ingest] POST /score/region error:', err);
    return res.status(500).json({ error: 'Failed to compute region risk score' });
  }
});

// ---------------------------------------------------------------------------
// 5. POST /alerts/evaluate — Trigger alert evaluation for a farm
// ---------------------------------------------------------------------------
router.post('/alerts/evaluate', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { profileId } = req.body;

    if (!profileId) {
      return res.status(400).json({ error: 'profileId is required' });
    }

    // Fetch latest risk data for the farm
    const latestRisk = await prisma.v2FarmPestRisk.findFirst({
      where: { profileId },
      orderBy: { computedAt: 'desc' },
    });

    if (!latestRisk) {
      return res.status(404).json({ error: 'No risk data found for this farm. Run scoring first.' });
    }

    const alertResult = await evaluateAndCreateAlert({
      targetType: 'farm',
      targetId: profileId,
      riskScore: latestRisk.riskScore,
      reason: 'manual_evaluation',
      issueType: 'pest',
      components: latestRisk.components ?? {},
    });

    await writeAuditLog(req, {
      userId: user.id,
      action: 'alert_evaluated',
      entityType: 'V2AlertEvent',
      entityId: alertResult.alert?.id ?? null,
      metadata: {
        profileId,
        created: alertResult.created,
        suppressed: alertResult.suppressed,
      },
    });

    return res.json({ data: alertResult });
  } catch (err: any) {
    console.error('[ingest] POST /alerts/evaluate error:', err);
    return res.status(500).json({ error: 'Failed to evaluate alert' });
  }
});

export default router;
