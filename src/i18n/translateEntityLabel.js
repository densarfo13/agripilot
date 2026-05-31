/**
 * src/i18n/translateEntityLabel.js — dynamic entity-label
 * normalization + localization layer (Language Mismatch Fix §7).
 *
 *   import { translateEntityLabel } from './i18n/translateEntityLabel.js';
 *
 *   translateEntityLabel({ type: 'disease', keyOrName: 'Early Blight', locale: 'fr' })
 *     → 'Alternariose (mildiou précoce)'
 *   translateEntityLabel({ type: 'crop', keyOrName: 'maize', locale: 'tw' })
 *     → 'Aburo'   (delegates to the 6-language crop registry)
 *
 * Why this exists
 * ───────────────
 * Scan/ML providers + the rule engine return ENGLISH labels
 * ("Early Blight", "Fall Armyworm", "Nitrogen deficiency"). Rendering
 * those verbatim is the single biggest source of language mismatch on
 * an otherwise-localized screen. This layer:
 *   1. normalizes any provider label to a stable canonical key
 *      (lower-snake, alias-folded),
 *   2. looks the key up in the per-type localization table,
 *   3. returns the localized display name when present,
 *   4. otherwise falls back SAFELY to a humanized English label
 *      (never a raw provider string, never a crash),
 *   5. records every missing (type, key, locale) tuple for the
 *      __languageHealth() / __languageError diagnostic so coverage is
 *      measured honestly — no fake 100%.
 *
 * HONEST COVERAGE NOTE
 *   Crops are fully localized via the existing 6-language registry
 *   (config/crops.js → getCropLabelSafe). For diseases / pests /
 *   nutrients, English + French are populated with high confidence;
 *   tw / ha / sw / hi are intentionally LEFT for partner-agronomist
 *   review (see TRANSLATOR_REVIEW_LOCALES) rather than machine-guessed
 *   — a wrong agricultural term is worse than an honest English
 *   fallback for a low-literacy user. Those locales fall through to
 *   English here and are reported as missing by the diagnostic.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws. No fabricated translations.
 */

import { getCropLabelSafe } from '../utils/crops.js';
import { t as baseT } from './index.js';

export const SUPPORTED_LOCALES = Object.freeze(['en', 'tw', 'ha', 'fr', 'sw', 'hi']);
export const TRANSLATOR_REVIEW_LOCALES = Object.freeze(['tw', 'ha', 'sw', 'hi']);

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

// ── Missing-label diagnostics (bounded ring buffer) ─────────────
const _missing = [];
const _missingKeys = new Set();
const MISSING_CAP = 200;
function _recordMissing(type, key, locale) {
  _safe(() => {
    const id = `${type}:${key}:${locale}`;
    if (_missingKeys.has(id)) return;
    _missingKeys.add(id);
    _missing.push(Object.freeze({ type, key, locale }));
    if (_missing.length > MISSING_CAP) _missing.shift();
  }, undefined);
}
export function getMissingEntityLabels() {
  return _safe(() => Object.freeze(_missing.slice()), Object.freeze([]));
}

// ── Canonical-key normalization (alias-fold + slugify) ──────────
const _ALIASES = Object.freeze({
  corn: 'maize',
  groundnut: 'peanut', peanut: 'groundnut',
  'army worm': 'fall_armyworm', armyworm: 'fall_armyworm',
  'fall army worm': 'fall_armyworm',
  whitefly: 'whiteflies', aphid: 'aphids',
  'spider mite': 'spider_mites', mealybug: 'mealybugs',
  'fruit fly': 'fruit_flies', weevil: 'weevils',
  'stem borer': 'stem_borer', 'tuta absoluta': 'tuta_absoluta',
});
export function toCanonicalKey(nameOrKey) {
  return _safe(() => {
    const raw = String(nameOrKey == null ? '' : nameOrKey).trim().toLowerCase();
    if (!raw) return '';
    if (_ALIASES[raw]) return _ALIASES[raw];
    const slug = raw.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return _ALIASES[slug] || slug;
  }, '');
}

function _humanizeEnglish(key) {
  return _safe(() => String(key || '')
    .split('_').filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' '), String(key || ''));
}

