import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { writeAuditLog } from '../lib/audit.js';
import { computeFarmPestRisk, computeRegionalOutbreakScore, riskLevelFromScore } from '../services/intelligence/scoringEngine.js';
import { evaluateAndCreateAlert } from '../services/intelligence/alertEngine.js';

const router = express.Router();

const ADMIN_ROLES = ['super_admin', 'institutional_admin', 'reviewer'];

function requireAdmin(req, res, next) {
  if (!ADMIN_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// All routes require authentication + admin role
router.use(authenticate, requireAdmin);

// ─── POST /satellite/ingest — Ingest satellite scan ────────────────────────
router.post('/satellite/ingest', async (req, res) => {
  try {
    const { profileId, scanDate, imagerySource, cloudCover, rawMetadata } = req.body;

    if (!profileId) return res.status(400).json({ error: 'profileId is required' });
    if (!scanDate) return res.status(400).json({ error: 'scanDate is required' });

    // Verify profile exists
    const profile = await prisma.farmProfile.findUnique({ where: { id: profileId }, select: { id: true } });
    if (!profile) return res.status(400).json({ error: 'Farm profile not found' });

    // Create satellite scan record
    const scan = await prisma.v2SatelliteScan.create({
      data: {
        profileId,
        scanDate: new Date(scanDate),
        imagerySource: imagerySource || 'sentinel2',
        cloudCover: cloudCover != null ? parseFloat(cloudCover) : null,
        rawMetadata: rawMetadata || null,
      },
    });

    // Compute field stress from satellite data
    // In production, these scores would come from actual satellite image analysis.
    // For now, derive reasonable defaults from cloud cover and any raw metadata signals.
    const cloudFactor = cloudCover != null ? Math.max(0, 100 - cloudCover) / 100 : 0.7;
    const baseStress = rawMetadata?.stressIndicator || 30;
    const baseAnomaly = rawMetadata?.anomalyIndicator || 20;

    const fieldStress = await prisma.v2FieldStressScore.create({
      data: {
        profileId,
        satelliteScanId: scan.id,
        stressScore: Math.round(baseStress * cloudFactor * 100) / 100,
        anomalyScore: Math.round(baseAnomaly * cloudFactor * 100) / 100,
        temporalChangeScore: rawMetadata?.temporalChange || 0,
        spreadScore: rawMetadata?.spreadIndicator || 0,
        hotspotCount: rawMetadata?.hotspotCount || 0,
      },
    });

    // Generate hotspots if anomaly score is significant
    const hotspots = [];
    if (fieldStress.anomalyScore > 40) {
      const hotspot = await prisma.v2HotspotZone.create({
        data: {
          profileId,
          sourceType: 'satellite',
          zoneGeoJson: rawMetadata?.hotspotGeoJson || { type: 'Point', coordinates: [0, 0] },
          hotspotScore: fieldStress.anomalyScore,
          severity: fieldStress.anomalyScore >= 80 ? 'critical' :
                   fieldStress.anomalyScore >= 60 ? 'high' :
                   fieldStress.anomalyScore >= 40 ? 'moderate' : 'low',
          inspectionPriority: Math.round(fieldStress.anomalyScore),
          status: 'active',
        },
      });
      hotspots.push(hotspot);
    }

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'satellite.ingested',
      entityType: 'V2SatelliteScan',
      entityId: scan.id,
      metadata: { profileId, scanDate, imagerySource: scan.imagerySource, stressScore: fieldStress.stressScore },
    });

    return res.status(201).json({ data: { scan, fieldStress, hotspots } });
  } catch (error) {
    console.error('POST /api/v2/intelligence-ingest/satellite/ingest failed:', error);
    return res.status(500).json({ error: 'Failed to ingest satellite scan' });
  }
});

