/**
 * dailyEmailDispatcher.js — once-per-day email send glue
 * for the Smart Reminder System (§4 + transport).
 *
 *   import { sendDailyEmailIfDue } from '../core/dailyEmailDispatcher.js';
 *
 *   sendDailyEmailIfDue({ decision, recipient });
 *
 *   // → 'no_decision'        decision missing primaryAction
 *   // | 'no_recipient'       no email address provided
 *   // | 'opt_out'             user disabled email reminders
 *   // | 'deduped'             already sent today
 *   // | 'no_adapter'          no email transport registered
 *   // | 'ok'                  dispatcher accepted (real send if
 *   //                          adapter is wired; in-memory no-op
 *   //                          while the team integrates SendGrid /
 *   //                          Resend / SMTP)
 *   // | 'error'               adapter threw (swallowed)
 *
 * Composition pipeline
 * ────────────────────
 *   decideToday(input)              → composer decision
 *     ↓
 *   generateDailyEmail({ decision }) → { subject, primary, reason,
 *                                         tomorrow, meta }
 *     ↓
 *   { channel: 'email', to, ...email }
 *     ↓
 *   notificationDispatcher.dispatchNotification(notif)
 *
 * Pre-conditions (any failure → no send)
 *   • `getSettings().emailReminderEnabled === true`
 *   • Per-day dedup not already fired
 *
 * Storage
 *   localStorage[`farroway:emailFired:YYYY-MM-DD`] = '1'
 *   Per-day dedup so a tab that re-mounts doesn't spam the
 *   adapter. Midnight rollover lets the next day re-send.
 *
 * Safety
 *   Never throws. Failures route through the standard
 *   dispatcher result codes; analytics counts each outcome.
 */

import { generateDailyEmail } from './notificationEngine.js';
import { dispatchNotification } from '../lib/notifications/notificationDispatcher.js';
import { getSettings } from '../lib/notifications/reminderEngine.js';
import { trackEvent } from './analytics.js';

const EMAIL_FIRED_PREFIX = 'farroway:emailFired:';

function _today() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function _firedKey() { return EMAIL_FIRED_PREFIX + _today(); }

function _alreadyFiredToday() {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(_firedKey()) === '1';
  } catch { return false; }
}

function _markFiredToday() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(_firedKey(), '1');
  } catch { /* ignore */ }
}

function _isOptedIn() {
  try {
    const s = getSettings();
    return !!(s && s.emailReminderEnabled === true);
  } catch { return false; }
}

/**
 * @param {{decision?: object, recipient?: string|null}} input
 * @returns {string}
 */
export function sendDailyEmailIfDue(input = {}) {
  // 1. Opt-in gate (spec §5: email default OFF; user opts in
  //    via NotificationSettingsPanel `emailReminderEnabled` toggle).
  if (!_isOptedIn()) return 'opt_out';

  // 2. Per-day dedup before doing any work — cheapest exit.
  if (_alreadyFiredToday()) return 'deduped';

  // 3. Build the email body from the decision.
  let email = null;
  try { email = generateDailyEmail({ decision: input.decision }); }
  catch { email = null; }
  if (!email) return 'no_decision';

  // 4. Recipient — caller supplies. Without one we cannot send.
  //    Caller might pass user.email; we don't reach into auth
  //    state here so this module stays test-friendly.
  const to = typeof input.recipient === 'string' && input.recipient.trim()
    ? input.recipient.trim() : null;
  if (!to) return 'no_recipient';

  // 5. Mark BEFORE dispatch so a synchronous adapter throw can't
  //    leave us in a re-fire loop.
  _markFiredToday();

  let result = 'noop';
  try {
    result = dispatchNotification({
      channel: 'email',
      to,
      subject:  email.subject,    // { key, fallback }
      primary:  email.primary,
      reason:   email.reason,
      tomorrow: email.tomorrow,
      meta:     email.meta,
    });
  } catch { result = 'error'; }

  // 6. Analytics — fire-and-forget, doubly guarded.
  try {
    trackEvent('daily_email_sent', {
      result,
      primaryActionType: email.meta && email.meta.primaryActionType,
      timestamp:         Date.now(),
    });
  } catch { /* never propagate */ }

  return result;
}

/**
 * Privacy / debug helper — drops every per-day email-fired marker.
 * Used by clearLocalActivityData() chains.
 */
export function clearEmailDedup() {
  try {
    if (typeof localStorage === 'undefined') return;
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(EMAIL_FIRED_PREFIX)) toRemove.push(k);
    }
    for (const k of toRemove) localStorage.removeItem(k);
  } catch { /* ignore */ }
}

export const _internal = Object.freeze({
  EMAIL_FIRED_PREFIX,
  _today, _firedKey, _alreadyFiredToday, _markFiredToday, _isOptedIn,
});
