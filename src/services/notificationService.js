/**
 * Notification Service — bridge between the pure notification engine
 * and the browser's Notification API.
 *
 * Responsibilities:
 *   - request / read permission state
 *   - deliver a NotificationDecision as a real browser notification
 *     (when permission is granted)
 *   - regardless of browser permission, record that the decision fired
 *     so the in-app banner on Home can render the same message
 *   - on click, open/focus the app at the decision's deeplink
 *
 * This is client-only. Server-side push is out of scope for this pass.
 */
import { recordSent, recordOpened, recordDismissed } from './notificationHistory.js';
import { safeTrackEvent } from '../lib/analytics.js';

// ─── Permission ─────────────────────────────────────────────

export function isSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getPermission() {
  if (!isSupported()) return 'unsupported';
  try { return Notification.permission; } catch { return 'denied'; }
}

export async function requestPermission() {
  if (!isSupported()) return 'unsupported';
  try {
    const result = await Notification.requestPermission();
    safeTrackEvent('notification.permission_result', { result });
    return result;
  } catch {
    return 'denied';
  }
}

// ─── Delivery ──────────────────────────────────────────────

/**
 * Deliver a NotificationDecision. Returns a summary of what happened.
 *
 * @param {Object} decision - Output from getDailyNotificationDecision()
 * @param {Function} t - i18n translate function
 * @returns {{ delivered: boolean, reason: string, id: string|null }}
 */
export function deliverNotification(decision, t) {
  if (!decision || !decision.shouldSend) {
    safeTrackEvent('notification.skipped', { reason: decision?.skipReason || 'unknown' });
    return { delivered: false, reason: decision?.skipReason || 'not_sendable', id: null };
  }

  const id = `${decision.type}_${Date.now()}`;
  const title = t(decision.titleKey, decision.titleVars || {}) || '';
  const body = t(decision.bodyKey, decision.bodyVars || {}) || '';

  // Always record in history — this is what powers the in-app banner
  // and the dedupe check on the next run.
  recordSent({
    id,
    type: decision.type,
    dedupeKey: decision.dedupeKey,
    sentAt: Date.now(),
  });
  safeTrackEvent('notification.scheduled', {
    type: decision.type,
    urgency: decision.urgency,
    dedupeKey: decision.dedupeKey,
  });

  const permission = getPermission();
  if (permission !== 'granted') {
    // Permission not granted — the in-app banner still renders the
    // message, which is why we always record first. Spec §1: value > channel.
    safeTrackEvent('notification.sent_in_app_only', {
      type: decision.type, reason: permission,
    });
    return { delivered: true, reason: 'in_app_only', id };
  }

  // Fire the browser notification
  try {
    const n = new Notification(title, {
      body,
      tag: decision.dedupeKey, // replaces earlier with same tag — natural dedupe
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { deeplink: decision.deeplinkTarget || '/dashboard', id, type: decision.type },
      requireInteraction: decision.type === 'critical',
    });

    n.onclick = (event) => {
      event.preventDefault();
      safeTrackEvent('notification.opened', { type: decision.type, id });
      recordOpened(id);
      const target = decision.deeplinkTarget || '/dashboard';
      try {
        if (window && window.focus) window.focus();
        // If the app is already open, soft-navigate via hash/location
        if (window.location.pathname !== target.split('?')[0]) {
          window.location.href = target;
        } else {
          // Re-apply query string so the Home highlight handler re-triggers
          window.history.replaceState(null, '', target);
          window.dispatchEvent(new CustomEvent('farroway:notification_opened', { detail: { id, target } }));
        }
      } catch { /* ignore */ }
      n.close();
    };

    n.onclose = () => {
      recordDismissed(id);
      safeTrackEvent('notification.dismissed', { type: decision.type, id });
    };

    safeTrackEvent('notification.sent', { type: decision.type, urgency: decision.urgency });
    return { delivered: true, reason: 'browser', id };
  } catch (err) {
    // Some platforms throw on new Notification() even with granted permission
    safeTrackEvent('notification.delivery_failed', { message: err?.message });
    return { delivered: true, reason: 'in_app_only_fallback', id };
  }
}
