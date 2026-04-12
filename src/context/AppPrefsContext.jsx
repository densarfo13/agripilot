import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getPreference, savePreference } from '../lib/offlineDb.js';

const AppPrefsContext = createContext(null);

export function AppPrefsProvider({ children }) {
  const [language, setLanguageState] = useState('en');
  const [autoVoice, setAutoVoiceState] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      getPreference('language'),
      getPreference('autoVoice'),
    ])
      .then(([savedLanguage, savedAutoVoice]) => {
        if (savedLanguage) setLanguageState(savedLanguage);
        if (savedAutoVoice !== null) setAutoVoiceState(!!savedAutoVoice);
      })
      .finally(() => setPrefsLoaded(true));
  }, []);

  async function setLanguage(languageCode) {
    setLanguageState(languageCode);
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
