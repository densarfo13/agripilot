/**
 * cropLabel.js — single, opinionated UI helper for rendering a crop
 * value the right way.
 *
 * Why this thin wrapper exists
 * ────────────────────────────
 * Three rules govern crop display in this codebase, and each lives
 * in a different module:
 *   • normalizeCrop  (src/config/crops/index.js)   ← canonical id
 *   • getCropLabelSafe (src/utils/crops.js)         ← localised label
 *   • the lang from useTranslation()                ← active UI lang
 *
 * Without a single bridge, callers either forget the language
 * argument (which silently English-leaks the label) or skip the
 * normalisation step (which lets aliased ids slip through). The
 * `cropLabel(value, lang)` helper here glues the three rules into
 * one call so new code never has to remember the order.
 *
 * Usage
 * ─────
 *   import { cropLabel } from '../utils/cropLabel.js';
 *   const { lang } = useTranslation();
 *
 *   <td>{cropLabel(farm.crop, lang)}</td>
 *   <td>{cropLabel(task.crop, lang)}</td>
 *
 * Return value
 * ────────────
 *   • '' / null / undefined input → '—'  (caller doesn't have to
 *                                          guard before rendering)
 *   • known value → localised label per the active language
 *   • unknown id  → humanised id (the existing getCropLabelSafe
 *                    behaviour; never blanks the cell)
 *
 * Coexistence note
 * ────────────────
 * `getCropLabelSafe` stays the underlying implementation — this file
 * does NOT replace it. New code SHOULD prefer cropLabel; existing
 * call sites stay valid until migrated.
 */

import { normalizeCrop } from '../config/crops/index.js';
import { getCropLabelSafe } from './crops.js';

const EMPTY = '—';

/**
 * @param {string|null|undefined} value  raw crop value (id, alias,
 *   display name, or noisy free-text from a legacy field)
 * @param {string} [lang='en']           active short language code
 * @returns {string}
 */
export function cropLabel(value, lang = 'en') {
  // STABILITY HOTFIX: full-function try/catch so a render path
  // that hits a transiently malformed crop row never throws into
  // React's reconciler. Returns the EMPTY sentinel on any failure.
  try {
    if (!value || (typeof value === 'string' && !value.trim())) return EMPTY;
    let normalised = value;
    try {
      const id = normalizeCrop(value);
      if (id) normalised = id;
    } catch {
      // normalizeCrop should never throw, but be defensive.
    }
    let label;
    try {
      label = getCropLabelSafe(normalised, lang);
    } catch {
      label = '';
    }
    return (typeof label === 'string' && label) ? label : EMPTY;
  } catch (err) {
    try {
      if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
        console.warn('[cropLabel error]', value, err && err.message);
      }
    } catch { /* ignore */ }
    return EMPTY;
  }
}

export default cropLabel;
