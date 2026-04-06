import prisma from '../../config/database.js';

/**
 * Portfolio Summary Engine
 * Aggregates all applications into a portfolio-level overview
 * for institutional dashboards and investor reports.
 */
export async function getPortfolioSummary() {
  const [
    totalApps,
    statusCounts,
    amountAgg,
    riskMix,
    cropMix,
    regionMix,
    recentApps,
    decisionMix,
    avgVerification,
    recommendedTotal,
  ] = await Promise.all([
    prisma.application.count(),

    prisma.application.groupBy({
      by: ['status'],
      _count: true,
      _sum: { requestedAmount: true },
    }),

    prisma.application.aggregate({
      _sum: { requestedAmount: true },
      _avg: { requestedAmount: true, farmSizeAcres: true },
      _count: true,
    }),

    prisma.fraudResult.groupBy({
      by: ['fraudRiskLevel'],
      _count: true,
    }),

    prisma.application.groupBy({
      by: ['cropType'],
      _count: true,
      _sum: { requestedAmount: true },
      _avg: { requestedAmount: true },
      orderBy: { _count: { cropType: 'desc' } },
      take: 10,
    }),

    prisma.farmer.groupBy({
      by: ['region'],
      _count: true,
    }),

    prisma.application.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, status: true, cropType: true, requestedAmount: true, createdAt: true,
        currencyCode: true,
        farmer: { select: { fullName: true, region: true } },
      },
    }),

    prisma.decisionResult.groupBy({
      by: ['decision'],
      _count: true,
    }),

    prisma.verificationResult.aggregate({
      _avg: { verificationScore: true },
    }),

    prisma.decisionResult.aggregate({
      _sum: { recommendedAmount: true },
    }),
  ]);

  return {
    totalApplications: totalApps,
    totalRequestedAmount: amountAgg._sum.requestedAmount || 0,
    totalRecommendedAmount: recommendedTotal._sum.recommendedAmount || 0,
    avgRequestedAmount: amountAgg._avg.requestedAmount || 0,
    avgFarmSizeAcres: amountAgg._avg.farmSizeAcres || 0,
    avgVerificationScore: avgVerification._avg.verificationScore || 0,
    statusBreakdown: statusCounts.map(s => ({ status: s.status, count: s._count, totalAmount: s._sum.requestedAmount })),
    riskBreakdown: riskMix.map(r => ({ level: r.fraudRiskLevel, count: r._count })),
    decisionBreakdown: decisionMix.map(d => ({ decision: d.decision, count: d._count })),
    cropBreakdown: cropMix.map(c => ({
      crop: c.cropType, count: c._count, totalAmount: c._sum.requestedAmount, avgAmount: c._avg.requestedAmount,
    })),
    regionBreakdown: regionMix.map(r => ({ region: r.region, farmerCount: r._count })),
    recentApplications: recentApps,
  };
}

export async function takeSnapshot() {
  const summary = await getPortfolioSummary();

  return prisma.portfolioSnapshot.create({
    data: {
      snapshotDate: new Date(),
      totalApplications: summary.totalApplications,
      totalRequestedAmount: summary.totalRequestedAmount,
      totalRecommendedAmount: summary.totalRecommendedAmount,
      avgVerificationScore: summary.avgVerificationScore,
      decisionMix: summary.decisionBreakdown,
      riskMix: summary.riskBreakdown,
      statusMix: summary.statusBreakdown,
      topRiskCrops: summary.cropBreakdown.slice(0, 5),
      topRiskRegions: summary.regionBreakdown.slice(0, 5),
    },
  });
}

export async function getSnapshotHistory(limit = 30) {
  return prisma.portfolioSnapshot.findMany({
    orderBy: { snapshotDate: 'desc' },
    take: limit,
  });
}
