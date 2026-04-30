/**
 * getLocalizedCropName.js — thin façade over the existing
 * getCropLabelSafe resolver so this feature exposes the API the
 * spec requires without forking crop-label resolution.
 *
 * Every render-site that wants a crop name SHOULD eventually
 * route through here; behaviour is identical to
 * getCropLabelSafe. Keeping a dedicated entry point lets us:
 *   • capture missing-translation warnings centrally (fires
 *     logMissingTranslation when the resolved label looks like
 *     a humanised fallback)
 *   • swap the resolver later without touching every consumer
 */

import { getCropLabelSafe } from '../../utils/crops.js';
import { logMissingTranslation } from './logMissingTranslation.js';

/**
 * @param  {string} value  canonical crop key, alias, or display name
 * @param  {string} lang   active UI language code
 * @returns {string}       localised label (never empty when value present)
 */
export function getLocalizedCropName(value, lang = 'en') {
  if (!value) return '';
  const label = getCropLabelSafe(value, lang);

  // Fallback heuristic — if the resolved label is the raw input
  // itself (humanised), there's no translation in this language.
  // Surface it through the missing-translation channel so the
  // admin dashboard sees coverage gaps.
  if (lang !== 'en'
      && label
      && String(label).toLowerCase() === String(value).toLowerCase()) {
    logMissingTranslation({
      key: `crop.${String(value).toLowerCase()}`,
      lang,
      surface: 'getLocalizedCropName',
    });
  }
  return label;
}
