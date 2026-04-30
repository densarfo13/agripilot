/**
 * localeDetection.js — spec-pathed façade for the
 * automatic-language-adaptation feature.
 *
 * The full implementation lives under
 * src/i18n/localeDetection/ (detection chain, persistence,
 * telemetry, missing-translation logger, React hook). This
 * file is the single import target the rollout spec asks
 * for, exposing every helper under the function names called
 * out in §3:
 *
 *   detectFarmerLocale()
 *   getBrowserLanguage()
 *   mapLocationToLanguage()
 *   resolveLanguage({ userPreferredLanguage,
 *                     farmPreferredLanguage,
 *                     detectedCountry, browserLanguage })
 *   saveLanguagePreference()
 *   logMissingTranslation()
 *
 * Priority chain enforced by resolveLanguage (spec §3):
 *   1. Manual user language
 *   2. Farm preferred language
 *   3. GPS country / region mapping
 *   4. Browser language
 *   5. English fallback
 *
 * No I/O at the top level — every helper is safe to call from
 * SSR / locked-down browsers (each underlying writer guards
 * its own try/catch).
 */

import {
  detectFarmerLocale,
  saveLanguagePreference,
  logMissingTranslation,
} from '../i18n/localeDetection/index.js';
import {
  SUPPORTED_LANGUAGES,
  LOCATION_LANGUAGE_MAP,
  isSupportedLanguage,
} from '../i18n/languageConfig.js';

// ── 1. getBrowserLanguage ─────────────────────────────────────
/**
 * Return the device locale's primary language tag, or 'en'.
 *
 *   navigator.language === 'hi-IN'  → 'hi'
 *   navigator.language === 'fr-CI'  → 'fr'
 *   undefined                        → 'en'
 *
 * The result is normalized to lowercase so callers can compare
 * directly against SUPPORTED_LANGUAGES keys.
 */
export function getBrowserLanguage() {
  try {
    if (typeof navigator !== 'undefined') {
      const raw = navigator.language
        || (Array.isArray(navigator.languages) && navigator.languages[0])
        || '';
      const head = String(raw).split(/[-_]/)[0];
      if (head) return head.toLowerCase();
    }
  } catch { /* SSR / locked-down */ }
  return 'en';
}

// ── 2. mapLocationToLanguage ──────────────────────────────────
/**
 * Country (full name OR ISO-2) → suggested language code.
 * Uses the spec's narrow LOCATION_LANGUAGE_MAP first (full
 * country names like "Ghana"), then falls through to the
 * lower-level ISO map for codes like "GH". Returns 'en' when
 * no row matches.
 */
export function mapLocationToLanguage(country) {
  if (!country) return 'en';
  const direct = LOCATION_LANGUAGE_MAP[country];
  if (direct && direct.default) return direct.default;
  // ISO-2/ISO-3 path — defer to the lower-level mapper which
  // owns the full ~50-row country table.
  try {
    /* eslint-disable global-require */
    const { mapLocationToLanguage: lower } = require('../i18n/localeDetection/mapLocationToLanguage.js');
    /* eslint-enable global-require */
    const richer = lower(country);
    if (richer && richer.primary) return richer.primary;
  } catch { /* fall through */ }
  return 'en';
}

// ── 3. resolveLanguage (spec §3 exact signature) ──────────────
/**
 * Spec-shape resolver. Accepts the four signals + nothing else
 * and returns { language, source } where source is one of:
 *   'manual' | 'farm_profile' | 'gps' | 'browser' | 'fallback'
 *
 *   resolveLanguage({ userPreferredLanguage: 'tw', ... })
 *     → { language: 'tw', source: 'manual' }
 *   resolveLanguage({ detectedCountry: 'India' })
 *     → { language: 'hi', source: 'gps' }
 *
 * @param  {object} opts
 * @param  {string} [opts.userPreferredLanguage]
 * @param  {string} [opts.farmPreferredLanguage]
 * @param  {string} [opts.detectedCountry]
 * @param  {string} [opts.browserLanguage]
 *
 * @returns {{ language: string, source: string }}
 */
export function resolveLanguage({
  userPreferredLanguage,
  farmPreferredLanguage,
  detectedCountry,
  browserLanguage,
} = {}) {
  // 1. Manual user language wins always.
  if (userPreferredLanguage) {
    return { language: String(userPreferredLanguage), source: 'manual' };
  }
  // 2. Farm preference next.
  if (farmPreferredLanguage) {
    return { language: String(farmPreferredLanguage), source: 'farm_profile' };
  }
  // 3. GPS / detected country.
  if (detectedCountry && LOCATION_LANGUAGE_MAP[detectedCountry]) {
    return {
      language: LOCATION_LANGUAGE_MAP[detectedCountry].default,
      source: 'gps',
    };
  }
  // 4. Browser language — only if it's one we ship.
  if (browserLanguage && isSupportedLanguage(browserLanguage)) {
    return { language: String(browserLanguage), source: 'browser' };
  }
  // 5. English fallback.
  return { language: 'en', source: 'fallback' };
}

// ── Re-exports ────────────────────────────────────────────────
//
// Everything else the spec mentions is already implemented in
// src/i18n/localeDetection/. We re-export here so callers only
// need ONE import path (`@/utils/localeDetection`).

export {
  detectFarmerLocale,
  saveLanguagePreference,
  logMissingTranslation,
};

// Convenience re-exports — useful for callers that want the
// spec-shape tables alongside the helpers.
export { SUPPORTED_LANGUAGES, LOCATION_LANGUAGE_MAP };
