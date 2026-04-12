import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { writeAuditLog } from '../lib/audit.js';

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

// ─── GET /regions/risk — Regional risk overview ────────────────────────────
router.get('/regions/risk', async (req, res) => {
  try {
    // Get the latest district risk score per region using a subquery approach
    const allScores = await prisma.v2DistrictRiskScore.findMany({
      orderBy: [{ regionKey: 'asc' }, { date: 'desc' }],
    });

    // Deduplicate: keep only the latest per regionKey
    const regionMap = new Map();
    for (const score of allScores) {
      if (!regionMap.has(score.regionKey)) {
        regionMap.set(score.regionKey, score);
      }
    }

    const regions = Array.from(regionMap.values()).map(s => ({
      regionKey: s.regionKey,
      riskScore: s.overallRiskScore,
      outbreakProbability: s.outbreakProbability,
      trend: s.trendDirection,
      dominantRisk: s.dominantRiskType,
    }));

    return res.json({ data: { regions } });
  } catch (error) {
    console.error('GET /api/v2/intelligence-admin/regions/risk failed:', error);
    return res.status(500).json({ error: 'Failed to load regional risk overview' });
  }
});

// ─── GET /outbreak-clusters — Active outbreak clusters ─────────────────────
router.get('/outbreak-clusters', async (req, res) => {
  try {
    const { regionKey, status } = req.query;

    const where = {};
    if (regionKey) where.regionKey = regionKey;
    if (status) where.status = status;

    const clusters = await prisma.v2OutbreakCluster.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ data: { clusters } });
  } catch (error) {
    console.error('GET /api/v2/intelligence-admin/outbreak-clusters failed:', error);
    return res.status(500).json({ error: 'Failed to load outbreak clusters' });
  }
});

// ─── GET /farms/high-risk — High-risk farms list ───────────────────────────
router.get('/farms/high-risk', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const where = {
      riskLevel: { in: ['high', 'urgent'] },
    };

    const [farms, total] = await Promise.all([
      prisma.v2FarmPestRisk.findMany({
        where,
        include: {
          profile: {
            select: {
              id: true,
              farmerName: true,
              farmName: true,
              crop: true,
              locationName: true,
              latitude: true,
              longitude: true,
            },
          },
        },
        orderBy: { overallRiskScore: 'desc' },
        skip,
        take: limit,
      }),
      prisma.v2FarmPestRisk.count({ where }),
    ]);

    // Enrich with hotspot counts
    const profileIds = [...new Set(farms.map(f => f.profileId))];
    const hotspotCounts = await prisma.v2HotspotZone.groupBy({
      by: ['profileId'],
      where: {
        profileId: { in: profileIds },
        status: 'active',
      },
      _count: { id: true },
    });
    const hotspotMap = new Map(hotspotCounts.map(h => [h.profileId, h._count.id]));

    const enriched = farms.map(f => ({
      ...f,
      activeHotspotCount: hotspotMap.get(f.profileId) || 0,
    }));

    return res.json({ data: { farms: enriched, total, page } });
  } catch (error) {
    console.error('GET /api/v2/intelligence-admin/farms/high-risk failed:', error);
    return res.status(500).json({ error: 'Failed to load high-risk farms' });
  }
});

// ─── GET /hotspots — All active hotspots across farms ──────────────────────
router.get('/hotspots', async (req, res) => {
  try {
    const { severity, profileId } = req.query;

    const where = { status: 'active' };
    if (severity) where.severity = severity;
    if (profileId) where.profileId = profileId;

    const hotspots = await prisma.v2HotspotZone.findMany({
      where,
      include: {
        profile: {
          select: {
            id: true,
            farmerName: true,
            farmName: true,
            crop: true,
            locationName: true,
          },
        },
      },
      orderBy: { inspectionPriority: 'desc' },
    });

    return res.json({ data: { hotspots } });
  } catch (error) {
    console.error('GET /api/v2/intelligence-admin/hotspots failed:', error);
    return res.status(500).json({ error: 'Failed to load hotspots' });
  }
});

// ─── GET /alerts — Alert control center ────────────────────────────────────
router.get('/alerts', async (req, res) => {
  try {
    const { alertLevel, sentStatus } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const where = {};
    if (alertLevel) where.alertLevel = alertLevel;
    if (sentStatus) where.sentStatus = sentStatus;

    const [alerts, total] = await Promise.all([
      prisma.v2AlertEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.v2AlertEvent.count({ where }),
    ]);

    return res.json({ data: { alerts, total, page } });
  } catch (error) {
    console.error('GET /api/v2/intelligence-admin/alerts failed:', error);
    return res.status(500).json({ error: 'Failed to load alerts' });
  }
});

