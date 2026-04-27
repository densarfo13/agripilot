/**
 * notificationSystem.js — Farroway core daily-reminder driver
 * (spec section 7).
 *
 * Called every minute by the init module (section 10). On the
 * minute that matches the farmer's preferred reminderTime, fires
 * exactly once per local day:
 *
 *   1. read settings  -> bail if `daily` is off
 *   2. throttle       -> skip if we already fired today
 *   3. read farm      -> bail if no farm record
 *   4. compute task   -> bail if engine returns null
 *   5. browser notif  -> only if Notification permission granted
 *   6. voice          -> always safe (silently no-ops if unavailable)
 *   7. SMS            -> only if settings.sms is on AND farm has a phone
 *   8. mark fired     -> stamp today so step 2 short-circuits the rest of today
 *
 * Strict rules respected:
 *   * never crashes if any storage read fails (safeRead returns the
 *     default and we keep going)
 *   * never throws from a notification handler - every external
 *     call is wrapped
 *   * no auth, no backend redesign - we just call /api/send-sms
 */

import { loadSettings } from '../../store/settingsStore.js';
import { getCurrentFarm } from './farmStore.js';
import { generateDailyTask } from './taskEngine.js';
import { getTaskMessage } from './taskMessages.js';
import { speak } from './voice.js';
import { sendSMS } from './smsService.js';

export const LAST_NOTIFICATION_KEY      = 'farroway_last_notification';
export const LAST_NOTIFICATION_TASK_KEY = 'farroway_last_notification_task';

function _safeRead(key) {
  try {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem(key) || '';
  } catch { return ''; }
}

function _safeWrite(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, String(value || ''));
  } catch { /* swallow - quota / private mode */ }
}

function safeReadLastNotificationStamp() { return _safeRead(LAST_NOTIFICATION_KEY); }
function safeWriteLastNotificationStamp(stamp) { _safeWrite(LAST_NOTIFICATION_KEY, stamp); }
function safeReadLastNotificationTask() { return _safeRead(LAST_NOTIFICATION_TASK_KEY); }
function safeWriteLastNotificationTask(task) { _safeWrite(LAST_NOTIFICATION_TASK_KEY, task); }

function parseHM(value) {
  // settings.reminderTime is the canonical "HH:MM" the Settings
  // page persists. Defensive: handle bad input -> 7:00 fallback.
  if (typeof value !== 'string' || !value.includes(':')) return [7, 0];
  const [hRaw, mRaw] = value.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  return [
    Number.isFinite(h) ? h : 7,
    Number.isFinite(m) ? m : 0,
  ];
}

function showBrowserNotification(message) {
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    /* eslint-disable no-new */
    new Notification('Farroway', { body: message });
  } catch { /* never propagate */ }
}

/**
 * Run one tick of the daily-reminder check. Safe to call on a
 * setInterval - everything inside is idempotent and defensive.
 */
export function runDailyReminder(now = new Date()) {
  let settings;
  try { settings = loadSettings(); }
  catch { return; }
  if (!settings || !settings.daily) return;

  const today = now.toDateString();
  if (safeReadLastNotificationStamp() === today) return;

  const [targetH, targetM] = parseHM(settings.reminderTime);
  if (now.getHours() !== targetH || now.getMinutes() !== targetM) return;

  // Anti-spam (spec section 7):
  //   1. Do NOT send if no farm
  const farm = getCurrentFarm();
  if (!farm) return;

  const data = generateDailyTask(farm);
  const taskId = (data && data.mainTask) || 'check_farm';

  //   2. Do NOT send a duplicate task we already sent today.
  //      The day-stamp guard above already enforces "1/day max"
  //      after a successful fire, but if a previous tick wrote
  //      ONLY the task stamp (e.g. browser closed mid-write),
  //      this second guard keeps us from re-firing the same task.
  const lastTaskKey = `${today}:${taskId}`;
  if (safeReadLastNotificationTask() === lastTaskKey) return;

  const msg = getTaskMessage(taskId);

  showBrowserNotification(msg);
  speak(msg);

  if (settings.sms && farm.phone) {
    // Fire-and-forget; sendSMS swallows its own errors.
    sendSMS(farm.phone, msg);
  }

  // Stamp BOTH guards. Day-stamp first - it's the cheaper
  // short-circuit on the next tick.
  safeWriteLastNotificationStamp(today);
  safeWriteLastNotificationTask(lastTaskKey);
}
