/**
 * agricultureRegistry.js — ONE normalized access engine for every
 * agricultural label and message, across all six launch languages.
 *
 *   import {
 *     getCropLabel, getTaskLabel, getDiseaseLabel,
 *     getWeatherMessage, getScanExplanation, getCopilotPrompt,
 *   } from 'src/core/intelligence/agricultureRegistry.js';
 *
 *   getCropLabel('pepper', 'fr')          // → 'Poivron'
 *   getTaskLabel('task.remove_weeds', 'sw')
 *   getWeatherMessage('heavyRain', 'tw')
 *
 * Why a facade and NOT a new src/localization/agriculture/ tree
 * ─────────────────────────────────────────────────────────────
 *   The agricultural vocabulary the spec asks to "create" already
 *   ships, fully populated and tested:
 *
 *     • crop names  → src/i18n/cropNames.js (getLocalizedCropName)
 *     • tasks       → src/i18n/taskEngineTranslations.js
 *     • weather /   → src/i18n/translations.js (6,372 keys × 6
 *       scan /        languages — the weather.*, scan.*, pest.*,
 *       disease /     disease.*, copilot.* domains)
 *       copilot
 *
 *   A second src/localization/agriculture/ JSON tree would be a
 *   THIRD parallel translation store competing with translations.js
 *   and cropNames.js — exactly the fragmentation this upgrade is
 *   meant to end. The real fragmentation is in the ACCESS layer:
 *   crop labels alone are reachable through three different files.
 *   This module is the single normalized accessor every screen,
 *   the voice assistant, and the copilot can call.
 *
 * Mixed-language protection (spec §13)
 *   Every getter resolves to exactly ONE language. It picks the
 *   requested language's string, or — if that is missing — logs the
 *   gap and falls back to ENGLISH ONLY. It never concatenates two
 *   languages, so a sentence can never come back half-translated.
 *
 * Performance (spec §16)
 *   Every resolved label is memoised in a module-level Map keyed by
 *   domain:id:lang, so repeated lookups (every render) are O(1) and
 *   never re-walk the translation tables.
 *
 * Strict-rule audit
 *   • Pure. Never throws — every lookup is guarded.
 *   • SSR-safe (no window / DOM access).
 *   • No new translation DATA — this is the accessor only.
 */

import { getLocalizedCropName } from '../../i18n/cropNames.js';
import translations from '../../i18n/translations.js';
import taskEngineTranslations from '../../i18n/taskEngineTranslations.js';
import { logMissingTranslation } from '../../i18n/missingTranslationLogger.js';

// The six launch languages. Anything else normalises to English.
export const SUPPORTED_LANGUAGES = Object.freeze(['en', 'fr', 'tw', 'ha', 'sw', 'hi']);

const FALLBACK_LANG = 'en';

// domain:id:lang → resolved string. Bounded in practice by the
// finite label set; cleared only by the test seam.
const _cache = new Map();

/** Normalise any locale input to one of the six supported codes. */
function _normLang(language) {
  try {
    const l = String(language || '').trim().toLowerCase().slice(0, 2);
    return SUPPORTED_LANGUAGES.includes(l) ? l : FALLBACK_LANG;
  } catch {
    return FALLBACK_LANG;
  }
}

/** Turn an id ('possibleLeafSpot', 'task.remove_weeds') into calm
 *  human text — the last-resort English fallback so the UI never
 *  shows a raw key. */
