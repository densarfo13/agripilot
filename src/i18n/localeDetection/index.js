/**
 * src/i18n/localeDetection — automatic language adaptation.
 *
 * Public API (everything the rest of the app should import from
 * here, never from sibling files directly):
 *
 *   detectFarmerLocale({ farm, requestGps, gpsTimeoutMs })
 *     → Promise<DetectionResult>
 *
 *   mapLocationToLanguage(country)
 *     → { primary, alternatives }
 *
 *   applyFarmLanguage({ lang, farmId, country, region, localeSource })
 *     → { applied, fallbackUsed, persisted }
 *
 *   saveLanguagePreference(...)
 *   loadUserLanguagePreference()
 *   loadFarmLanguagePreference(farmId)
 *   resolveLanguagePreference(farmId)
 *
 *   getLocalizedCropName(value, lang)
 *   getLocalizedTaskText(task, t, lang)
 *
 *   logMissingTranslation({ key, lang, surface })
 *   readMissingTranslationQueue()
 *
 *   getLanguageDistribution()      // admin telemetry snapshot
 *   sortedTopN(map, n)
 *
 *   useFarmLocale({ farm, autoDetect })   // React hook
 *
 *   <LanguageSuggestionBanner farm={...} /> lives in
 *   src/components/locale/LanguageSuggestionBanner.jsx so it
 *   can stay React-only without polluting this module.
 */

export { detectFarmerLocale } from './detectFarmerLocale.js';
export {
  mapLocationToLanguage,
  mapBrowserLocaleToLanguage,
  normaliseCountryCode,
  COUNTRY_LANGUAGE,
} from './mapLocationToLanguage.js';
export { applyFarmLanguage } from './applyFarmLanguage.js';
export {
  saveLanguagePreference,
  loadUserLanguagePreference,
  loadFarmLanguagePreference,
  resolveLanguagePreference,
  clearFarmLanguagePreference,
} from './saveLanguagePreference.js';
export { getLocalizedCropName } from './getLocalizedCropName.js';
export { getLocalizedTaskText } from './getLocalizedTaskText.js';
export {
  logMissingTranslation,
  readMissingTranslationQueue,
  clearMissingTranslationQueue,
} from './logMissingTranslation.js';
export {
  getLanguageDistribution,
  sortedTopN,
} from './languageDistribution.js';
export { useFarmLocale } from './useFarmLocale.js';
