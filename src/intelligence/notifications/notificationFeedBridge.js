/**
 * notificationFeedBridge — connects the calm-intelligence engine
 * to the user-facing notification feed store (`src/notifications/`).
 *
 *   import { commitCalmQueue } from 'src/intelligence/notifications';
 *
 *   const { delivered, deferred } = commitCalmQueue(intelligenceContext, {
 *     userId: user.sub,
 *     now: new Date(),
 *   });
 *
 * WHAT THIS DOES
 *   1. Routes the active user id to both calm-engine memory stores
 *      (dedup + action/dismissal state) so the cooldown maps are
 *      scoped per account.
 *   2. Calls `queueNotifications(context, { commit: true })`.
 *   3. For every envelope marked `deliveredAt` (i.e. it passed the
 *      cooldown + scheduler + daily cap), writes a feed row via
 *      the existing `addNotification()` helper. The feed store's
 *      own dedupeKey window (12 h) is a second-line safety net.
 *   4. Returns `{ delivered, deferred, written }`:
 *        delivered → envelopes that DID deliver this call
 *        deferred  → envelopes the scheduler held for a future window
 *        written   → array of feed rows persisted (or null when
 *                    the feed store rejected the row via its own
 *                    dedup window)
 *
 * KIND → FEED TYPE MAP
 *   The feed store's existing schema only knows four types: TASK,
 *   FUNDING, BUYER, PROGRAM. The calm engine emits a finer set. We
 *   collapse them as follows:
 *     weather, task, scan_followup, scan, progress → TASK
 *     buyer                                       → BUYER
 *     funding                                     → FUNDING
 *   A future refactor could widen the feed schema, but for now
 *   collapsing keeps the bell + /notifications page rendering
 *   without any UI changes.
 *
 * STRICT-RULE AUDIT
 *   • Never throws — every step wrapped. Feed-store writes that
 *     dedupe-suppress return null, which is handled inline.
 *   • Pure with respect to the calm engine's `commit` flag — when
 *     the caller passes `{ commit: false }` the dedup store stays
 *     untouched (useful for previews + tests).
 *   • Idempotent: calling `commitCalmQueue` twice in quick
 *     succession produces ONE feed row (the calm dedup + the feed
 *     store's dedupeKey both engage).
 */

import { queueNotifications } from './notificationEngine.js';
import { setActiveUserId } from './notificationDeduplication.js';
import { addNotification, NOTIFICATION_TYPES } from '../../notifications/notificationStore.js';

// kind → feed TYPE.  Anything unknown collapses to TASK so the row
// still surfaces in the bell rather than getting silently dropped.
const KIND_TO_TYPE = Object.freeze({
  weather:       NOTIFICATION_TYPES.TASK,
  task:          NOTIFICATION_TYPES.TASK,
  task_reminder: NOTIFICATION_TYPES.TASK,
  scan_followup: NOTIFICATION_TYPES.TASK,
  scan:          NOTIFICATION_TYPES.TASK,
  progress:      NOTIFICATION_TYPES.TASK,
  buyer:         NOTIFICATION_TYPES.BUYER,
  funding:       NOTIFICATION_TYPES.FUNDING,
});

function _typeFor(kind) {
  return KIND_TO_TYPE[String(kind || '').toLowerCase()] || NOTIFICATION_TYPES.TASK;
}

/**
 * Push the calm engine's output into the user-facing feed store.
 *
 * @param {import('../core/intelligenceTypes.js').IntelligenceContext} context
 * @param {object} [opts]
 * @param {string} [opts.userId]    — sets dedup scope + persists on rows
 * @param {Date}   [opts.now]
 * @param {boolean} [opts.commit=true]
 * @returns {{
 *   delivered: Array<object>,
 *   deferred:  Array<object>,
 *   written:   Array<object|null>,
 * }}
 */
export function commitCalmQueue(context, opts = {}) {
  const userId = (opts.userId == null || opts.userId === '') ? null : String(opts.userId);
  const commit = opts.commit !== false; // default true — production behaviour
  const now    = (opts.now instanceof Date) ? opts.now : new Date();

  // Route both calm memory stores to this user scope BEFORE we
  // queue, so cooldown / state lookups read the right map.
  try { setActiveUserId(userId); } catch { /* swallow */ }

  let queued = [];
  try {
    queued = queueNotifications(context, { now, commit });
  } catch {
    return { delivered: [], deferred: [], written: [] };
  }

  const delivered = [];
  const deferred  = [];
  const written   = [];

  for (const n of queued) {
    if (!n || typeof n !== 'object') continue;
    if (n.deliveredAt) {
      delivered.push(n);
      // Persist into the user-facing feed. The feed store enforces
      // its own dedupeKey window (12 h) — if a row with the same
      // userId + dedupeKey was written recently, addNotification
      // returns null and we record that as a non-write.
      let row = null;
      try {
        row = addNotification({
          userId,
          type:      _typeFor(n.kind),
          title:     n.title || (n._fallback && n._fallback.title) || '',
          message:   n.body  || (n._fallback && n._fallback.body)  || '',
          dedupeKey: n.dedupeKey || `${n.kind}:${n.key}`,
        });
      } catch { row = null; }
      written.push(row);
    } else {
      deferred.push(n);
    }
  }

  return { delivered, deferred, written };
}

const _module = { commitCalmQueue, KIND_TO_TYPE };
export default _module;
