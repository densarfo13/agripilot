/**
 * pushPrep.js — Push notification preparation (safe mode).
 *
 * Phase: preparation only. No actual push sending, no service workers,
 * no background polling, no cron jobs, no retry loops, no SMS, no email.
 *
 * This module provides:
 *   1. User preference storage (daily task reminder, buyer request alerts).
 *   2. A user-triggered permission request wrapper.
 *   3. A device token placeholder for future server registration.
 *
 * Safe rules (enforced here, not just in callers):
 *   • NEVER auto-prompts — requestNotificationPermission() MUST be called
 *     from a direct user action (button tap). Never call it on mount or
 *     on page load.
 *   • NEVER throws — every exported function is try/catch wrapped.
 *   • NEVER blocks render — all ops are synchronous localStorage reads /
 *     writes with no async I/O.
 *   • Gracefully degrades when Notification API is unavailable (SSR,
 *     denied, unsupported browser, locked-down WebView).
 *
 * Storage keys:
 *   farroway_notification_preferences_v1  — user preferences object
 *   farroway_device_token_v1              — device token placeholder (string)
 *
 * Gated by FEATURE_PUSH_PREP in UI callers. This module is safe to
 * import regardless of the flag — every function returns a safe default
 * when called from an environment where the API doesn't exist.
 */

const PREFS_KEY = 'farroway_notification_preferences_v1';
const TOKEN_KEY = 'farroway_device_token_v1';

/** Default preference shape. All granular prefs ON; push itself OFF
 *  until the user explicitly grants browser permission. */
const PREFS_DEFAULTS = Object.freeze({
  dailyTaskReminder:  true,   // in-app daily nudge
  buyerRequestAlerts: true,   // buyer interest events
  enabled:            false,  // true once browser permission granted
});

// ─── Preferences ──────────────────────────────────────────────────────────

/**
 * getPrefs — returns current preferences merged with defaults.
 * Never throws; returns defaults on any read/parse error.
 */
export function getPrefs() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ...PREFS_DEFAULTS };
    }
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...PREFS_DEFAULTS };
    const parsed = JSON.parse(raw);
    // Always merge with defaults so newly added fields have values.
    return { ...PREFS_DEFAULTS, ...parsed };
  } catch {
    return { ...PREFS_DEFAULTS };
  }
}

/**
 * setPrefs — shallow-patches preferences and persists to localStorage.
 * Returns the new full preferences object.
 * Never throws; returns current prefs on error.
 *
 * @param {Partial<typeof PREFS_DEFAULTS>} patch
 * @returns {typeof PREFS_DEFAULTS}
 */
export function setPrefs(patch) {
  try {
    const next = { ...getPrefs(), ...patch };
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    }
    return next;
  } catch {
    return getPrefs();
  }
}

// ─── Device token placeholder ──────────────────────────────────────────────

/**
 * getDeviceToken — returns stored placeholder token or null.
 *
 * Real token registration against a push server is a future phase.
 * This stub exists so callers can check "has a token been stored?"
 * without coupling to the eventual server endpoint.
 */
export function getDeviceToken() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

/**
 * setDeviceTokenPlaceholder — stores a placeholder token string.
 * No server call is made — this is prep only.
 * Silently no-ops on invalid input.
 *
 * @param {string} token
 */
export function setDeviceTokenPlaceholder(token) {
  try {
    if (!token || typeof token !== 'string') return;
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(TOKEN_KEY, String(token).slice(0, 256));
  } catch { /* swallow */ }
}

// ─── Notification API helpers ──────────────────────────────────────────────

/**
 * isSupported — true when the browser Notification API is available.
 * false in SSR, old browsers, and locked-down WebViews.
 */
export function isSupported() {
  try {
    return typeof window !== 'undefined' && 'Notification' in window;
  } catch {
    return false;
  }
}

/**
 * getPermissionState — returns the current Notification.permission string.
 *
 * Returns: 'granted' | 'denied' | 'default' | 'unsupported'
 *   'unsupported' — Notification API does not exist in this environment.
 */
export function getPermissionState() {
  try {
    if (!isSupported()) return 'unsupported';
    return Notification.permission;
  } catch {
    return 'unsupported';
  }
}

/**
 * requestNotificationPermission — async wrapper around
 * Notification.requestPermission().
 *
 * ╔══════════════════════════════════════════════════════╗
 * ║  MUST only be called from a direct user action.     ║
 * ║  Never call this on mount, page load, or useEffect. ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Side effects:
 *   granted  → sets prefs.enabled = true, writes a local placeholder token.
 *   denied   → sets prefs.enabled = false.
 *   default  → no pref change (user dismissed without deciding).
 *
 * Returns: 'granted' | 'denied' | 'default' | 'unsupported'
 * Never throws — errors resolve to 'unsupported'.
 */
export async function requestNotificationPermission() {
  try {
    if (!isSupported()) return 'unsupported';
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      setPrefs({ enabled: true });
      // Write a placeholder token so future server-registration code
      // can check whether this device has been seen before.
      if (!getDeviceToken()) {
        setDeviceTokenPlaceholder(`local_${Date.now()}_placeholder`);
      }
    } else if (result === 'denied') {
      setPrefs({ enabled: false });
    }
    return result;
  } catch {
    return 'unsupported';
  }
}
