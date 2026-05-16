/**
 * returnLoopScheduler.js — the daily return-loop trigger.
 *
 *   import { installReturnLoop } from
 *     'src/core/notifications/returnLoopScheduler.js';
 *   installReturnLoop();   // once, at app boot
 *
 * What it does
 * ────────────
 *   dailyBriefingEngine produces the day's notification messages;
 *   this module is what actually FIRES them. On app boot and again
 *   whenever the tab becomes visible (a return visit), it runs the
 *   briefing AT MOST ONCE PER DAY and writes the messages into the
 *   in-app notification centre (notificationStore).
 *
 *   In-app delivery is the universal path — it never needs push
 *   permission and never crashes when FCM is absent (spec §7). When
 *   push IS available, the existing notificationService can later
 *   mirror these rows; this scheduler does not depend on it.
 *
 * Spec rules honoured
 *   • Once per day — a localStorage date stamp guards re-runs (§3
 *     "no duplicates"); addNotification's dedupeKey (the briefing
 *     id carries the date) is a second guard.
 *   • Opt-in — skips entirely when notificationPreferences.daily is
 *     off, and when FEATURE_NOTIFICATIONS is disabled (§3, §8).
 *   • At most 2 messages — enforced upstream by dailyBriefingEngine.
 *
 * Strict-rule audit
 *   • Never throws — every step is guarded; a failure is a no-op.
 *   • SSR-safe (window / localStorage guarded). Idempotent install.
 *   • No PII beyond the user id already held locally.
 */

import { generateDailyBriefingNotifications } from './dailyBriefingEngine.js';
import { addNotification } from '../../notifications/notificationStore.js';
import { getPreferences } from '../../services/notificationPreferences.js';
import { isFeatureEnabled } from '../../utils/featureFlags.js';

const LAST_RUN_KEY = 'farroway_daily_briefing_last_run_v1';

function _today() {
  try { return new Date().toISOString().slice(0, 10); }
  catch { return 'today'; }
}

/** Current user id — synchronous best-effort read of the locally
 *  cached user. Null when signed out / unavailable. */
function _currentUserId() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('farroway_user');
    if (!raw) return null;
    const u = JSON.parse(raw);
    const id = u && (u.sub || u.id || u.userId);
    return id ? String(id) : null;
  } catch {
    return null;
  }
}

function _ranToday() {
  try { return localStorage.getItem(LAST_RUN_KEY) === _today(); }
  catch { return false; }
}

function _stampRun() {
  try { localStorage.setItem(LAST_RUN_KEY, _today()); }
  catch { /* quota / private mode — non-fatal */ }
}

/**
 * Run the daily briefing — at most once per calendar day. Generates
 * the briefing notifications and writes them into the in-app
 * notification centre. Never throws.
 *
 * @returns {{ ran:boolean, delivered?:number, reason?:string }}
 */
export function runDailyBriefingOnce() {
  try {
    if (typeof localStorage === 'undefined') return { ran: false, reason: 'no_storage' };
    if (_ranToday()) return { ran: false, reason: 'already_ran' };

    // Feature gate — when notifications are off, nothing fires.
    try {
      if (!isFeatureEnabled('FEATURE_NOTIFICATIONS')) {
        return { ran: false, reason: 'feature_off' };
      }
    } catch { /* default to enabled if the flag read fails */ }

    // Opt-in — the farmer can turn the daily briefing off (§8).
    let prefs;
    try { prefs = getPreferences(); } catch { prefs = null; }
    if (prefs && prefs.daily === false) {
      _stampRun(); // stamp so we don't re-evaluate all day
      return { ran: false, reason: 'opted_out' };
    }

    const notes = generateDailyBriefingNotifications();
    const userId = _currentUserId();
    let delivered = 0;
    for (const n of (Array.isArray(notes) ? notes : [])) {
      try {
        const row = addNotification({
          userId,
          type:      'TASK', // briefing items are calm next-actions
          title:     n.title,
          message:   n.body,
          dedupeKey: n.id,   // carries today's date — once-per-day dedupe
        });
        if (row) delivered += 1;
      } catch { /* per-note tolerate */ }
    }
    _stampRun();
    return { ran: true, delivered };
  } catch {
    return { ran: false, reason: 'error' };
  }
}

/**
 * Install the return loop — runs the briefing at boot and again
 * when the tab next becomes visible. Idempotent.
 *
 * @returns {boolean} true once installed
 */
export function installReturnLoop() {
  try {
    if (typeof window === 'undefined') return false;
    if (window.__farrowayReturnLoopInstalled) return true;
    window.__farrowayReturnLoopInstalled = true;

    runDailyBriefingOnce();

    try {
      if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('visibilitychange', () => {
          try { if (!document.hidden) runDailyBriefingOnce(); }
          catch { /* swallow */ }
        });
      }
    } catch { /* swallow */ }

    return true;
  } catch {
    return false;
  }
}

/** Test seam — clears the install flag + the daily run stamp. */
export function _resetReturnLoop() {
  try {
    if (typeof window !== 'undefined') delete window.__farrowayReturnLoopInstalled;
    if (typeof localStorage !== 'undefined') localStorage.removeItem(LAST_RUN_KEY);
  } catch { /* swallow */ }
}

const _module = {
  runDailyBriefingOnce,
  installReturnLoop,
  _resetReturnLoop,
};
export default _module;