function _humanize(id) {
  try {
    const base = String(id || '').split('.').pop() || '';
    const words = base
      .replace(/[_-]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim()
      .toLowerCase();
    if (!words) return '';
    return words.charAt(0).toUpperCase() + words.slice(1);
  } catch {
    return '';
  }
}

/**
 * Pick exactly one language string from a {en,fr,sw,ha,tw,hi}
 * value object. Missing requested language → log + English only.
 * Returns null when nothing usable exists.
 */
function _pickOne(valueObj, lang, missKey) {
  if (!valueObj || typeof valueObj !== 'object') return null;
  const direct = valueObj[lang];
  if (typeof direct === 'string' && direct.trim()) return direct;
  // Missing in the requested language — record the gap, then fall
  // back to ENGLISH ONLY. Never blend two languages (spec §13).
  if (lang !== FALLBACK_LANG) {
    try { logMissingTranslation(missKey, lang); } catch { /* swallow */ }
  }
  const en = valueObj[FALLBACK_LANG];
  return (typeof en === 'string' && en.trim()) ? en : null;
}

/** Resolve a translations.js key (tries each candidate in order). */
function _fromTranslations(keys, lang) {
  for (const key of keys) {
    const entry = translations && translations[key];
    const hit = _pickOne(entry, lang, key);
    if (hit) return hit;
  }
  return null;
}

/** Memoised wrapper around a resolver. */
function _memo(domain, id, lang, resolve) {
  const cacheKey = domain + ':' + id + ':' + lang;
  if (_cache.has(cacheKey)) return _cache.get(cacheKey);
  let value;
  try { value = resolve(); } catch { value = null; }
  if (typeof value !== 'string' || !value.trim()) value = _humanize(id);
  _cache.set(cacheKey, value);
  return value;
}

// ─── Public accessors ──────────────────────────────────────────

/** Localized crop name. Delegates to the existing crop registry. */
export function getCropLabel(cropId, language) {
  const lang = _normLang(language);
  return _memo('crop', String(cropId || ''), lang, () => {
    try { return getLocalizedCropName(cropId, lang); }
    catch { return null; }
  });
}

/** Localized task wording (planting/care/harvest task engine). */
export function getTaskLabel(taskId, language) {
  const lang = _normLang(language);
  return _memo('task', String(taskId || ''), lang, () => {
    const byLang = taskEngineTranslations && taskEngineTranslations[lang];
    const enByLang = taskEngineTranslations && taskEngineTranslations[FALLBACK_LANG];
    const direct = byLang && byLang[taskId];
    if (typeof direct === 'string' && direct.trim()) return direct;
    if (lang !== FALLBACK_LANG) {
      try { logMissingTranslation('task.' + taskId, lang); } catch { /* swallow */ }
    }
    const en = enByLang && enByLang[taskId];
    if (typeof en === 'string' && en.trim()) return en;
    // Last resort — the shared translations.js task domains.
    return _fromTranslations(['taskEngine.' + taskId, 'task.' + taskId, 'tasks.' + taskId], lang);
  });
}

/** Localized disease label — never claims certainty (the data
 *  itself carries the calm "possible …" wording). */
export function getDiseaseLabel(diseaseId, language) {
  const lang = _normLang(language);
  return _memo('disease', String(diseaseId || ''), lang, () =>
    _fromTranslations(['disease.' + diseaseId, 'pest.' + diseaseId, 'scan.' + diseaseId], lang));
}

/** Calm, action-oriented weather guidance message. */
export function getWeatherMessage(type, language) {
  const lang = _normLang(language);
  return _memo('weather', String(type || ''), lang, () =>
    _fromTranslations(['weather.' + type, 'wx.' + type], lang));
}

/** Localized scan explanation (short, farmer-facing). */
export function getScanExplanation(scanType, language) {
  const lang = _normLang(language);
  return _memo('scan', String(scanType || ''), lang, () =>
    _fromTranslations(['scan.' + scanType, 'briefingScan.' + scanType, 'pest.' + scanType], lang));
}

/** Localized copilot / recommendation prompt. */
export function getCopilotPrompt(type, language) {
  const lang = _normLang(language);
  return _memo('copilot', String(type || ''), lang, () =>
    _fromTranslations(['copilot.' + type, 'recommend.' + type, 'actionHome.' + type], lang));
}

/**
 * One bundled vocabulary snapshot for a language — the
 * "agricultureVocabulary" surface the intelligence snapshot can
 * expose (spec §14). Each field is a resolver bound to the
 * language so callers need not thread `lang` everywhere.
 */
export function getAgricultureVocabulary(language) {
  const lang = _normLang(language);
  return Object.freeze({
    language: lang,
    cropLabel:       (id) => getCropLabel(id, lang),
    taskLabel:       (id) => getTaskLabel(id, lang),
    diseaseLabel:    (id) => getDiseaseLabel(id, lang),
    weatherMessage:  (id) => getWeatherMessage(id, lang),
    scanExplanation: (id) => getScanExplanation(id, lang),
    copilotPrompt:   (id) => getCopilotPrompt(id, lang),
  });
}

/** Test seam — clears the memo cache. */
export function _resetAgricultureRegistry() {
  _cache.clear();
}

const _module = {
  SUPPORTED_LANGUAGES,
  getCropLabel,
  getTaskLabel,
  getDiseaseLabel,
  getWeatherMessage,
  getScanExplanation,
  getCopilotPrompt,
  getAgricultureVocabulary,
  _resetAgricultureRegistry,
};
export default _module;
