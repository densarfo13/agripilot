/**
 * Pilot Metrics Service
 *
 * Computes adoption, usage, completion funnel, needs-attention signals,
 * and reviewer efficiency from existing platform data.
 *
 * All queries are org-scoped. Pass organizationId = null for super_admin
 * cross-org views.
 *
 * Data sources: AuditLog, Farmer, FarmSeason, SeasonProgressEntry,
 *   HarvestReport, ReviewAssignment, OfficerValidation, CredibilityAssessment.
 *
 * Rule: This service never fabricates data. It only aggregates
 * actually recorded platform activity.
 */

import prisma from '../../config/database.js';

// ─── Org filter helpers ────────────────────────────────────

function farmerFilter(organizationId) {
  return organizationId ? { organizationId } : {};
}

function seasonFilter(organizationId) {
  return organizationId ? { farmer: { organizationId } } : {};
}

function progressFilter(organizationId) {
  return organizationId ? { season: { farmer: { organizationId } } } : {};
}

function appFilter(organizationId) {
  return organizationId ? { farmer: { organizationId } } : {};
}

// ─── Pilot Metrics Summary ─────────────────────────────────

/**
 * Core adoption and activity counts for an organization.
 * @param {object} opts - { organizationId } — null = cross-org (super_admin)
 */
