import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getPreference, savePreference } from '../lib/offlineDb.js';
import { setLanguage as setI18nLanguage, getLanguage as getI18nLanguage } from '../i18n/index.js';

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
    setLanguageState(languageCode);
    // Sync the i18n system — updates localStorage + dispatches farroway:langchange
    // so ALL useTranslation() hooks re-render with the new language
    setI18nLanguage(languageCode);
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
