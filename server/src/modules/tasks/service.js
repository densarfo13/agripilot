/**
 * Daily Task System Service
 *
 * Generates role-scoped, actionable tasks derived from actual workflow state.
 * Tasks are computed dynamically — no task table required.
 *
 * This is NOT a project management platform.
 * It tells each role what to do next based on real conditions.
 *
 * Task Types by Role:
 *
 *   FARMER:
 *     START_SEASON        — approved but no active season
 *     LOG_UPDATE          — active season, 7+ days no update
 *     UPLOAD_IMAGE        — active season, milestone stage needs image
 *     REPORT_HARVEST      — harvest stage reached, no harvest report
 *
 *   FIELD_OFFICER:
 *     VALIDATE_UPDATE     — assigned farmer has updates, no recent validation
 *     FOLLOW_UP_STALE     — assigned farmer no update in 14+ days
 *     CONFIRM_HARVEST     — harvest reported but no harvest validation
 *
 *   REVIEWER:
 *     REVIEW_APPLICATION  — submitted/under_review applications pending
 *     RESOLVE_BLOCKER     — needs_more_evidence stalled
 *     REVIEW_OVERDUE      — application pending > 7 days
 *
 *   ADMIN (institutional_admin + super_admin):
 *     APPROVE_ONBOARDING  — farmers pending approval
 *     RESOLVE_INVITE      — invited but not activated for 7+ days
 *     ASSIGN_OFFICER      — active seasons without assigned field officer on farmer
 *     REVIEW_HIGH_RISK    — high-risk or critical-risk seasons
 *     REVIEW_BACKLOG      — applications pending > 14 days
 *
 * Each task has:
 *   taskType, roleTarget, title, reason, priority,
 *   dueAt (if applicable), farmerId, seasonId, applicationId, userId
 */

import prisma from '../../config/database.js';
import { computeSeasonRisk } from '../risk/service.js';

// ─── Constants ─────────────────────────────────────────────

const UPDATE_DUE_DAYS = 7;      // farmer: log update if 7+ days idle
const UPDATE_HIGH_DAYS = 14;    // higher priority if 14+ days idle
const STALE_FO_DAYS = 14;       // FO: follow up if assigned farmer 14+ days idle
const HARVEST_VALIDATION_DAYS = 3; // FO: validate harvest within 3 days of report
const REVIEW_OVERDUE_DAYS = 7;  // Reviewer: flag if pending 7+ days
const INVITE_STALL_DAYS = 7;    // Admin: resolve invite if not accepted 7+ days
const BACKLOG_DAYS = 14;        // Admin: backlog if application pending 14+ days
const MAX_TASKS_PER_TYPE = 10;  // cap items per task type to avoid noise

// ─── Task Builders ─────────────────────────────────────────

function task(type, title, reason, priority, refs = {}) {
  return {
    taskType: type,
    title,
    reason,
    priority,
    status: 'open',
    createdAt: new Date().toISOString(),
    farmerId: refs.farmerId || null,
    seasonId: refs.seasonId || null,
    applicationId: refs.applicationId || null,
    userId: refs.userId || null,
  };
}

// ─── Farmer Tasks ─────────────────────────────────────────

/**
 * Generate tasks for a farmer (their own workflow).
 * farmerId: the farmer's profile ID (from farmerProfile.id on the User)
 */
