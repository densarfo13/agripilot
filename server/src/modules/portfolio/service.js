import prisma from '../../config/database.js';

/**
 * Portfolio Summary Engine
 * Aggregates all applications into a portfolio-level overview
 * for institutional dashboards and investor reports.
 *
 * All queries are org-scoped: each organization sees only its own data.
 * super_admin with no org filter sees global data.
 */
export async function getPortfolioSummary(orgScope = {}) {
  // Build application where clause from org scope
  const appWhere = {};
  if (orgScope.farmer) appWhere.farmer = orgScope.farmer;

  // Build farmer where clause from org scope
  const farmerWhere = {};
  if (orgScope.farmer) Object.assign(farmerWhere, orgScope.farmer);

  // Build scoped fraud/verification/decision where via application
  const resultWhere = {};
  if (orgScope.farmer) resultWhere.application = { farmer: orgScope.farmer };

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
    totalFarmers,
    womenFarmers,
    youthFarmers,
    farmerLandAgg,
  ] = await Promise.all([
    prisma.application.count({ where: appWhere }),

    prisma.application.groupBy({
      by: ['status'],
      where: appWhere,
      _count: true,
      _sum: { requestedAmount: true },
    }),

    prisma.application.aggregate({
      where: appWhere,
      _sum: { requestedAmount: true },
      _avg: { requestedAmount: true },
      _count: true,
    }),

    prisma.fraudResult.groupBy({
      by: ['fraudRiskLevel'],
      where: resultWhere,
      _count: true,
    }),

    prisma.application.groupBy({
      by: ['cropType'],
      where: appWhere,
      _count: true,
      _sum: { requestedAmount: true },
      _avg: { requestedAmount: true },
      orderBy: { _count: { cropType: 'desc' } },
      take: 10,
    }),

    prisma.farmer.groupBy({
      by: ['region'],
      where: farmerWhere,
      _count: true,
    }),

    prisma.application.findMany({
      where: appWhere,
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
      where: resultWhere,
      _count: true,
    }),

    prisma.verificationResult.aggregate({
      where: resultWhere,
      _avg: { verificationScore: true },
    }),

    prisma.decisionResult.aggregate({
      where: resultWhere,
      _sum: { recommendedAmount: true },
    }),

    // Demographics
    prisma.farmer.count({ where: farmerWhere }),
    prisma.farmer.count({ where: { ...farmerWhere, gender: 'female' } }),
    prisma.farmer.count({
      where: {
        ...farmerWhere,
        // Youth: age <= 35 (aligned with impact/service.js isYouth definition)
        dateOfBirth: { gt: new Date(new Date().getFullYear() - 36, new Date().getMonth(), new Date().getDate()) },
      },
    }),

    // Authoritative farm size average from farmer records (not legacy application field)
    prisma.farmer.aggregate({
      where: { ...farmerWhere, landSizeHectares: { not: null } },
      _avg: { landSizeHectares: true },
    }),
  ]);

  return {
    totalApplications: totalApps,
    totalRequestedAmount: amountAgg._sum.requestedAmount || 0,
    totalRecommendedAmount: recommendedTotal._sum.recommendedAmount || 0,
    avgRequestedAmount: amountAgg._avg.requestedAmount || 0,
    avgFarmSizeHectares: farmerLandAgg._avg.landSizeHectares || 0,
    avgFarmSizeAcres: farmerLandAgg._avg.landSizeHectares ? Math.round(farmerLandAgg._avg.landSizeHectares * 2.47105 * 100) / 100 : 0, // LEGACY: derived from hectares for backward compat
    avgVerificationScore: avgVerification._avg.verificationScore || 0,
    statusBreakdown: statusCounts.map(s => ({ status: s.status, count: s._count, totalAmount: s._sum.requestedAmount })),
    riskBreakdown: riskMix.map(r => ({ level: r.fraudRiskLevel, count: r._count })),
    decisionBreakdown: decisionMix.map(d => ({ decision: d.decision, count: d._count })),
    cropBreakdown: cropMix.map(c => ({
      crop: c.cropType, count: c._count, totalAmount: c._sum.requestedAmount, avgAmount: c._avg.requestedAmount,
    })),
    regionBreakdown: regionMix.map(r => ({ region: r.region, farmerCount: r._count })),
    recentApplications: recentApps,
    demographics: {
      totalFarmers,
      womenFarmers,
      youthFarmers,
      womenPercent: totalFarmers > 0 ? Math.round((womenFarmers / totalFarmers) * 100) : 0,
      youthPercent: totalFarmers > 0 ? Math.round((youthFarmers / totalFarmers) * 100) : 0,
    },
  };
}

export async function takeSnapshot(organizationId = null) {
  // Pass org scope matching the format expected by getPortfolioSummary
  const orgScope = organizationId ? { farmer: { organizationId } } : {};
  const summary = await getPortfolioSummary(orgScope);

  return prisma.portfolioSnapshot.create({
    data: {
      organizationId,
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

export async function getSnapshotHistory(limit = 30, organizationId = null) {
  const where = {};
  if (organizationId) where.organizationId = organizationId;

  return prisma.portfolioSnapshot.findMany({
    where,
    orderBy: { snapshotDate: 'desc' },
    take: limit,
  });
}
