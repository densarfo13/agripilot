/**
 * Farroway Intelligence Module — Ingestion Routes (Admin)
 *
 * 5 endpoints for satellite/drone data ingestion, farm/region scoring
 * triggers, and alert evaluation.
 */
import { Router } from 'express';
// @ts-ignore — JS module
import { authenticate } from '../lib/auth.js';
// @ts-ignore — JS module
import prisma from '../lib/prisma.js';
// @ts-ignore — JS module
import { writeAuditLog } from '../lib/audit.js';
import { ingestSatelliteScan } from '../services/satellite.service.js';
import { ingestDroneScan } from '../services/drone.service.js';
import { computeDistrictRisk } from '../services/outbreak.service.js';
import { evaluateAndCreateAlert } from '../services/alert.service.js';
import { computeComponentScores } from '../services/components.service.js';
import { requireAdmin } from '../guards/roles.guard.js';
import { validate, ingestSatelliteSchema, ingestDroneSchema, triggerFarmScoreSchema, triggerRegionScoreSchema, triggerAlertEvaluateSchema, } from '../validation/schemas.js';
import { computeFarmPestRisk, riskLevelFromScore, } from '../services/scoring.service.js';
import { computeAlertConfidence } from '../services/scoring.service.js';
const router = Router();
router.use(authenticate, requireAdmin);
// ---------------------------------------------------------------------------
// 1. POST /satellite/ingest — Ingest satellite scan
// ---------------------------------------------------------------------------
router.post('/satellite/ingest', validate(ingestSatelliteSchema), async (req, res) => {
    try {
        const user = req.user;
        const { profileId, scanDate, imagerySource, cloudCover, rawMetadata } = req.body;
        const result = await ingestSatelliteScan({
            profileId,
            scanDate,
            imagerySource,
            cloudCover,
            rawMetadata,
            uploadedBy: user.id,
        });
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
    }
    catch (err) {
        console.error('[ingest] POST /satellite/ingest error:', err);
        return res.status(500).json({ error: 'Failed to ingest satellite scan' });
    }
});
// ---------------------------------------------------------------------------
// 2. POST /drone/ingest — Ingest drone scan
// ---------------------------------------------------------------------------
router.post('/drone/ingest', validate(ingestDroneSchema), async (req, res) => {
    try {
        const user = req.user;
        const { profileId, hotspotZoneId, flightDate, imageBundleUrl, metadata } = req.body;
        const result = await ingestDroneScan({
            profileId,
            hotspotZoneId,
            flightDate,
            imageBundleUrl,
            metadata,
            uploadedBy: user.id,
        });
        await writeAuditLog(req, {
            userId: user.id,
            action: 'drone_scan_ingested',
            entityType: 'V2DroneScan',
            entityId: result.scan?.id ?? null,
            metadata: { profileId, flightDate },
        });
        return res.status(201).json({
            data: { scan: result.scan, hotspotUpdate: result.hotspotUpdate ?? null },
        });
    }
    catch (err) {
        console.error('[ingest] POST /drone/ingest error:', err);
        return res.status(500).json({ error: 'Failed to ingest drone scan' });
    }
});
// ---------------------------------------------------------------------------
// 3. POST /score/farm — Trigger farm pest risk scoring
// ---------------------------------------------------------------------------
router.post('/score/farm', validate(triggerFarmScoreSchema), async (req, res) => {
    try {
        const user = req.user;
        const { profileId } = req.body;
        const profile = await prisma.farmProfile.findUnique({ where: { id: profileId } });
        if (!profile) {
            return res.status(404).json({ error: 'Farm profile not found' });
        }
        // Compute all 7 scoring components from real DB data
        const components = await computeComponentScores(profileId);
        const scoringResult = computeFarmPestRisk(components);
        const riskLevel = riskLevelFromScore(scoringResult.score);
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
    }
    catch (err) {
        console.error('[ingest] POST /score/farm error:', err);
        return res.status(500).json({ error: 'Failed to compute farm risk score' });
    }
});
// ---------------------------------------------------------------------------
// 4. POST /score/region — Trigger region risk scoring
// ---------------------------------------------------------------------------
router.post('/score/region', validate(triggerRegionScoreSchema), async (req, res) => {
    try {
        const user = req.user;
        const { regionKey } = req.body;
        const result = await computeDistrictRisk(regionKey);
        await writeAuditLog(req, {
            userId: user.id,
            action: 'region_risk_scored',
            entityType: 'V2DistrictRiskScore',
            entityId: result?.id ?? null,
            metadata: { regionKey, riskScore: result?.overallRiskScore },
        });
        return res.json({ data: result });
    }
    catch (err) {
        console.error('[ingest] POST /score/region error:', err);
        return res.status(500).json({ error: 'Failed to compute region risk score' });
    }
});
// ---------------------------------------------------------------------------
// 5. POST /alerts/evaluate — Trigger alert evaluation for a farm
// ---------------------------------------------------------------------------
router.post('/alerts/evaluate', validate(triggerAlertEvaluateSchema), async (req, res) => {
    try {
        const user = req.user;
        const { profileId } = req.body;
        const latestRisk = await prisma.v2FarmPestRisk.findFirst({
            where: { profileId },
            orderBy: { computedAt: 'desc' },
        });
        if (!latestRisk) {
            return res.status(404).json({ error: 'No risk data found for this farm. Run scoring first.' });
        }
        const riskLevel = latestRisk.riskLevel || 'moderate';
        // Predictive refinement: require multi-signal agreement
        // Check if there are corroborating signals (satellite stress, recent reports, regional risk)
        const [recentStress, recentReports, regionalRisk] = await Promise.all([
            prisma.v2FieldStressScore.findFirst({
                where: { profileId, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.v2PestReport.count({
                where: { profileId, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
            }),
            prisma.v2DistrictRiskScore.findFirst({
                where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
                orderBy: { date: 'desc' },
            }),
        ]);
        // Count agreeing signals
        let signalCount = 0;
        if (latestRisk.overallRiskScore > 50)
            signalCount++;
        if (recentStress && recentStress.stressScore > 40)
            signalCount++;
        if (recentReports > 0)
            signalCount++;
        if (regionalRisk && regionalRisk.overallRiskScore > 40)
            signalCount++;
        // Compute real confidence using the alert confidence formula
        const confidenceResult = computeAlertConfidence({
            model_confidence: latestRisk.overallRiskScore,
            signal_agreement: signalCount >= 3 ? 80 : signalCount >= 2 ? 55 : 25,
            data_quality: recentStress ? 70 : 30,
            spatial_relevance: regionalRisk ? Math.min(100, regionalRisk.overallRiskScore * 1.2) : 20,
            recent_trend_strength: recentReports > 2 ? 70 : recentReports * 25,
        });
        const alertResult = await evaluateAndCreateAlert({
            targetType: 'farm',
            targetId: profileId,
            alertLevel: riskLevel === 'urgent' ? 'urgent' : riskLevel === 'high' ? 'high_risk' : 'elevated',
            alertReason: 'manual_alert_evaluation',
            alertMessage: `Alert evaluation — risk ${Math.round(latestRisk.overallRiskScore)}, confidence ${Math.round(confidenceResult.score)}, ${signalCount} corroborating signals`,
            confidenceScore: confidenceResult.score,
            actionGuidance: 'Review farm risk data and determine next steps',
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
    }
    catch (err) {
        console.error('[ingest] POST /alerts/evaluate error:', err);
        return res.status(500).json({ error: 'Failed to evaluate alert' });
    }
});
export default router;
//# sourceMappingURL=ingest.routes.js.map