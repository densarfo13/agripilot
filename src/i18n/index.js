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
import TW from './tw.js';
import { resolveLanguage, confirmLanguage } from '../lib/languageResolver.js';
import { mergeManyOverlays } from './mergeOverlays.js';

// ─── Translation overlays ─────────────────────────────────
// Each overlay is shaped `{ locale: { key: value } }` and
// merges into T as empty-slot fill. Translator-authored
// values in translations.js always win.
import { FAST_ONBOARDING_TRANSLATIONS } from './fastOnboardingTranslations.js';
import { HOME_TRANSLATIONS }            from './homeTranslations.js';
import { EDIT_FARM_TRANSLATIONS }       from './editFarmTranslations.js';
import { NEW_FARM_TRANSLATIONS }        from './newFarmTranslations.js';
import { COMPLETION_TRANSLATIONS }      from './completionTranslations.js';
import { USE_CROP_TRANSLATIONS }        from './useCropTranslations.js';
import { TASK_ENGINE_TRANSLATIONS }     from './taskEngineTranslations.js';
import { SIGNAL_TRANSLATIONS }          from './signalTranslations.js';
import { GAP_FIX_TRANSLATIONS }         from './gapFixTranslations.js';
import { NOTIFICATION_PREFS_TRANSLATIONS } from './notificationPrefsTranslations.js';
import {
  formatNumber,
  formatCount,
  formatDate,
  formatRelativeTime,
  pluralCategory,
  pluralKey,
} from './format.js';
import { wrapTranslationForAudit, buildLeakReport } from './audit.js';

// Merge per-language packs into the main dictionary once at module
// load. Separate packs keep language rollouts reviewable in one
// place and prevent translations.js from bloating indefinitely.
// Existing translator-authored values in the main dictionary always
// win — packs only fill *empty* slots.
(function mergePacks() {
  // 1. Per-language single-pack merges (legacy shape: flat key→string
  //    keyed under a single locale).
  const packs = [['hi', HI], ['tw', TW]];
  for (const [lang, dict] of packs) {
    for (const key of Object.keys(dict)) {
      if (T[key]) {
        if (!T[key][lang]) T[key][lang] = dict[key];
      } else {
        T[key] = { [lang]: dict[key] };
      }
    }
  }
  // 2. Locale-first overlays (new shape: `{locale: {key: value}}`).
  //    These were previously defined but never merged — that's how
  //    farm.editFarm.* / fast_onboarding.* / home.* keys were leaking
  //    as humanized strings instead of rendering their translations.
  mergeManyOverlays(T, [
    FAST_ONBOARDING_TRANSLATIONS,
    HOME_TRANSLATIONS,
    EDIT_FARM_TRANSLATIONS,
    NEW_FARM_TRANSLATIONS,
    COMPLETION_TRANSLATIONS,
    USE_CROP_TRANSLATIONS,
    TASK_ENGINE_TRANSLATIONS,
    SIGNAL_TRANSLATIONS,
    GAP_FIX_TRANSLATIONS,
    NOTIFICATION_PREFS_TRANSLATIONS,
  ]);
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

/**
 * Read the active UI language using the full priority chain:
 * manual → saved profile → legacy storage → device locale → 'en'.
 * The chain lives in languageResolver so region logic stays
 * independent — a farmer can use Hindi UI with Maryland agronomy.
 */
export function getLanguage() {
  try { return resolveLanguage(); } catch { return 'en'; }
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

/**
 * Persist language using the resolver so manual, profile, and legacy
 * slots stay in sync (VoiceBar + server-side locale still read from
 * the legacy keys). Broadcasts a change event for every subscriber.
 */
export function setLanguage(code) {
  confirmLanguage(code);
  applyHtmlLang(code);
  // confirmLanguage already dispatches the event, but we re-dispatch
  // here for older call sites that imported setLanguage directly
  // before the resolver existed.
  try { window.dispatchEvent(new CustomEvent('farroway:langchange', { detail: code })); }
  catch { /* ignore */ }
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

// Fix 3 — Production-stability hardening §3:
// Strict mode surfaces missing translations as [MISSING:key] so QA
// can see them during pilot. Production builds keep the friendly
// English fallback so a missing Hindi string doesn't break the
// dashboard. Set VITE_I18N_STRICT=1 in dev/staging to opt in.
function isStrictI18n() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      if (import.meta.env.VITE_I18N_STRICT === '1') return true;
      if (import.meta.env.DEV) return true;
    }
  } catch { /* SSR */ }
  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.VITE_I18N_STRICT === '1') return true;
      if (process.env.NODE_ENV === 'test')      return true;
    }
  } catch { /* ignore */ }
  return false;
}

export function t(key, lang, vars) {
  // Outer try/catch — t() must NEVER throw. If anything exotic
  // happens (corrupted translations object, vars iteration error,
  // unexpected non-string value), return the [MISSING:key] marker
  // so the UI renders a debuggable string instead of crashing the
  // React tree. This is the canonical "fallback never crashes"
  // guarantee callers rely on.
  try {
    if (!key) return '';
    const entry = T[key];
    const isDev = typeof import.meta !== 'undefined' ? import.meta.env?.DEV : process.env.NODE_ENV === 'development';
    const strict = isStrictI18n();
    if (!entry) {
      if (isDev || strict) {
        _warnedMissing ??= new Set();
        if (!_warnedMissing.has(key)) {
          _warnedMissing.add(key);
          console.warn(`[i18n] Missing key: "${key}"`);
        }
      }
      // Strict mode (dev/QA): make the gap visible. Production: stay
      // user-friendly with the humanised key.
      if (strict) return `[MISSING:${key}]`;
      return humanizeKey(key);
    }
    let text = entry[lang];
    if (!text && lang !== 'en') {
      text = entry.en || '';
      if (isDev || strict) {
        _warnedFallbacks ??= new Set();
        const warnKey = `${key}:${lang}`;
        if (!_warnedFallbacks.has(warnKey)) {
          _warnedFallbacks.add(warnKey);
          console.warn(`[i18n] Falling back to English for "${key}" (lang="${lang}")`);
        }
      }
      // Strict + non-English: surface the gap so QA catches it.
      if (strict && text) text = `[MISSING:${key}|fallback]`;
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
  } catch (err) {
    try {
      if (typeof console !== 'undefined') {
        console.warn('[i18n] t() threw — returning [MISSING] marker:',
          err && err.message ? err.message : 'unknown');
      }
    } catch { /* don't even propagate from the warn */ }
    return `[MISSING:${key || 'unknown'}]`;
  }
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
