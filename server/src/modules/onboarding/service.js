import prisma from '../../config/database.js';

/**
 * Onboarding Service
 *
 * Manages user onboarding lifecycle:
 *   not_started → in_progress → completed | abandoned
 *
 * Every state transition is recorded as an OnboardingEvent for audit.
 */

// ── Valid transitions ──
const VALID_TRANSITIONS = {
  not_started:  ['in_progress'],
  in_progress:  ['completed', 'abandoned'],
  abandoned:    ['in_progress'],  // allow resume
  completed:    [],               // terminal
};

/**
 * Record an onboarding event and update user state in a single transaction.
 */
export async function recordOnboardingEvent(userId, { eventType, stepName = null, metadata = null, transitionTo = null }) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, onboardingStatus: true, onboardingStartedAt: true },
    });
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

    // Validate transition if requested
    if (transitionTo) {
      const allowed = VALID_TRANSITIONS[user.onboardingStatus] || [];
      if (!allowed.includes(transitionTo)) {
        throw Object.assign(
          new Error(`Cannot transition from '${user.onboardingStatus}' to '${transitionTo}'`),
          { statusCode: 400 },
        );
      }
    }

    // Build user update
    const userUpdate = {};
    if (transitionTo) {
      userUpdate.onboardingStatus = transitionTo;
      if (transitionTo === 'in_progress' && !user.onboardingStartedAt) {
        userUpdate.onboardingStartedAt = new Date();
      }
      if (transitionTo === 'completed') {
        userUpdate.onboardedAt = new Date();
      }
    }
    if (stepName) {
      userUpdate.onboardingLastStep = stepName;
    }

    // Persist event
    const event = await tx.onboardingEvent.create({
      data: {
        userId,
        eventType,
        stepName,
        metadataJson: metadata,
      },
    });

    // Update user if needed
    if (Object.keys(userUpdate).length > 0) {
      await tx.user.update({ where: { id: userId }, data: userUpdate });
    }

    return event;
  });
}

/**
 * Start onboarding: not_started → in_progress
 */
export async function startOnboarding(userId, { source = null } = {}) {
  // Set source in the same transaction as the state transition
  if (source) {
    await prisma.user.update({ where: { id: userId }, data: { onboardingSource: source } });
  }

  return recordOnboardingEvent(userId, {
    eventType: 'started',
    stepName: 'welcome',
    metadata: source ? { source } : null,
    transitionTo: 'in_progress',
  });
}

/**
 * Record a step completion during onboarding.
 */
export async function recordStepCompleted(userId, stepName, metadata = null) {
  return recordOnboardingEvent(userId, {
    eventType: 'step_completed',
    stepName,
    metadata,
  });
}

/**
 * Complete onboarding: in_progress → completed
 */
export async function completeOnboarding(userId, metadata = null) {
  return recordOnboardingEvent(userId, {
    eventType: 'completed',
    metadata,
    transitionTo: 'completed',
  });
}

/**
 * Abandon onboarding: in_progress → abandoned
 */
export async function abandonOnboarding(userId, metadata = null) {
  return recordOnboardingEvent(userId, {
    eventType: 'abandoned',
    metadata,
    transitionTo: 'abandoned',
  });
}

/**
 * Resume onboarding: abandoned → in_progress
 */
export async function resumeOnboarding(userId) {
  return recordOnboardingEvent(userId, {
    eventType: 'resumed',
    transitionTo: 'in_progress',
  });
}

/**
 * Get onboarding status + events for a user.
 */
export async function getOnboardingStatus(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      onboardingStatus: true,
      onboardingStartedAt: true,
      onboardedAt: true,
      onboardingLastStep: true,
      onboardingSource: true,
    },
  });
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const events = await prisma.onboardingEvent.findMany({
    where: { userId },
    orderBy: { eventTimestamp: 'asc' },
  });

  return { ...user, events };
}

/**
 * Admin analytics: onboarding summary stats.
 */
export async function getOnboardingAnalytics({ days = 30 } = {}) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  // Status distribution
  const statusCounts = await prisma.user.groupBy({
    by: ['onboardingStatus'],
    where: { role: 'farmer' },
    _count: true,
  });

  const totalFarmers = statusCounts.reduce((sum, s) => sum + s._count, 0);
  const statusMap = Object.fromEntries(statusCounts.map(s => [s.onboardingStatus, s._count]));

  const completed = statusMap.completed || 0;
  const inProgress = statusMap.in_progress || 0;
  const abandoned = statusMap.abandoned || 0;
  const notStarted = statusMap.not_started || 0;

  const completionRate = totalFarmers > 0 ? Math.round((completed / totalFarmers) * 100) : 0;
  const abandonmentRate = totalFarmers > 0 ? Math.round((abandoned / totalFarmers) * 100) : 0;

  // Average onboarding time (for completed users)
  const completedUsers = await prisma.user.findMany({
    where: {
      role: 'farmer',
      onboardingStatus: 'completed',
      onboardingStartedAt: { not: null },
      onboardedAt: { not: null },
    },
    select: { onboardingStartedAt: true, onboardedAt: true },
  });

  let avgOnboardingMs = 0;
  if (completedUsers.length > 0) {
    const totalMs = completedUsers.reduce((sum, u) => {
      return sum + (u.onboardedAt.getTime() - u.onboardingStartedAt.getTime());
    }, 0);
    avgOnboardingMs = totalMs / completedUsers.length;
  }
  const avgOnboardingMinutes = Math.round(avgOnboardingMs / 60000);

  // Recent activity (last N days)
  const recentEvents = await prisma.onboardingEvent.groupBy({
    by: ['eventType'],
    where: { eventTimestamp: { gte: cutoff } },
    _count: true,
  });
  const recentActivity = Object.fromEntries(recentEvents.map(e => [e.eventType, e._count]));

  // Drop-off by step: count abandoned users by their last step
  const dropOffRaw = await prisma.user.groupBy({
    by: ['onboardingLastStep'],
    where: { role: 'farmer', onboardingStatus: 'abandoned', onboardingLastStep: { not: null } },
    _count: true,
  });
  const dropOffByStep = Object.fromEntries(dropOffRaw.map(d => [d.onboardingLastStep, d._count]));

  // Source breakdown
  const sourceCounts = await prisma.user.groupBy({
    by: ['onboardingSource'],
    where: { role: 'farmer', onboardingSource: { not: null } },
    _count: true,
  });
  const bySource = Object.fromEntries(sourceCounts.map(s => [s.onboardingSource, s._count]));

  return {
    totalFarmers,
    statusBreakdown: { not_started: notStarted, in_progress: inProgress, completed, abandoned },
    completionRate,
    abandonmentRate,
    avgOnboardingMinutes,
    recentActivity,
    dropOffByStep,
    bySource,
  };
}