export async function getPilotMetrics({ organizationId } = {}) {
  const fFilter = farmerFilter(organizationId);
  const sFilter = seasonFilter(organizationId);
  const pFilter = progressFilter(organizationId);

  const [
    totalFarmers,
    approvedFarmers,
    pendingApproval,
    invitedNotActivated,
    farmersWithSeason,
    farmersWithFirstUpdate,
    farmersWithImage,
    farmersWithHarvest,
    farmersLoggedIn,
    activeSeasons,
    harvestedSeasons,
    completedSeasons,
    totalProgressEntries,
    totalImages,
    harvestReports,
    pendingOfficerValidation,
    lowCredibilitySeasons,
    totalApplications,
    submittedApplications,
    underReviewApplications,
    approvedApplications,
  ] = await Promise.all([
    // Farmer counts
    prisma.farmer.count({ where: fFilter }),
    prisma.farmer.count({ where: { ...fFilter, registrationStatus: 'approved' } }),
    prisma.farmer.count({ where: { ...fFilter, registrationStatus: 'pending_approval' } }),
    prisma.farmer.count({ where: { ...fFilter, invitedAt: { not: null }, userAccount: null } }),

    // Adoption funnel
    prisma.farmer.count({
      where: { ...fFilter, farmSeasons: { some: {} } },
    }),
    prisma.farmer.count({
      where: { ...fFilter, farmSeasons: { some: { progressEntries: { some: {} } } } },
    }),
    prisma.farmer.count({
      where: { ...fFilter, farmSeasons: { some: { progressEntries: { some: { imageUrl: { not: null } } } } } },
    }),
    prisma.farmer.count({
      where: { ...fFilter, farmSeasons: { some: { harvestReport: { isNot: null } } } },
    }),
    prisma.farmer.count({
      where: { ...fFilter, userAccount: { lastLoginAt: { not: null } } },
    }),

    // Season counts
    prisma.farmSeason.count({ where: { status: 'active', ...sFilter } }),
    prisma.farmSeason.count({ where: { status: 'harvested', ...sFilter } }),
    prisma.farmSeason.count({ where: { status: 'completed', ...sFilter } }),

    // Activity counts
    prisma.seasonProgressEntry.count({ where: pFilter }),
    prisma.seasonProgressEntry.count({ where: { ...pFilter, imageUrl: { not: null } } }),
    prisma.harvestReport.count({ where: { season: { ...sFilter } } }),

    // Validation gaps
    prisma.farmSeason.count({
      where: {
        status: 'active',
        officerValidations: { none: {} },
        createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        ...sFilter,
      },
    }),
    prisma.credibilityAssessment.count({
      where: {
        credibilityLevel: { in: ['low_confidence', 'needs_review'] },
        season: { status: 'active', ...sFilter },
      },
    }),

    // Application counts
    prisma.application.count({ where: appFilter(organizationId) }),
    prisma.application.count({ where: { ...appFilter(organizationId), status: 'submitted' } }),
    prisma.application.count({ where: { ...appFilter(organizationId), status: 'under_review' } }),
    prisma.application.count({
      where: { ...appFilter(organizationId), status: { in: ['approved', 'conditional_approved', 'disbursed'] } },
    }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    farmers: {
      total: totalFarmers,
      approved: approvedFarmers,
      pendingApproval,
      invitedNotActivated,
    },
    adoption: {
      loggedIn: farmersLoggedIn,
      withSeason: farmersWithSeason,
      withFirstUpdate: farmersWithFirstUpdate,
      withImage: farmersWithImage,
      withHarvest: farmersWithHarvest,
    },
    seasons: {
      active: activeSeasons,
      harvested: harvestedSeasons,
      completed: completedSeasons,
    },
    activity: {
      totalProgressEntries,
      totalImages,
      harvestReports,
    },
    applications: {
      total: totalApplications,
      submitted: submittedApplications,
      underReview: underReviewApplications,
      approved: approvedApplications,
    },
    attention: {
      pendingOfficerValidation,
      lowCredibilitySeasons,
      pendingApproval,
    },
  };
}

// ─── Completion Funnel ─────────────────────────────────────

/**
 * Step-by-step completion funnel showing drop-off at each stage.
 */
export async function getCompletionFunnel({ organizationId } = {}) {
  const fFilter = farmerFilter(organizationId);

  const [
    totalApproved,
    withUserAccount,
    withLogin,
    withSeason,
    withFirstUpdate,
    withImage,
    withHarvest,
  ] = await Promise.all([
    prisma.farmer.count({ where: { ...fFilter, registrationStatus: 'approved' } }),
    prisma.farmer.count({ where: { ...fFilter, registrationStatus: 'approved', userId: { not: null } } }),
    prisma.farmer.count({ where: { ...fFilter, registrationStatus: 'approved', userAccount: { lastLoginAt: { not: null } } } }),
    prisma.farmer.count({ where: { ...fFilter, registrationStatus: 'approved', farmSeasons: { some: {} } } }),
    prisma.farmer.count({ where: { ...fFilter, registrationStatus: 'approved', farmSeasons: { some: { progressEntries: { some: {} } } } } }),
    prisma.farmer.count({ where: { ...fFilter, registrationStatus: 'approved', farmSeasons: { some: { progressEntries: { some: { imageUrl: { not: null } } } } } } }),
    prisma.farmer.count({ where: { ...fFilter, registrationStatus: 'approved', farmSeasons: { some: { harvestReport: { isNot: null } } } } }),
  ]);

  const pct = (n) => totalApproved > 0 ? Math.round((n / totalApproved) * 100) : 0;

  return {
    generatedAt: new Date().toISOString(),
    funnel: [
      { step: 1, label: 'Approved', count: totalApproved, pct: totalApproved > 0 ? 100 : 0 },
      { step: 2, label: 'Account activated', count: withUserAccount, pct: pct(withUserAccount) },
      { step: 3, label: 'First login', count: withLogin, pct: pct(withLogin) },
      { step: 4, label: 'Season created', count: withSeason, pct: pct(withSeason) },
      { step: 5, label: 'First progress update', count: withFirstUpdate, pct: pct(withFirstUpdate) },
      { step: 6, label: 'First image uploaded', count: withImage, pct: pct(withImage) },
      { step: 7, label: 'Harvest reported', count: withHarvest, pct: pct(withHarvest) },
    ],
  };
}

// ─── Needs Attention ───────────────────────────────────────

const STALE_DAYS = 14;
const UNVALIDATED_DAYS = 7;
const MAX_ITEMS_PER_CATEGORY = 20;

/**
 * Items requiring operator action, grouped by type.
 * @param {object} opts - { organizationId, role }
 */
export async function getNeedsAttention({ organizationId, role } = {}) {
  const fFilter = farmerFilter(organizationId);
  const sFilter = seasonFilter(organizationId);
  const now = new Date();
  const staleCutoff = new Date(now - STALE_DAYS * 24 * 60 * 60 * 1000);
  const validationCutoff = new Date(now - UNVALIDATED_DAYS * 24 * 60 * 60 * 1000);

  const items = [];

  // 1. Farmers pending approval (admin/institutional_admin view)
  if (role !== 'field_officer') {
    const pending = await prisma.farmer.findMany({
      where: { ...fFilter, registrationStatus: 'pending_approval' },
      select: { id: true, fullName: true, region: true, selfRegistered: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: MAX_ITEMS_PER_CATEGORY,
    });
    if (pending.length > 0) {
      items.push({
        type: 'pending_approval',
        priority: 'high',
        label: 'Farmers pending approval',
        count: pending.length,
        items: pending.map(f => ({
          id: f.id, name: f.fullName, region: f.region,
          selfRegistered: f.selfRegistered, waitingSince: f.createdAt,
        })),
      });
    }
  }

  // 2. Invited farmers who have not activated
  const unactivated = await prisma.farmer.findMany({
    where: { ...fFilter, invitedAt: { not: null }, userAccount: null },
    select: { id: true, fullName: true, region: true, invitedAt: true },
    orderBy: { invitedAt: 'asc' },
    take: MAX_ITEMS_PER_CATEGORY,
  });
  if (unactivated.length > 0) {
    items.push({
      type: 'invite_not_accepted',
      priority: 'medium',
      label: 'Invited farmers who have not activated',
      count: unactivated.length,
      items: unactivated.map(f => ({ id: f.id, name: f.fullName, region: f.region, invitedAt: f.invitedAt })),
    });
  }

  // 3. Active seasons with no activity for 14+ days
  const staleSeasons = await prisma.farmSeason.findMany({
    where: {
      status: 'active',
      ...sFilter,
      OR: [
        { lastActivityDate: { lt: staleCutoff } },
        { lastActivityDate: null, createdAt: { lt: staleCutoff } },
      ],
    },
    select: {
      id: true, cropType: true, lastActivityDate: true, createdAt: true,
      farmer: { select: { id: true, fullName: true, region: true } },
    },
    orderBy: { lastActivityDate: 'asc' },
    take: MAX_ITEMS_PER_CATEGORY,
  });
  if (staleSeasons.length > 0) {
    items.push({
      type: 'inactive_seasons',
      priority: 'medium',
      label: `Active seasons with no updates (${STALE_DAYS}+ days)`,
      count: staleSeasons.length,
      items: staleSeasons.map(s => ({
        seasonId: s.id, cropType: s.cropType,
        farmerId: s.farmer.id, farmerName: s.farmer.fullName, region: s.farmer.region,
        lastActivity: s.lastActivityDate || s.createdAt,
      })),
    });
  }

  // 4. Harvest expected but not reported
  const harvestOverdue = await prisma.farmSeason.findMany({
    where: {
      status: 'active',
      ...sFilter,
      expectedHarvestDate: { lt: now },
      harvestReport: { is: null },
    },
    select: {
      id: true, cropType: true, expectedHarvestDate: true,
      farmer: { select: { id: true, fullName: true, region: true } },
    },
    orderBy: { expectedHarvestDate: 'asc' },
    take: MAX_ITEMS_PER_CATEGORY,
  });
  if (harvestOverdue.length > 0) {
    items.push({
      type: 'harvest_overdue',
      priority: 'high',
      label: 'Harvest expected but not reported',
      count: harvestOverdue.length,
      items: harvestOverdue.map(s => ({
        seasonId: s.id, cropType: s.cropType,
        farmerId: s.farmer.id, farmerName: s.farmer.fullName, region: s.farmer.region,
        expectedHarvestDate: s.expectedHarvestDate,
      })),
    });
  }

  // 5. Active seasons with no officer validation (7+ days old)
  const unvalidated = await prisma.farmSeason.findMany({
    where: {
      status: 'active',
      ...sFilter,
      officerValidations: { none: {} },
      createdAt: { lt: validationCutoff },
    },
    select: {
      id: true, cropType: true, createdAt: true,
      farmer: { select: { id: true, fullName: true, region: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: MAX_ITEMS_PER_CATEGORY,
  });
  if (unvalidated.length > 0) {
    items.push({
      type: 'validation_overdue',
      priority: 'medium',
      label: 'Active seasons with no field officer validation',
      count: unvalidated.length,
      items: unvalidated.map(s => ({
        seasonId: s.id, cropType: s.cropType,
        farmerId: s.farmer.id, farmerName: s.farmer.fullName, region: s.farmer.region,
        seasonCreatedAt: s.createdAt,
      })),
    });
  }

  // 6. Low credibility active seasons
  const lowCred = await prisma.credibilityAssessment.findMany({
    where: {
      credibilityLevel: { in: ['low_confidence', 'needs_review'] },
      season: { status: 'active', ...sFilter },
    },
    select: {
      credibilityScore: true, credibilityLevel: true,
      season: { select: { id: true, cropType: true, farmer: { select: { id: true, fullName: true, region: true } } } },
    },
    take: MAX_ITEMS_PER_CATEGORY,
  });
  if (lowCred.length > 0) {
    items.push({
      type: 'low_credibility',
      priority: 'low',
      label: 'Active seasons with low credibility assessment',
      count: lowCred.length,
      items: lowCred.map(ca => ({
        seasonId: ca.season.id, cropType: ca.season.cropType,
        farmerId: ca.season.farmer.id, farmerName: ca.season.farmer.fullName, region: ca.season.farmer.region,
        credibilityScore: ca.credibilityScore, credibilityLevel: ca.credibilityLevel,
      })),
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    totalItems: items.reduce((sum, g) => sum + g.count, 0),
    categories: items,
  };
}

// ─── Reviewer Efficiency ───────────────────────────────────

/**
 * Review queue age, throughput, and completion timing.
 */
export async function getReviewerEfficiency({ organizationId } = {}) {
  const aFilter = appFilter(organizationId);
  const now = new Date();
  const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [
    queueByStatus,
    completedAssignments,
    oldestSubmitted,
    recentDecisions,
  ] = await Promise.all([
    // Current queue by status
    prisma.application.groupBy({
      by: ['status'],
      where: aFilter,
      _count: true,
    }),

    // Completed review assignments (for timing)
    prisma.reviewAssignment.findMany({
      where: {
        completedAt: { not: null },
        assignedAt: { gte: since30d },
        application: aFilter,
      },
      select: { assignedAt: true, completedAt: true, reviewerId: true },
    }),

    // Oldest pending application in queue
    prisma.application.findFirst({
      where: { status: { in: ['submitted', 'under_review'] }, ...aFilter },
      orderBy: { createdAt: 'asc' },
      select: { id: true, status: true, createdAt: true },
    }),

    // Recent decisions (30d) from audit log
    prisma.auditLog.count({
      where: {
        action: { in: ['application_approved', 'application_rejected', 'application_conditionally_approved'] },
        ...(organizationId ? { organizationId } : {}),
        createdAt: { gte: since30d },
      },
    }),
  ]);

  // Compute average review time from assignments
  const reviewTimes = completedAssignments
    .map(a => (new Date(a.completedAt) - new Date(a.assignedAt)) / (1000 * 60 * 60))
    .filter(h => h >= 0);

  const avgReviewHours = reviewTimes.length > 0
    ? Math.round((reviewTimes.reduce((a, b) => a + b, 0) / reviewTimes.length) * 10) / 10
    : null;

  // Compute oldest item age
  const oldestAgeHours = oldestSubmitted
    ? Math.round((now - new Date(oldestSubmitted.createdAt)) / (1000 * 60 * 60))
    : null;

  // Map queue by status
  const statusMap = {};
  for (const row of queueByStatus) {
    statusMap[row.status] = row._count;
  }

  const activeQueue = (statusMap.submitted || 0) + (statusMap.under_review || 0)
    + (statusMap.needs_more_evidence || 0) + (statusMap.field_review_required || 0)
    + (statusMap.escalated || 0) + (statusMap.fraud_hold || 0);

  return {
    generatedAt: new Date().toISOString(),
    queue: {
      active: activeQueue,
      submitted: statusMap.submitted || 0,
      underReview: statusMap.under_review || 0,
      needsMoreEvidence: statusMap.needs_more_evidence || 0,
      fieldReviewRequired: statusMap.field_review_required || 0,
      escalated: statusMap.escalated || 0,
      fraudHold: statusMap.fraud_hold || 0,
    },
    timing: {
      avgReviewHours,
      reviewedCount: reviewTimes.length,
      oldestPendingHours: oldestAgeHours,
      oldestPendingId: oldestSubmitted?.id || null,
    },
    throughput: {
      decisionsLast30Days: recentDecisions,
    },
  };
}

// ─── Pilot Summary (Exportable) ────────────────────────────

/**
 * Combined exportable pilot summary for reporting and investor/stakeholder sharing.
 * Includes org info, adoption metrics, funnel, and application summary.
 */
export async function getPilotSummary({ organizationId } = {}) {
  const [metrics, funnel, reviewerEff, orgInfo] = await Promise.all([
    getPilotMetrics({ organizationId }),
    getCompletionFunnel({ organizationId }),
    getReviewerEfficiency({ organizationId }),
    organizationId
      ? prisma.organization.findUnique({
          where: { id: organizationId },
          select: { id: true, name: true, type: true, countryCode: true, createdAt: true },
        })
      : Promise.resolve(null),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    organization: orgInfo,
    pilotMetrics: metrics,
    completionFunnel: funnel,
    reviewerEfficiency: reviewerEff,
    disclaimer: 'This summary reflects only actual recorded platform activity. No data is fabricated or projected.',
  };
}
