/**
 * autoDetectLanguage.js — first-boot language picker for the
 * Global Multilingual System spec §1.
 *
 *   detectInitialLanguage() → 'en' | 'fr' | 'sw' | 'ha' | 'tw' | 'hi'
 *
 * Priority chain (first non-null wins):
 *   1. User's stored preference      — already-chosen language
 *   2. Device / browser language     — navigator.language
 *   3. Location-derived fallback     — when farm-profile country
 *                                      already exists in storage
 *   4. Safe default                  — 'en'
 *
 * Why a separate file
 * ───────────────────
 *   The existing pipeline reads `localStorage.getItem('farroway_lang')`
 *   directly in `utils/i18n.js`. That works for returning users
 *   (whose language has already been written) but ignores
 *   browser language on first ever boot — every fresh install
 *   starts in English regardless of device locale. This module
 *   is the single source of truth for "what language should we
 *   load before any UI paints"; `utils/i18n.js` and the boot
 *   sequence both call it.
 *
 *   The richer per-farm + per-user storage in `localeEngine.js`
 *   stays untouched. This file is only consulted when those
 *   stores are empty (i.e. fresh install).
 *
 * Strict-rule audit
 *   • Pure + sync; no I/O outside reading localStorage and
 *     navigator.language (both wrapped in try/catch).
 *   • Never throws — every browser global is feature-checked.
 *   • SSR-safe — `typeof navigator/localStorage` checks degrade
 *     to 'en' when those globals are absent.
 *   • Idempotent — repeated calls produce identical output.
 */

import { SUPPORTED_LANGUAGES } from '../i18n/languageConfig.js';

// Spec §6 launch languages — kept in sync with the curated
// translation packs. Anything outside this set falls back to 'en'
// so we never load a language that doesn't have a translation
// pack shipped.
const LAUNCH_LANGUAGES = Object.freeze(['en', 'fr', 'sw', 'ha', 'tw', 'hi']);

// Storage keys consulted in priority order. The first key wins
// when multiple have values (a returning user with a stored
// preference always overrides browser language).
const STORAGE_KEYS = Object.freeze([
  'farroway_lang',          // legacy + utils/i18n.js source of truth
  'farroway:lang',          // i18n/index.js mirror
  'farroway_user_language', // localeEngine.js spec key
]);

// Country → language fallback. Picked to match the curated
// translation packs; anything else collapses to 'en'.
const COUNTRY_LANGUAGE_FALLBACK = Object.freeze({
  GH: 'tw', CI: 'fr', SN: 'fr', BJ: 'fr', TG: 'fr', BF: 'fr', ML: 'fr',
  NG: 'ha', NE: 'ha',
  KE: 'sw', TZ: 'sw', UG: 'sw', RW: 'sw',
  IN: 'hi',
  FR: 'fr', BE: 'fr', CA: 'fr',
  US: 'en', GB: 'en', AU: 'en', NZ: 'en',
});

function _safeReadLocal(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _isSupported(code) {
  if (!code) return false;
  if (LAUNCH_LANGUAGES.includes(code)) return true;
  // Defensive — accept any code in the SUPPORTED_LANGUAGES table
  // so non-launch languages can flow through when their packs
  // ship later. The orchestrator stays the gatekeeper.
  return !!(SUPPORTED_LANGUAGES && SUPPORTED_LANGUAGES[code]);
}

/**
 * Read the device / browser language. Returns the head segment
 * (e.g. 'fr-CA' → 'fr') so it can be matched against the launch
 * set without locale-region noise.
 */
function _browserLang() {
  try {
    if (typeof navigator !== 'undefined') {
      // navigator.languages is the user's full preference list
      // (modern browsers expose it). Walk it newest-first so a
      // user with ['fr-CA', 'en-US'] resolves to 'fr' even when
      // the OS default is English.
      const list = Array.isArray(navigator.languages) && navigator.languages.length > 0
        ? navigator.languages
        : (navigator.language ? [navigator.language] : []);
      for (const tag of list) {
        const head = String(tag || '').split(/[-_]/)[0].toLowerCase();
        if (_isSupported(head)) return head;
      }
    }
  } catch { /* SSR / locked-down */ }
  return null;
}

/**
 * Read the country code stored by previous farm/garden
 * onboarding (if any) and translate it through
 * COUNTRY_LANGUAGE_FALLBACK. Returns null when no country is
 * stored — typical for the truly-first boot path.
 */
function _locationLang() {
  // The fast-onboarding row stamps a country code; check the
  // common keys without coupling to a specific store API.
  const candidates = [
    'farroway_active_country',
    'farroway_country',
    'farroway_user_country',
  ];
  for (const k of candidates) {
    const v = _safeReadLocal(k);
    if (!v) continue;
    const upper = String(v).trim().toUpperCase();
    const lang = COUNTRY_LANGUAGE_FALLBACK[upper];
    if (lang && _isSupported(lang)) return lang;
  }
  return null;
}

/**
 * Read any stored user language preference. Returns the first
 * supported value found across the storage keys.
 */
function _storedLang() {
  for (const k of STORAGE_KEYS) {
    const v = _safeReadLocal(k);
    if (!v) continue;
    const head = String(v).trim().toLowerCase().split(/[-_]/)[0];
    if (_isSupported(head)) return head;
  }
  return null;
}

/**
 * detectInitialLanguage — main entry. Caller (utils/i18n.js,
 * App boot) calls this once before loading translations. Pure +
 * never throws; returns one of the 6 launch languages.
 */
export function detectInitialLanguage() {
  return (
    _storedLang()
    || _browserLang()
    || _locationLang()
    || 'en'
  );
}

export const _internal = Object.freeze({
  LAUNCH_LANGUAGES, STORAGE_KEYS, COUNTRY_LANGUAGE_FALLBACK,
  _safeReadLocal, _isSupported, _browserLang, _locationLang, _storedLang,
});

export default detectInitialLanguage;
