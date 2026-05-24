/**
 * experiencePreferenceStore.js — persists the farmer's
 * beginner-vs-experienced preference (spec §10).
 *
 *   import { getExperienceLevel, setExperienceLevel,
 *            clearExperiencePreference, EXPERIENCE_LEVEL }
 *     from 'src/core/experience/experiencePreferenceStore.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A tiny localStorage-backed preference store with a single
 *   value. Used by the daily-decision assistant and any surface
 *   that adjusts wording / micro-help density.
 *
 *   It does NOT decide WHAT the experience level means — that's
 *   `dailyDecisionAssistant`. It just remembers the choice.
 *
 *   Default is 'new' — beginner-friendlier wording is the safer
 *   landing for first-time users.
 *
 * Strict-rule audit
 *   • Never throws. SSR-safe (guards localStorage). Pure-ish.
 */

const STORE_KEY = 'farroway:experience_level';

export const EXPERIENCE_LEVEL = Object.freeze({
  NEW:         'new',
  EXPERIENCED: 'experienced',
});

const _VALID = new Set(Object.values(EXPERIENCE_LEVEL));

function _safeStorage() {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage || null;
  } catch { return null; }
}

/**
 * Read the saved preference. Returns 'new' by default.
 *
 * @returns {'new' | 'experienced'}
 */
export function getExperienceLevel() {
  try {
    const s = _safeStorage();
    if (!s) return EXPERIENCE_LEVEL.NEW;
    const raw = s.getItem(STORE_KEY);
    if (raw && _VALID.has(raw)) return raw;
    return EXPERIENCE_LEVEL.NEW;
  } catch {
    return EXPERIENCE_LEVEL.NEW;
  }
}

/**
 * Save the preference. Unknown values are coerced to 'new' so a
 * typo never breaks the surface.
 *
 * @param {string} level
 * @returns {boolean} written?
 */
export function setExperienceLevel(level) {
  try {
    const s = _safeStorage();
    if (!s) return false;
    const v = _VALID.has(level) ? level : EXPERIENCE_LEVEL.NEW;
    s.setItem(STORE_KEY, v);
    return true;
  } catch {
    return false;
  }
}

/** Clear the saved preference (returns the next read to 'new'). */
export function clearExperiencePreference() {
  try {
    const s = _safeStorage();
    if (!s) return false;
    s.removeItem(STORE_KEY);
    return true;
  } catch { return false; }
}

/** Convenience boolean — true when the farmer has set "experienced". */
export function isExperienced() {
  return getExperienceLevel() === EXPERIENCE_LEVEL.EXPERIENCED;
}

const _module = {
  EXPERIENCE_LEVEL,
  getExperienceLevel,
  setExperienceLevel,
  clearExperiencePreference,
  isExperienced,
};
export default _module;