// ── Per-type localization tables ────────────────────────────────
// en + fr populated with confidence; tw/ha/sw/hi → translator review
// (omitted on purpose → honest English fallback + diagnostic record).
const DISEASE_LABELS = Object.freeze({
  leaf_spot:               { en: 'Leaf spot',               fr: 'Tache foliaire' },
  early_blight:            { en: 'Early blight',            fr: 'Alternariose (mildiou précoce)' },
  late_blight:             { en: 'Late blight',             fr: 'Mildiou' },
  cassava_mosaic_disease:  { en: 'Cassava mosaic disease',  fr: 'Mosaïque du manioc' },
  maize_lethal_necrosis:   { en: 'Maize lethal necrosis',   fr: 'Nécrose létale du maïs' },
  rust:                    { en: 'Rust',                    fr: 'Rouille' },
  powdery_mildew:          { en: 'Powdery mildew',          fr: 'Oïdium' },
  bacterial_wilt:          { en: 'Bacterial wilt',          fr: 'Flétrissement bactérien' },
  root_rot:                { en: 'Root rot',                fr: 'Pourriture des racines' },
});
const PEST_LABELS = Object.freeze({
  aphids:         { en: 'Aphids',         fr: 'Pucerons' },
  fall_armyworm:  { en: 'Fall armyworm',  fr: 'Chenille légionnaire d’automne' },
  stem_borer:     { en: 'Stem borer',     fr: 'Foreur de tige' },
  whiteflies:     { en: 'Whiteflies',     fr: 'Aleurodes' },
  thrips:         { en: 'Thrips',         fr: 'Thrips' },
  spider_mites:   { en: 'Spider mites',   fr: 'Tétranyques' },
  mealybugs:      { en: 'Mealybugs',      fr: 'Cochenilles farineuses' },
  fruit_flies:    { en: 'Fruit flies',    fr: 'Mouches des fruits' },
  tuta_absoluta:  { en: 'Tuta absoluta',  fr: 'Tuta absoluta' },
  weevils:        { en: 'Weevils',        fr: 'Charançons' },
});
const NUTRIENT_LABELS = Object.freeze({
  nitrogen_deficiency:   { en: 'Nitrogen deficiency',   fr: 'Carence en azote' },
  phosphorus_deficiency: { en: 'Phosphorus deficiency', fr: 'Carence en phosphore' },
  potassium_deficiency:  { en: 'Potassium deficiency',  fr: 'Carence en potassium' },
  calcium_deficiency:    { en: 'Calcium deficiency',    fr: 'Carence en calcium' },
  magnesium_deficiency:  { en: 'Magnesium deficiency',  fr: 'Carence en magnésium' },
  iron_deficiency:       { en: 'Iron deficiency',       fr: 'Carence en fer' },
  zinc_deficiency:       { en: 'Zinc deficiency',       fr: 'Carence en zinc' },
});

const _TABLE_BY_TYPE = Object.freeze({
  disease:  DISEASE_LABELS,
  pest:     PEST_LABELS,
  nutrient: NUTRIENT_LABELS,
});

export const ENTITY_LABELS = Object.freeze({
  disease: DISEASE_LABELS, pest: PEST_LABELS, nutrient: NUTRIENT_LABELS,
});

/**
 * translateEntityLabel({ type, keyOrName, locale }) → localized string.
 * Never throws; always returns a non-empty human-readable label.
 */
export function translateEntityLabel({ type, keyOrName, locale } = {}) {
  return _safe(() => {
    const loc = SUPPORTED_LOCALES.includes(locale) ? locale : 'en';
    const key = toCanonicalKey(keyOrName);
    if (!key) return String(keyOrName || '');

    // Crops delegate to the canonical 6-language registry.
    if (type === 'crop') {
      return getCropLabelSafe(key, loc, baseT) || _humanizeEnglish(key);
    }

    // Tasks / weather are sentence-level — route through the t()
    // namespace if the caller passed a key; else humanize.
    if (type === 'task' || type === 'weather') {
      const ns = `${type}.${key}`;
      const translated = _safe(() => baseT(ns, ''), '');
      if (translated && translated !== ns) return translated;
      return _humanizeEnglish(key);
    }

    const table = _TABLE_BY_TYPE[type];
    if (!table) return _humanizeEnglish(key);
    const row = table[key];
    if (!row) {
      // Unknown canonical key — honest English humanization + record.
      _recordMissing(type, key, loc);
      return _humanizeEnglish(key);
    }
    if (row[loc]) return row[loc];
    // Known entity, locale not yet translated → English fallback +
    // record so the diagnostic shows the real gap (no fake coverage).
    if (loc !== 'en') _recordMissing(type, key, loc);
    return row.en || _humanizeEnglish(key);
  }, _safe(() => _humanizeEnglish(toCanonicalKey(keyOrName)), String(keyOrName || '')));
}

/**
 * entityLocalizationCoverage() — REAL coverage per type/locale, for
 * the __languageHealth() diagnostic. No fabricated numbers.
 */
export function entityLocalizationCoverage() {
  return _safe(() => {
    const out = {};
    for (const [type, table] of Object.entries(_TABLE_BY_TYPE)) {
      const keys = Object.keys(table);
      const perLocale = {};
      for (const loc of SUPPORTED_LOCALES) {
        const have = keys.filter((k) => !!table[k][loc]).length;
        perLocale[loc] = keys.length ? Math.round((have / keys.length) * 100) : 0;
      }
      out[type] = Object.freeze({ total: keys.length, perLocale: Object.freeze(perLocale) });
    }
    return Object.freeze(out);
  }, Object.freeze({}));
}
