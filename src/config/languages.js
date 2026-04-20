/**
 * languages.js — single source of truth for supported UI languages.
 *
 * Every other module (languageResolver, i18n, onboarding screens)
 * reads from this list so adding a locale is a one-line change.
 *
 * Shape:
 *   { code, label, quick }
 *
 *   code   — BCP-47 base tag ('en', 'hi', 'tw', 'pt-BR' is NOT
 *            supported; always map to the base tag).
 *   label  — native-script display name rendered in the UI.
 *   quick  — when true, the language gets a chip on the first-launch
 *            screen. `quick === false` languages still render in the
 *            full dropdown so nothing is hidden from users.
 *
 * Ordering matters: quick chips appear in the order listed here.
 */

export const LANGUAGES = Object.freeze([
  // Quick picks — rendered as chips on the first-launch screen.
  Object.freeze({ code: 'en', label: 'English',    quick: true }),
  Object.freeze({ code: 'fr', label: 'Français',   quick: true }),
  Object.freeze({ code: 'hi', label: 'हिंदी',       quick: true }),
  Object.freeze({ code: 'tw', label: 'Twi (beta)', quick: true }),
  // Long tail — rendered only in the "All languages" dropdown.
  // Kept in the config so existing users who chose these before the
  // quick/long-tail split still see them and their translations
  // continue to work via the i18n fallback chain.
  Object.freeze({ code: 'sw', label: 'Kiswahili',  quick: false }),
  Object.freeze({ code: 'ha', label: 'Hausa',      quick: false }),
  Object.freeze({ code: 'es', label: 'Español',    quick: false }),
  Object.freeze({ code: 'pt', label: 'Português',  quick: false }),
]);

export const DEFAULT_LANGUAGE = 'en';

const CODE_SET = new Set(LANGUAGES.map((l) => l.code));

/** Quick-pick subset for the first-launch chip row. */
export function getQuickLanguages() {
  return LANGUAGES.filter((l) => l.quick);
}

/** Full list — used by the "All languages" dropdown. */
export function getAllLanguages() {
  return LANGUAGES.slice();
}

/** Strict check — only returns true for codes present in the list. */
export function isSupported(code) {
  if (!code || typeof code !== 'string') return false;
  return CODE_SET.has(code);
}

/** Lookup by code; returns null for unknown codes. */
export function getLanguage(code) {
  return LANGUAGES.find((l) => l.code === code) || null;
}

export const _internal = Object.freeze({ CODE_SET });
