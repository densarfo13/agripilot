/**
 * intelligence/notifications — calm-intelligence notification
 * orchestration (May 2026).
 *
 *   import { queueNotifications, buildNotification, PRIORITY }
 *     from 'src/intelligence/notifications';
 *
 * MODULE MAP
 *   notificationPriority      — LOW / NORMAL / IMPORTANT tiers
 *   notificationTiming        — quiet hours + window classifier
 *   notificationDeduplication — cooldown tracker
 *   notificationTemplates     — calm copy library
 *   notificationScheduler     — when to fire / when to defer
 *   notificationEngine        — single entry: queueNotifications
 *
 * RULES
 *   • Pure / SSR-safe / never-throws across the board.
 *   • Visible strings pass through the intelligence-adapter's
 *     forbidden-wording filter as a defence-in-depth net.
 *   • `commit: false` (default) makes every helper non-mutating,
 *     so tests can run end-to-end without polluting localStorage.
 */

export {
  PRIORITY,
  PRIORITY_CONTRACT,
  normalizePriority,
  priorityContract,
} from './notificationPriority.js';

export {
  QUIET_START_HOUR,
  QUIET_END_HOUR,
  WINDOW,
  classifyWindow,
  isQuietHours,
  nextDeliveryAt,
} from './notificationTiming.js';

export {
  DEDUP_KEY,
  MAX_TRACKED,
  COOLDOWN,
  shouldDeliver,
  markDelivered,
  countDeliveredSince,
  clearDedup,
  clearAllDedupScopes,
  setActiveUserId,
  getActiveUserId,
} from './notificationDeduplication.js';

export {
  TEMPLATES,
  renderTemplate,
  resolveTemplate,
} from './notificationTemplates.js';

export {
  PREFERRED_WINDOW,
  evaluateSchedule,
} from './notificationScheduler.js';

export {
  identifyCandidates,
  buildNotification,
  queueNotifications,
  MAX_DAILY_TOTAL,
  MAX_DAILY_WEATHER,
} from './notificationEngine.js';

export {
  STATE_KEY,
  ACTION_SUPPRESS_HOURS,
  DISMISSED_SUPPRESS_HOURS,
  markAction,
  markDismissed,
  getState,
  isSuppressed,
  clearAllState,
} from './notificationState.js';

export {
  commitCalmQueue,
  KIND_TO_TYPE,
} from './notificationFeedBridge.js';
