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
});

/**
 * Country → { default, options }.
 *
 * `default` is the language we propose first when we detect
 * the farmer is in this country.
 *
 * `options` is the ordered list shown by the LanguageSwitcher
 * when the country is known — keeps the picker tight on
 * Ghana (3 langs) and even tighter on Nigeria/USA.
 *
 * Adding a country: append a row + ensure each lang code is
 * also present in SUPPORTED_LANGUAGES above.
 */
export const LOCATION_LANGUAGE_MAP = Object.freeze({
  Ghana:           Object.freeze({ default: 'en', options: ['en', 'tw', 'ha'] }),
  Nigeria:         Object.freeze({ default: 'en', options: ['en', 'ha'] }),
  'United States': Object.freeze({ default: 'en', options: ['en'] }),
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
