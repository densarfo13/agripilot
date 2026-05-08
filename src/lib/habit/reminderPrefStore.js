/**
 * reminderPrefStore.js — simple reminder preference store.
 *
 * STORAGE KEY
 * ───────────
 *   farroway_daily_reminder_pref_v1
 *
 * SHAPE
 * ─────
 *   {
 *     enabled:       boolean   — whether the farmer wants daily reminders
 *     preferredTime: string|null — HH:MM local time, e.g. '08:00'
 *   }
 *
 * PURPOSE
 * ───────
 * Persists the farmer's reminder preference locally so it survives
 * page reloads. No push notifications, SMS, or email are wired here —
 * this is preference storage only. Future delivery channels can read
 * this preference when they ship.
 *
 * Default: { enabled: false, preferredTime: null }
 * (Opt-in only — we never enable reminders without explicit farmer action.)
 *
 * RULES
 * ─────
 *   • Never throws — corrupt JSON → safe default.
 *   • No network calls. No React imports.
 *   • Dispatches 'farroway:dailyHabitChanged' on write for cross-tab sync.
 *   • Works in SSR (localStorage guard).
 */

export const REMINDER_PREF_KEY = 'farroway_daily_reminder_pref_v1';
const CHANGE_EVENT = 'farroway:dailyHabitChanged';

const _SAFE_DEFAULT = Object.freeze({ enabled: false, preferredTime: null });

function _broadcast() {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    }
  } catch { /* ignore */ }
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Read the current reminder preference. Never throws.
 * @returns {{ enabled: boolean, preferredTime: string|null }}
 */
export function getReminderPref() {
  try {
    if (typeof localStorage === 'undefined') return { ..._SAFE_DEFAULT };
    const raw = localStorage.getItem(REMINDER_PREF_KEY);
    if (!raw) return { ..._SAFE_DEFAULT };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ..._SAFE_DEFAULT };
    }
    return {
      enabled:       !!parsed.enabled,
      preferredTime: typeof parsed.preferredTime === 'string'
                     && /^\d{2}:\d{2}$/.test(parsed.preferredTime)
                       ? parsed.preferredTime
                       : null,
    };
  } catch {
    return { ..._SAFE_DEFAULT };
  }
}

/**
 * Save the reminder preference.
 *
 * @param {{ enabled?: boolean, preferredTime?: string|null }} opts
 * @returns {{ enabled: boolean, preferredTime: string|null }} the saved value
 */
export function setReminderPref({ enabled, preferredTime } = {}) {
  const current = getReminderPref();
  const next = {
    enabled:       typeof enabled === 'boolean' ? enabled : current.enabled,
    preferredTime: preferredTime !== undefined
                   ? (typeof preferredTime === 'string' && /^\d{2}:\d{2}$/.test(preferredTime)
                       ? preferredTime
                       : null)
                   : current.preferredTime,
  };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(REMINDER_PREF_KEY, JSON.stringify(next));
    }
  } catch { /* quota / private mode — non-fatal */ }
  _broadcast();
  return next;
}

/**
 * Remove the preference record (sign-out / debug).
 */
export function clearReminderPref() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(REMINDER_PREF_KEY);
    }
    _broadcast();
  } catch { /* ignore */ }
}
