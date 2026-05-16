/**
 * notificationOrchestrator.js — the notification CHANNEL router.
 *
 *   import { routeNotifications, CHANNEL }
 *     from 'src/core/notifications/notificationOrchestrator.js';
 *
 *   const plan = routeNotifications(notifications);
 *   //  → { push: [...], inApp: [...], email: [...] }
 *
 * What it is
 * ──────────
 *   dailyBriefingEngine GENERATES notification messages; this module
 *   decides which CHANNEL each one belongs to. It is the routing
 *   brain the spec's §1/§2/§4 describe — it does NOT generate
 *   messages, deliver push, or render the in-app centre (those are
 *   dailyBriefingEngine / notificationService / notificationStore,
 *   all of which already ship — building parallel versions would
 *   duplicate them).
 *
 * The three-channel model (spec intro + §2)
 *   • push   — OPERATIONAL: a small, time-sensitive subset (weather
 *              risk, scan follow-up, task due, irrigation, harvest).
 *   • in-app — PERSISTENT MEMORY: EVERY notification lands here.
 *   • email  — SUMMARY/REPORTING: weekly digests only — never a
 *              per-notification channel, so routeNotifications()
 *              returns email: [] (the weekly summary is a separate
 *              opt-in trigger, not routed here).
 *
 * Frequency rules (§4)
 *   • push is capped at MAX_PUSH_PER_DAY (2).
 *   • Critical-urgency items may exceed the cap (spec: "urgent
 *     alerts can override if critical").
 *   • Quiet hours suppress push (never in-app).
 *   • Opt-out: push:false / inApp:false in preferences removes
 *     that channel entirely.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe. No new state.
 *   • Reads notificationPreferences only — no recommendation logic.
 */

import { getPreferences } from '../../services/notificationPreferences.js';

export const CHANNEL = Object.freeze({
  PUSH:   'push',
  IN_APP: 'in_app',
  EMAIL:  'email',
});

// Notification kinds that warrant an operational PUSH. Everything
// else is in-app only. (in-app always receives every kind.)
const PUSH_KINDS = Object.freeze(new Set([
  'weather_risk',
  'scan_followup',
  'task_reminder',
  'irrigation_warning',
  'harvest_ready',
]));

const MAX_PUSH_PER_DAY = 2;

/** Whether `hour` (0-23) falls inside the quiet-hours window.
 *  Handles windows that wrap past midnight (e.g. 21 → 7). */
function _inQuietHours(hour, start, end) {
  if (typeof hour !== 'number') return false;
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end; // wraps midnight
}

/** Resolve the current local hour — injectable for tests. */
function _currentHour(nowMs) {
  try {
    const d = (typeof nowMs === 'number') ? new Date(nowMs) : new Date();
    return d.getHours();
  } catch {
    return 12;
  }
}

/**
 * Route a list of generated notifications onto channels.
 *
 * @param {Array<object>} notifications  from dailyBriefingEngine —
 *        each: { id, kind, urgency, mode, title, body, language }
 * @param {object} [options]
 * @param {number} [options.nowMs]   injectable clock (tests)
 * @param {object} [options.prefsOverride]  injectable prefs (tests)
 * @returns {{ push: Array<object>, inApp: Array<object>, email: Array<object> }}
 */
export function routeNotifications(notifications, options) {
  const opts = (options && typeof options === 'object') ? options : {};
  const list = Array.isArray(notifications) ? notifications.filter(Boolean) : [];

  let prefs;
  try {
    prefs = opts.prefsOverride || getPreferences() || {};
  } catch {
    prefs = {};
  }

  const pushEnabled  = prefs.push  !== false; // default on
  const inAppEnabled = prefs.inApp !== false; // default on
  const hour = _currentHour(opts.nowMs);
  const quiet = _inQuietHours(
    hour,
    typeof prefs.quietStart === 'number' ? prefs.quietStart : 21,
    typeof prefs.quietEnd   === 'number' ? prefs.quietEnd   : 7,
  );

  const inApp = [];
  const push = [];

  for (const n of list) {
    // In-app is the persistent memory — every notification lands
    // here unless the farmer turned the whole channel off.
    if (inAppEnabled) {
      inApp.push({ ...n, channel: CHANNEL.IN_APP });
    }

    // Push — operational subset only, and only when the channel is
    // on. Critical items ignore quiet hours; everything else is
    // suppressed during quiet hours.
    if (!pushEnabled) continue;
    if (!PUSH_KINDS.has(n.kind)) continue;
    const isCritical = String(n.urgency || '').toLowerCase() === 'high';
    if (quiet && !isCritical) continue;
    push.push({ ...n, channel: CHANNEL.PUSH });
  }

  // Frequency cap (§4): at most MAX_PUSH_PER_DAY push, but a
  // critical item may override the cap. Order push so critical
  // items survive the slice.
  push.sort((a, b) => {
    const ac = String(a.urgency || '').toLowerCase() === 'high' ? 1 : 0;
    const bc = String(b.urgency || '').toLowerCase() === 'high' ? 1 : 0;
    return bc - ac;
  });
  let capped;
  if (push.length <= MAX_PUSH_PER_DAY) {
    capped = push;
  } else {
    const critical = push.filter(
      (n) => String(n.urgency || '').toLowerCase() === 'high',
    );
    capped = critical.length > MAX_PUSH_PER_DAY
      ? critical
      : push.slice(0, Math.max(MAX_PUSH_PER_DAY, critical.length));
  }

  return {
    push:  capped,
    inApp,
    // Email is summary-only — never a per-notification channel.
    // The weekly digest is a separate opt-in trigger.
    email: [],
  };
}

export const _internal = Object.freeze({
  PUSH_KINDS, MAX_PUSH_PER_DAY, _inQuietHours,
});

const _module = { CHANNEL, routeNotifications, _internal };
export default _module;
