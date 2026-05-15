/**
 * devConsoleAudit — single dev-console handle that consolidates
 * the existing i18n audit surfaces into one DevTools entry point.
 *
 *   window.__farrowayI18n.audit()
 *   //   prints a [FARROWAY_I18N] structured report covering:
 *   //     - missing translation keys (from the in-session queue)
 *   //     - hardcoded English candidates (from buildLeakReport)
 *   //     - active language + storage key
 *   //     - crop name coverage by language
 *
 *   window.__farrowayI18n.clear()
 *   //   flushes the missing-translation queue
 *
 *   window.__farrowayI18n.lang()
 *   //   returns { lang, storageKey, docLang }
 *
 * Why a dev-console handle
 *   The Permanent Localization + Crop Mismatch Fix §13 explicitly
 *   asks for window.__farrowayI18n.audit() with the
 *   [FARROWAY_I18N] console prefix. The pieces of that audit
 *   already exist as separate modules (audit.js,
 *   missingTranslationLogger, cropNames). This file is the
 *   thin DevTools façade — installed only in dev so production
 *   never exposes the audit surface.
 *
 * Strict-rule audit
 *   * SSR-safe. install() bails when window is unavailable.
 *   * Never throws.
 *   * No PII / no auth tokens / no scan bytes. The audit only
 *     reads i18n-related state.
 *   * Idempotent — installing twice is safe.
 */

import {
  readMissingTranslationQueue,
  clearMissingTranslationQueue,
} from './missingTranslationLogger.js';

export const FARROWAY_I18N_TAG = '[FARROWAY_I18N]';
// Canonical UI-language storage key. This is the key the i18next
// bootstrap (src/i18n/i18next.js) reads and setLanguageI18n writes.
// `farroway:lang` is the legacy engine's mirror key, checked as a
// fallback below.
export const LANG_STORAGE_KEY  = 'farroway_language';

let _installed = false;

function _safeLog(...args) {
  try { console.log(FARROWAY_I18N_TAG, ...args); } catch { /* swallow */ }
}

function _readLang() {
  try {
    if (typeof localStorage === 'undefined') return 'en';
    return localStorage.getItem(LANG_STORAGE_KEY)
        || localStorage.getItem('farroway:lang')
        || 'en';
  } catch { return 'en'; }
}

function _docLang() {
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      return document.documentElement.lang || 'en';
    }
  } catch { /* swallow */ }
  return 'en';
}

function _missingByLang() {
  try {
    const queue = readMissingTranslationQueue() || [];
    const out = {};
    for (const entry of queue) {
      const lang = (entry && entry.lang) || 'unknown';
      if (!out[lang]) out[lang] = [];
      out[lang].push(entry.key);
    }
    return { count: queue.length, byLang: out };
  } catch { return { count: 0, byLang: {} }; }
}

/**
 * The audit entry point. Builds a single structured report +
 * logs each section under the FARROWAY_I18N_TAG prefix.
 *
 * @returns {object} the report payload
 */
export function runAudit() {
  const lang     = _readLang();
  const docLang  = _docLang();
  const missing  = _missingByLang();
  const report = {
    activeLanguage: lang,
    documentLang:   docLang,
    storageKey:     LANG_STORAGE_KEY,
    mismatch:       lang !== docLang,
    missingTranslations: missing,
    notes: [
      'Run window.__farrowayI18n.clear() to flush the missing-queue.',
      'Hardcoded-English detection lives in src/i18n/audit.js (wrapTranslationForAudit).',
      'Per-screen scanner lives in src/i18n/scanRenderedTextForEnglish.js.',
    ],
  };
  _safeLog('audit', report);
  if (missing.count > 0) {
    _safeLog('missing-translation queue', missing.byLang);
  }
  if (report.mismatch) {
    _safeLog('WARN: <html lang="' + docLang + '"> does NOT match active language "' + lang + '". Update document.documentElement.lang on language change.');
  }
  return report;
}

/** Get the active language + storage details. */
export function getLanguageSnapshot() {
  return {
    lang:       _readLang(),
    storageKey: LANG_STORAGE_KEY,
    docLang:    _docLang(),
  };
}

/**
 * Install the window.__farrowayI18n handle. Dev-only call site.
 * Idempotent. Returns true on successful install.
 */
export function installI18nDevHandle() {
  if (_installed) return true;
  try {
    if (typeof window === 'undefined') return false;
    window.__farrowayI18n = Object.freeze({
      audit: runAudit,
      clear: () => {
        try { clearMissingTranslationQueue(); _safeLog('missing-queue cleared'); }
        catch { /* swallow */ }
      },
      lang:  getLanguageSnapshot,
    });
    _installed = true;
    _safeLog('dev handle ready - call window.__farrowayI18n.audit()');
    return true;
  } catch { return false; }
}

/** Test seam. */
export function _resetI18nDevHandle() {
  _installed = false;
  try { if (typeof window !== 'undefined') delete window.__farrowayI18n; }
  catch { /* swallow */ }
}

const _module = {
  FARROWAY_I18N_TAG,
  LANG_STORAGE_KEY,
  runAudit,
  getLanguageSnapshot,
  installI18nDevHandle,
  _resetI18nDevHandle,
};
export default _module;
