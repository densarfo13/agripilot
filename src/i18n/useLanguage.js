/**
 * src/i18n/useLanguage.js — the single hook every surface uses to
 * read/set the active language. Re-renders on farroway:langchange.
 *
 *   const { language, setLanguage, source, supported } = useLanguage();
 *
 * Composes languageStore (which composes the canonical resolver), so
 * there is ONE source of truth. SSR-safe; never throws.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  getCurrentLanguage, setCurrentLanguage, subscribeLanguage,
  languageSource, SUPPORTED,
} from './languageStore.js';

export default function useLanguage() {
  const [language, setLang] = useState(() => {
    try { return getCurrentLanguage(); } catch { return 'en'; }
  });

  useEffect(() => {
    const unsub = subscribeLanguage((next) => setLang(next));
    // Re-sync on mount in case the language changed before subscribe.
    try { setLang(getCurrentLanguage()); } catch { /* swallow */ }
    return unsub;
  }, []);

  const setLanguage = useCallback((code) => {
    try { return setCurrentLanguage(code); } catch { return false; }
  }, []);

  return {
    language,
    setLanguage,
    source: (() => { try { return languageSource(); } catch { return 'default'; } })(),
    supported: SUPPORTED,
    fallbackLanguage: 'en',
  };
}

export { useLanguage };
