import prisma from '../../config/database.js';
import { logWorkflowEvent } from '../../utils/opsLogger.js';

/**
 * Season Status Transition Service
 *
 * Enforces strict status transition rules for farm seasons.
 * Every status change must go through this service to ensure:
 *   1. Only valid transitions are allowed
 *   2. Audit trail fields are populated (closedAt, closedBy, etc.)
 *   3. Workflow events are logged for observability
 *
 * Status lifecycle:
 *   active → harvested   (harvest report submitted)
 *   active → abandoned   (farmer voluntarily abandons)
 *   active → failed      (crop failure declared)
 *   harvested → completed (final review/closure by staff)
 *   harvested → active   (reopen — staff correction only, with reason)
 *   completed → active   (reopen — super_admin only, with reason)
 *   abandoned → active   (reopen — staff only, with reason)
 *   failed → active      (recovery — staff only, with reason)
 *
 * Stale season rules:
 *   Seasons older than MAX_SEASON_AGE_DAYS without activity
 *   are flagged but NOT auto-closed (manual action required).
 */

// ─── Valid transitions map ─────────────────────────────────
const VALID_TRANSITIONS = {
  active:    ['harvested', 'abandoned', 'failed'],
  harvested: ['completed', 'active'],  // active = reopen
  completed: ['active'],               // reopen (admin only)
  abandoned: ['active'],               // reopen
  failed:    ['active'],               // recovery
};

// ─── Roles allowed to perform each transition ──────────────
const STAFF_ROLES = ['super_admin', 'institutional_admin', 'field_officer'];
const ADMIN_ROLES = ['super_admin', 'institutional_admin'];

const TRANSITION_PERMISSIONS = {
  'active→harvested':    [...STAFF_ROLES, 'farmer'],  // harvest report triggers this
  'active→abandoned':    [...STAFF_ROLES, 'farmer'],
  'active→failed':       [...STAFF_ROLES, 'farmer'],
  'harvested→completed': ADMIN_ROLES,                  // final closure = staff only
  'harvested→active':    ADMIN_ROLES,                  // reopen from harvest = correction
  'completed→active':    ['super_admin'],               // reopen completed = admin only
  'abandoned→active':    ADMIN_ROLES,                   // reopen abandoned
  'failed→active':       ADMIN_ROLES,                   // recovery from failure
};

// ─── Season age limits ─────────────────────────────────────
const MAX_SEASON_AGE_DAYS = 365; // Seasons older than this are flagged as stale
const STALE_INACTIVITY_DAYS = 90; // No activity for 90 days = stale warning

export {
  VALID_TRANSITIONS,
  TRANSITION_PERMISSIONS,
  MAX_SEASON_AGE_DAYS,
  STALE_INACTIVITY_DAYS,
};

/**
 * Check if a status transition is valid.
 */
export function isValidTransition(fromStatus, toStatus) {
  const allowed = VALID_TRANSITIONS[fromStatus];
  return allowed ? allowed.includes(toStatus) : false;
}

/**
 * Check if a role is allowed to perform a transition.
 */
export function canPerformTransition(fromStatus, toStatus, role) {
  const key = `${fromStatus}→${toStatus}`;
  const allowedRoles = TRANSITION_PERMISSIONS[key];
  return allowedRoles ? allowedRoles.includes(role) : false;
}

/**
 * Transition a season's status with full validation and audit trail.
 *
 * @param {string} seasonId - Season to transition
 * @param {string} toStatus - Target status
 * @param {object} opts - { userId, role, reason }
 * @returns {object} Updated season
 */
