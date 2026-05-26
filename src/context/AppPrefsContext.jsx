import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getPreference, savePreference } from '../lib/offlineDb.js';
import { setLanguage as setI18nLanguage, getLanguage as getI18nLanguage } from '../i18n/index.js';
// Production-rebuild Phase 7: atomic locale switch preloads the
// target locale's column chunk BEFORE flipping htmlLang + the
// langchange event, so the UI never shows a partially-translated
// frame. The legacy setI18nLanguage stays as the boot-time
// synchronous path (we don't want to block first paint waiting
// on a chunk fetch); user-initiated switches go through atomic.
import { setLanguageAtomic } from '../i18n/atomicLocaleSwitch.js';

const AppPrefsContext = createContext(null);

export function AppPrefsProvider({ children }) {
  // Initialize from the i18n system's persisted value (localStorage) for consistency
  const [language, setLanguageState] = useState(() => getI18nLanguage());
  const [autoVoice, setAutoVoiceState] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      getPreference('language'),
      getPreference('autoVoice'),
    ])
      .then(([savedLanguage, savedAutoVoice]) => {
        if (savedLanguage) {
          setLanguageState(savedLanguage);
          // Sync i18n system so useTranslation() hooks pick up the stored language
          setI18nLanguage(savedLanguage);
        }
        if (savedAutoVoice !== null) setAutoVoiceState(!!savedAutoVoice);
      })
      .finally(() => setPrefsLoaded(true));
  }, []);

  async function setLanguage(languageCode) {
    // Optimistic state update — keeps the picker feeling instant.
    setLanguageState(languageCode);
    // Atomic switch — awaits the column chunk before flipping
    // htmlLang + dispatching farroway:langchange. Eliminates the
    // 1-3 s "partial English" window on cold-cache locale changes.
    // Falls back to the legacy synchronous path on failure so a
    // network stall can't permanently strand the user.
    try {
      const result = await setLanguageAtomic(languageCode);
      if (!result || result.ok === false) {
        // Last-resort legacy path so the user isn't stuck if the
        // atomic switch failed for any non-network reason.
        try { setI18nLanguage(languageCode); } catch { /* swallow */ }
      }
    } catch {
      try { setI18nLanguage(languageCode); } catch { /* swallow */ }
    }
    await savePreference('language', languageCode);
  }

  async function setAutoVoice(value) {
    setAutoVoiceState(value);
    await savePreference('autoVoice', value);
  }

  const value = useMemo(
    () => ({ language, autoVoice, prefsLoaded, setLanguage, setAutoVoice }),
    [language, autoVoice, prefsLoaded],
  );

  return <AppPrefsContext.Provider value={value}>{children}</AppPrefsContext.Provider>;
}

export function useAppPrefs() {
  const context = useContext(AppPrefsContext);
  if (!context) throw new Error('useAppPrefs must be used within AppPrefsProvider');
  return context;
}
