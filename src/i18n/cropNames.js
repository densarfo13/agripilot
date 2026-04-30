/**
 * cropNames.js — narrow localization table for the crop names
 * called out in the localization rollout spec (§8).
 *
 * The canonical, full-coverage crop registry lives in
 * src/config/crops.js (CROP_LABELS_BY_LANG) — it ships ~50
 * crops × 6 languages and is what every render-site reads
 * through getCropLabelSafe / getCropLabel.
 *
 * This file is the SHORT, AUDIT-FRIENDLY list the spec asked
 * for, with the exact local names supplied by the partner
 * agronomy team. We use it in two ways:
 *
 *   1. As a transparent OVERLAY: getLocalizedCropName below
 *      checks this table FIRST so the partner-supplied
 *      Twi/Hausa names always win over the registry default.
 *      (Pilot example: spec wants "Aburo" for Twi maize but
 *      the registry shipped "Aburoɔ" — both are correct,
 *      partner team prefers the shorter form.)
 *
 *   2. As a stable contract for screenshot QA — the spec
 *      tests look these strings up by exact match.
 *
 * Adding a crop here: do NOT also edit cropAliases.js or
 * normalizeCrop — overlay only.
 */

import { getCropLabelSafe } from '../utils/crops.js';

// Spec-supplied table. Crop ids are lowercase canonical.
// All six launch languages must be present per the rollout
// spec — partner team verified each row in pilot screenshots.
export const CROP_NAMES = Object.freeze({
  maize:  Object.freeze({
    en: 'Maize / Corn', tw: 'Aburo',           ha: 'Masara',
    fr: 'Ma\u00EFs',    es: 'Ma\u00EDz',       hi: '\u092E\u0915\u094D\u0915\u093E',
  }),
  okra:   Object.freeze({
    en: 'Okra',         tw: 'Nkruma',          ha: 'Kubewa',
    fr: 'Gombo',        es: 'Okra',            hi: '\u092D\u093F\u0902\u0921\u0940',
  }),
  onion:  Object.freeze({
    en: 'Onion',        tw: 'Ay\u025By\u025B', ha: 'Albasa',
    fr: 'Oignon',       es: 'Cebolla',         hi: '\u092A\u094D\u092F\u093E\u091C',
  }),
  ginger: Object.freeze({
    en: 'Ginger',       tw: 'Akakaduro',       ha: 'Citta',
    fr: 'Gingembre',    es: 'Jengibre',        hi: '\u0905\u0926\u0930\u0915',
  }),
  tomato: Object.freeze({
    en: 'Tomato',       tw: 'Tomato',          ha: 'Tumatir',
    fr: 'Tomate',       es: 'Tomate',          hi: '\u091F\u092E\u093E\u091F\u0930',
  }),
  pepper: Object.freeze({
    en: 'Pepper',       tw: 'Mako',            ha: 'Barkono',
    fr: 'Piment',       es: 'Pimiento',        hi: '\u092E\u093F\u0930\u094D\u091A',
  }),
});

/**
 * getLocalizedCropName — overlay-aware resolver.
 *
 *   getLocalizedCropName('maize', 'tw')  → 'Aburo'
 *   getLocalizedCropName('cassava', 'ha') → 'Rogo'   (registry fallback)
 *   getLocalizedCropName('UNKNOWN', 'tw') → 'UNKNOWN'
 *
 * Resolution order:
 *   1. Overlay table here (narrow, partner-supplied)
 *   2. Canonical registry via getCropLabelSafe (50+ crops × 6 langs)
 *   3. English column of the overlay (last-line safety net)
 *   4. Raw cropId
 */
export function getLocalizedCropName(cropId, language = 'en') {
  if (!cropId) return '';
  const id = String(cropId).toLowerCase();
  const lang = String(language || 'en').toLowerCase();
  const overlay = CROP_NAMES[id];
  if (overlay && overlay[lang]) return overlay[lang];
  // Defer to the full registry — it knows ~50 crops × 6 langs.
  const registry = getCropLabelSafe(cropId, lang);
  if (registry) return registry;
  if (overlay && overlay.en) return overlay.en;
  return cropId;
}
