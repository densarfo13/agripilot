/**
 * i18next.js — react-i18next bootstrap for Farroway's JSON-driven
 * locale namespace.
 *
 * This is the new JSON translation system described in spec §2–8.
 * It lives alongside the legacy `src/i18n/index.js` custom engine
 * (which powers dozens of existing screens via its own
 * useTranslation hook). Both systems can coexist because they use
 * different storage keys and different hooks:
 *
 *   • Legacy engine  → `src/i18n/index.js`  → storage: 'farroway:lang'
 *     hook: `import { useTranslation } from '../i18n/index.js'`
 *
 *   • New i18next    → this file            → storage: 'farroway_language'
 *     hook: `import { useTranslation } from 'react-i18next'`
 *
 * The two language-picker helpers (setLanguageI18n + the legacy
 * setLanguage) mirror each other so flipping the language in either
 * UI updates both systems.
 *
 * NOTE: spec §8 asked for `src/i18n/index.ts`. A file at
 * `src/i18n/index.js` already exists and is imported by ~100 screens
 * — renaming it would mean a cross-project rewrite. This file takes
 * the same bootstrap content as the spec's `index.ts` and is
 * imported by `main.jsx` as `./i18n/i18next`; every other behaviour
 * matches the spec exactly.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import tw from './locales/tw.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import pt from './locales/pt.json';
import sw from './locales/sw.json';

function readSavedLanguage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return 'en';
    return (
      window.localStorage.getItem('farroway_language')
      || window.localStorage.getItem('farroway:lang')   // legacy mirror
      || 'en'
    );
  } catch { return 'en'; }
}

const savedLanguage = readSavedLanguage();

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    tw: { translation: tw },
    fr: { translation: fr },
    es: { translation: es },
    pt: { translation: pt },
    sw: { translation: sw },
  },
  lng: savedLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
  returnEmptyString: false,
});

// Keep the i18next runtime in sync when the legacy engine broadcasts
// a language change (e.g. someone used the legacy LanguageSwitcher
// on an auth screen).
if (typeof window !== 'undefined') {
  window.addEventListener('farroway:langchange', (e) => {
    const next = e && e.detail;
    if (next && typeof next === 'string' && i18n.language !== next) {
      i18n.changeLanguage(next);
    }
  });
}

export default i18n;
