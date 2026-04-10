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
    womenFarmers,
    youthFarmers,
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

    // Demographic counts — filter by approved to align with dashboard/portfolio/reports
    prisma.farmer.count({ where: { ...fFilter, registrationStatus: 'approved', gender: 'female' } }),
    prisma.farmer.count({
      where: {
        ...fFilter,
        registrationStatus: 'approved',
        // Youth: age <= 35 (aligned with impact/service.js isYouth definition)
        dateOfBirth: { gt: new Date(new Date().getFullYear() - 36, new Date().getMonth(), new Date().getDate()) },
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

  // ── Crop distribution + land size aggregates ──────────────
  // These use FarmProfile data linked through approved farmers.
  const farmProfileFilter = organizationId
    ? { farmer: { organizationId, registrationStatus: 'approved' } }
    : { farmer: { registrationStatus: 'approved' } };

  const [cropGroups, landAgg] = await Promise.all([
    prisma.farmProfile.groupBy({
      by: ['crop'],
      where: farmProfileFilter,
      _count: { crop: true },
      orderBy: { _count: { crop: 'desc' } },
      take: 20, // top 20 crops
    }),
    prisma.farmProfile.aggregate({
      where: { ...farmProfileFilter, landSizeHectares: { not: null } },
      _sum: { landSizeHectares: true },
      _avg: { landSizeHectares: true },
      _count: { landSizeHectares: true },
    }),
  ]);

  const cropDistribution = cropGroups.map(g => ({ crop: g.crop, count: g._count.crop }));
  const landSize = {
    totalHectares: Math.round((landAgg._sum.landSizeHectares || 0) * 100) / 100,
    avgHectares: Math.round((landAgg._avg.landSizeHectares || 0) * 100) / 100,
    farmProfilesWithLand: landAgg._count.landSizeHectares || 0,
  };

  return {
    generatedAt: new Date().toISOString(),
    farmers: {
      total: totalFarmers,
      approved: approvedFarmers,
      pendingApproval,
      invitedNotActivated,
      womenFarmers,
      youthFarmers,
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
    cropDistribution,
    landSize,
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

  // 2b. Stuck farmers — approved but no login and no active invite (dead end)
  const stuckFarmers = await prisma.farmer.findMany({
    where: {
      ...fFilter,
      registrationStatus: 'approved',
      userId: null,
      OR: [
        { inviteToken: null },
        { inviteExpiresAt: { lt: now } },
        { inviteDeliveryStatus: 'cancelled' },
      ],
    },
    select: { id: true, fullName: true, region: true, createdAt: true, inviteDeliveryStatus: true },
    orderBy: { createdAt: 'asc' },
    take: MAX_ITEMS_PER_CATEGORY,
  });
  if (stuckFarmers.length > 0) {
    items.push({
      type: 'stuck_no_access',
      priority: 'high',
      label: 'Approved farmers with no login and no active invite',
      count: stuckFarmers.length,
      items: stuckFarmers.map(f => ({
        id: f.id, name: f.fullName, region: f.region,
        reason: f.inviteDeliveryStatus === 'cancelled' ? 'Invite cancelled' : 'Invite expired or missing',
      })),
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

// ─── Delivery Observability ────────────────────────────────

/**
 * Delivery outcome breakdown by channel and status.
 * Identifies failed or stalled invites and surfaces resend recommendations.
 */
export async function getDeliveryStats({ organizationId } = {}) {
  const fFilter = farmerFilter(organizationId);
  const now = new Date();

  // All invited farmers (those with invitedAt set)
  const invited = await prisma.farmer.findMany({
    where: { ...fFilter, invitedAt: { not: null } },
    select: {
      id: true, fullName: true, region: true,
      invitedAt: true, inviteExpiresAt: true,
      inviteDeliveryStatus: true, inviteChannel: true,
      inviteAcceptedAt: true,
      userAccount: { select: { id: true } },
    },
    orderBy: { invitedAt: 'desc' },
  });

  // Aggregate by delivery status
  const byStatus = {};
  const byChannel = {};
  const failedInvites = [];

  for (const f of invited) {
    const status = f.userAccount ? 'accepted' : (f.inviteDeliveryStatus || 'unknown');
    byStatus[status] = (byStatus[status] || 0) + 1;
    byChannel[f.inviteChannel || 'link'] = (byChannel[f.inviteChannel || 'link'] || 0) + 1;

    // Classify as "failed/stalled": no account, not yet accepted, and invite expired
    const isExpired = f.inviteExpiresAt && new Date(f.inviteExpiresAt) < now;
    if (!f.userAccount && isExpired) {
      failedInvites.push({
        farmerId: f.id,
        farmerName: f.fullName,
        region: f.region,
        invitedAt: f.invitedAt,
        inviteExpiresAt: f.inviteExpiresAt,
        deliveryStatus: f.inviteDeliveryStatus,
        channel: f.inviteChannel || 'link',
        recommendation: 'resend_invite',
      });
    }
  }

  const totalInvited = invited.length;
  const totalActivated = byStatus.accepted || 0;
  const activationRate = totalInvited > 0 ? Math.round((totalActivated / totalInvited) * 100) : 0;

  const emailDelivered = byStatus.email_sent || 0;
  const smsDelivered = byStatus.phone_sent || 0;
  const totalDelivered = emailDelivered + smsDelivered;
  const deliverySuccessRate = totalInvited > 0 ? Math.round((totalDelivered / totalInvited) * 100) : 0;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalInvited,
      totalActivated,
      activationRate,
      totalDelivered,         // email_sent + phone_sent (actual provider sends)
      deliverySuccessRate,    // % that were delivered via provider (not manual)
      stalledCount: failedInvites.length,
    },
    byStatus,
    byChannel,
    failedInvites: failedInvites.slice(0, 50),
  };
}

// ─── Alert Rules ───────────────────────────────────────────

const ALERT_THRESHOLDS = {
  inviteActivationRateMin:  0.40, // alert if < 40% of invited farmers have activated
  inactiveFarmerCount:      10,   // alert if >= 10 farmers have had no activity in 30 days
  validationBacklog:         5,   // alert if >= 5 seasons lack officer validation (7+ days)
  harvestOverdueCount:       3,   // alert if >= 3 seasons have harvest overdue
  stalledInviteCount:        5,   // alert if >= 5 invites have expired without activation
};

/**
 * Derive actionable alerts from current platform state.
 * Returns a list of alerts ordered by severity.
 */
export async function getAlerts({ organizationId } = {}) {
  const fFilter = farmerFilter(organizationId);
  const sFilter = seasonFilter(organizationId);
  const now = new Date();
  const thirtyDaysAgo  = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo   = new Date(now - 7  * 24 * 60 * 60 * 1000);

  const [
    totalInvited,
    totalActivated,
    inactiveFarmers,
    validationBacklog,
    harvestOverdue,
    stalledInvites,
  ] = await Promise.all([
    prisma.farmer.count({ where: { ...fFilter, invitedAt: { not: null } } }),
    prisma.farmer.count({ where: { ...fFilter, invitedAt: { not: null }, userAccount: { isNot: null } } }),
    // Farmers approved but no season activity in 30 days
    prisma.farmer.count({
      where: {
        ...fFilter,
        registrationStatus: 'approved',
        userId: { not: null },
        OR: [
          { farmSeasons: { every: { lastActivityDate: { lt: thirtyDaysAgo } } } },
          { farmSeasons: { none: {} } },
        ],
      },
    }),
    // Active seasons without officer validation, 7+ days old
    prisma.farmSeason.count({
      where: { status: 'active', ...sFilter, officerValidations: { none: {} }, createdAt: { lt: sevenDaysAgo } },
    }),
    // Active seasons with harvest overdue
    prisma.farmSeason.count({
      where: { status: 'active', ...sFilter, expectedHarvestDate: { lt: now }, harvestReport: { is: null } },
    }),
    // Expired invites (no activation)
    prisma.farmer.count({
      where: { ...fFilter, invitedAt: { not: null }, userAccount: null, inviteExpiresAt: { lt: now } },
    }),
  ]);

  const alerts = [];

  // Invite activation rate
  const activationRate = totalInvited > 0 ? totalActivated / totalInvited : 1;
  if (totalInvited >= 5 && activationRate < ALERT_THRESHOLDS.inviteActivationRateMin) {
    alerts.push({
      type: 'LOW_INVITE_ACTIVATION',
      severity: 'high',
      message: `Only ${Math.round(activationRate * 100)}% of invited farmers have activated their accounts (${totalActivated}/${totalInvited}). Consider resending invites or switching delivery channel.`,
      metric: { activationRate: Math.round(activationRate * 100), activated: totalActivated, invited: totalInvited },
      action: 'Go to Pilot Metrics > Delivery Stats',
    });
  }

  // Stalled invites
  if (stalledInvites >= ALERT_THRESHOLDS.stalledInviteCount) {
    alerts.push({
      type: 'STALLED_INVITES',
      severity: 'medium',
      message: `${stalledInvites} invite${stalledInvites !== 1 ? 's have' : ' has'} expired without the farmer activating. Resend to recover these farmers.`,
      metric: { stalledInvites },
      action: 'Resend invites from Farmer detail pages',
    });
  }

  // Inactive farmers
  if (inactiveFarmers >= ALERT_THRESHOLDS.inactiveFarmerCount) {
    alerts.push({
      type: 'INACTIVE_FARMERS',
      severity: 'medium',
      message: `${inactiveFarmers} active farmer${inactiveFarmers !== 1 ? 's' : ''} have had no platform activity in 30 days. Follow up to re-engage.`,
      metric: { inactiveFarmers },
      action: 'Go to Needs Attention panel',
    });
  }

  // Validation backlog
  if (validationBacklog >= ALERT_THRESHOLDS.validationBacklog) {
    alerts.push({
      type: 'VALIDATION_BACKLOG',
      severity: 'medium',
      message: `${validationBacklog} active season${validationBacklog !== 1 ? 's have' : ' has'} received no field officer validation in over 7 days. Assign or prompt officers to validate.`,
      metric: { validationBacklog },
      action: 'Go to Needs Attention > Validation Overdue',
    });
  }

  // Harvest overdue
  if (harvestOverdue >= ALERT_THRESHOLDS.harvestOverdueCount) {
    alerts.push({
      type: 'HARVEST_OVERDUE',
      severity: 'high',
      message: `${harvestOverdue} season${harvestOverdue !== 1 ? 's have' : ' has'} passed the expected harvest date without a harvest report. This blocks cycle completion.`,
      metric: { harvestOverdue },
      action: 'Go to Needs Attention > Harvest Overdue',
    });
  }

  // Sort by severity (high first)
  const severityOrder = { high: 0, medium: 1, low: 2 };
  alerts.sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));

  return {
    generatedAt: new Date().toISOString(),
    alertCount: alerts.length,
    alerts,
  };
}

// ─── Pilot Report (Exportable) ─────────────────────────────

/**
 * Comprehensive pilot report combining all metrics.
 * Supports JSON and CSV format.
 */
export async function getPilotReport({ organizationId, format = 'json' } = {}) {
  const [metrics, funnel, delivery, alerts, orgInfo] = await Promise.all([
    getPilotMetrics({ organizationId }),
    getCompletionFunnel({ organizationId }),
    getDeliveryStats({ organizationId }),
    getAlerts({ organizationId }),
    organizationId
      ? prisma.organization.findUnique({
          where: { id: organizationId },
          select: { id: true, name: true, type: true, countryCode: true, createdAt: true },
        })
      : Promise.resolve(null),
  ]);

  const report = {
    exportedAt: new Date().toISOString(),
    organization: orgInfo,
    summary: {
      totalFarmers:          metrics.farmers.total,
      approvedFarmers:       metrics.farmers.approved,
      activeFarmers:         metrics.adoption.loggedIn,
      farmersWithFirstUpdate: metrics.adoption.withFirstUpdate,
      farmersWithHarvest:    metrics.adoption.withHarvest,
      activeSeasons:         metrics.seasons.active,
      harvestedSeasons:      metrics.seasons.harvested,
      completedSeasons:      metrics.seasons.completed,
      totalProgressEntries:  metrics.activity.totalProgressEntries,
      totalImages:           metrics.activity.totalImages,
      totalApplications:     metrics.applications.total,
      approvedApplications:  metrics.applications.approved,
    },
    inviteActivationRate: delivery.summary.activationRate,
    deliverySuccessRate:  delivery.summary.deliverySuccessRate,
    funnelCompletionRate: funnel.funnel.length > 0
      ? funnel.funnel[funnel.funnel.length - 1].pct
      : 0,
    funnel:   funnel.funnel,
    delivery: delivery.summary,
    alerts:   alerts.alerts,
    disclaimer: 'This report reflects only actual recorded platform activity. No data is fabricated or projected.',
  };

  if (format === 'csv') {
    return { csv: buildCSV(report), contentType: 'text/csv' };
  }

  return { json: report, contentType: 'application/json' };
}

function buildCSV(report) {
  const rows = [
    ['Pilot Report', new Date(report.exportedAt).toLocaleString()],
    ['Organization', report.organization?.name || 'All Organizations'],
    [],
    ['Metric', 'Value'],
    ['Total Farmers', report.summary.totalFarmers],
    ['Approved Farmers', report.summary.approvedFarmers],
    ['Active Farmers (logged in)', report.summary.activeFarmers],
    ['Farmers with First Update', report.summary.farmersWithFirstUpdate],
    ['Farmers with Harvest', report.summary.farmersWithHarvest],
    ['Active Seasons', report.summary.activeSeasons],
    ['Harvested Seasons', report.summary.harvestedSeasons],
    ['Completed Seasons', report.summary.completedSeasons],
    ['Total Progress Entries', report.summary.totalProgressEntries],
    ['Total Images Uploaded', report.summary.totalImages],
    ['Total Applications', report.summary.totalApplications],
    ['Approved Applications', report.summary.approvedApplications],
    [],
    ['Invite & Delivery', ''],
    ['Invite Activation Rate (%)', report.inviteActivationRate],
    ['Delivery Success Rate (%)', report.deliverySuccessRate],
    ['Invites Sent', report.delivery.totalInvited],
    ['Invites Activated', report.delivery.totalActivated],
    ['Stalled Invites', report.delivery.stalledCount],
    [],
    ['Adoption Funnel', 'Count', '%'],
    ...report.funnel.map(f => [f.label, f.count, f.pct]),
    [],
    ['Active Alerts', report.alerts.length],
    ...report.alerts.map(a => [`[${a.severity.toUpperCase()}] ${a.type}`, a.message]),
    [],
    [report.disclaimer],
  ];

  return rows
    .map(row => row.map(cell => {
      const s = String(cell ?? '');
      // Quote cells containing commas or quotes
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    }).join(','))
    .join('\n');
}

// ─── Daily Snapshot ────────────────────────────────────────

/**
 * Compute and persist (upsert) today's snapshot for an organization.
 * Safe to call multiple times — always updates the existing row for today.
 */
export async function saveDailySnapshot({ organizationId } = {}) {
  const fFilter = farmerFilter(organizationId);
  const sFilter = seasonFilter(organizationId);
  const pFilter = progressFilter(organizationId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    farmerCount,
    activeCount,
    updatesCount,
    validationsCount,
    inviteSentCount,
    inviteAcceptedCount,
  ] = await Promise.all([
    prisma.farmer.count({ where: fFilter }),
    // Active = logged in within last 30 days
    prisma.farmer.count({
      where: { ...fFilter, userAccount: { lastLoginAt: { gte: thirtyDaysAgo } } },
    }),
    // Progress entries created today
    prisma.seasonProgressEntry.count({
      where: { ...pFilter, createdAt: { gte: today, lt: tomorrow } },
    }),
    // Officer validations created today
    prisma.officerValidation.count({
      where: {
        ...(organizationId ? { season: { farmer: { organizationId } } } : {}),
        createdAt: { gte: today, lt: tomorrow },
      },
    }),
    // Invites sent today (invitedAt = today)
    prisma.farmer.count({
      where: { ...fFilter, invitedAt: { gte: today, lt: tomorrow } },
    }),
    // Invites accepted today
    prisma.farmer.count({
      where: { ...fFilter, inviteAcceptedAt: { gte: today, lt: tomorrow } },
    }),
  ]);

  // Risk distribution snapshot (simplified: count high-activity vs stale seasons)
  const [activeSeasons, staleSeasons, harvestReports] = await Promise.all([
    prisma.farmSeason.count({ where: { status: 'active', ...sFilter } }),
    prisma.farmSeason.count({
      where: {
        status: 'active', ...sFilter,
        OR: [
          { lastActivityDate: { lt: new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000) } },
          { lastActivityDate: null },
        ],
      },
    }),
    prisma.harvestReport.count({ where: { season: sFilter } }),
  ]);

  const riskDistribution = { activeSeasons, staleSeasons, harvestReports };

  await prisma.pilotDailySnapshot.upsert({
    where: { snapshot_org_date_unique: { organizationId: organizationId || null, snapshotDate: today } },
    create: {
      organizationId: organizationId || null,
      snapshotDate: today,
      farmerCount,
      activeCount,
      updatesCount,
      validationsCount,
      inviteSentCount,
      inviteAcceptedCount,
      riskDistribution,
    },
    update: {
      farmerCount,
      activeCount,
      updatesCount,
      validationsCount,
      inviteSentCount,
      inviteAcceptedCount,
      riskDistribution,
    },
  });

  return { snapshotDate: today, farmerCount, activeCount, updatesCount, validationsCount };
}

/**
 * Retrieve snapshot trend for the last N days.
 */
export async function getSnapshotTrends({ organizationId, days = 30 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const snapshots = await prisma.pilotDailySnapshot.findMany({
    where: {
      organizationId: organizationId || null,
      snapshotDate: { gte: since },
    },
    orderBy: { snapshotDate: 'asc' },
    select: {
      snapshotDate: true,
      farmerCount: true,
      activeCount: true,
      updatesCount: true,
      validationsCount: true,
      inviteSentCount: true,
      inviteAcceptedCount: true,
    },
  });

  return {
    generatedAt: new Date().toISOString(),
    days,
    dataPoints: snapshots.length,
    snapshots,
  };
}
