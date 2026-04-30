/**
 * localeEngine.js — public façade for the locale-detection
 * feature, exposed under the function names the localization
 * rollout spec asks for.
 *
 * This file is intentionally a thin re-export + light-glue
 * layer over src/i18n/localeDetection/. Doing it this way:
 *   • keeps the spec-named functions discoverable from
 *     /src/utils/localeEngine.* without forking logic
 *   • lets us change the underlying implementation without
 *     touching every caller
 *   • gives us a clean place to bind the localStorage fallback
 *     keys called out in §13 of the rollout spec
 *
 * Priority chain (spec §4):
 *   1. Manual user language
 *   2. Farm preferred language
 *   3. GPS / farm country mapping
 *   4. Browser language
 *   5. English fallback
 */

import {
  detectFarmerLocale,
  mapLocationToLanguage as _mapIsoToLanguage,
  applyFarmLanguage,
  saveLanguagePreference,
  loadUserLanguagePreference,
  loadFarmLanguagePreference,
  resolveLanguagePreference,
} from '../i18n/localeDetection/index.js';
import {
  LOCATION_LANGUAGE_MAP, SUPPORTED_LANGUAGES,
} from '../i18n/languageConfig.js';

// ── localStorage key contracts (spec §13) ────────────────────
//
// These are the keys the rollout spec promised — we honour them
// here. The actual writers live in saveLanguagePreference.js
// (which uses a slightly different prefix); a few callers want
// the spec key shape, so we mirror the writes when invoked
// through this façade.
const KEY_USER_LANGUAGE = 'farroway_user_language';
const KEY_FARM_LANGUAGE = (id) => `farroway_farm_language_${id}`;
const KEY_LANGUAGE_SOURCE = 'farroway_language_source';
const KEY_SUGGESTION_DISMISSED = (id) => `farroway_language_suggestion_dismissed_${id}`;

function safeLs() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch { return null; }
}

function safeWriteString(key, value) {
  const ls = safeLs();
  if (!ls) return false;
  try {
    if (value == null) { ls.removeItem(key); return true; }
    ls.setItem(key, String(value));
    return true;
  } catch { return false; }
}

function safeReadString(key) {
  const ls = safeLs();
  if (!ls) return null;
  try { return ls.getItem(key); } catch { return null; }
}

// ── 1. getBrowserLanguage ─────────────────────────────────────
/**
 * Returns the device locale's language tag, or 'en' when the
 * browser doesn't expose one.
 *
 *   navigator.language === 'hi-IN'  → 'hi'
 *   navigator.language === 'fr-CI'  → 'fr'
 *   undefined                        → 'en'
 */
export function getBrowserLanguage() {
  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      const tag = String(navigator.language).split(/[-_]/)[0];
      if (tag) return tag.toLowerCase();
    }
  } catch { /* SSR / locked-down */ }
  return 'en';
}

// ── 2. mapLocationToLanguage ──────────────────────────────────
/**
 * Spec-shape mapper: country name (or ISO code) → suggested
 * language. Returns 'en' as the safe default whenever the row
 * is missing. Use this from UI code that wants ONE answer; for
 * primary + alternatives use the underlying module's
 * mapLocationToLanguage which returns the richer object.
 */
export function mapLocationToLanguage(country) {
  if (!country) return 'en';
  // 1. Match the spec's narrow LOCATION_LANGUAGE_MAP first
  //    (full country names).
  const direct = LOCATION_LANGUAGE_MAP[country];
  if (direct && direct.default) return direct.default;
  // 2. Fall back to the lower-level ISO-keyed map.
  const richer = _mapIsoToLanguage(country);
  return (richer && richer.primary) || 'en';
}

// ── 3. resolveLanguage ────────────────────────────────────────
/**
 * Given an arbitrary input ("ha", "Hausa", "ha-NG"), return a
 * supported language code or null when nothing matches.
 */
export function resolveLanguage(input) {
  if (!input) return null;
  const raw = String(input).trim().toLowerCase();
  if (!raw) return null;
  const head = raw.split(/[-_]/)[0];
  if (SUPPORTED_LANGUAGES[head]) return head;
  // Allow native-label inputs ("Twi", "Hausa", "English").
  for (const [code, row] of Object.entries(SUPPORTED_LANGUAGES)) {
    if (row.label.toLowerCase() === raw) return code;
    if (row.nativeLabel.toLowerCase() === raw) return code;
  }
  return null;
}

