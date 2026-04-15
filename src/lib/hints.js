/**
 * First-time hints system.
 *
 * Shows lightweight one-time overlays for key farmer actions.
 * Uses localStorage to track which hints have been dismissed.
 * Each hint shows once, then never again.
 */

const STORAGE_KEY = 'farroway:hints_dismissed';

/**
 * Get the set of dismissed hint IDs.
 * @returns {Set<string>}
 */
function getDismissed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

/**
 * Check if a hint should be shown (not yet dismissed).
 * @param {string} hintId
 * @returns {boolean}
 */
export function shouldShowHint(hintId) {
  return !getDismissed().has(hintId);
}

/**
 * Dismiss a hint permanently.
 * @param {string} hintId
 */
export function dismissHint(hintId) {
  try {
    const dismissed = getDismissed();
    dismissed.add(hintId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...dismissed]));
  } catch { /* storage full */ }
}

/**
 * Check if user has completed enough actions to skip all hints.
 * After 3 task completions, we assume the user understands the flow.
 * @returns {boolean}
 */
export function isExperiencedUser() {
  try {
    const dismissed = getDismissed();
    return dismissed.size >= 3;
  } catch {
    return false;
  }
}

// ─── Hint IDs ───────────────────────────────────────────────
export const HINT_IDS = {
  TAP_TASK: 'tap_task',
  TAP_SPEAKER: 'tap_speaker',
  SWIPE_UPDATE: 'swipe_update',
};
