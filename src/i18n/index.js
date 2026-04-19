/**
 * i18n — centralized UI translation system.
 *
 * Single source of truth: language is stored in localStorage as 'farroway:lang'.
 * Both UI text and voice guidance share the same key.
 *
 * Usage:
 *   import { t, useTranslation, getLanguage, setLanguage, LANGUAGES } from '../i18n';
 *   const { t, lang, setLang } = useTranslation();
 *   t('home.startSeason')        → "Anza Msimu" (if lang=sw)
 *   t('home.noUpdateDays', { days: 5 })  → interpolates {days}
 */

import { useState, useEffect, useCallback } from 'react';
import T from './translations.js';
import HI from './hi.js';
import {
  formatNumber,
  formatCount,
  formatDate,
  formatRelativeTime,
  pluralCategory,
  pluralKey,
} from './format.js';
import { wrapTranslationForAudit, buildLeakReport } from './audit.js';

// Merge the Hindi pack into the main dictionary once at module load.
// Keeping HI in a separate file means Hindi rollouts are reviewable
// in one place and don't bloat translations.js further.
(function mergeHindi() {
  for (const key of Object.keys(HI)) {
    if (T[key]) {
      // Only fill in when the main entry is missing hi — never clobber
      // an existing in-place Hindi string that a translator may have
      // committed directly into translations.js.
      if (!T[key].hi) T[key].hi = HI[key];
    } else {
      T[key] = { hi: HI[key] };
    }
  }
})();

// ── Language list (matches VOICE_LANGUAGES in voiceGuide.js) ──
export const LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'fr', label: 'Français', short: 'FR' },
  { code: 'sw', label: 'Kiswahili', short: 'SW' },
  { code: 'ha', label: 'Hausa', short: 'HA' },
  { code: 'tw', label: 'Twi', short: 'TW' },
  // Starter language — only high-priority shared strings are translated
  // (see "Starter Hindi set" in translations.js). Other keys fall back
  // to English via the resolver until Hindi is fully rolled out.
  { code: 'hi', label: 'हिन्दी', short: 'HI' },
];

const STORAGE_KEY = 'farroway:lang';
// Legacy key used by the old voice-only system — keep in sync
const LEGACY_VOICE_KEY = 'farroway:voiceLang';
// Legacy key from old server-based i18n — keep in sync
const LEGACY_UI_KEY = 'farroway_lang';

/** Read persisted language, defaulting to 'en'. */
export function getLanguage() {
  try {
    return localStorage.getItem(STORAGE_KEY)
      || localStorage.getItem(LEGACY_VOICE_KEY)
      || localStorage.getItem(LEGACY_UI_KEY)
      || 'en';
  } catch {
    return 'en';
  }
}

/**
 * Mirror the active language onto <html lang> so CSS can target
 * `html[lang="hi"]` for Devanagari font + line-height overrides and
 * screen readers get the right pronunciation.
 */
function applyHtmlLang(code) {
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('lang', code || 'en');
      // Devanagari and other RTL-safe left-to-right scripts stay ltr;
      // set explicitly so any parent RTL wrapper doesn't flip Hindi.
      document.documentElement.setAttribute('dir', 'ltr');
    }
  } catch { /* SSR / locked-down contexts */ }
}

/** Persist language to all storage keys (so VoiceBar reads the same value). */
export function setLanguage(code) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
    localStorage.setItem(LEGACY_VOICE_KEY, code); // keeps voice aligned
    localStorage.setItem(LEGACY_UI_KEY, code);     // keeps legacy i18n aligned
  } catch { /* quota exceeded — no-op */ }
  applyHtmlLang(code);
  // Dispatch custom event so every useTranslation hook picks it up
  window.dispatchEvent(new CustomEvent('farroway:langchange', { detail: code }));
}

// On module load, mirror the persisted language onto <html lang> so
// even the first paint on reload gets the right font stack / locale.
if (typeof window !== 'undefined') {
  try { applyHtmlLang(getLanguage()); } catch { /* ignore */ }
}

/**
 * Translate a key.
 *
 * @param {string} key     — dot-notation key, e.g. 'home.startSeason'
 * @param {string} lang    — language code, e.g. 'sw'
 * @param {object} [vars]  — interpolation variables, e.g. { days: 5 }
 * @returns {string}
 */