// ─── GET /interventions/effectiveness — Treatment effectiveness stats ──────
router.get('/interventions/effectiveness', async (req, res) => {
  try {
    // Aggregate outcomes by status
    const outcomeGroups = await prisma.v2TreatmentOutcome.groupBy({
      by: ['outcomeStatus'],
      _count: { id: true },
    });

    const statusCounts = {};
    let total = 0;
    for (const group of outcomeGroups) {
      statusCounts[group.outcomeStatus] = group._count.id;
      total += group._count.id;
    }

    const successCount = (statusCounts['improved'] || 0) + (statusCounts['resolved'] || 0);
    const successRate = total > 0 ? Math.round((successCount / total) * 10000) / 100 : 0;

    // Group by crop type via treatment → report → profile
    const treatments = await prisma.v2TreatmentAction.findMany({
      select: {
        id: true,
        pestReport: {
          select: {
            profile: {
              select: { crop: true },
            },
          },
        },
        outcomes: {
          select: { outcomeStatus: true },
        },
      },
    });

    const byCrop = {};
    for (const t of treatments) {
      const crop = t.pestReport?.profile?.crop || 'unknown';
      if (!byCrop[crop]) byCrop[crop] = { total: 0, success: 0 };
      for (const o of t.outcomes) {
        byCrop[crop].total++;
        if (o.outcomeStatus === 'improved' || o.outcomeStatus === 'resolved') {
          byCrop[crop].success++;
        }
      }
    }

    // Compute per-crop success rates
    const byCropStats = {};
    for (const [crop, data] of Object.entries(byCrop)) {
      byCropStats[crop] = {
        total: data.total,
        successRate: data.total > 0 ? Math.round((data.success / data.total) * 10000) / 100 : 0,
      };
    }

    return res.json({
      data: {
        overall: { successRate, total, breakdown: statusCounts },
        byCrop: byCropStats,
      },
    });
  } catch (error) {
    console.error('GET /api/v2/intelligence-admin/interventions/effectiveness failed:', error);
    return res.status(500).json({ error: 'Failed to compute treatment effectiveness' });
  }
});

// ─── POST /boundaries/:profileId/validate — Admin validates farm boundary ──
router.post('/boundaries/:profileId/validate', async (req, res) => {
  try {
    const { profileId } = req.params;
    const { validated, notes } = req.body;

    if (typeof validated !== 'boolean') {
      return res.status(400).json({ error: 'validated must be a boolean' });
    }

    // Find the latest boundary for this profile
    const boundary = await prisma.v2LandBoundary.findFirst({
      where: { profileId },
      orderBy: { capturedAt: 'desc' },
    });

    if (!boundary) return res.status(404).json({ error: 'No boundary found for this profile' });

    // Update boundary with validation status
    // Using notes field to store validation info since schema may not have a dedicated validated column
    const updated = await prisma.v2LandBoundary.update({
      where: { id: boundary.id },
      data: {
        notes: validated
          ? `[VALIDATED by admin ${req.user.id}] ${notes || ''}`.trim()
          : `[REJECTED by admin ${req.user.id}] ${notes || ''}`.trim(),
      },
    });

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'boundary.validated',
      entityType: 'V2LandBoundary',
      entityId: boundary.id,
      metadata: { profileId, validated, notes },
    });

    return res.json({ data: { boundary: updated } });
  } catch (error) {
    console.error('POST /api/v2/intelligence-admin/boundaries/:profileId/validate failed:', error);
    return res.status(500).json({ error: 'Failed to validate boundary' });
  }
});

// ─── POST /reports/:id/review — Admin reviews pest report ──────────────────
router.post('/reports/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['confirmed', 'false_positive', 'under_review'];
    if (!status) return res.status(400).json({ error: 'status is required' });
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    // Verify report exists
    const report = await prisma.v2PestReport.findUnique({ where: { id }, select: { id: true } });
    if (!report) return res.status(404).json({ error: 'Pest report not found' });

    const updated = await prisma.v2PestReport.update({
      where: { id },
      data: {
        status,
        notes: notes || undefined,
      },
    });

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'pest_report.reviewed',
      entityType: 'V2PestReport',
      entityId: id,
      metadata: { status, notes },
    });

    return res.json({ data: { report: updated } });
  } catch (error) {
    console.error('POST /api/v2/intelligence-admin/reports/:id/review failed:', error);
    return res.status(500).json({ error: 'Failed to review pest report' });
  }
});

export default router;
