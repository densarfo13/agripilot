/**
 * AppSettingsContext — single source of truth for language + region,
 * layered on top of the existing resolver modules so legacy callers
 * keep working.
 *
 * Exposes:
 *   language   — 'en' | 'hi' | 'tw' | (legacy 'fr'|'sw'|'ha')
 *   region     — { country, stateCode, source }
 *   setLanguage(code)
 *   setRegion({ country, stateCode })
 *   t(key, vars?) — bound translator for the active language
 *
 * Region is tracked INDEPENDENTLY of language so a Hindi UI can
 * run against Maryland agronomy, or English UI against Ghana.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  resolveLanguage, confirmLanguage, SUPPORTED_LANGUAGES,
} from '../lib/languageResolver.js';
import { resolveRegion, confirmRegion } from '../lib/regionResolver.js';
import { t as rawT } from '../i18n/index.js';

const AppSettingsContext = createContext(null);

export function AppSettingsProvider({ children }) {
  const [language, setLanguageState] = useState(() => resolveLanguage());
  const [region, setRegionState] = useState(() => resolveRegion());

  // Re-read from storage whenever another tab / component fires the
  // resolver events. Keeps the context coherent across the tree.
  useEffect(() => {
    const onLang = (e) => setLanguageState(e?.detail || resolveLanguage());
    const onRegion = () => setRegionState(resolveRegion());
    window.addEventListener('farroway:langchange', onLang);
    window.addEventListener('farroway:regionchange', onRegion);
    return () => {
      window.removeEventListener('farroway:langchange', onLang);
      window.removeEventListener('farroway:regionchange', onRegion);
    };
  }, []);

  const setLanguage = useCallback((code) => {
    if (confirmLanguage(code)) setLanguageState(code);
  }, []);

  const setRegion = useCallback(({ country, stateCode } = {}) => {
    if (confirmRegion({ country, stateCode })) {
      setRegionState({ country, stateCode: stateCode || null, source: 'manual' });
    }
  }, []);

  const t = useCallback((key, vars) => rawT(key, language, vars), [language]);

  const value = useMemo(() => ({
    language,
    region,
    setLanguage,
    setRegion,
    t,
    languages: SUPPORTED_LANGUAGES,
  }), [language, region, setLanguage, setRegion, t]);

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) {
    throw new Error('useAppSettings must be used inside <AppSettingsProvider>');
  }
  return ctx;
}