// ── 4. saveUserLanguage ───────────────────────────────────────
/**
 * Persist the user-level preference + the source label that
 * tells us how it was chosen ('manual' | 'gps' | 'farm_profile'
 * | 'browser' | 'fallback'). Mirrors writes through both the
 * spec key shape AND the underlying detection module so
 * everything stays in sync.
 */
export function saveUserLanguage(language, source = 'manual') {
  if (!language) return false;
  // Mirror to spec keys (§13).
  safeWriteString(KEY_USER_LANGUAGE, language);
  safeWriteString(KEY_LANGUAGE_SOURCE, source);
  // Live UI flip + canonical persistence.
  applyFarmLanguage({ lang: language, localeSource: source });
  return true;
}

// ── 5. saveFarmLanguage ───────────────────────────────────────
/**
 * Persist the farm-level preference + detection metadata.
 * detectedCountry / detectedRegion are stored alongside so the
 * admin dashboard can answer "which country requested which
 * language?". Source records HOW we got here.
 */
export function saveFarmLanguage(
  farmId, language, source = 'manual',
  detectedCountry = null, detectedRegion = null,
) {
  if (!farmId || !language) return false;
  safeWriteString(KEY_FARM_LANGUAGE(farmId), language);
  safeWriteString(KEY_LANGUAGE_SOURCE, source);
  // Underlying writer also persists the country/region/source.
  saveLanguagePreference({
    lang: language,
    farmId,
    country: detectedCountry,
    region: detectedRegion,
    localeSource: source,
  });
  applyFarmLanguage({
    lang: language, farmId,
    country: detectedCountry, region: detectedRegion,
    localeSource: source,
  });
  return true;
}

// ── 6. getLanguageOptionsForCountry ───────────────────────────
/**
 * Returns the ordered list of language codes a switcher should
 * offer for a given country. Falls back to ['en'] when the
 * country isn't in the map.
 */
export function getLanguageOptionsForCountry(country) {
  if (!country) return ['en'];
  const row = LOCATION_LANGUAGE_MAP[country];
  if (row && Array.isArray(row.options)) return row.options.slice();
  return ['en'];
}

// ── 7. shouldShowLanguageSuggestion ───────────────────────────
/**
 * The banner gating logic, lifted out so tests can drive it
 * without React. Show only when ALL of:
 *   • the user has not already manually picked a language
 *   • the farm has no saved preference
 *   • the suggestion has not been dismissed for this farm
 *   • a country was detected (so we have something to suggest)
 */
export function shouldShowLanguageSuggestion(user = null, farm = null) {
  // Already a manual user pick? Respect it.
  const userPref = (user && user.preferredLanguage)
    || (loadUserLanguagePreference()?.lang)
    || safeReadString(KEY_USER_LANGUAGE);
  if (userPref) {
    const source = (user && user.localeSource)
      || safeReadString(KEY_LANGUAGE_SOURCE);
    if (source === 'manual') return false;
  }
  // Farm-level preference already saved.
  if (farm && farm.preferredLanguage) return false;
  if (farm && farm.id && loadFarmLanguagePreference(farm.id)) return false;
  // Suggestion explicitly dismissed for this farm.
  if (farm && farm.id) {
    const dismissed = safeReadString(KEY_SUGGESTION_DISMISSED(farm.id));
    if (dismissed === '1' || dismissed === 'true') return false;
    if (farm.languageSuggestionDismissed) return false;
  }
  // Need a country to suggest from.
  const country = (farm && (farm.detectedCountry || farm.country))
    || (user && user.detectedCountry);
  if (!country) return false;
  return true;
}

/**
 * markSuggestionDismissed — called when the farmer taps the
 * "Keep current language" button on the banner so we don't
 * show it again for this farm.
 */
export function markSuggestionDismissed(farmId) {
  if (!farmId) return;
  safeWriteString(KEY_SUGGESTION_DISMISSED(farmId), '1');
}

// ── Re-exports of the lower-level helpers ─────────────────────
export {
  detectFarmerLocale,
  applyFarmLanguage,
  saveLanguagePreference,
  loadUserLanguagePreference,
  loadFarmLanguagePreference,
  resolveLanguagePreference,
};

export const _internal = Object.freeze({
  KEY_USER_LANGUAGE,
  KEY_FARM_LANGUAGE,
  KEY_LANGUAGE_SOURCE,
  KEY_SUGGESTION_DISMISSED,
});
