/**
 * languageConfig.js — supported-language registry + the
 * per-country language menu used by the suggestion banner and
 * the LanguageSwitcher.
 *
 * The shapes here intentionally match the localization rollout
 * spec verbatim so tests written against the spec read 1:1.
 *
 * Note: the lower-level COUNTRY_LANGUAGE map in
 * src/i18n/localeDetection/mapLocationToLanguage.js carries
 * the full 50+ country list (ISO-2 keyed) used by the
 * detection chain. This file is a NARROWER, USER-FACING
 * registry — the rows the language switcher offers and the
 * banner copy refers to. Country keys here use the
 * human-readable form ("Ghana", not "GH") to match the spec.
 */

export const SUPPORTED_LANGUAGES = Object.freeze({
  en: Object.freeze({ label: 'English', nativeLabel: 'English' }),
  tw: Object.freeze({ label: 'Twi',     nativeLabel: 'Twi' }),
  ha: Object.freeze({ label: 'Hausa',   nativeLabel: 'Hausa' }),
  fr: Object.freeze({ label: 'French',  nativeLabel: 'Fran\u00E7ais' }),
  es: Object.freeze({ label: 'Spanish', nativeLabel: 'Espa\u00F1ol' }),
  hi: Object.freeze({ label: 'Hindi',   nativeLabel: '\u0939\u093F\u0928\u094D\u0926\u0940' }),
});

/**
 * Country → { default, options }.
 *
 * `default` is the language we propose first when we detect
 * the farmer is in this country.
 *
 * `options` is the ordered list shown by the LanguageSwitcher
 * when the country is known — keeps the picker tight so each
 * country only sees the locales that make sense for it.
 *
 * Adding a country: append a row + ensure each lang code is
 * also present in SUPPORTED_LANGUAGES above.
 */
export const LOCATION_LANGUAGE_MAP = Object.freeze({
  Ghana:           Object.freeze({ default: 'en', options: ['en', 'tw', 'ha'] }),
  Nigeria:         Object.freeze({ default: 'en', options: ['en', 'ha'] }),
  India:           Object.freeze({ default: 'hi', options: ['hi', 'en'] }),
  'United States': Object.freeze({ default: 'en', options: ['en', 'es'] }),
  France:          Object.freeze({ default: 'fr', options: ['fr', 'en'] }),
  Spain:           Object.freeze({ default: 'es', options: ['es', 'en'] }),
});

/**
 * isSupportedLanguage — narrow guard for a code.
 */
export function isSupportedLanguage(code) {
  if (!code) return false;
  return Object.prototype.hasOwnProperty.call(
    SUPPORTED_LANGUAGES, String(code).toLowerCase(),
  );
}

/**
 * getLanguageNativeLabel — human label for a switcher row.
 * Falls through to the code when the row is unknown.
 */
export function getLanguageNativeLabel(code) {
  const row = SUPPORTED_LANGUAGES[String(code || '').toLowerCase()];
  return (row && row.nativeLabel) || (row && row.label) || code || '';
}

/**
 * getCountryDefaultLanguage — convenience for callers who only
 * want the suggested language for a country (use
 * mapLocationToLanguage in the detection module for the full
 * { primary, alternatives } shape).
 */
export function getCountryDefaultLanguage(country) {
  if (!country) return 'en';
  const row = LOCATION_LANGUAGE_MAP[country];
  return (row && row.default) || 'en';
}