export async function transitionSeasonStatus(seasonId, toStatus, { userId, role, reason }) {
  const season = await prisma.farmSeason.findUnique({ where: { id: seasonId } });

  if (!season) {
    const err = new Error('Season not found');
    err.statusCode = 404;
    throw err;
  }

  const fromStatus = season.status;

  // Validate transition
  if (!isValidTransition(fromStatus, toStatus)) {
    const err = new Error(
      `Invalid status transition: ${fromStatus} → ${toStatus}. ` +
      `Allowed transitions from '${fromStatus}': ${(VALID_TRANSITIONS[fromStatus] || []).join(', ') || 'none'}`
    );
    err.statusCode = 400;
    throw err;
  }

  // Validate permission
  if (!canPerformTransition(fromStatus, toStatus, role)) {
    const err = new Error(
      `Role '${role}' is not authorized for transition ${fromStatus} → ${toStatus}`
    );
    err.statusCode = 403;
    throw err;
  }

  // Require reason for reopens and recoveries
  const isReopen = ['harvested', 'completed', 'abandoned', 'failed'].includes(fromStatus) && toStatus === 'active';
  if (isReopen && !reason) {
    const err = new Error('A reason is required to reopen or recover a season');
    err.statusCode = 400;
    throw err;
  }

  // Build update data
  const updateData = { status: toStatus };
  const now = new Date();

  // Closure audit fields
  if (['harvested', 'completed', 'abandoned', 'failed'].includes(toStatus)) {
    updateData.closedAt = now;
    updateData.closedBy = userId;
    updateData.closureReason = reason || null;
  }

  // Reopen audit fields
  if (isReopen) {
    updateData.reopenedAt = now;
    updateData.reopenedBy = userId;
    updateData.reopenReason = reason;
    // Clear closure fields on reopen
    updateData.closedAt = null;
    updateData.closedBy = null;
    updateData.closureReason = null;
  }

  // Optimistic lock: use updateMany with status condition to prevent race conditions
  const result = await prisma.farmSeason.updateMany({
    where: { id: seasonId, status: fromStatus },
    data: updateData,
  });

  if (result.count === 0) {
    const err = new Error('Season status changed concurrently — please retry');
    err.statusCode = 409;
    throw err;
  }

  // Fetch updated season
  const updated = await prisma.farmSeason.findUnique({
    where: { id: seasonId },
    include: { farmer: { select: { id: true, fullName: true } } },
  });

  // Log workflow event
  logWorkflowEvent('season_status_changed', {
    seasonId,
    fromStatus,
    toStatus,
    userId,
    role,
    reason: reason || null,
    isReopen,
  });

  return { season: updated, previousStatus: fromStatus };
}

/**
 * Check if a season is stale (too old or inactive too long).
 * Returns warnings, does NOT auto-close.
 */
export function checkSeasonStaleness(season) {
  const warnings = [];
  const now = new Date();
  const plantingDate = new Date(season.plantingDate);
  const ageDays = Math.floor((now - plantingDate) / (1000 * 60 * 60 * 24));

  if (season.status === 'active' && ageDays > MAX_SEASON_AGE_DAYS) {
    warnings.push({
      code: 'season_overdue',
      message: `Season is ${ageDays} days old (limit: ${MAX_SEASON_AGE_DAYS} days). Consider closing or marking as failed.`,
      ageDays,
      maxAgeDays: MAX_SEASON_AGE_DAYS,
    });
  }

  if (season.status === 'active' && season.lastActivityDate) {
    const inactiveDays = Math.floor((now - new Date(season.lastActivityDate)) / (1000 * 60 * 60 * 24));
    if (inactiveDays > STALE_INACTIVITY_DAYS) {
      warnings.push({
        code: 'season_inactive',
        message: `No activity for ${inactiveDays} days (threshold: ${STALE_INACTIVITY_DAYS} days).`,
        inactiveDays,
        threshold: STALE_INACTIVITY_DAYS,
      });
    }
  }

  return warnings;
}

/**
 * Get all stale active seasons (for admin dashboards / reports).
 */
export async function getStaleSeasons() {
  const cutoffAge = new Date();
  cutoffAge.setDate(cutoffAge.getDate() - MAX_SEASON_AGE_DAYS);

  const cutoffActivity = new Date();
  cutoffActivity.setDate(cutoffActivity.getDate() - STALE_INACTIVITY_DAYS);

  const stale = await prisma.farmSeason.findMany({
    where: {
      status: 'active',
      OR: [
        { plantingDate: { lt: cutoffAge } },
        { lastActivityDate: { lt: cutoffActivity } },
        { lastActivityDate: null, createdAt: { lt: cutoffActivity } },
      ],
    },
    include: {
      farmer: { select: { id: true, fullName: true, region: true } },
    },
    orderBy: { plantingDate: 'asc' },
  });

  return stale.map(season => ({
    ...season,
    stalenessWarnings: checkSeasonStaleness(season),
  }));
}
