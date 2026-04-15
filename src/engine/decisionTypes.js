/**
 * Decision Engine Types
 *
 * Defines the shape of decision inputs, outputs, and action types.
 * Pure data definitions — no logic here.
 */

/**
 * All possible action keys the decision engine can return.
 * @typedef {'onboarding_incomplete' | 'no_active_farm' | 'profile_incomplete' |
 *   'stage_missing' | 'stage_outdated' | 'severe_pest' | 'pest_overdue' |
 *   'unread_alert' | 'stale_activity' | 'daily_task' | 'all_done'} ActionKey
 */

/**
 * Priority levels (lower number = higher priority).
 * @typedef {'critical' | 'high' | 'medium' | 'low' | 'info'} PriorityLevel
 */

/**
 * Risk levels for overall farm status.
 * @typedef {'none' | 'low' | 'moderate' | 'high' | 'critical'} RiskLevel
 */

/**
 * @typedef {Object} DecisionInput
 * @property {Object|null} profile - Farm profile from API
 * @property {boolean} setupComplete - Whether farm score >= 75
 * @property {Object|null} primaryTask - Highest-priority server task
 * @property {number} taskCount - Total pending task count
 * @property {number} completedCount - Tasks completed this period
 * @property {Object|null} weather - Current weather data
 * @property {boolean} isOnline - Network connectivity
 */

/**
 * @typedef {Object} DecisionAction
 * @property {ActionKey} key - Unique action identifier
 * @property {string} icon - Emoji icon
 * @property {string} iconBg - Background color for icon circle
 * @property {string} title - Short action title (farmer-friendly)
 * @property {string} reason - Why this action matters (one sentence)
 * @property {string} cta - CTA button label
 * @property {string|null} next - "What happens next" hint
 * @property {PriorityLevel} priority - Visual priority level
 * @property {boolean} isAlert - Whether this is an urgent alert
 * @property {Object|null} [stageInfo] - Current stage info (for stage actions)
 * @property {Object|null} [task] - Server task object (for task actions)
 */

/**
 * @typedef {Object} PlanStep
 * @property {string} icon - Emoji
 * @property {string} label - Short label
 * @property {boolean} active - Whether this is the current step
 */

/**
 * @typedef {Object} FarmStatus
 * @property {RiskLevel} riskLevel - Overall farm risk
 * @property {string} label - Short status label
 * @property {string} description - One-line description
 * @property {Array<{icon: string, label: string, ok: boolean}>} checks - Individual status checks
 */

/**
 * @typedef {Object} DecisionResult
 * @property {DecisionAction} primaryAction - The one thing to do now
 * @property {PlanStep[]} todaysPlan - 2-4 step plan
 * @property {FarmStatus} farmStatus - Overall farm health
 * @property {DecisionAction[]} secondaryActions - Lower-priority actions (max 3)
 */

// Priority weights for sorting (lower = more urgent)
export const PRIORITY_WEIGHTS = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

// Risk level colors
export const RISK_COLORS = {
  none: { bg: 'rgba(34,197,94,0.12)', text: '#86EFAC', border: 'rgba(34,197,94,0.3)' },
  low: { bg: 'rgba(34,197,94,0.12)', text: '#86EFAC', border: 'rgba(34,197,94,0.3)' },
  moderate: { bg: 'rgba(250,204,21,0.12)', text: '#FCD34D', border: 'rgba(250,204,21,0.3)' },
  high: { bg: 'rgba(239,68,68,0.12)', text: '#FCA5A5', border: 'rgba(239,68,68,0.3)' },
  critical: { bg: 'rgba(239,68,68,0.15)', text: '#FCA5A5', border: 'rgba(239,68,68,0.4)' },
};