export async function getFarmerTasks(farmerId) {
  const now = new Date();
  const tasks = [];

  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
    include: {
      farmSeasons: {
        where: { status: 'active' },
        orderBy: { plantingDate: 'desc' },
        take: 3,
        include: {
          progressEntries: { orderBy: { entryDate: 'desc' }, take: 1 },
          harvestReport: { select: { id: true } },
          officerValidations: { select: { id: true } },
        },
      },
    },
  });

  if (!farmer) return tasks;

  const activeSeasons = farmer.farmSeasons;

  // START_SEASON — approved but no active season
  if (farmer.registrationStatus === 'approved' && activeSeasons.length === 0) {
    tasks.push(task(
      'START_SEASON',
      'Start your farm season',
      'Your account is active. Set up a season to begin tracking your farm progress.',
      'High',
      { farmerId }
    ));
    return tasks; // nothing else is actionable without a season
  }

  for (const season of activeSeasons) {
    const lastEntry = season.progressEntries[0];
    const lastEntryDate = season.lastActivityDate
      ? new Date(season.lastActivityDate)
      : lastEntry?.entryDate ? new Date(lastEntry.entryDate) : new Date(season.createdAt);
    const daysSinceUpdate = Math.floor((now - lastEntryDate) / (1000 * 60 * 60 * 24));

    // REPORT_HARVEST — harvest expected
    if (season.expectedHarvestDate && !season.harvestReport) {
      const expectedHarvest = new Date(season.expectedHarvestDate);
      if (expectedHarvest <= now) {
        const overdueDays = Math.floor((now - expectedHarvest) / (1000 * 60 * 60 * 24));
        tasks.push(task(
          'REPORT_HARVEST',
          'Report your harvest',
          `Your harvest was expected ${overdueDays} day(s) ago. Submit your harvest details to close the season.`,
          'High',
          { farmerId, seasonId: season.id }
        ));
        continue; // harvest report is the priority action
      }
    }

    // LOG_UPDATE — no update in 7+ days
    if (daysSinceUpdate >= UPDATE_DUE_DAYS) {
      tasks.push(task(
        'LOG_UPDATE',
        `Log a farm update (${daysSinceUpdate} days since last update)`,
        'Regular updates help build a stronger track record. Log an activity, crop condition, or note.',
        daysSinceUpdate >= UPDATE_HIGH_DAYS ? 'High' : 'Medium',
        { farmerId, seasonId: season.id }
      ));
    }

    // UPLOAD_IMAGE — no image logged for current season
    if (season.progressEntries.length === 0 || !season.progressEntries.some(e => e?.imageUrl)) {
      // Only check 1 entry — re-query if needed for this check
      const imageCheck = await prisma.seasonProgressEntry.count({
        where: { seasonId: season.id, imageUrl: { not: null } },
      });
      if (imageCheck === 0 && season.progressEntries.length > 0) {
        tasks.push(task(
          'UPLOAD_IMAGE',
          'Upload a progress photo',
          'No images have been uploaded for this season. A progress photo helps verify your crop.',
          'Medium',
          { farmerId, seasonId: season.id }
        ));
      }
    }
  }

  return tasks;
}

// ─── Field Officer Tasks ──────────────────────────────────

/**
 * Generate tasks for a field officer.
 * officerId: the User.id of the field officer
 * organizationId: org scope
 */
