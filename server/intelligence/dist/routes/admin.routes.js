/**
 * Farroway Intelligence Module — Admin Routes
 *
 * 10 endpoints for regional risk views, outbreak clusters, high-risk farms,
 * hotspot management, alert oversight, intervention effectiveness,
 * boundary validation, and report review.
 */
import { Router } from 'express';
// @ts-ignore — JS module
import { authenticate } from '../lib/auth.js';
// @ts-ignore — JS module
import prisma from '../lib/prisma.js';
// @ts-ignore — JS module
import { writeAuditLog } from '../lib/audit.js';
import { requireAdmin } from '../guards/roles.guard.js';
import { validate, reviewReportSchema, validateBoundarySchema } from '../validation/schemas.js';
import { validateBoundary } from '../services/boundary-validation.service.js';
const router = Router();
router.use(authenticate, requireAdmin);
// ---------------------------------------------------------------------------
// 1. GET /regions/risk — Latest district risk scores per region (deduped)
// ---------------------------------------------------------------------------
router.get('/regions/risk', async (_req, res) => {
    try {
        const scores = await prisma.v2DistrictRiskScore.findMany({
            orderBy: { date: 'desc' },
        });
        const byRegion = new Map();
        for (const score of scores) {
            if (!byRegion.has(score.regionKey)) {
                byRegion.set(score.regionKey, score);
            }
        }
        // Reshape for frontend field expectations + regional confidence
        const data = Array.from(byRegion.values()).map((s) => ({
            ...s,
            riskScore: s.overallRiskScore,
            region: s.regionKey,
            trend: s.trendDirection,
            direction: s.trendDirection,
            dominantThreat: s.dominantRiskType,
            lastUpdated: s.date,
            confidenceLevel: s.confidenceLevel || 'low_confidence',
            signalCount: s.signalCount || 0,
            dataQualityScore: s.dataQualityScore || 0,
        }));
        return res.json({ data });
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
                orderBy: { createdAt: 'desc' },
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
                orderBy: { overallRiskScore: 'desc' },
                skip: (pageNum - 1) * pageSize,
                take: pageSize,
                include: {
                    profile: { select: { id: true, farmName: true, locationName: true, crop: true } },
                },
            }),
            prisma.v2FarmPestRisk.count({ where }),
        ]);
        // Reshape for frontend: flatten profile + build components object
        const data = risks.map((r) => ({
            id: r.id,
            profileId: r.profileId,
            farmName: r.profile?.farmName ?? null,
            locationName: r.profile?.locationName ?? null,
            crop: r.profile?.crop ?? null,
            riskScore: r.overallRiskScore,
            riskLevel: r.riskLevel,
            lastScored: r.computedAt,
            components: {
                boundary: r.imageScore,
                scan: r.fieldStressScore,
                weather: r.weatherSuitability,
                historical: r.farmHistoryScore,
                crop: r.cropStageVulnerability,
                regional: r.nearbyOutbreakDensity,
                temporal: r.verificationResponseScore,
            },
        }));
        return res.json({
            data,
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
            orderBy: { createdAt: 'desc' },
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
                        profile: { select: { crop: true } },
                    },
                },
            },
        });
        const total = outcomes.length;
        // ── By status (outcome distribution) ──
        const byStatus = {};
        for (const o of outcomes) {
            byStatus[o.outcomeStatus] = (byStatus[o.outcomeStatus] || 0) + 1;
        }
        const resolved = (byStatus['resolved'] || 0) + (byStatus['improved'] || 0);
        const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
        // ── By treatment type ──
        const typeMap = {};
        for (const o of outcomes) {
            const action = o.treatmentAction;
            const type = action?.actionTaken || 'unknown';
            if (!typeMap[type])
                typeMap[type] = { count: 0, resolved: 0, daySum: 0, resolvedCount: 0 };
            typeMap[type].count++;
            if (o.outcomeStatus === 'resolved' || o.outcomeStatus === 'improved') {
                typeMap[type].resolved++;
                // Compute days between treatment and outcome
                const treatDate = action?.actionDate ? new Date(action.actionDate).getTime() : 0;
                const outDate = o.followupDate ? new Date(o.followupDate).getTime() : Date.now();
                if (treatDate > 0) {
                    typeMap[type].daySum += Math.max(1, Math.round((outDate - treatDate) / (1000 * 60 * 60 * 24)));
                    typeMap[type].resolvedCount++;
                }
            }
        }
        const byType = Object.entries(typeMap).map(([type, v]) => ({
            type,
            count: v.count,
            successRate: v.count > 0 ? Math.round((v.resolved / v.count) * 100) : 0,
            avgDaysToResolution: v.resolvedCount > 0 ? Math.round(v.daySum / v.resolvedCount) : null,
        }));
        // ── By crop ──
        const cropMap = {};
        for (const o of outcomes) {
            const action = o.treatmentAction;
            const crop = action?.profile?.crop || 'unknown';
            const type = action?.actionTaken || 'unknown';
            if (!cropMap[crop])
                cropMap[crop] = { count: 0, resolved: 0, treatments: {} };
            cropMap[crop].count++;
            cropMap[crop].treatments[type] = (cropMap[crop].treatments[type] || 0) + 1;
            if (o.outcomeStatus === 'resolved' || o.outcomeStatus === 'improved') {
                cropMap[crop].resolved++;
            }
        }
        const byCrop = Object.entries(cropMap).map(([crop, v]) => {
            const topTreatment = Object.entries(v.treatments).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
            return {
                crop,
                count: v.count,
                resolutionRate: v.count > 0 ? Math.round((v.resolved / v.count) * 100) : 0,
                mostUsedTreatment: topTreatment,
            };
        });
        // ── Repeat outbreak rate ──
        // Farms with >1 pest report in the last 90 days that also had a treatment
        const cutoff90 = new Date();
        cutoff90.setDate(cutoff90.getDate() - 90);
        const recentReports = await prisma.v2PestReport.groupBy({
            by: ['profileId'],
            where: { createdAt: { gte: cutoff90 } },
            _count: true,
        });
        const repeats = recentReports.filter((r) => r._count > 1).length;
        const repeatOutbreakRate = recentReports.length > 0
            ? Math.round((repeats / recentReports.length) * 100)
            : 0;
        return res.json({
            data: { total, byStatus, resolutionRate, byType, byCrop, repeatOutbreakRate },
        });
    }
    catch (err) {
        console.error('[admin] GET /interventions/effectiveness error:', err);
        return res.status(500).json({ error: 'Failed to compute intervention effectiveness' });
    }
});
// ---------------------------------------------------------------------------
// 7a. POST /alerts/:id/suppress — Suppress an alert
// ---------------------------------------------------------------------------
router.post('/alerts/:id/suppress', async (req, res) => {
    try {
        const user = req.user;
        const alertId = req.params.id;
        const { reason } = req.body;
        const alert = await prisma.v2AlertEvent.findUnique({ where: { id: alertId } });
        if (!alert)
            return res.status(404).json({ error: 'Alert not found' });
        const updated = await prisma.v2AlertEvent.update({
            where: { id: alertId },
            data: {
                sentStatus: 'suppressed',
                suppressedReason: reason || `Suppressed by admin ${user.id}`,
            },
        });
        await writeAuditLog(req, {
            userId: user.id,
            action: 'alert_suppressed',
            entityType: 'V2AlertEvent',
            entityId: alertId,
            metadata: { previousStatus: alert.sentStatus, reason },
        });
        return res.json({ data: { id: updated.id, sentStatus: updated.sentStatus } });
    }
    catch (err) {
        console.error('[admin] POST /alerts/:id/suppress error:', err);
        return res.status(500).json({ error: 'Failed to suppress alert' });
    }
});
// ---------------------------------------------------------------------------
// 7b. PATCH /hotspots/:id/status — Update hotspot status
// ---------------------------------------------------------------------------
router.patch('/hotspots/:id/status', async (req, res) => {
    try {
        const user = req.user;
        const hotspotId = req.params.id;
        const { status } = req.body;
        const validStatuses = ['active', 'inspected', 'resolved', 'false_alarm'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }
        const hotspot = await prisma.v2HotspotZone.findUnique({ where: { id: hotspotId } });
        if (!hotspot)
            return res.status(404).json({ error: 'Hotspot not found' });
        const updated = await prisma.v2HotspotZone.update({
            where: { id: hotspotId },
            data: { status },
        });
        await writeAuditLog(req, {
            userId: user.id,
            action: 'hotspot_status_updated',
            entityType: 'V2HotspotZone',
            entityId: hotspotId,
            metadata: { previousStatus: hotspot.status, newStatus: status },
        });
        return res.json({ data: { id: updated.id, status: updated.status } });
    }
    catch (err) {
        console.error('[admin] PATCH /hotspots/:id/status error:', err);
        return res.status(500).json({ error: 'Failed to update hotspot status' });
    }
});
// ---------------------------------------------------------------------------
// 8. POST /boundaries/:profileId/validate — Update farm boundary validation
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
        // Store boundary validation as a note on the land boundary record
        const boundary = await prisma.v2LandBoundary.findFirst({
            where: { profileId },
            orderBy: { createdAt: 'desc' },
        });
        if (boundary) {
            await prisma.v2LandBoundary.update({
                where: { id: boundary.id },
                data: {
                    validationStatus: validated ? 'valid' : 'needs_redraw',
                    validationReason: validated ? null : (notes || 'Rejected by admin review'),
                    boundaryConfidence: validated ? 100 : 0,
                    notes: `${validated ? 'VALIDATED' : 'REJECTED'} by admin ${user.id} at ${new Date().toISOString()}${notes ? ': ' + notes : ''}`,
                },
            });
        }
        return res.json({ data: { success: true, profileId, validated } });
    }
    catch (err) {
        console.error('[admin] POST /boundaries/:profileId/validate error:', err);
        return res.status(500).json({ error: 'Failed to validate boundary' });
    }
});
// ---------------------------------------------------------------------------
// 9. POST /reports/:id/review — Update pest report status
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
                notes: notes
                    ? `${report.notes ? report.notes + '\n' : ''}[Review by ${user.id}] ${notes}`
                    : undefined,
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
// ---------------------------------------------------------------------------
// 10. GET /queues/false-positive — Reports flagged as potential false positives
// ---------------------------------------------------------------------------
router.get('/queues/false-positive', async (_req, res) => {
    try {
        const reports = await prisma.v2PestReport.findMany({
            where: {
                OR: [
                    { isUncertain: true },
                    { confidenceScore: { lt: 45 } },
                    { status: 'false_positive' },
                ],
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
                profile: { select: { id: true, farmName: true, locationName: true, crop: true } },
            },
        });
        const data = reports.map((r) => ({
            id: r.id,
            profileId: r.profileId,
            farmName: r.profile?.farmName,
            locationName: r.profile?.locationName,
            crop: r.profile?.crop,
            likelyIssue: r.likelyIssue,
            confidenceScore: r.confidenceScore,
            isUncertain: r.isUncertain,
            riskLevel: r.riskLevel,
            status: r.status,
            createdAt: r.createdAt,
        }));
        return res.json({ data });
    }
    catch (err) {
        console.error('[admin] GET /queues/false-positive error:', err);
        return res.status(500).json({ error: 'Failed to fetch false-positive queue' });
    }
});
// ---------------------------------------------------------------------------
// 11. GET /queues/boundary-review — Boundaries needing validation
// ---------------------------------------------------------------------------
router.get('/queues/boundary-review', async (_req, res) => {
    try {
        const boundaries = await prisma.v2LandBoundary.findMany({
            where: {
                OR: [
                    { validationStatus: 'pending' },
                    { validationStatus: 'needs_redraw' },
                    { boundaryConfidence: { lt: 50 } },
                ],
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
                profile: { select: { id: true, farmName: true, locationName: true } },
            },
        });
        const data = boundaries.map((b) => ({
            id: b.id,
            profileId: b.profileId,
            farmName: b.profile?.farmName,
            locationName: b.profile?.locationName,
            captureMethod: b.captureMethod,
            pointCount: b.pointCount,
            measuredArea: b.measuredArea,
            boundaryConfidence: b.boundaryConfidence,
            validationStatus: b.validationStatus,
            validationReason: b.validationReason,
            createdAt: b.createdAt,
        }));
        return res.json({ data });
    }
    catch (err) {
        console.error('[admin] GET /queues/boundary-review error:', err);
        return res.status(500).json({ error: 'Failed to fetch boundary review queue' });
    }
});
// ---------------------------------------------------------------------------
// 12. POST /boundaries/:id/auto-validate — Run automated boundary validation
// ---------------------------------------------------------------------------
router.post('/boundaries/:id/auto-validate', async (req, res) => {
    try {
        const user = req.user;
        const boundaryId = req.params.id;
        const result = await validateBoundary(boundaryId);
        await writeAuditLog(req, {
            userId: user.id,
            action: 'boundary_auto_validated',
            entityType: 'V2LandBoundary',
            entityId: boundaryId,
            metadata: { valid: result.valid, confidence: result.boundaryConfidence, warnings: result.warnings },
        });
        return res.json({ data: result });
    }
    catch (err) {
        console.error('[admin] POST /boundaries/:id/auto-validate error:', err);
        return res.status(500).json({ error: 'Failed to validate boundary' });
    }
});
// ---------------------------------------------------------------------------
// 13. GET /queues/alert-review — Alerts needing review (suppressed + low confidence)
// ---------------------------------------------------------------------------
router.get('/queues/alert-review', async (_req, res) => {
    try {
        const alerts = await prisma.v2AlertEvent.findMany({
            where: {
                OR: [
                    { sentStatus: 'suppressed' },
                    { confidenceScore: { lt: 55 } },
                ],
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        return res.json({ data: alerts });
    }
    catch (err) {
        console.error('[admin] GET /queues/alert-review error:', err);
        return res.status(500).json({ error: 'Failed to fetch alert review queue' });
    }
});
// ---------------------------------------------------------------------------
// 14. GET /queues/summary — Admin queue counts
// ---------------------------------------------------------------------------
router.get('/queues/summary', async (_req, res) => {
    try {
        const [highRisk, falsePositive, boundaryReview, alertReview] = await Promise.all([
            prisma.v2FarmPestRisk.count({ where: { riskLevel: { in: ['high', 'urgent'] } } }),
            prisma.v2PestReport.count({ where: { OR: [{ isUncertain: true }, { confidenceScore: { lt: 45 } }] } }),
            prisma.v2LandBoundary.count({ where: { OR: [{ validationStatus: 'pending' }, { validationStatus: 'needs_redraw' }] } }),
            prisma.v2AlertEvent.count({ where: { OR: [{ sentStatus: 'suppressed' }, { confidenceScore: { lt: 55 } }] } }),
        ]);
        const total = highRisk + falsePositive + boundaryReview + alertReview;
        return res.json({
            data: {
                highRisk,
                falsePositives: falsePositive,
                boundaryReviews: boundaryReview,
                alertReviews: alertReview,
                total,
            },
        });
    }
    catch (err) {
        console.error('[admin] GET /queues/summary error:', err);
        return res.status(500).json({ error: 'Failed to fetch queue summary' });
    }
});
export default router;
//# sourceMappingURL=admin.routes.js.map