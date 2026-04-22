/**
 * notificationPreferences.js — per-user notification settings.
 *
 * Storage:
 *   localStorage['farroway.notificationPrefs.v1'] = {
 *     emailEnabled, smsEnabled,
 *     dailyReminderEnabled, weatherAlertsEnabled, riskAlertsEnabled,
 *     missedTaskRemindersEnabled,
 *     preferredReminderTime: 'HH:mm',
 *     updatedAt: ISO string,
 *   }
 *
 * Defaults are conservative: in-app always on, email on, SMS off
 * (most farmers haven't verified a phone yet). Callers never need to
 * branch on missing prefs — `getNotificationPreferences()` always
 * returns a complete object.
 */

const KEY = 'farroway.notificationPrefs.v1';

export const DEFAULT_PREFERENCES = Object.freeze({
  emailEnabled:                true,
  smsEnabled:                  false,
  dailyReminderEnabled:        true,
  weatherAlertsEnabled:        true,
  riskAlertsEnabled:           true,
  missedTaskRemindersEnabled:  true,
  preferredReminderTime:       '07:00',
});

function hasStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readRaw() {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeRaw(obj) {
  if (!hasStorage()) return false;
  try { window.localStorage.setItem(KEY, JSON.stringify(obj)); return true; }
  catch { return false; }
}

function validTime(s) {
  return typeof s === 'string' && /^\d{2}:\d{2}$/.test(s);
}

export function getNotificationPreferences() {
  const raw = readRaw();
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PREFERENCES };
  const merged = { ...DEFAULT_PREFERENCES, ...raw };
  if (!validTime(merged.preferredReminderTime)) {
    merged.preferredReminderTime = DEFAULT_PREFERENCES.preferredReminderTime;
  }
  // Coerce every boolean flag so legacy / truthy / stringified values
  // still behave safely.
  for (const k of Object.keys(DEFAULT_PREFERENCES)) {
    if (typeof DEFAULT_PREFERENCES[k] === 'boolean') merged[k] = !!merged[k];
  }
  return merged;
}

export function setNotificationPreferences(patch) {
  if (!patch || typeof patch !== 'object') return getNotificationPreferences();
  const current = getNotificationPreferences();
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  if (!validTime(next.preferredReminderTime)) {
    next.preferredReminderTime = current.preferredReminderTime;
  }
  writeRaw(next);
  return next;
}

export function resetNotificationPreferences() {
  if (hasStorage()) {
    try { window.localStorage.removeItem(KEY); } catch { /* noop */ }
  }
  return { ...DEFAULT_PREFERENCES };
}

export const _internal = Object.freeze({ KEY });
