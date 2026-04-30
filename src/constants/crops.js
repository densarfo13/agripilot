/**
 * crops.js — stable named-export crop label table.
 *
 * Spec §4 of the language-mismatch sweep asks for:
 *
 *     maize:
 *       en: "Maize (corn)"
 *       tw: "Aburo"
 *       hi: "मक्का"
 *
 * Farroway already has a richer crop infrastructure:
 *   • src/config/crops/cropRegistry.js    canonical id + lifecycle
 *   • src/config/crops/cropAliases.js     legacy-id → canonical map
 *   • src/utils/crops.js                  getCropLabel / getCropLabelSafe
 *   • src/utils/cropLabel.js              UI-layer wrapper
 *
 * Strict rule of this codebase: do NOT modify cropAliases or
 * normalizeCrop — they are the single source of truth. THIS file
 * is a thin **read-only shim** that exposes the same data through
 * a stable named-export shape, so callers that prefer
 * `import { CROPS } from '@/constants/crops'` get a static table
 * without each surface having to call `getCropLabel(id, lang)`
 * five times.
 *
 * The table is computed once at module load by iterating
 * `listRegisteredCrops()` and calling `getCropLabel(crop, lang)`
 * for every supported language. New crops added to the registry
 * pick up automatically; nothing is duplicated, nothing drifts.
 *
 * Usage
 * ─────
 *   import { CROPS, cropLabelFor, SUPPORTED_CROP_LANGS }
 *     from '../constants/crops.js';
 *
 *   CROPS.maize.hi     // "मक्का"
 *   cropLabelFor('maize', 'tw')   // dynamic alias-aware lookup
 */

import {
  listRegisteredCrops,
  getCropLabel,
  normalizeCropId,
} from '../config/crops/index.js';

/**
 * Languages the crop label table covers. Matches the launch-language
 * set in `src/i18n/index.js` (LANGUAGES). Kept in step manually
 * because both lists move at the same cadence.
 */
export const SUPPORTED_CROP_LANGS = Object.freeze([
  'en', 'fr', 'sw', 'ha', 'tw', 'hi',
]);

function _buildTable() {
  const out = {};
  let ids = [];
  try { ids = listRegisteredCrops() || []; }
  catch { ids = []; }
  for (const id of ids) {
    if (!id) continue;
    const row = {};
    for (const lang of SUPPORTED_CROP_LANGS) {
      try {
        const label = getCropLabel(id, lang);
        row[lang] = (label && typeof label === 'string') ? label : id;
      } catch {
        row[lang] = id;
      }
    }
    out[id] = Object.freeze(row);
  }
  return Object.freeze(out);
}

/**
 * Static crop-label table. Keyed by canonical crop id; each value
 * is a frozen `{ en, fr, sw, ha, tw, hi }` object.
 *
 * Built once at import time. Treat as read-only — mutating it
 * does not propagate to the underlying registry, and `Object.freeze`
 * prevents accidental writes anyway.
 */
export const CROPS = _buildTable();

/**
 * Alias-aware lookup: accepts any input shape (canonical id,
 * legacy alias, display name, free-text) and returns the
 * localised label, or `''` when the crop is unknown.
 *
 * Equivalent to `getCropLabel(normalizeCropId(value), lang)` —
 * exposed here so a caller doesn't need two imports.
 */
export function cropLabelFor(value, lang = 'en') {
  if (!value) return '';
  let id = '';
  try {
    id = normalizeCropId(value) || String(value).toLowerCase();
  } catch {
    id = String(value || '').toLowerCase();
  }
  if (!id) return '';
  const row = CROPS[id];
  if (row && row[lang]) return row[lang];
  if (row && row.en)    return row.en;
  // Fall back to the dynamic helper for crops that are registered
  // but appeared after this module was first imported.
  try { return getCropLabel(id, lang) || ''; }
  catch { return ''; }
}

export default CROPS;
