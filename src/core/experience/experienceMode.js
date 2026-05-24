/**
 * experienceMode.js — Simple Mode vs Standard Mode presentation
 * layer (spec §1).
 *
 *   import { getExperienceMode, setExperienceMode,
 *            isSimpleMode, isStandardMode,
 *            getExperienceModeMeta, EXPERIENCE_MODE }
 *     from 'src/core/experience/experienceMode.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A small preference store that decides ONLY how the existing
 *   intelligence output is PRESENTED. Same engines, same data,
 *   different surface density.
 *
 *   It is NOT a new intelligence system. It does NOT duplicate
 *   the existing `experiencePreferenceStore` (new ↔ experienced)
 *   — instead it bridges to it so a user who set 'experienced'
 *   in an earlier session lands on 'standard' here automatically.
 *
 *   Persistence key (spec §1): `farroway_experience_mode_v1`.
 *
 * Strict-rule audit
 *   • Never throws. SSR-safe (guards localStorage).
 */

import {
  getExperienceLevel as _getLegacyLevel,
  setExperienceLevel as _setLegacyLevel,
  EXPERIENCE_LEVEL as _LEGACY_LEVEL,
} from './experiencePreferenceStore.js';

const STORE_KEY = 'farroway_experience_mode_v1';

export const EXPERIENCE_MODE = Object.freeze({
  SIMPLE:   'simple',
  STANDARD: 'standard',
});

const _VALID = new Set(Object.values(EXPERIENCE_MODE));

// Legacy ↔ new vocabulary bridge so a user who set the older
// "experienced" preference doesn't get reset back to simple.
const _LEGACY_TO_MODE = Object.freeze({
  [_LEGACY_LEVEL.NEW]:         EXPERIENCE_MODE.SIMPLE,
  [_LEGACY_LEVEL.EXPERIENCED]: EXPERIENCE_MODE.STANDARD,
});
const _MODE_TO_LEGACY = Object.freeze({
  [EXPERIENCE_MODE.SIMPLE]:   _LEGACY_LEVEL.NEW,
  [EXPERIENCE_MODE.STANDARD]: _LEGACY_LEVEL.EXPERIENCED,
});

function _safeStorage() {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage || null;
  } catch { return null; }
}

/**
 * Read the saved mode. Default is `simple` (spec §1: "Default:
 * simple"). When a user only has the legacy `_v1` preference
 * set, we honour that.
 */
export function getExperienceMode() {
  try {
    const s = _safeStorage();
    if (s) {
      const raw = s.getItem(STORE_KEY);
      if (raw && _VALID.has(raw)) return raw;
    }
    // Bridge — read the legacy preference and convert.
    try {
      const legacy = _getLegacyLevel();
      const mapped = _LEGACY_TO_MODE[legacy];
      if (mapped) return mapped;
    } catch { /* ignore */ }
    return EXPERIENCE_MODE.SIMPLE;
  } catch {
    return EXPERIENCE_MODE.SIMPLE;
  }
}

/**
 * Save the mode. Also writes the legacy preference so older
 * callers still resolve to the right tone. Unknown values are
 * coerced to `simple` — a typo never breaks the surface.
 */
export function setExperienceMode(mode) {
  try {
    const v = _VALID.has(mode) ? mode : EXPERIENCE_MODE.SIMPLE;
    const s = _safeStorage();
    if (s) s.setItem(STORE_KEY, v);
    try { _setLegacyLevel(_MODE_TO_LEGACY[v]); } catch { /* ignore */ }
    return true;
  } catch { return false; }
}

export function clearExperienceMode() {
  try {
    const s = _safeStorage();
    if (s) s.removeItem(STORE_KEY);
    return true;
  } catch { return false; }
}

export function isSimpleMode()   { return getExperienceMode() === EXPERIENCE_MODE.SIMPLE; }
export function isStandardMode() { return getExperienceMode() === EXPERIENCE_MODE.STANDARD; }

// ── Mode metadata (spec §2) ───────────────────────────────
//
// Surfaces consume this object — same name on both modes, just
// different values. Localized labels stay as { key, fallback }
// envelopes so the surface translates them.
const META = Object.freeze({
  simple: Object.freeze({
    mode:              EXPERIENCE_MODE.SIMPLE,
    label:             { key: 'experience.simple',            fallback: 'Simple' },
    description:       { key: 'experience.simpleDescription', fallback: 'Guide me step by step.' },
    detailLevel:       'low',
    explanationStyle:  'short',
    notificationStyle: 'short',
    uiDensity:         'spacious',
  }),
  standard: Object.freeze({
    mode:              EXPERIENCE_MODE.STANDARD,
    label:             { key: 'experience.standard',            fallback: 'Standard' },
    description:       { key: 'experience.standardDescription', fallback: 'Show me more farming details.' },
    detailLevel:       'medium',
    explanationStyle:  'operational',
    notificationStyle: 'operational',
    uiDensity:         'normal',
  }),
});

/**
 * Metadata block surfaces attach to the intelligence snapshot.
 *
 * @param {string} [mode] override (default: getExperienceMode())
 * @returns {object}
 */
export function getExperienceModeMeta(mode) {
  const m = _VALID.has(mode) ? mode : getExperienceMode();
  return { ...META[m] };
}

const _module = {
  EXPERIENCE_MODE,
  getExperienceMode, setExperienceMode, clearExperienceMode,
  isSimpleMode, isStandardMode, getExperienceModeMeta,
};
export default _module;
