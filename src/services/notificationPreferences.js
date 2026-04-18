/**
 * Notification preferences — simple client-side toggles.
 *
 * Stored in localStorage as a single JSON blob so reads are synchronous
 * (the notification engine runs on app mount).
 *
 * Defaults follow the spec:
 *   - daily:    on
 *   - weather:  on
 *   - critical: on (essentially mandatory — but still user-controllable)
 *   - reminderHour: 7 (local 07:00 — centre of the 06–10 window)
 *
 * No per-category time, no per-crop overrides. Spec §9: keep simple.
 */

const KEY = 'farroway:notification_prefs';

export const DEFAULT_PREFS = Object.freeze({
  daily: true,
  weather: true,
  critical: true,
  reminderHour: 7,
});

function safeRead() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch { return null; }
}

function safeWrite(prefs) {
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* quota */ }
}

/** Read current preferences, merged with defaults. */
export function getPreferences() {
  const stored = safeRead() || {};
  return { ...DEFAULT_PREFS, ...stored };
}

/** Patch preferences and return the merged result. */
export function setPreferences(patch) {
  const merged = { ...getPreferences(), ...patch };
  // Clamp reminderHour to a sane range (5–10)
  if (typeof merged.reminderHour === 'number') {
    merged.reminderHour = Math.max(5, Math.min(10, Math.round(merged.reminderHour)));
  }
  safeWrite(merged);
  return merged;
}

/** Reset to defaults — used by logout / "restore defaults". */
export function resetPreferences() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  return { ...DEFAULT_PREFS };
}
