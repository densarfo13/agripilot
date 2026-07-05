/**
 * src/i18n/LanguageProvider.jsx — optional context wrapper exposing
 * the single language source to a subtree. Most call sites use the
 * useLanguage() hook directly; this provider is for trees that want
 * the value via context without each leaf subscribing.
 *
 * It does NOT own state beyond mirroring useLanguage() — the canonical
 * resolver (i18n/index.js) remains the single source of truth.
 *
 * SSR-safe; never throws.
 */

import React, { createContext, useContext } from 'react';
import useLanguage from './useLanguage.js';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const value = useLanguage();
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

/** Read the language value from context, falling back to the hook. */
export function useLanguageContext() {
  // Both hooks run unconditionally — `ctx || useLanguage()` short-circuited the hook
  // call, corrupting hook order whenever ctx presence changed between renders.
  const ctx = useContext(LanguageContext);
  const hookValue = useLanguage();
  return ctx || hookValue;
}

export default LanguageProvider;