export async function getFieldOfficerTasks(officerId, organizationId) {
  const now = new Date();
  const tasks = [];
  const staleCutoff = new Date(now - STALE_FO_DAYS * 24 * 60 * 60 * 1000);
  const orgFilter = organizationId ? { organizationId } : {};

  // Assigned farmers (via assignedOfficerId on Farmer)
  const assignedFarmers = await prisma.farmer.findMany({
    where: { ...orgFilter, assignedOfficerId: officerId, registrationStatus: 'approved' },
    include: {
      farmSeasons: {
        where: { status: 'active' },
        include: {
          officerValidations: { orderBy: { validatedAt: 'desc' }, take: 1 },
          harvestReport: { select: { id: true, createdAt: true } },
          progressEntries: { orderBy: { entryDate: 'desc' }, take: 1 },
        },
      },
    },
    take: 50, // cap for performance
  });

  const foTasks = [];

  for (const farmer of assignedFarmers) {
    for (const season of farmer.farmSeasons) {
      const lastEntry = season.progressEntries[0];
      // Prefer lastActivityDate (DB-maintained) then latest entry date then season creation
      const lastEntryDate = season.lastActivityDate
        ? new Date(season.lastActivityDate)
        : lastEntry?.entryDate ? new Date(lastEntry.entryDate) : new Date(season.createdAt);
      const daysSinceUpdate = Math.floor((now - lastEntryDate) / (1000 * 60 * 60 * 24));
      const lastValidation = season.officerValidations[0];
      const lastValidationDate = lastValidation?.validatedAt ? new Date(lastValidation.validatedAt) : null;
      const daysSinceValidation = lastValidationDate
        ? Math.floor((now - lastValidationDate) / (1000 * 60 * 60 * 24))
        : null;

      // CONFIRM_HARVEST — harvest reported but not validated
      if (season.harvestReport) {
        const harvestReportDate = new Date(season.harvestReport.createdAt);
        const harvestDaysAgo = Math.floor((now - harvestReportDate) / (1000 * 60 * 60 * 24));
        const harvestValidated = season.officerValidations.some(v => v.validationType === 'harvest');
        if (!harvestValidated) {
          foTasks.push(task(
            'CONFIRM_HARVEST',
            `Confirm harvest for ${farmer.fullName}`,
            `Harvest reported ${harvestDaysAgo} day(s) ago and needs officer validation`,
            harvestDaysAgo >= HARVEST_VALIDATION_DAYS ? 'High' : 'Medium',
            { farmerId: farmer.id, seasonId: season.id, userId: officerId }
          ));
          continue;
        }
      }

      // VALIDATE_UPDATE — entries exist but no recent validation
      if (season.progressEntries.length > 0) {
        const needsValidation =
          daysSinceValidation === null ||
          (lastEntry && lastValidationDate && new Date(lastEntry.entryDate) > lastValidationDate);

        if (needsValidation) {
          foTasks.push(task(
            'VALIDATE_UPDATE',
            `Validate update for ${farmer.fullName}`,
            `Farmer has logged progress entries that have not been validated by an officer`,
            'Medium',
            { farmerId: farmer.id, seasonId: season.id, userId: officerId }
          ));
        }
      }

      // FOLLOW_UP_STALE — no update from assigned farmer in 14+ days
      if (daysSinceUpdate >= STALE_FO_DAYS) {
        foTasks.push(task(
          'FOLLOW_UP_STALE',
          `Follow up with ${farmer.fullName}`,
          `No update in ${daysSinceUpdate} days — farmer may need support or reminder`,
          daysSinceUpdate >= 30 ? 'High' : 'Medium',
          { farmerId: farmer.id, seasonId: season.id, userId: officerId }
        ));
      }
    }
  }

  // Sort by priority and cap
  const PRIORITY = { High: 3, Medium: 2, Low: 1 };
  foTasks.sort((a, b) => (PRIORITY[b.priority] || 0) - (PRIORITY[a.priority] || 0));
  tasks.push(...foTasks.slice(0, MAX_TASKS_PER_TYPE * 3));

  return tasks;
}

// ─── Reviewer Tasks ───────────────────────────────────────

/**
 * Generate tasks for a reviewer.
 * reviewerId: the User.id of the reviewer
 * organizationId: org scope
 */
