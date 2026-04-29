/**
 * src/notifications — canonical entry for the user-facing
 * notification feed (bell + /notifications page + external
 * triggers like BUYER / FUNDING / PROGRAM / TASK deliveries).
 *
 * Why this barrel exists
 * ──────────────────────
 * The audit flagged "two notification stores" as architecture
 * drift. On closer inspection the two stores are NOT duplicates
 * — they serve different layers (rule dispatch vs. user feed).
 * This index pins the user-facing feed as the canonical surface
 * and re-exports its API so callers can stop importing through
 * a deep `./notificationStore.js` path that obscured the split.
 *
 * For the rule/reminder dispatch layer, import directly from
 * `src/lib/notifications/notificationStore.js` instead — that
 * one is consumed by reminderEngine + notificationDispatcher,
 * not by user-facing surfaces.
 */

export {
  STORAGE_KEY,
  NOTIFICATION_TYPES,
  NOTIFICATION_EVENTS,
  MAX_PER_USER,
  getNotifications,
  getUnreadCount,
  addNotification,
  markAsRead,
  markAllAsRead,
} from './notificationStore.js';
