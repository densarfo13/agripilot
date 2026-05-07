/**
 * safeNotify.js — safe trigger helpers for in-app notifications.
 *
 * Safe mode rules (notification safe spec):
 *   • NEVER throws — every function is wrapped in try/catch.
 *   • NEVER blocks render — all writes are synchronous localStorage ops.
 *   • NEVER spams — the underlying addNotification() is idempotent on
 *     (userId, dedupeKey) within a 12-hour window.
 *   • Invalid / missing data → silent no-op (returns false).
 *   • No push, no SMS, no email, no background polling.
 *   • Private contact details are NEVER stored; only approved status
 *     is surfaced in buyer-approval notifications.
 *
 * Gated by FEATURE_NOTIFICATIONS in callers. This module can be imported
 * regardless of the flag; each helper just returns false when data is
 * absent or the flag is off.
 *
 * Supported event types:
 *   task_completed          → TASK notification
 *   buyer_interest_received → BUYER notification
 *   buyer_request_approved  → BUYER notification (contact revealed)
 *   buyer_request_declined  → BUYER notification
 *   listing_expired         → TASK notification
 *   scan_task_added         → TASK notification
 */

import { addNotification, NOTIFICATION_TYPES } from './notificationStore.js';
import { isFeatureEnabled } from '../utils/featureFlags.js';

// ─── internal ─────────────────────────────────────────────────────

function _flagOn() {
  try { return isFeatureEnabled('FEATURE_NOTIFICATIONS'); }
  catch { return false; }
}

function _safe(fn) {
  try { return fn(); }
  catch { return false; }
}

function _str(v, maxLen = 120) {
  const s = String(v || '').trim().slice(0, maxLen);
  return s || null;
}

// ─── Public triggers ──────────────────────────────────────────────

/**
 * notifyTaskCompleted — fires when a farmer marks a task done.
 *
 * @param {{ userId: string, taskTitle: string, taskId?: string }} input
 * @returns {boolean} true if a notification entry was written
 */
export function notifyTaskCompleted({ userId, taskTitle, taskId } = {}) {
  return _safe(() => {
    if (!_flagOn()) return false;
    const uid  = _str(userId,    64);
    const title = _str(taskTitle, 80);
    if (!uid || !title) return false;

    return addNotification({
      userId:    uid,
      type:      NOTIFICATION_TYPES.TASK,
      title:     '✅ Task completed',
      message:   title,
      dedupeKey: `task_completed:${taskId || title}`,
    });
  });
}

/**
 * notifyBuyerInterestReceived — fires when a buyer expresses interest
 * in a farmer's listing. Contact details are NEVER included.
 *
 * @param {{ userId: string, cropName: string, listingId: string }} input
 * @returns {boolean}
 */
export function notifyBuyerInterestReceived({ userId, cropName, listingId } = {}) {
  return _safe(() => {
    if (!_flagOn()) return false;
    const uid  = _str(userId, 64);
    const crop = _str(cropName, 60) || 'your listing';
    const lid  = _str(listingId, 64);
    if (!uid || !lid) return false;

    return addNotification({
      userId:    uid,
      type:      NOTIFICATION_TYPES.BUYER,
      title:     '🛒 Buyer interested',
      message:   `A buyer is interested in ${crop}. Review in My Listings.`,
      dedupeKey: `buyer_interest:${lid}`,
    });
  });
}

/**
 * notifyBuyerRequestApproved — fires when a farmer approves a buyer
 * request. The buyer's contact details are revealed server-side only;
 * this notification tells the buyer the farmer accepted.
 *
 * @param {{ userId: string, farmerName?: string, interestId: string }} input
 * @returns {boolean}
 */
export function notifyBuyerRequestApproved({ userId, farmerName, interestId } = {}) {
  return _safe(() => {
    if (!_flagOn()) return false;
    const uid    = _str(userId, 64);
    const farmer = _str(farmerName, 60) || 'The farmer';
    const iid    = _str(interestId, 64);
    if (!uid || !iid) return false;

    return addNotification({
      userId:    uid,
      type:      NOTIFICATION_TYPES.BUYER,
      title:     '✅ Interest approved',
      // Do NOT include phone / email here — server enforces that.
      message:   `${farmer} approved your interest. Check your messages.`,
      dedupeKey: `buyer_approved:${iid}`,
    });
  });
}

/**
 * notifyBuyerRequestDeclined — fires when a farmer declines a buyer request.
 *
 * @param {{ userId: string, cropName?: string, interestId: string }} input
 * @returns {boolean}
 */
export function notifyBuyerRequestDeclined({ userId, cropName, interestId } = {}) {
  return _safe(() => {
    if (!_flagOn()) return false;
    const uid  = _str(userId, 64);
    const crop = _str(cropName, 60) || 'this listing';
    const iid  = _str(interestId, 64);
    if (!uid || !iid) return false;

    return addNotification({
      userId:    uid,
      type:      NOTIFICATION_TYPES.BUYER,
      title:     '❌ Interest declined',
      message:   `Your interest in ${crop} was declined. Try another listing.`,
      dedupeKey: `buyer_declined:${iid}`,
    });
  });
}

/**
 * notifyListingExpired — fires when a marketplace listing passes its
 * expiry date without a buyer match.
 *
 * @param {{ userId: string, cropName: string, listingId: string }} input
 * @returns {boolean}
 */
export function notifyListingExpired({ userId, cropName, listingId } = {}) {
  return _safe(() => {
    if (!_flagOn()) return false;
    const uid  = _str(userId, 64);
    const crop = _str(cropName, 60) || 'Your listing';
    const lid  = _str(listingId, 64);
    if (!uid || !lid) return false;

    return addNotification({
      userId:    uid,
      type:      NOTIFICATION_TYPES.TASK,
      title:     '⏰ Listing expired',
      message:   `${crop} listing has expired. Renew it in My Listings.`,
      dedupeKey: `listing_expired:${lid}`,
    });
  });
}

/**
 * notifyScanTaskAdded — fires when a scan result generates a follow-up
 * task (Phase 7F scan-task-suggestion flow).
 *
 * @param {{ userId: string, taskTitle: string, scanId?: string }} input
 * @returns {boolean}
 */
export function notifyScanTaskAdded({ userId, taskTitle, scanId } = {}) {
  return _safe(() => {
    if (!_flagOn()) return false;
    const uid  = _str(userId, 64);
    const task = _str(taskTitle, 80);
    if (!uid || !task) return false;

    return addNotification({
      userId:    uid,
      type:      NOTIFICATION_TYPES.TASK,
      title:     '📷 Scan task added',
      message:   task,
      dedupeKey: `scan_task:${scanId || task}`,
    });
  });
}
