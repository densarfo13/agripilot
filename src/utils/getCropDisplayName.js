/**
 * getCropDisplayName(cropKey, language, options?) — the farmer-facing
 * entry point for localized crop names.
 *
 * Config lives in `./cropNames.js` so adding a new language or
 * reviewing existing translations is a one-file change. This module
 * is strictly the resolution algorithm.
 *
 *   getCropDisplayName('tomato', 'hi')                     → 'टमाटर'
 *   getCropDisplayName('tomato', 'en')                     → 'Tomato'
 *   getCropDisplayName('cassava', 'hi')                    → 'कसावा'
 *   getCropDisplayName('cassava', 'hi', { bilingual: true }) → 'कसावा (Cassava)'
 *   getCropDisplayName('cassava', 'hi', { bilingual: 'auto' }) → 'कसावा (Cassava)'
 *   getCropDisplayName('tomato', 'hi', { bilingual: 'auto' })  → 'टमाटर'
 *   getCropDisplayName('taro',   'sw')                     → 'Taro'  (English fallback)
 */

import {
  EN_NAMES,
  LOCAL_NAMES,
  BILINGUAL_HINTED,
  LANGUAGE_COVERAGE,
} from './cropNames.js';

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
  const english = EN_NAMES[key] || humanize(key);
  const lang = String(language || 'en').toLowerCase();

  // English UI: always English.
  if (lang === 'en') return english;

  // Unknown language code: fall back to English.
  if (!LOCAL_NAMES[lang] && !LANGUAGE_COVERAGE[lang]) return english;

  const local = LOCAL_NAMES[lang]?.[key];
  // No local entry → safe English fallback. Never leak a raw key.
  if (!local) return english;
  // Native name happens to match English → no need for parens.
  if (local === english) return english;

  const bilingual = options?.bilingual;
  const shouldBilingual =
    bilingual === true
    || (bilingual === 'auto' && BILINGUAL_HINTED[lang]?.has(key));

  return shouldBilingual ? `${local} (${english})` : local;
}

/** Re-export the config so callers wanting the raw maps don't have to know the filename. */
export { EN_NAMES, LOCAL_NAMES, BILINGUAL_HINTED, LANGUAGE_COVERAGE } from './cropNames.js';
export { SUPPORTED_UI_LANGUAGES, getCoverageTier, hasLocalName } from './cropNames.js';

export const _internal = { humanize };
