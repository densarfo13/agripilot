import prisma from '../../config/database.js';

/**
 * Report generation service.
 * Generates structured report data for institutional use.
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

export async function getPortfolioReport() {
  const [
    totalByStatus,
    totalByRegion,
    totalByCrop,
    avgScores,
    monthlyTrend,
  ] = await Promise.all([
    prisma.application.groupBy({
      by: ['status'],
      _count: true,
      _sum: { requestedAmount: true },
    }),

    prisma.$queryRaw`
      SELECT f.region, COUNT(a.id)::int as count,
             SUM(a.requested_amount) as total_amount
      FROM applications a
      JOIN farmers f ON a.farmer_id = f.id
      GROUP BY f.region
      ORDER BY count DESC
    `,

    prisma.application.groupBy({
      by: ['cropType'],
      _count: true,
      _sum: { requestedAmount: true },
      orderBy: { _count: { cropType: 'desc' } },
    }),

    prisma.verificationResult.aggregate({
      _avg: { verificationScore: true },
      _count: true,
    }),

    prisma.$queryRaw`
      SELECT DATE_TRUNC('month', created_at) as month,
             COUNT(*)::int as count,
             SUM(requested_amount) as total_amount
      FROM applications
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
      LIMIT 12
    `,
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
