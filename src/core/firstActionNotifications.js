/**
 * firstActionNotifications.js — additive bridge between
 * `notificationDecisionEngine.getNotificationForToday()` and the
 * existing `lib/notifications/notificationDispatcher.dispatchNotification()`.
 *
 * Why a bridge module
 * ───────────────────
 * `notificationDecisionEngine` returns a *decision* (an object or
 * null). It deliberately doesn't import the dispatcher because
 * the spec said "Return notification object only" — the caller
 * decides whether to deliver. This module is that caller, kept
 * thin and additive so:
 *
 *   • Nothing breaks if the dispatcher's adapters are unset
 *     (default behaviour: returns `'no_adapter'` → silent no-op)
 *   • Per-day dedup so a tab that re-mounts doesn't fire the
 *     same morning notification 3 times
 *   • Privacy + opt-out paths short-circuit it cleanly
 *   • Analytics fires `notification_generated` (spec §12) only
 *     when an actual decision was reached
 *
 * Public API
 * ──────────
 *   routeFirstActionNotification(input)
 *     • input is the same shape as getNotificationForToday
 *     • returns the dispatch result string ('ok' | 'no_adapter' |
 *       'noop' | 'deduped' | 'error') so callers can log the
 *       outcome without importing the dispatcher directly
 *
 *   clearNotificationDedup()
 *     • drops the per-day dedup slot. Used by the privacy reset
 *       path so a fresh session doesn't inherit yesterday's
 *       "already fired" state.
 *
 * Storage
 * ───────
 *   localStorage[`farroway:notif:fired:${dedupKey}`] = '1'
 *   The dedup key comes from the engine's own `key` field, which
 *   already includes the date (e.g. `morning:2026-05-02`), so
 *   midnight rollover automatically un-dedupes.
 */

import { getNotificationForToday } from './notificationDecisionEngine.js';
import { dispatchNotification } from '../lib/notifications/notificationDispatcher.js';
import { trackEvent } from './analytics.js';

const DEDUP_PREFIX = 'farroway:notif:fired:';
// Spec §3 limit: "do not send if user already opened app".
// The FirstActionGate stamps this slot when the page mounts
// (see `markHomeOpenedToday` below). The morning notification
// then short-circuits with `'home_opened'` for the rest of
// the day. Other notification types (rain / humidity /
// inactive) still fire because they reflect transient
// conditions the user may not have seen on their first open.
const HOME_OPENED_KEY = 'farroway:notif:homeOpened';

function _todayDate() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * Stamp "home was opened today" so the morning notification
 * doesn't re-fire later in the day. Idempotent. Called by the
 * FirstActionGate's mount-time effect (or any other surface
 * that wants to claim "the user has seen today's primary action").
 */
export function markHomeOpenedToday() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(HOME_OPENED_KEY, _todayDate());
  } catch { /* ignore */ }
}

function _homeOpenedToday() {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(HOME_OPENED_KEY) === _todayDate();
  } catch { return false; }
}

function _dedupKey(notif) {
  return notif && notif.key ? `${DEDUP_PREFIX}${notif.key}` : null;
}

function _alreadyFired(notif) {
  try {
    if (typeof localStorage === 'undefined') return false;
    const k = _dedupKey(notif);
    if (!k) return false;
    return localStorage.getItem(k) === '1';
  } catch { return false; }
}

function _markFired(notif) {
  try {
    if (typeof localStorage === 'undefined') return;
    const k = _dedupKey(notif);
    if (!k) return;
    localStorage.setItem(k, '1');
  } catch { /* ignore */ }
}

/**
 * Compute today's notification (if any) and route it through
 * the dispatcher. Idempotent per-day via the engine's own
 * date-stamped dedup key.
 *
 * Returns one of:
 *   'no_decision'  — engine returned null
 *   'deduped'      — already fired today
 *   'ok'           — dispatcher accepted (real send if an adapter
 *                     is registered; in_app no-op otherwise)
 *   'no_adapter'   — channel has no registered adapter (still safe)
 *   'error'        — dispatcher threw; we swallow + surface
 */
export function routeFirstActionNotification(input = {}) {
  let notif = null;
  try { notif = getNotificationForToday(input); }
  catch { notif = null; }
  if (!notif) return 'no_decision';
  if (_alreadyFired(notif)) return 'deduped';
  // Spec §3 — never resend the morning ("Open Farroway first")
  // notification once the user has already opened Home today.
  // Other types (rain / humidity / inactive) still fire — they
  // reflect mid-day signals the user may not have seen.
  if (notif.type === 'morning_first_action' && _homeOpenedToday()) {
    return 'home_opened';
  }

  // Mark BEFORE dispatch so a synchronous adapter throw doesn't
  // leave us in a re-fire loop. The dispatcher itself is
  // try/catch-wrapped — see lib/notifications/notificationDispatcher.js.
  _markFired(notif);

  let result = 'noop';
  try { result = dispatchNotification(notif); }
  catch { result = 'error'; }

  // Spec §12 analytics — only fire when a real decision was
  // reached. trackEvent is wrapped twice (its own try/catch +
  // the safe-trackEvent helper), so this can never crash render.
  try {
    trackEvent('notification_generated', {
      type:        notif.type,
      priority:    notif.priority,
      dispatch:    result,
      timestamp:   Date.now(),
    });
  } catch { /* ignore */ }

  return result;
}

/**
 * Privacy reset path — drops every per-day fired marker so a
 * new session doesn't inherit yesterday's state. Called by
 * `insightsPrivacy.clearLocalActivityData()` indirectly via the
 * existing `clearFarrowayActivityData()` chain (the prefix slot
 * isn't in that helper's allow-list yet — see follow-up below).
 */
export function clearNotificationDedup() {
  try {
    if (typeof localStorage === 'undefined') return;
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(DEDUP_PREFIX)) toRemove.push(k);
    }
    for (const k of toRemove) localStorage.removeItem(k);
  } catch { /* ignore */ }
}

export const _internal = Object.freeze({
  DEDUP_PREFIX,
  _dedupKey, _alreadyFired, _markFired,
});
