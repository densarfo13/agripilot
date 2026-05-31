/**
 * src/i18n/translateEntityLabel.js — dynamic entity-label
 * normalization + localization layer.
 *
 *   import { translateEntityLabel } from './i18n/translateEntityLabel.js';
 *
 *   translateEntityLabel({ type: 'disease', keyOrName: 'Early Blight', locale: 'fr' })
 *     → { label: 'Alternariose (mildiou précoce)', locale: 'fr',
 *         fallbackUsed: false, reviewRequired: false, canonicalKey: 'early_blight' }
 *
 *   translateEntityLabel({ type: 'disease', keyOrName: 'Early Blight', locale: 'tw' })
 *     → { label: 'Early blight', locale: 'tw', fallbackUsed: true,
 *         reviewRequired: true, canonicalKey: 'early_blight' }   // honest EN fallback
 *
 * Source of truth = the honest JSON catalogs in src/i18n/entities/.
 * Crops delegate to the canonical 6-language registry (config/crops.js
 * via getCropLabelSafe). No tw/ha/sw/hi agronomy term is ever
 * machine-fabricated — null locales fall back to English and are
 * recorded for the translator-review queue + diagnostics.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws. No fabricated translations.
 */

import { getCropLabelSafe } from '../utils/crops.js';
import { t as baseT } from './index.js';
import diseasesCatalog from './entities/diseases.json';
import pestsCatalog from './entities/pests.json';
import nutrientsCatalog from './entities/nutrients.json';
import treatmentsCatalog from './entities/treatments.json';

export const SUPPORTED_LOCALES = Object.freeze(['en', 'tw', 'ha', 'fr', 'sw', 'hi']);
export const TRANSLATOR_REVIEW_LOCALES = Object.freeze(['tw', 'ha', 'sw', 'hi']);

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

// ── Build canonical-key → row maps from the JSON catalogs ───────
function _indexCatalog(catalog) {
  const byKey = Object.create(null);
  const aliasToKey = Object.create(null);
  _safe(() => {
    const rows = (catalog && Array.isArray(catalog.entities)) ? catalog.entities : [];
    for (const row of rows) {
      if (!row || !row.key) continue;
      byKey[row.key] = row;
      aliasToKey[row.key] = row.key;
      const aliases = Array.isArray(row.aliases) ? row.aliases : [];
      for (const a of aliases) {
        const slug = _slug(a);
        if (slug) aliasToKey[slug] = row.key;
      }
    }
  }, undefined);
  return { byKey, aliasToKey };
}
const _CATALOGS = {
  disease:   _indexCatalog(diseasesCatalog),
  pest:      _indexCatalog(pestsCatalog),
  nutrient:  _indexCatalog(nutrientsCatalog),
  treatment: _indexCatalog(treatmentsCatalog),
};

// Exposed for the coverage diagnostic + governance gate.
export const ENTITY_LABELS = Object.freeze({
  disease:   diseasesCatalog,
  pest:      pestsCatalog,
  nutrient:  nutrientsCatalog,
  treatment: treatmentsCatalog,
});

// ── Missing-label diagnostics (bounded) ─────────────────────────
const _missing = [];
const _missingKeys = new Set();
const MISSING_CAP = 300;
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

function _slug(nameOrKey) {
  return _safe(() => {
    const raw = String(nameOrKey == null ? '' : nameOrKey).trim().toLowerCase();
    return raw ? raw.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') : '';
  }, '');
}

export function toCanonicalKey(type, nameOrKey) {
  return _safe(() => {
    const slug = _slug(nameOrKey);
    if (!slug) return '';
    const cat = _CATALOGS[type];
    if (cat && cat.aliasToKey[slug]) return cat.aliasToKey[slug];
    return slug;
  }, '');
}

function _humanizeEnglish(key) {
  return _safe(() => String(key || '')
    .split('_').filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' '), String(key || ''));
}

/**
 * translateEntityLabel({ type, keyOrName, locale })
 *   → { label, locale, fallbackUsed, reviewRequired, canonicalKey }
 * Never throws; always returns a usable label.
 */
