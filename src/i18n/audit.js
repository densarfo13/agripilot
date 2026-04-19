/**
 * i18n/audit — dev-only helpers for catching localization regressions.
 *
 * Nothing in this file should run in production. The goal is to make
 * partial Hindi translations loud during development without slowing
 * down the farmer-facing build.
 *
 *   - checkForEnglishLeak(text) flags strings that look like raw
 *     English on a Hindi screen (ASCII letters only + not in an
 *     explicit allow-list of names/crop codes)
 *   - wrapTranslationForAudit(t, lang) returns a t() that logs a
 *     warning once per key when a Hindi screen returns an obviously
 *     English-looking result.
 */

const ASCII_ONLY = /^[\s\d\p{P}\p{S}A-Za-z]+$/u;

// Names, crop identifiers, units, and short tokens we don't translate
// on purpose. Anything listed here is accepted even on Hindi screens.
const ALLOWED_ASCII = new Set([
  // Common untranslated domain values
  'GH', 'NG', 'IN', 'US', 'KE', 'SN',
  'GPS', 'ID', 'SMS', 'OTP', 'OK',
  // Unit abbreviations (farmers recognize Latin-digit units)
  'kg', 'km', 'km/h', 'cm', 'm', 'mm', 'ha',
  // Brand
  'Farroway', 'WhatsApp',
]);

/**
 * Is this string suspicious on a Hindi screen?
 * Rules:
 *   - contains at least one ASCII letter
 *   - contains no Devanagari characters
 *   - not whitelisted
 *   - longer than 2 chars (short tokens like "A", "+" are fine)
 */
export function looksLikeEnglishLeak(text) {
  if (!text || typeof text !== 'string') return false;
  if (text.trim().length <= 2) return false;
  if (ALLOWED_ASCII.has(text.trim())) return false;
  // Reject if any Devanagari codepoint is present — then it's already
  // Hindi or mixed-intentional.
  if (/[\u0900-\u097F]/.test(text)) return false;
  // Reject if no ASCII letters — pure digits or punctuation are fine.
  if (!/[A-Za-z]/.test(text)) return false;
  return ASCII_ONLY.test(text);
}

const _warned = new Set();

/**
 * Dev-only wrapper around t() that logs once per key when a Hindi
 * screen resolves to an ASCII-only string (likely an English
 * fallback or a hardcoded label that slipped past the key audit).
 *
 * Safe to wrap unconditionally — no-ops in production builds.
 */
export function wrapTranslationForAudit(t, lang) {
  const isDev = typeof import.meta !== 'undefined'
    ? import.meta.env?.DEV
    : process.env.NODE_ENV === 'development';
  if (!isDev) return t;
  if (lang !== 'hi') return t;

  return (key, vars) => {
    const text = t(key, vars);
    if (looksLikeEnglishLeak(text) && !_warned.has(key)) {
      _warned.add(key);
      // eslint-disable-next-line no-console
      console.warn(`[i18n-audit] Key "${key}" returned English on Hindi screen: "${text}"`);
    }
    return text;
  };
}

/**
 * One-shot audit: return all keys currently falling back to English
 * on the given language. Call from the browser console:
 *   window.__i18nLeakReport?.('hi')
 */
export function buildLeakReport(T, lang) {
  const out = [];
  for (const [key, entry] of Object.entries(T)) {
    const text = entry[lang] || entry.en || '';
    if (looksLikeEnglishLeak(text)) out.push(key);
  }
  return out;
}