/**
 * Humanize a dotted key as a last-resort fallback so the UI never
 * shows a blank where a translation was expected.
 *   'myFarm.findBestCrop' → 'Find best crop'
 */
function humanizeKey(key) {
  const tail = String(key).split('.').pop() || key;
  const spaced = tail
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!spaced) return '';
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export function t(key, lang, vars) {
  if (!key) return '';
  const entry = T[key];
  const isDev = typeof import.meta !== 'undefined' ? import.meta.env?.DEV : process.env.NODE_ENV === 'development';
  if (!entry) {
    if (isDev) {
      _warnedMissing ??= new Set();
      if (!_warnedMissing.has(key)) {
        _warnedMissing.add(key);
        console.warn(`[i18n] Missing key: "${key}"`);
      }
    }
    // Never leak the raw key to the UI — humanize instead.
    return humanizeKey(key);
  }
  let text = entry[lang];
  if (!text && lang !== 'en') {
    text = entry.en || '';
    // In dev: warn about English fallback so translators can fix it
    if (isDev && text) {
      // Throttle: only warn once per key per session
      _warnedFallbacks ??= new Set();
      const warnKey = `${key}:${lang}`;
      if (!_warnedFallbacks.has(warnKey)) {
        _warnedFallbacks.add(warnKey);
        console.warn(`[i18n] Falling back to English for "${key}" (lang="${lang}")`);
      }
    }
  } else if (!text) {
    text = entry.en || '';
  }
  if (!text) {
    // Still nothing — humanize rather than leak blank to UI.
    text = humanizeKey(key);
  }
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}

let _warnedFallbacks = null;
let _warnedMissing = null;

/**
 * Dev-only audit: return keys with no Hindi translation.
 * Exposed so a one-liner in the console can surface coverage gaps:
 *   window.__i18nAuditHindi?.()
 */
export function auditMissingForLang(lang = 'hi') {
  const missing = [];
  for (const [key, entry] of Object.entries(T)) {
    if (!entry[lang]) missing.push(key);
  }
  return missing;
}

if (typeof window !== 'undefined') {
  try {
    window.__i18nAuditHindi = () => auditMissingForLang('hi');
  } catch { /* SSR / locked-down contexts — ignore */ }
}

// ── Convenience: bound translate for a given lang ──
export function createT(lang) {
  return (key, vars) => t(key, lang, vars);
}

// ── React hook — live language state + bound t() ──
let _listeners = [];

export function useTranslation() {
  const [lang, _setLang] = useState(getLanguage);

  useEffect(() => {
    const handler = (e) => _setLang(e.detail || getLanguage());
    window.addEventListener('farroway:langchange', handler);
    return () => window.removeEventListener('farroway:langchange', handler);
  }, []);

  const setLang = useCallback((code) => {
    setLanguage(code);
    _setLang(code);
  }, []);

  // Dev-only: wrap t() to warn once per key when a Hindi screen
  // resolves to an ASCII-only (likely English) string. No-op in prod.
  const rawBoundT = useCallback((key, vars) => t(key, lang, vars), [lang]);
  const boundT = useCallback(
    wrapTranslationForAudit(rawBoundT, lang),
    [rawBoundT, lang],
  );

  // Plural-aware translate: given a base key, pick _one/_other variant
  // using Intl.PluralRules for the active locale.
  const tPlural = useCallback((baseKey, count, vars) => {
    const key = pluralKey(baseKey, count, lang);
    return rawBoundT(key, { count, ...(vars || {}) });
  }, [rawBoundT, lang]);

  // Locale-aware formatters bound to the active language.
  const fmtNumber = useCallback((v, opts) => formatNumber(v, lang, opts), [lang]);
  const fmtCount = useCallback((v) => formatCount(v, lang), [lang]);
  const fmtDate = useCallback((v, opts) => formatDate(v, lang, opts), [lang]);
  const fmtRelative = useCallback((v, now) => formatRelativeTime(v, lang, now), [lang]);

  return {
    t: boundT,
    tPlural,
    lang,
    setLang,
    languages: LANGUAGES,
    fmtNumber,
    fmtCount,
    fmtDate,
    fmtRelative,
    pluralCategory: (n) => pluralCategory(n, lang),
  };
}

// Expose an on-demand dev leak report in the console.
if (typeof window !== 'undefined') {
  try { window.__i18nLeakReport = (lng = 'hi') => buildLeakReport(T, lng); }
  catch { /* ignore */ }
}
