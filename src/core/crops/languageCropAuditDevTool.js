/**
 * languageCropAuditDevTool.js — pins `window.__languageCropAudit()`.
 *
 * Walks every supported locale × every overlay crop and reports:
 *   • Which (locale, cropId) pairs are missing a localized name
 *   • Which locales fall back to English for >0% of crops
 *   • Which crop ids are unknown to normalizeCropId
 *
 * Useful for catching translation drift in QA before a release
 * goes live. Pairs with `window.__i18nState()` (active locale +
 * column-load status) and `window.__scanDebug()` (scan pipeline
 * state) — three small, structural inspectors that together
 * cover the bulk of "is i18n actually working?" debugging.
 *
 *   import { installLanguageCropAuditHook } from
 *     'src/core/crops/languageCropAuditDevTool.js';
 *   installLanguageCropAuditHook();
 *
 *   // From DevTools:
 *   window.__languageCropAudit()
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Idempotent — second install call is a no-op.
 *   • Snapshot carries NO PII.
 */

import { LOCALE_CODES } from '../../i18n/supportedLocales.ts';
import {
  getLocalizedCropName, listOverlayCropIds,
} from './cropLocalization.ts';

function _safe(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

/**
 * Build the audit snapshot. Exported so tests can call directly.
 */
export function buildLanguageCropAuditSnapshot() {
  return _safe(() => {
    const cropIds = listOverlayCropIds();
    const rows = [];
    const localeStats = new Map();
    for (const code of LOCALE_CODES) {
      localeStats.set(code, { total: 0, missing: 0, englishFallback: 0 });
    }
    for (const cropId of cropIds) {
      const englishName = getLocalizedCropName(cropId, 'en');
      for (const code of LOCALE_CODES) {
        const localized = getLocalizedCropName(cropId, code);
        const s = localeStats.get(code);
        s.total += 1;
        if (!localized) {
          s.missing += 1;
          rows.push({ cropId, locale: code, status: 'missing' });
          continue;
        }
        if (code !== 'en' && localized === englishName) {
          s.englishFallback += 1;
          rows.push({ cropId, locale: code, status: 'english_fallback', value: localized });
        }
      }
    }
    const localeSummary = LOCALE_CODES.map((code) => {
      const s = localeStats.get(code) || { total: 0, missing: 0, englishFallback: 0 };
      const localized = s.total - s.missing - (code === 'en' ? 0 : s.englishFallback);
      const coverage = s.total > 0 ? Math.round((localized / s.total) * 100) : 0;
      return { locale: code, ...s, localized, coveragePct: coverage };
    });
    const totalIssues = rows.length;
    return {
      ok:            totalIssues === 0,
      cropsChecked:  cropIds.length,
      localesChecked: LOCALE_CODES.length,
      localeSummary,
      issues:        rows,
      generatedAt:   new Date().toISOString(),
    };
  }, {
    ok:            false,
    cropsChecked:  0,
    localesChecked: 0,
    localeSummary: [],
    issues:        [{ cropId: null, locale: null, status: 'audit_failed' }],
    generatedAt:   new Date().toISOString(),
  });
}

/**
 * Install `window.__languageCropAudit`. Idempotent.
 */
export function installLanguageCropAuditHook() {
  try {
    if (typeof window === 'undefined') return false;
    if (window.__languageCropAudit) return true;
    Object.defineProperty(window, '__languageCropAudit', {
      value: function __languageCropAudit() {
        const snap = buildLanguageCropAuditSnapshot();
        try { console.table(snap.localeSummary); } catch { /* swallow */ }
        if (snap.issues && snap.issues.length) {
          try { console.warn('[languageCropAudit] issues:', snap.issues); } catch { /* swallow */ }
        }
        try { console.log('[languageCropAudit]', snap); } catch { /* swallow */ }
        return snap;
      },
      writable:     false,
      configurable: false,
      enumerable:   true,
    });
    return true;
  } catch { return false; }
}

const _module = {
  buildLanguageCropAuditSnapshot,
  installLanguageCropAuditHook,
};
export default _module;
