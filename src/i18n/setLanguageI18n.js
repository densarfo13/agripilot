/**
 * setLanguageI18n.js — the new JSON-system language switcher.
 *
 * Mirrors the spec's setLanguage.ts but:
 *   • calls i18next.changeLanguage for the new JSON resources
 *   • writes the spec's `farroway_language` storage key
 *   • ALSO calls the legacy engine's setLanguage so dozens of
 *     existing screens keep picking up the same choice
 *
 * NOTE on filename: spec §9 asked for `src/i18n/setLanguage.ts`. A
 * legacy `setLanguage(code)` export already lives in
 * `src/i18n/index.js`; this file carries the react-i18next version
 * without colliding. Callers import from `./setLanguageI18n`.
 */

import i18n from './i18next.js';
import { setLanguage as setLegacyLanguage } from './index.js';
import { SUPPORTED_LOCALES } from './supportedLocales.ts';

// Re-export the canonical registry under the SUPPORTED_LANGUAGES
// name this module historically used. Existing callers stay
// source-compatible; the actual list now matches the rest of the
// app (en/fr/sw/ha/tw/hi). Pre-refactor the list shipped es/pt,
// which have no translation columns — they were silently
// falling back to English on every key.
export const SUPPORTED_LANGUAGES = SUPPORTED_LOCALES.map((l) => ({
  code:  l.code,
  label: l.englishName,
}));

export function setLanguage(lang) {
  if (!lang) return;
  // i18next: swap the JSON resources in place.
  i18n.changeLanguage(lang);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('farroway_language', lang);
    }
  } catch { /* quota / privacy mode — non-fatal */ }
  // Legacy engine: keep the existing screens in sync.
  try { setLegacyLanguage(lang); } catch { /* ignore */ }
}