export async function getReviewerTasks(reviewerId, organizationId) {
  const now = new Date();
  const tasks = [];
  const orgFilter = organizationId ? { farmer: { organizationId } } : {};
  const overdueCutoff = new Date(now - REVIEW_OVERDUE_DAYS * 24 * 60 * 60 * 1000);

  const [assignedPending, blockedApps, overdueApps] = await Promise.all([
    // Applications assigned to this reviewer that are pending
    prisma.application.findMany({
      where: {
        ...orgFilter,
        assignedReviewerId: reviewerId,
        status: { in: ['submitted', 'under_review'] },
      },
      select: { id: true, createdAt: true, status: true, farmer: { select: { fullName: true } } },
      orderBy: { createdAt: 'asc' },
      take: MAX_TASKS_PER_TYPE,
    }),

    // Applications needing more evidence
    prisma.application.findMany({
      where: {
        ...orgFilter,
        assignedReviewerId: reviewerId,
        status: 'needs_more_evidence',
      },
      select: { id: true, createdAt: true, farmer: { select: { fullName: true } } },
      orderBy: { createdAt: 'asc' },
      take: MAX_TASKS_PER_TYPE,
    }),

    // Overdue unassigned applications in org
    prisma.application.findMany({
      where: {
        ...orgFilter,
        status: { in: ['submitted', 'under_review'] },
        createdAt: { lt: overdueCutoff },
        assignedReviewerId: null,
      },
      select: { id: true, createdAt: true, farmer: { select: { fullName: true } } },
      orderBy: { createdAt: 'asc' },
      take: MAX_TASKS_PER_TYPE,
    }),
  ]);

  for (const app of assignedPending) {
    const ageDays = Math.floor((now - new Date(app.createdAt)) / (1000 * 60 * 60 * 24));
    tasks.push(task(
      ageDays >= REVIEW_OVERDUE_DAYS ? 'REVIEW_OVERDUE' : 'REVIEW_APPLICATION',
      `Review application — ${app.farmer.fullName}`,
      `Application has been pending for ${ageDays} day(s)`,
      ageDays >= REVIEW_OVERDUE_DAYS ? 'High' : 'Medium',
      { applicationId: app.id, userId: reviewerId }
    ));
  }

  for (const app of blockedApps) {
    const ageDays = Math.floor((now - new Date(app.createdAt)) / (1000 * 60 * 60 * 24));
    tasks.push(task(
      'RESOLVE_BLOCKER',
      `Resolve blocked application — ${app.farmer.fullName}`,
      `Application awaiting additional evidence for ${ageDays} day(s)`,
      ageDays >= REVIEW_OVERDUE_DAYS ? 'High' : 'Medium',
      { applicationId: app.id, userId: reviewerId }
    ));
  }

  for (const app of overdueApps) {
    const ageDays = Math.floor((now - new Date(app.createdAt)) / (1000 * 60 * 60 * 24));
    tasks.push(task(
      'REVIEW_OVERDUE',
      `Overdue unassigned application — ${app.farmer.fullName}`,
      `Application pending ${ageDays} days with no assigned reviewer`,
      'High',
      { applicationId: app.id }
    ));
  }

  return tasks;
}

// ─── Admin Tasks ──────────────────────────────────────────

/**
 * Generate tasks for admin roles.
 * organizationId: org scope (null = cross-org for super_admin)
 */