// ─── POST /drone/ingest — Ingest drone scan ────────────────────────────────
router.post('/drone/ingest', async (req, res) => {
  try {
    const { profileId, hotspotZoneId, flightDate, imageBundleUrl, metadata } = req.body;

    if (!profileId) return res.status(400).json({ error: 'profileId is required' });
    if (!flightDate) return res.status(400).json({ error: 'flightDate is required' });

    // Verify profile exists
    const profile = await prisma.farmProfile.findUnique({ where: { id: profileId }, select: { id: true } });
    if (!profile) return res.status(400).json({ error: 'Farm profile not found' });

    // If hotspotZoneId provided, verify it exists
    if (hotspotZoneId) {
      const hotspot = await prisma.v2HotspotZone.findUnique({ where: { id: hotspotZoneId }, select: { id: true } });
      if (!hotspot) return res.status(400).json({ error: 'Hotspot zone not found' });
    }

    // Compute a validation score from drone metadata
    // In production, this would come from actual drone image analysis
    const validationScore = metadata?.validationScore || metadata?.confidence || null;

    const scan = await prisma.v2DroneScan.create({
      data: {
        profileId,
        hotspotZoneId: hotspotZoneId || null,
        flightDate: new Date(flightDate),
        imageBundleUrl: imageBundleUrl || null,
        validationScore: validationScore != null ? parseFloat(validationScore) : null,
        metadata: metadata || null,
      },
    });

    // If linked to a hotspot, update its status to 'inspected'
    let validation = null;
    if (hotspotZoneId && validationScore != null) {
      validation = await prisma.v2HotspotZone.update({
        where: { id: hotspotZoneId },
        data: { status: 'inspected' },
      });
    }

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'drone.ingested',
      entityType: 'V2DroneScan',
      entityId: scan.id,
      metadata: { profileId, hotspotZoneId, flightDate, validationScore },
    });

    return res.status(201).json({ data: { scan, validation } });
  } catch (error) {
    console.error('POST /api/v2/intelligence-ingest/drone/ingest failed:', error);
    return res.status(500).json({ error: 'Failed to ingest drone scan' });
  }
});

