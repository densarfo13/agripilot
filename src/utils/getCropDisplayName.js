/**
 * getCropDisplayName(cropKey, language, options?) — the farmer-facing
 * entry point for localized crop names.
 *
 * Config lives in `./cropNames.js`. This module is strictly the
 * resolution algorithm.
 *
 * Resolution:
 *   1. Look up cropNames[cropKey][language]. If missing, fall back to
 *      cropNames[cropKey].en. If that's also missing, humanize the key
 *      so we never leak a raw snake_case string to the UI.
 *   2. Decide whether to render bilingual:
 *        options.bilingual === true   → force bilingual
 *        options.bilingual === false  → force native only
 *        options.bilingual === 'auto' → use entry.bilingual (compat)
 *        options.bilingual undefined  → use entry.bilingual (default)
 *   3. Bilingual renders `"${label} (${english})"` only when the two
 *      differ (so we don't get "Lettuce (Lettuce)" on Twi placeholder
 *      rows).
 *
 *   getCropDisplayName('tomato',  'hi')                  → 'टमाटर'
 *   getCropDisplayName('cassava', 'hi')                  → 'कसावा (Cassava)'   // entry flag
 *   getCropDisplayName('cassava', 'hi', {bilingual:false}) → 'कसावा'
 *   getCropDisplayName('rice',    'hi', {bilingual:true})  → 'चावल (Rice)'
 *   getCropDisplayName('dragon_fruit', 'en')              → 'Dragon fruit'  // humanized
 */

import { cropNames } from './cropNames.js';

function humanize(cropKey) {
  if (!cropKey) return '';
  const tail = String(cropKey).split('.').pop() || cropKey;
  const spaced = tail.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (!spaced) return '';
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/**
 * @param {string}  cropKey
 * @param {string}  [language='en']
 * @param {{bilingual?: boolean | 'auto'}} [options]
 * @returns {string}
 */
export function getCropDisplayName(cropKey, language = 'en', options = {}) {
  if (!cropKey) return '';
  const key = String(cropKey).toLowerCase();
  const lang = String(language || 'en').toLowerCase();
  const crop = cropNames[key];
  if (!crop) return humanize(key);

  const entry = crop[lang] || crop.en;
  if (!entry?.label) return humanize(key);

  const bilingualOpt = options?.bilingual;
  // `auto` (back-compat) and `undefined` both defer to the entry's
  // own `bilingual` flag. Explicit booleans override.
  const shouldBilingual =
    bilingualOpt === true ? true
    : bilingualOpt === false ? false
    : !!entry.bilingual;

  // For the English cross-reference, prefer the entry's own `english`
  // hint; fall back to the English entry's label so forcing
  // `bilingual:true` works even when the localized entry didn't
  // explicitly set `english`.
  const englishRef = entry.english || crop.en?.label || null;

  if (shouldBilingual && englishRef && entry.label !== englishRef) {
    return `${entry.label} (${englishRef})`;
  }
  return entry.label;
}

/** Convenience re-exports so existing callers don't need to change imports. */
export {
  cropNames,
  SUPPORTED_LANGUAGES,
  CROP_KEYS,
  LANGUAGE_COVERAGE,
  SUPPORTED_UI_LANGUAGES,
  getCoverageTier,
  hasLocalName,
  EN_NAMES,
  LOCAL_NAMES,
  BILINGUAL_HINTED,
} from './cropNames.js';

export const _internal = { humanize };
