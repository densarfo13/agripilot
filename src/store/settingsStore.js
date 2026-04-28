/**
 * settingsStore.js — single localStorage-backed store for the
 * unified Settings page (notification + communication prefs +
 * reminder time).
 *
 * Storage key:   farroway_settings
 * Change event:  farroway:settingsChanged
 *
 * Pure read/write helpers. The notification engine + reminder
 * scheduler keep their own stores untouched per spec; this store
 * is the single source of truth for what the Settings UI shows
 * and persists across reloads.
 */

const KEY = 'farroway_settings';

export const DEFAULT_SETTINGS = Object.freeze({
  daily:        true,
  weather:      true,
  risk:         true,
  missed:       true,
  email:        true,
  sms:          false,
  reminderTime: '07:00',
  // ─── Simple Mode (low-literacy) ───────────────────────────
  // When true, the Today screen condenses to icon-first layout,
  // auto-plays the task voice on load, and the LabelPrompt
  // renders icon-only options. Off by default — the farmer
  // opts in via the Settings toggle.
  simpleMode:   false,
});

function safeParse(raw, fallback) {
  if (typeof raw !== 'string' || !raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function readRaw() {
  try {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

function writeRaw(value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(KEY, value);
  } catch { /* quota / private mode — non-fatal */ }
}

/**
 * loadSettings — current persisted settings merged over defaults.
 * Always returns a plain object with every default key present.
 */
export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...safeParse(readRaw(), {}) };
}

/**
 * saveSettings — persist a full or partial settings object. Any
 * missing keys fall back to the existing defaults so we never
 * write a half-shaped object that breaks downstream consumers.
 */
export function saveSettings(settings) {
  const merged = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  writeRaw(JSON.stringify(merged));
  return merged;
}

/**
 * updateSetting — patch a single key, persist, broadcast a
 * `farroway:settingsChanged` CustomEvent so every mounted listener
 * (Settings page, future feature flags) can react without prop-
 * drilling. Returns the merged object for the caller.
 *
 * Event tracking (data foundation v2): a simpleMode toggle
 * fires SIMPLE_MODE_ENABLED / SIMPLE_MODE_DISABLED into the
 * event log so the NGO aggregates can count low-literacy
 * adoption without instrumenting the Settings page directly.
 * Done via dynamic import to avoid pulling the eventLogger at
 * module-load time for stores that don't need it.
 */
export function updateSetting(key, value) {
  const current = loadSettings();
  const updated = { ...current, [key]: value };
  saveSettings(updated);
  try {
    if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('farroway:settingsChanged', { detail: updated }));
    }
  } catch { /* dispatch is best-effort */ }

  if (key === 'simpleMode' && current.simpleMode !== value) {
    try {
      import('../data/eventLogger.js').then((m) => {
        try {
          m.logEvent(value
            ? m.EVENT_TYPES.SIMPLE_MODE_ENABLED
            : m.EVENT_TYPES.SIMPLE_MODE_DISABLED, {});
        } catch { /* swallow */ }
      }).catch(() => { /* swallow */ });
    } catch { /* swallow */ }
  }

  return updated;
}

export const SETTINGS_STORAGE_KEY = KEY;
export const SETTINGS_CHANGE_EVENT = 'farroway:settingsChanged';

/**
 * isSimpleMode — synchronous probe used by the Today screen,
 * LabelPrompt, and RiskBadge to decide whether to auto-play
 * voice + collapse to icon-first layout. Wraps the read in
 * try/catch so a corrupt settings entry returns false (the
 * safer default — full UI, no surprise auto-speech).
 */
export function isSimpleMode() {
  try {
    return loadSettings().simpleMode === true;
  } catch { return false; }
}
