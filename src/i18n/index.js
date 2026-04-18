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

/** Persist language to all storage keys (so VoiceBar reads the same value). */
export function setLanguage(code) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
    localStorage.setItem(LEGACY_VOICE_KEY, code); // keeps voice aligned
    localStorage.setItem(LEGACY_UI_KEY, code);     // keeps legacy i18n aligned
  } catch { /* quota exceeded — no-op */ }
  // Dispatch custom event so every useTranslation hook picks it up
  window.dispatchEvent(new CustomEvent('farroway:langchange', { detail: code }));
}

/**
 * Translate a key.
 *
 * @param {string} key     — dot-notation key, e.g. 'home.startSeason'
 * @param {string} lang    — language code, e.g. 'sw'
 * @param {object} [vars]  — interpolation variables, e.g. { days: 5 }
 * @returns {string}
 */
export function t(key, lang, vars) {
  if (!key) return '';
  const entry = T[key];
  const isDev = typeof import.meta !== 'undefined' ? import.meta.env?.DEV : process.env.NODE_ENV === 'development';
  if (!entry) {
    if (isDev) {
      console.warn(`[i18n] Missing key: "${key}"`);
    }
    return ''; // never leak raw keys to UI
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
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}

let _warnedFallbacks = null;

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

  const boundT = useCallback((key, vars) => t(key, lang, vars), [lang]);

  return { t: boundT, lang, setLang, languages: LANGUAGES };
}