export function translateEntityLabel({ type, keyOrName, locale } = {}) {
  return _safe(() => {
    const loc = SUPPORTED_LOCALES.includes(locale) ? locale : 'en';

    // Crops delegate to the canonical 6-language registry.
    if (type === 'crop') {
      const key = toCanonicalKey('crop', keyOrName) || _slug(keyOrName);
      const label = getCropLabelSafe(key, loc, baseT) || _humanizeEnglish(key);
      return Object.freeze({ label, locale: loc, fallbackUsed: false, reviewRequired: false, canonicalKey: key });
    }

    // Tasks / weather are sentence-level — route through t().
    if (type === 'task' || type === 'weather') {
      const key = _slug(keyOrName);
      const ns = `${type}.${key}`;
      const translated = _safe(() => baseT(ns, ''), '');
      const has = translated && translated !== ns;
      return Object.freeze({
        label: has ? translated : _humanizeEnglish(key),
        locale: loc, fallbackUsed: !has, reviewRequired: false, canonicalKey: key,
      });
    }

    const cat = _CATALOGS[type];
    const canonicalKey = toCanonicalKey(type, keyOrName);
    if (!cat || !canonicalKey) {
      return Object.freeze({
        label: _humanizeEnglish(canonicalKey || _slug(keyOrName)),
        locale: loc, fallbackUsed: true, reviewRequired: false, canonicalKey,
      });
    }
    const row = cat.byKey[canonicalKey];
    if (!row) {
      _recordMissing(type, canonicalKey, loc);
      return Object.freeze({
        label: _humanizeEnglish(canonicalKey),
        locale: loc, fallbackUsed: true, reviewRequired: true, canonicalKey,
      });
    }
    const localized = row[loc];
    if (localized) {
      return Object.freeze({ label: localized, locale: loc, fallbackUsed: false, reviewRequired: false, canonicalKey });
    }
    // Known entity, locale not yet translated → honest English fallback.
    if (loc !== 'en') _recordMissing(type, canonicalKey, loc);
    const reviewRequired = !!(row.translatorReview && row.translatorReview[loc] === true);
    return Object.freeze({
      label: row.en || _humanizeEnglish(canonicalKey),
      locale: loc, fallbackUsed: loc !== 'en', reviewRequired, canonicalKey,
    });
  }, Object.freeze({
    label: _safe(() => _humanizeEnglish(_slug(keyOrName)), String(keyOrName || '')),
    locale: 'en', fallbackUsed: true, reviewRequired: false, canonicalKey: _slug(keyOrName),
  }));
}

/** String convenience wrapper for render sites that only need the text. */
export function translateEntityLabelText(input) {
  return _safe(() => translateEntityLabel(input).label, String((input && input.keyOrName) || ''));
}

/**
 * entityLocalizationCoverage() — REAL coverage per type/locale from
 * the JSON catalogs. No fabricated numbers.
 */
export function entityLocalizationCoverage() {
  return _safe(() => {
    const out = {};
    for (const [type, catalog] of Object.entries(ENTITY_LABELS)) {
      const rows = (catalog && Array.isArray(catalog.entities)) ? catalog.entities : [];
      const perLocale = {};
      for (const loc of SUPPORTED_LOCALES) {
        const have = rows.filter((r) => !!r[loc]).length;
        perLocale[loc] = rows.length ? Math.round((have / rows.length) * 100) : 0;
      }
      out[type] = Object.freeze({ total: rows.length, perLocale: Object.freeze(perLocale) });
    }
    return Object.freeze(out);
  }, Object.freeze({}));
}

/** Translator-review summary for the QA page + diagnostics. */
export function translatorReviewSummary() {
  return _safe(() => {
    const out = {};
    let totalReview = 0;
    for (const [type, catalog] of Object.entries(ENTITY_LABELS)) {
      const rows = (catalog && Array.isArray(catalog.entities)) ? catalog.entities : [];
      let n = 0;
      for (const r of rows) {
        for (const loc of TRANSLATOR_REVIEW_LOCALES) {
          if (r.translatorReview && r.translatorReview[loc] === true) n += 1;
        }
      }
      out[type] = n; totalReview += n;
    }
    return Object.freeze({ byType: Object.freeze(out), total: totalReview });
  }, Object.freeze({ byType: {}, total: 0 }));
}
