/**
 * Predictive Next-Action Engine — rule-based, explainable.
 *
 * Examines farm context (profile, season, last activity, lifecycle state)
 * and returns ONE clear recommended next action for the farmer.
 *
 * Every recommendation has:
 *   actionKey  — i18n translation key
 *   icon       — emoji for low-literacy UX
 *   priority   — 1 (urgent) to 5 (routine)
 *   route      — where the CTA navigates
 *   reason     — short explanation (i18n key)
 *
 * Rules are evaluated top-down; first match wins.
 * No black-box scoring. Every action has an explicit rule.
 */

import { FARMER_STATE, getFarmerLifecycleState } from './farmerLifecycle.js';

// ── Stage progression order ────────────────────────────────
const STAGE_ORDER = ['planting', 'growing', 'flowering', 'harvest'];

function stageIndex(stage) {
  const idx = STAGE_ORDER.indexOf(stage);
  return idx >= 0 ? idx : -1;
}

// ── Helpers ────────────────────────────────────────────────

function daysBetween(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function pendingTaskCount(tasks) {
  if (!Array.isArray(tasks)) return 0;
  return tasks.filter(t => t.status === 'pending').length;
}

function nextPendingTask(tasks) {
  if (!Array.isArray(tasks)) return null;
  const pending = tasks
    .filter(t => t.status === 'pending')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  return pending[0] || null;
}

// ── Core engine ────────────────────────────────────────────

/**
 * Determine the single most relevant next action for a farmer.
 *
 * @param {Object} ctx
 * @param {Object|null}  ctx.profile      — farm profile (from ProfileContext)
 * @param {string|null}  ctx.countryCode  — farmer's country
 * @param {Object|null}  ctx.season       — active season (from SeasonContext)
 * @param {Object|null}  ctx.user         — user record (for fullName, etc.)
 * @returns {{ actionKey: string, icon: string, priority: number, route: string, reason: string, meta?: object } | null}
 */
export function getNextAction(ctx = {}) {
  const { profile, countryCode, season, user } = ctx;

  // ── Rule 1: No profile → complete setup ──────────────────
  const lifecycle = getFarmerLifecycleState({
    farmProfile: profile,
    countryCode: countryCode || profile?.countryCode,
  });

  if (lifecycle.state === FARMER_STATE.NEW) {
    return {
      actionKey: 'nextAction.createProfile',
      icon: '📋',
      priority: 1,
      route: '/profile/setup',
      reason: 'nextAction.createProfileReason',
    };
  }

  // ── Rule 2: Setup incomplete → finish setup ──────────────
  if (lifecycle.state === FARMER_STATE.SETUP_INCOMPLETE) {
    return {
      actionKey: 'nextAction.finishSetup',
      icon: '⚙️',
      priority: 1,
      route: '/profile/setup',
      reason: 'nextAction.finishSetupReason',
      meta: { missing: lifecycle.missing },
    };
  }

  // ── From here: ACTIVE state ──────────────────────────────

  // ── Rule 3: No active season → start one ─────────────────
  if (!season) {
    return {
      actionKey: 'nextAction.startSeason',
      icon: '🌱',
      priority: 2,
      route: '/season/start',
      reason: 'nextAction.startSeasonReason',
    };
  }

  // ── Season is active — check season-specific rules ───────
  const stage = season.stage;
  const tasks = season.tasks || [];
  const daysSinceStart = daysBetween(season.startDate);
  const daysSinceUpdate = daysBetween(season.updatedAt);
  const pending = pendingTaskCount(tasks);
  const nextTask = nextPendingTask(tasks);

  // ── Rule 4: Overdue task (past due date) ─────────────────
  if (nextTask) {
    const daysUntilDue = -daysBetween(nextTask.dueDate); // negative = overdue
    if (daysUntilDue < 0) {
      return {
        actionKey: 'nextAction.overdueTask',
        icon: '⚠️',
        priority: 1,
        route: '/season/start',
        reason: 'nextAction.overdueTaskReason',
        meta: { taskTitle: nextTask.title, daysOverdue: Math.abs(daysUntilDue) },
      };
    }
  }

  // ── Rule 5: Harvest stage → report harvest ───────────────
  if (stage === 'harvest') {
    return {
      actionKey: 'nextAction.reportHarvest',
      icon: '🌾',
      priority: 2,
      route: '/season/start',
      reason: 'nextAction.reportHarvestReason',
    };
  }

  // ── Rule 6: No update in 14+ days → add update ──────────
  if (daysSinceUpdate !== null && daysSinceUpdate >= 14) {
    return {
      actionKey: 'nextAction.addUpdate',
      icon: '📝',
      priority: 2,
      route: '/season/start',
      reason: 'nextAction.addUpdateReason',
      meta: { daysSinceUpdate },
    };
  }

  // ── Rule 7: Pending task coming up → do next task ────────
  if (nextTask) {
    const daysUntilDue = -daysBetween(nextTask.dueDate);
    if (daysUntilDue <= 3) {
      return {
        actionKey: 'nextAction.upcomingTask',
        icon: '📌',
        priority: 3,
        route: '/season/start',
        reason: 'nextAction.upcomingTaskReason',
        meta: { taskTitle: nextTask.title, daysUntilDue },
      };
    }
  }

  // ── Rule 8: No update in 7+ days → gentle nudge ─────────
  if (daysSinceUpdate !== null && daysSinceUpdate >= 7) {
    return {
      actionKey: 'nextAction.weeklyCheck',
      icon: '📸',
      priority: 3,
      route: '/season/start',
      reason: 'nextAction.weeklyCheckReason',
      meta: { daysSinceUpdate },
    };
  }

  // ── Rule 9: Stage-specific guidance ──────────────────────
  const si = stageIndex(stage);
  if (si >= 0 && si < STAGE_ORDER.length - 1) {
    const stageGuidance = {
      planting: {
        actionKey: 'nextAction.monitorPlanting',
        icon: '🌱',
        reason: 'nextAction.monitorPlantingReason',
      },
      growing: {
        actionKey: 'nextAction.monitorGrowth',
        icon: '🌿',
        reason: 'nextAction.monitorGrowthReason',
      },
      flowering: {
        actionKey: 'nextAction.monitorFlowering',
        icon: '🌸',
        reason: 'nextAction.monitorFloweringReason',
      },
    };

    const guidance = stageGuidance[stage];
    if (guidance) {
      return {
        ...guidance,
        priority: 4,
        route: '/season/start',
      };
    }
  }

  // ── Rule 10: Fallback — everything looks good ────────────
  return {
    actionKey: 'nextAction.onTrack',
    icon: '✅',
    priority: 5,
    route: '/season/start',
    reason: 'nextAction.onTrackReason',
  };
}

/**
 * Get a human-readable label for a stage.
 */
export function getStageName(stage) {
  const names = {
    planting: 'Planting',
    growing: 'Growing',
    flowering: 'Flowering',
    harvest: 'Harvest',
  };
  return names[stage] || stage || 'Unknown';
}

// Re-export for convenience
export { STAGE_ORDER };