export async function getAdminTasks(organizationId) {
  const now = new Date();
  const tasks = [];
  const inviteStallCutoff = new Date(now - INVITE_STALL_DAYS * 24 * 60 * 60 * 1000);
  const backlogCutoff = new Date(now - BACKLOG_DAYS * 24 * 60 * 60 * 1000);
  const orgFilter = organizationId ? { organizationId } : {};
  const orgSeasonFilter = organizationId ? { farmer: { organizationId } } : {};

  const [
    pendingApproval,
    stalledInvites,
    unassignedSeasons,
    backlogApps,
    highRiskSeasons,
  ] = await Promise.all([
    // APPROVE_ONBOARDING — pending farmers
    prisma.farmer.findMany({
      where: { ...orgFilter, registrationStatus: 'pending_approval' },
      select: { id: true, fullName: true, region: true, selfRegistered: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: MAX_TASKS_PER_TYPE,
    }),

    // RESOLVE_INVITE — invited but not activated for 7+ days
    prisma.farmer.findMany({
      where: {
        ...orgFilter,
        invitedAt: { not: null, lt: inviteStallCutoff },
        userAccount: null,
        registrationStatus: 'approved',
      },
      select: { id: true, fullName: true, invitedAt: true },
      orderBy: { invitedAt: 'asc' },
      take: MAX_TASKS_PER_TYPE,
    }),

    // ASSIGN_OFFICER — active seasons where farmer has no assigned officer
    prisma.farmSeason.findMany({
      where: {
        ...orgSeasonFilter,
        status: 'active',
        farmer: { ...orgFilter, assignedOfficerId: null },
      },
      select: { id: true, createdAt: true, cropType: true, farmer: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'asc' },
      take: MAX_TASKS_PER_TYPE,
    }),

    // REVIEW_BACKLOG — applications pending 14+ days
    prisma.application.findMany({
      where: {
        ...orgSeasonFilter,
        status: { in: ['submitted', 'under_review'] },
        createdAt: { lt: backlogCutoff },
      },
      select: { id: true, createdAt: true, farmer: { select: { fullName: true } } },
      orderBy: { createdAt: 'asc' },
      take: MAX_TASKS_PER_TYPE,
    }),

    // REVIEW_HIGH_RISK — seasons with no activity in 30+ days
    prisma.farmSeason.findMany({
      where: {
        ...orgSeasonFilter,
        status: 'active',
        OR: [
          { lastActivityDate: { lt: new Date(now - 30 * 24 * 60 * 60 * 1000) } },
          { lastActivityDate: null, createdAt: { lt: new Date(now - 30 * 24 * 60 * 60 * 1000) } },
        ],
      },
      select: { id: true, cropType: true, lastActivityDate: true, createdAt: true, farmer: { select: { id: true, fullName: true } } },
      orderBy: { lastActivityDate: 'asc' },
      take: MAX_TASKS_PER_TYPE,
    }),
  ]);

  for (const farmer of pendingApproval) {
    const ageDays = Math.floor((now - new Date(farmer.createdAt)) / (1000 * 60 * 60 * 24));
    tasks.push(task(
      'APPROVE_ONBOARDING',
      `Approve farmer registration — ${farmer.fullName}`,
      `${farmer.selfRegistered ? 'Self-registered' : 'Staff-created'} farmer waiting ${ageDays} day(s) for approval`,
      ageDays >= 3 ? 'High' : 'Medium',
      { farmerId: farmer.id }
    ));
  }

  for (const farmer of stalledInvites) {
    const ageDays = Math.floor((now - new Date(farmer.invitedAt)) / (1000 * 60 * 60 * 24));
    tasks.push(task(
      'RESOLVE_INVITE',
      `Resolve stalled invite — ${farmer.fullName}`,
      `Farmer was invited ${ageDays} day(s) ago but has not activated their account`,
      ageDays >= 21 ? 'High' : 'Medium',
      { farmerId: farmer.id }
    ));
  }

  for (const season of unassignedSeasons) {
    tasks.push(task(
      'ASSIGN_OFFICER',
      `Assign field officer — ${season.farmer.fullName}`,
      `Active ${season.cropType} season has no assigned field officer`,
      'Medium',
      { farmerId: season.farmer.id, seasonId: season.id }
    ));
  }

  for (const app of backlogApps) {
    const ageDays = Math.floor((now - new Date(app.createdAt)) / (1000 * 60 * 60 * 24));
    tasks.push(task(
      'REVIEW_BACKLOG',
      `Review backlogged application — ${app.farmer.fullName}`,
      `Application has been pending ${ageDays} days — assign a reviewer or escalate`,
      ageDays >= 21 ? 'High' : 'Medium',
      { applicationId: app.id }
    ));
  }

  for (const season of highRiskSeasons) {
    const lastDate = season.lastActivityDate || season.createdAt;
    const ageDays = Math.floor((now - new Date(lastDate)) / (1000 * 60 * 60 * 24));
    tasks.push(task(
      'REVIEW_HIGH_RISK',
      `Review inactive season — ${season.farmer.fullName}`,
      `Active season with no activity for ${ageDays} days (${season.cropType})`,
      ageDays >= 60 ? 'High' : 'Medium',
      { farmerId: season.farmer.id, seasonId: season.id }
    ));
  }

  return tasks;
}

// ─── Unified Entry Point ──────────────────────────────────

/**
 * Get tasks for the current user based on their role.
 * This is the main endpoint handler helper.
 */
export async function getTasksForUser({ userId, role, organizationId, farmerId }) {
  switch (role) {
    case 'farmer':
      if (!farmerId) return [];
      return getFarmerTasks(farmerId);

    case 'field_officer':
      return getFieldOfficerTasks(userId, organizationId);

    case 'reviewer':
      return getReviewerTasks(userId, organizationId);

    case 'institutional_admin':
    case 'super_admin':
      return getAdminTasks(organizationId);

    default:
      return [];
  }
}

/**
 * Get a summary count of tasks by priority for the current user.
 */
export async function getTaskSummary({ userId, role, organizationId, farmerId }) {
  const tasks = await getTasksForUser({ userId, role, organizationId, farmerId });

  const byPriority = { High: 0, Medium: 0, Low: 0 };
  const byType = {};
  for (const t of tasks) {
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
    byType[t.taskType] = (byType[t.taskType] || 0) + 1;
  }

  return {
    total: tasks.length,
    byPriority,
    byType,
    highPriority: tasks.filter(t => t.priority === 'High'),
  };
}
