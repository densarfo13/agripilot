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

/**
 * Generate CSV string for pilot report (farmer-level export).
 * Columns: Name, Phone, Region, Gender, DateOfBirth, FarmSize(ha), Crop, Stage,
 *          InviteStatus, RegistrationStatus, HasLogin, Seasons, ProgressEntries, LastLogin
 */
export async function getPilotReportCSV(farmerWhere = {}) {
  const farmers = await prisma.farmer.findMany({
    where: farmerWhere,
    select: {
      fullName: true,
      phone: true,
      region: true,
      gender: true,
      dateOfBirth: true,
      landSizeHectares: true,
      registrationStatus: true,
      inviteDeliveryStatus: true,
      invitedAt: true,
      inviteAcceptedAt: true,
      assignedOfficerId: true,
      profileImageUrl: true,
      createdAt: true,
      userAccount: { select: { lastLoginAt: true } },
      farmSeasons: {
        select: {
          cropType: true,
          status: true,
          _count: { select: { progressEntries: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 5000, // safety cap
  });

  const header = [
    'Name', 'Phone', 'Region', 'Gender', 'DateOfBirth', 'FarmSize_ha',
    'RegistrationStatus', 'InviteStatus', 'HasLogin', 'LastLogin',
    'Seasons', 'TotalUpdates', 'PrimaryCrop', 'HasPhoto', 'CreatedAt',
  ];

  const escCSV = (val) => {
    if (val == null) return '';
    const s = String(val);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = farmers.map(f => {
    const totalUpdates = f.farmSeasons.reduce((sum, s) => sum + (s._count?.progressEntries || 0), 0);
    const primaryCrop = f.farmSeasons[0]?.cropType || '';
    return [
      f.fullName,
      f.phone,
      f.region,
      f.gender,
      f.dateOfBirth ? new Date(f.dateOfBirth).toISOString().split('T')[0] : '',
      f.landSizeHectares != null ? f.landSizeHectares : '',
      f.registrationStatus,
      f.inviteDeliveryStatus || (f.invitedAt ? 'invited' : 'not_invited'),
      f.userAccount ? 'yes' : 'no',
      f.userAccount?.lastLoginAt ? new Date(f.userAccount.lastLoginAt).toISOString() : '',
      f.farmSeasons.length,
      totalUpdates,
      primaryCrop,
      f.profileImageUrl ? 'yes' : 'no',
      new Date(f.createdAt).toISOString().split('T')[0],
    ].map(escCSV).join(',');
  });

  return [header.join(','), ...rows].join('\n');
}

export async function getPortfolioReport(orgScope = {}) {
  const appWhere = {};
  if (orgScope.farmer) appWhere.farmer = orgScope.farmer;

  const resultWhere = {};
  if (orgScope.farmer) resultWhere.application = { farmer: orgScope.farmer };

  // Build org filter for raw SQL — use parameterized queries to prevent SQL injection
  const hasOrgFilter = orgScope.farmer?.organizationId;

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

    hasOrgFilter
      ? prisma.$queryRaw`
          SELECT f.region, COUNT(a.id)::int as count,
                 SUM(a.requested_amount) as total_amount
          FROM applications a
          JOIN farmers f ON a.farmer_id = f.id AND f.organization_id = ${hasOrgFilter}
          GROUP BY f.region
          ORDER BY count DESC
        `
      : prisma.$queryRaw`
          SELECT f.region, COUNT(a.id)::int as count,
                 SUM(a.requested_amount) as total_amount
          FROM applications a
          JOIN farmers f ON a.farmer_id = f.id
          GROUP BY f.region
          ORDER BY count DESC
        `,

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

    hasOrgFilter
      ? prisma.$queryRaw`
          SELECT DATE_TRUNC('month', a.created_at) as month,
                 COUNT(*)::int as count,
                 SUM(a.requested_amount) as total_amount
          FROM applications a
          WHERE a.farmer_id IN (SELECT id FROM farmers WHERE organization_id = ${hasOrgFilter})
          GROUP BY DATE_TRUNC('month', a.created_at)
          ORDER BY month DESC
          LIMIT 12
        `
      : prisma.$queryRaw`
          SELECT DATE_TRUNC('month', a.created_at) as month,
                 COUNT(*)::int as count,
                 SUM(a.requested_amount) as total_amount
          FROM applications a
          GROUP BY DATE_TRUNC('month', a.created_at)
          ORDER BY month DESC
          LIMIT 12
        `,
  ]);

  // Demographic breakdown for portfolio — filter by approved to align with dashboard/portfolio
  const farmerWhere = { registrationStatus: 'approved' };
  if (orgScope.farmer) Object.assign(farmerWhere, orgScope.farmer);

  const [totalFarmers, womenFarmers, youthFarmers, genderBreakdown] = await Promise.all([
    prisma.farmer.count({ where: farmerWhere }),
    prisma.farmer.count({ where: { ...farmerWhere, gender: 'female' } }),
    prisma.farmer.count({
      where: {
        ...farmerWhere,
        // Youth: age <= 35 (aligned with impact/service.js isYouth definition)
        dateOfBirth: { gt: new Date(new Date().getFullYear() - 36, new Date().getMonth(), new Date().getDate()) },
      },
    }),
    prisma.farmer.groupBy({
      by: ['gender'],
      where: farmerWhere,
      _count: true,
    }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    statusBreakdown: totalByStatus,
    regionBreakdown: totalByRegion,
    cropBreakdown: totalByCrop,
    avgVerificationScore: avgScores._avg.verificationScore,
    totalVerified: avgScores._count,
    monthlyTrend,
    demographics: {
      totalFarmers,
      womenFarmers,
      youthFarmers,
      genderBreakdown: genderBreakdown.map(g => ({ gender: g.gender || 'unknown', count: g._count })),
    },
  };
}
