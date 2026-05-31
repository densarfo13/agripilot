/**
 * src/i18n/voiceLanguageRuntime.js — voice/text language alignment.
 *
 *   window.__voiceLanguageHealth()
 *
 * Voice playback follows the selected TEXT language by default. If a
 * native voice for the locale isn't available in the browser's
 * speechSynthesis, we report it honestly + a fallback locale — we do
 * NOT pretend a native Twi/Hausa voice exists when it doesn't.
 *
 * Strict-rule audit
 *   • SSR-safe. Never throws. Read-only probe (no narration here).
 */

import { getCurrentLanguage } from './languageStore.js';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

// BCP-47 hints for the speechSynthesis voice lookup.
const BCP47 = Object.freeze({
  en: 'en', tw: 'ak', ha: 'ha', fr: 'fr', sw: 'sw', hi: 'hi',
});

function _voicesForLocale(locale) {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis
        || typeof window.speechSynthesis.getVoices !== 'function') return [];
    const want = (BCP47[locale] || locale || 'en').toLowerCase();
    const voices = window.speechSynthesis.getVoices() || [];
    return voices.filter((v) => {
      const lang = String(v && v.lang ? v.lang : '').toLowerCase();
      return lang === want || lang.startsWith(want + '-');
    });
  }, []);
}

export function voiceLanguageHealth() {
  return _safe(() => {
    const textLang = getCurrentLanguage();
    // Voice follows text by default; legacy voice key can override.
    const voiceLang = _safe(() => {
      const raw = typeof localStorage !== 'undefined'
        ? (localStorage.getItem('farroway:voiceLang') || localStorage.getItem('farroway:lang')) : null;
      return raw || textLang;
    }, textLang);
    const nativeVoices = _voicesForLocale(textLang);
    const voiceAvailableForLocale = nativeVoices.length > 0;
    return Object.freeze({
      runtimeVersion:        'voice-language-v1',
      selectedTextLanguage:  textLang,
      selectedVoiceLanguage: voiceLang,
      aligned:               voiceLang === textLang,
      voiceAvailableForLocale,
      // Honest: when no native voice, the app should surface a notice
      // and fall back to English audio rather than fake the locale.
      fallbackVoiceLocale:   voiceAvailableForLocale ? null : 'en',
    });
  }, Object.freeze({
    runtimeVersion: 'voice-language-v1',
    selectedTextLanguage: 'en', selectedVoiceLanguage: 'en',
    aligned: true, voiceAvailableForLocale: false, fallbackVoiceLocale: 'en',
  }));
}

export function installVoiceLanguageGlobal() {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window;
    if (typeof w.__voiceLanguageHealth !== 'function') {
      w.__voiceLanguageHealth = function () {
        const out = voiceLanguageHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Voice Language]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
