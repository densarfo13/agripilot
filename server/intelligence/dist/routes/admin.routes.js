/**
 * Farroway Intelligence Module — Admin Routes
 *
 * 8 endpoints for regional risk views, outbreak clusters, high-risk farms,
 * hotspot management, alert oversight, intervention effectiveness,
 * boundary validation, and report review.
 */
import { Router } from 'express';
// @ts-ignore — JS module
import { authenticate } from '../../src/middleware/auth.js';
// @ts-ignore — JS module
import prisma from '../../lib/prisma.js';
// @ts-ignore — JS module
import { writeAuditLog } from '../../lib/audit.js';
import { requireAdmin } from '../guards/roles.guard.js';
import { validate, reviewReportSchema, validateBoundarySchema } from '../validation/schemas.js';
const router = Router();
// All routes require authentication + admin role
router.use(authenticate, requireAdmin);
// ---------------------------------------------------------------------------
// 1. GET /regions/risk — Latest district risk scores per region (deduped)
// ---------------------------------------------------------------------------
router.get('/regions/risk', async (_req, res) => {
    try {
        const scores = await prisma.v2DistrictRiskScore.findMany({
            orderBy: { computedAt: 'desc' },
        });
        // Deduplicate: keep only the latest score per regionKey
        const byRegion = new Map();
        for (const score of scores) {
            if (!byRegion.has(score.regionKey)) {
                byRegion.set(score.regionKey, score);
            }
        }
        return res.json({ data: Array.from(byRegion.values()) });
    }
    catch (err) {
        console.error('[admin] GET /regions/risk error:', err);
        return res.status(500).json({ error: 'Failed to fetch regional risk scores' });
    }
});
// ---------------------------------------------------------------------------
// 2. GET /outbreak-clusters — Active clusters with filters, paginated
// ---------------------------------------------------------------------------
router.get('/outbreak-clusters', async (req, res) => {
    try {
        const { regionKey, status, page = '1', limit = '20' } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const where = {};
        if (regionKey)
            where.regionKey = regionKey;
        if (status)
            where.status = status;
        const [clusters, total] = await Promise.all([
            prisma.v2OutbreakCluster.findMany({
                where,
                orderBy: { detectedAt: 'desc' },
                skip: (pageNum - 1) * pageSize,
                take: pageSize,
            }),
            prisma.v2OutbreakCluster.count({ where }),
        ]);
        return res.json({
            data: clusters,
            pagination: { page: pageNum, limit: pageSize, total },
        });
    }
    catch (err) {
        console.error('[admin] GET /outbreak-clusters error:', err);
        return res.status(500).json({ error: 'Failed to fetch outbreak clusters' });
    }
});
// ---------------------------------------------------------------------------
// 3. GET /farms/high-risk — High/urgent risk farms, paginated
// ---------------------------------------------------------------------------
router.get('/farms/high-risk', async (req, res) => {
    try {
        const { page = '1', limit = '20' } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const where = { riskLevel: { in: ['high', 'urgent'] } };
        const [risks, total] = await Promise.all([
            prisma.v2FarmPestRisk.findMany({
                where,
                orderBy: { riskScore: 'desc' },
                skip: (pageNum - 1) * pageSize,
                take: pageSize,
                include: {
                    profile: { select: { id: true, farmName: true, regionKey: true } },
                },
            }),
            prisma.v2FarmPestRisk.count({ where }),
        ]);
        return res.json({
            data: risks,
            pagination: { page: pageNum, limit: pageSize, total },
        });
    }
    catch (err) {
        console.error('[admin] GET /farms/high-risk error:', err);
        return res.status(500).json({ error: 'Failed to fetch high-risk farms' });
    }
});
// ---------------------------------------------------------------------------
// 4. GET /hotspots — All hotspot zones with optional filters
// ---------------------------------------------------------------------------
router.get('/hotspots', async (req, res) => {
    try {
        const { severity, profileId } = req.query;
        const where = {};
        if (severity)
            where.severity = severity;
        if (profileId)
            where.profileId = profileId;
        const hotspots = await prisma.v2HotspotZone.findMany({
            where,
            orderBy: { detectedAt: 'desc' },
        });
        return res.json({ data: hotspots });
    }
    catch (err) {
        console.error('[admin] GET /hotspots error:', err);
        return res.status(500).json({ error: 'Failed to fetch hotspots' });
    }
});
// ---------------------------------------------------------------------------
// 5. GET /alerts — Paginated alert list with filters
// ---------------------------------------------------------------------------
router.get('/alerts', async (req, res) => {
    try {
        const { alertLevel, sentStatus, page = '1', limit = '20' } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const where = {};
        if (alertLevel)
            where.alertLevel = alertLevel;
        if (sentStatus)
            where.sentStatus = sentStatus;
        const [alerts, total] = await Promise.all([
            prisma.v2AlertEvent.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (pageNum - 1) * pageSize,
                take: pageSize,
            }),
            prisma.v2AlertEvent.count({ where }),
        ]);
        return res.json({
            data: alerts,
            pagination: { page: pageNum, limit: pageSize, total },
        });
    }
    catch (err) {
        console.error('[admin] GET /alerts error:', err);
        return res.status(500).json({ error: 'Failed to fetch alerts' });
    }
});
// ---------------------------------------------------------------------------
// 6. GET /interventions/effectiveness — Aggregate treatment outcomes
// ---------------------------------------------------------------------------
router.get('/interventions/effectiveness', async (_req, res) => {
    try {
        const outcomes = await prisma.v2TreatmentOutcome.findMany({
            include: {
                treatmentAction: {
                    include: {
                        pestReport: { select: { profileId: true } },
                        profile: { select: { cropType: true } },
                    },
                },
            },
        });
        const total = outcomes.length;
        // Count by outcome status
        const byStatus = {};
        for (const o of outcomes) {
            byStatus[o.outcomeStatus] = (byStatus[o.outcomeStatus] || 0) + 1;
        }
        // Resolution rate
        const resolved = (byStatus['resolved'] || 0) + (byStatus['improved'] || 0);
        const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
        // Count by crop type
        const byCrop = {};
        for (const o of outcomes) {
            const crop = o.treatmentAction?.profile?.cropType || 'unknown';
            byCrop[crop] = (byCrop[crop] || 0) + 1;
        }
        return res.json({
            data: {
                total,
                byStatus,
                resolutionRate,
                byCrop,
            },
        });
    }
    catch (err) {
        console.error('[admin] GET /interventions/effectiveness error:', err);
        return res.status(500).json({ error: 'Failed to compute intervention effectiveness' });
    }
});
// ---------------------------------------------------------------------------
// 7. POST /boundaries/:profileId/validate — Update farm boundary validation
// ---------------------------------------------------------------------------
router.post('/boundaries/:profileId/validate', validate(validateBoundarySchema), async (req, res) => {
    try {
        const user = req.user;
        const { profileId } = req.params;
        const { validated, notes } = req.body;
        const profile = await prisma.farmProfile.findUnique({ where: { id: profileId } });
        if (!profile) {
            return res.status(404).json({ error: 'Farm profile not found' });
        }
        // Stub: store boundary validation as a metadata flag on the profile
        await prisma.farmProfile.update({
            where: { id: profileId },
            data: {
                metadata: {
                    ...(typeof profile.metadata === 'object' && profile.metadata !== null ? profile.metadata : {}),
                    boundaryValidated: validated,
                    boundaryValidationNotes: notes ?? null,
                    boundaryValidatedAt: new Date().toISOString(),
                    boundaryValidatedBy: user.id,
                },
            },
        });
        return res.json({ data: { success: true, profileId, validated } });
    }
    catch (err) {
        console.error('[admin] POST /boundaries/:profileId/validate error:', err);
        return res.status(500).json({ error: 'Failed to validate boundary' });
    }
});
// ---------------------------------------------------------------------------
// 8. POST /reports/:id/review — Update pest report status
// ---------------------------------------------------------------------------
router.post('/reports/:id/review', validate(reviewReportSchema), async (req, res) => {
    try {
        const user = req.user;
        const reportId = req.params.id;
        const { status, notes } = req.body;
        const report = await prisma.v2PestReport.findUnique({ where: { id: reportId } });
        if (!report) {
            return res.status(404).json({ error: 'Pest report not found' });
        }
        const updated = await prisma.v2PestReport.update({
            where: { id: reportId },
            data: {
                status,
                reviewNotes: notes ?? null,
                reviewedBy: user.id,
                reviewedAt: new Date(),
            },
        });
        await writeAuditLog(req, {
            userId: user.id,
            action: 'pest_report_reviewed',
            entityType: 'V2PestReport',
            entityId: reportId,
            metadata: { previousStatus: report.status, newStatus: status, notes },
        });
        return res.json({ data: { reportId: updated.id, status: updated.status } });
    }
    catch (err) {
        console.error('[admin] POST /reports/:id/review error:', err);
        return res.status(500).json({ error: 'Failed to review pest report' });
    }
});
export default router;
//# sourceMappingURL=admin.routes.js.map