// ─── POST /score/farm — Manually trigger farm risk scoring ─────────────────
router.post('/score/farm', async (req, res) => {
  try {
    const { profileId } = req.body;

    if (!profileId) return res.status(400).json({ error: 'profileId is required' });

    // Verify profile exists
    const profile = await prisma.farmProfile.findUnique({ where: { id: profileId }, select: { id: true } });
    if (!profile) return res.status(400).json({ error: 'Farm profile not found' });

    // Gather scoring components from the database
    // Latest image detections (average severity from recent pest images)
    const recentDetections = await prisma.v2ImageDetection.findMany({
      where: {
        image: { profileId },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { severityScore: true, confidenceScore: true },
    });
    const imageScore = recentDetections.length > 0
      ? recentDetections.reduce((s, d) => s + d.severityScore, 0) / recentDetections.length
      : 0;

    // Latest field stress
    const latestStress = await prisma.v2FieldStressScore.findFirst({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
    });

    // Count active hotspots in nearby region (simplified: count outbreak clusters)
    const activeOutbreaks = await prisma.v2OutbreakCluster.count({
      where: { status: 'active' },
    });

    // Count past pest reports for farm history
    const pastReports = await prisma.v2PestReport.count({
      where: { profileId },
    });

    // Gather verification response score from latest report
    const latestReport = await prisma.v2PestReport.findFirst({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
      include: { verificationAnswers: true },
    });

    let verificationScore = 0;
    if (latestReport?.verificationAnswers?.length > 0) {
      const yesCount = latestReport.verificationAnswers.filter(a => a.answerValue === 'yes').length;
      verificationScore = (yesCount / latestReport.verificationAnswers.length) * 100;
    }

    const components = {
      image_score: imageScore,
      field_stress_score: latestStress?.stressScore || 0,
      crop_stage_vulnerability: 0,       // requires crop cycle integration
      weather_suitability: 0,            // requires weather integration
      nearby_outbreak_density: Math.min(activeOutbreaks * 15, 100),
      farm_history_score: Math.min(pastReports * 10, 100),
      verification_response_score: verificationScore,
    };

    const riskResult = await computeFarmPestRisk(components);

    // Persist the computed risk
    const risk = await prisma.v2FarmPestRisk.create({
      data: {
        profileId,
        imageScore: components.image_score,
        fieldStressScore: components.field_stress_score,
        cropStageVulnerability: components.crop_stage_vulnerability,
        weatherSuitability: components.weather_suitability,
        nearbyOutbreakDensity: components.nearby_outbreak_density,
        farmHistoryScore: components.farm_history_score,
        verificationResponseScore: components.verification_response_score,
        overallRiskScore: riskResult.score,
        riskLevel: riskResult.level,
      },
    });

    return res.status(201).json({ data: { risk } });
  } catch (error) {
    console.error('POST /api/v2/intelligence-ingest/score/farm failed:', error);
    return res.status(500).json({ error: 'Failed to compute farm risk score' });
  }
});

// ─── POST /score/region — Manually trigger regional scoring ────────────────
router.post('/score/region', async (req, res) => {
  try {
    const { regionKey } = req.body;

    if (!regionKey) return res.status(400).json({ error: 'regionKey is required' });

    // Gather regional data for outbreak scoring
    const activeClusters = await prisma.v2OutbreakCluster.findMany({
      where: { regionKey, status: 'active' },
    });

    // Count confirmed and unconfirmed pest reports in this region's farms
    // (simplified: count all reports as we don't have region-to-farm mapping yet)
    const confirmedReports = await prisma.v2PestReport.count({
      where: { status: 'confirmed' },
    });
    const openReports = await prisma.v2PestReport.count({
      where: { status: 'open' },
    });

    // Compute regional outbreak score
    const components = {
      confirmed_reports: Math.min(confirmedReports * 10, 100),
      unconfirmed_signals: Math.min(openReports * 5, 100),
      satellite_anomalies: 0,     // requires satellite aggregation
      weather_favorability: 0,    // requires weather integration
      seasonal_baseline_match: 50, // neutral baseline
      intervention_failure_rate: 0,
    };

    const outbreakResult = await computeRegionalOutbreakScore(components);

    // Save district risk score
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const districtRisk = await prisma.v2DistrictRiskScore.upsert({
      where: {
        regionKey_date: {
          regionKey,
          date: today,
        },
      },
      update: {
        overallRiskScore: outbreakResult.score,
        outbreakProbability: outbreakResult.score / 100,
        dominantRiskType: null,
        trendDirection: outbreakResult.score > 60 ? 'rising' : outbreakResult.score > 30 ? 'stable' : 'declining',
      },
      create: {
        regionKey,
        date: today,
        overallRiskScore: outbreakResult.score,
        outbreakProbability: outbreakResult.score / 100,
        dominantRiskType: null,
        trendDirection: outbreakResult.score > 60 ? 'rising' : outbreakResult.score > 30 ? 'stable' : 'declining',
      },
    });

    return res.status(201).json({ data: { clusters: activeClusters, districtRisk } });
  } catch (error) {
    console.error('POST /api/v2/intelligence-ingest/score/region failed:', error);
    return res.status(500).json({ error: 'Failed to compute regional score' });
  }
});

// ─── POST /alerts/evaluate — Manually evaluate alerts for a farm ───────────
router.post('/alerts/evaluate', async (req, res) => {
  try {
    const { profileId } = req.body;

    if (!profileId) return res.status(400).json({ error: 'profileId is required' });

    // Verify profile exists
    const profile = await prisma.farmProfile.findUnique({ where: { id: profileId }, select: { id: true } });
    if (!profile) return res.status(400).json({ error: 'Farm profile not found' });

    // Get the latest farm pest risk
    const latestRisk = await prisma.v2FarmPestRisk.findFirst({
      where: { profileId },
      orderBy: { computedAt: 'desc' },
    });

    if (!latestRisk) {
      return res.status(400).json({ error: 'No risk score found for this profile. Run /score/farm first.' });
    }

    // Get the latest pest report for issue context
    const latestReport = await prisma.v2PestReport.findFirst({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
    });

    // Evaluate alert using the alert engine
    const alertResult = await evaluateAndCreateAlert({
      targetType: 'farm',
      targetId: profileId,
      riskScore: latestRisk.overallRiskScore,
      reason: latestReport?.suspectedIssue || 'risk_assessment',
      issueType: latestReport?.suspectedIssue,
    });

    return res.json({ data: { alert: alertResult } });
  } catch (error) {
    console.error('POST /api/v2/intelligence-ingest/alerts/evaluate failed:', error);
    return res.status(500).json({ error: 'Failed to evaluate alert' });
  }
});

export default router;
