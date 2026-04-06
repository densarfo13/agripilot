import prisma from '../../config/database.js';

/**
 * Report generation service.
 * Generates structured report data for institutional use.
 * All queries are org-scoped where applicable.
 */

export async function getApplicationReport(applicationId) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      farmer: true,
      createdBy: { select: { id: true, fullName: true, email: true, role: true } },
      farmLocation: true,
      farmBoundary: { include: { points: { orderBy: { pointOrder: 'asc' } } } },
      evidenceFiles: true,
      verificationResult: true,
      fraudResult: true,
      decisionResult: true,
      benchmarkResult: true,
      intelligenceResult: true,
      reviewNotes: { include: { author: { select: { fullName: true, role: true } } } },
      fieldVisits: { include: { officer: { select: { fullName: true } } } },
      auditLogs: { orderBy: { createdAt: 'asc' }, include: { user: { select: { fullName: true, role: true } } } },
    },
  });

  if (!app) {
    const err = new Error('Application not found');
    err.statusCode = 404;
    throw err;
  }

  return {
    generatedAt: new Date().toISOString(),
    application: app,
    timeline: app.auditLogs.map(log => ({
      timestamp: log.createdAt,
      action: log.action,
      user: log.user.fullName,
      role: log.user.role,
      previousStatus: log.previousStatus,
      newStatus: log.newStatus,
      details: log.details,
    })),
    summary: {
      farmerId: app.farmer.id,
      farmerName: app.farmer.fullName,
      region: app.farmer.region,
      cropType: app.cropType,
      requestedAmount: app.requestedAmount,
      status: app.status,
      verificationScore: app.verificationResult?.verificationScore || null,
      fraudRiskLevel: app.fraudResult?.fraudRiskLevel || null,
      decision: app.decisionResult?.decision || null,
      recommendedAmount: app.decisionResult?.recommendedAmount || null,
      evidenceCount: app.evidenceFiles.length,
      hasGPS: !!app.farmLocation,
      hasBoundary: !!app.farmBoundary,
      reviewNoteCount: app.reviewNotes.length,
      fieldVisitCount: app.fieldVisits.length,
    },
  };
}

export async function getPortfolioReport(orgScope = {}) {
  const appWhere = {};
  if (orgScope.farmer) appWhere.farmer = orgScope.farmer;

  const resultWhere = {};
  if (orgScope.farmer) resultWhere.application = { farmer: orgScope.farmer };

  // Build org join condition for raw SQL
  const hasOrgFilter = orgScope.farmer?.organizationId;
  const orgJoinClause = hasOrgFilter
    ? `JOIN farmers f ON a.farmer_id = f.id AND f.organization_id = '${hasOrgFilter}'`
    : 'JOIN farmers f ON a.farmer_id = f.id';

  const orgAppWhereClause = hasOrgFilter
    ? `WHERE a.farmer_id IN (SELECT id FROM farmers WHERE organization_id = '${hasOrgFilter}')`
    : '';

  const [
    totalByStatus,
    totalByRegion,
    totalByCrop,
    avgScores,
    monthlyTrend,
  ] = await Promise.all([
    prisma.application.groupBy({
      by: ['status'],
      where: appWhere,
      _count: true,
      _sum: { requestedAmount: true },
    }),

    prisma.$queryRawUnsafe(`
      SELECT f.region, COUNT(a.id)::int as count,
             SUM(a.requested_amount) as total_amount
      FROM applications a
      ${orgJoinClause}
      GROUP BY f.region
      ORDER BY count DESC
    `),

    prisma.application.groupBy({
      by: ['cropType'],
      where: appWhere,
      _count: true,
      _sum: { requestedAmount: true },
      orderBy: { _count: { cropType: 'desc' } },
    }),

    prisma.verificationResult.aggregate({
      where: resultWhere,
      _avg: { verificationScore: true },
      _count: true,
    }),

    prisma.$queryRawUnsafe(`
      SELECT DATE_TRUNC('month', a.created_at) as month,
             COUNT(*)::int as count,
             SUM(a.requested_amount) as total_amount
      FROM applications a
      ${hasOrgFilter ? `WHERE a.farmer_id IN (SELECT id FROM farmers WHERE organization_id = '${hasOrgFilter}')` : ''}
      GROUP BY DATE_TRUNC('month', a.created_at)
      ORDER BY month DESC
      LIMIT 12
    `),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    statusBreakdown: totalByStatus,
    regionBreakdown: totalByRegion,
    cropBreakdown: totalByCrop,
    avgVerificationScore: avgScores._avg.verificationScore,
    totalVerified: avgScores._count,
    monthlyTrend,
  };
}
