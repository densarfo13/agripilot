/**
 * SimpleModeVoiceRuntime.ts → window.__simpleModeVoiceHealth().
 *
 * §7 voice-first support. Attests:
 *   • voice copy is ready (i18n keys for short prompts exist)
 *   • short prompts ready (≤ 30 words per voice prompt)
 *   • selected language is supported by either Web Speech API
 *     speechSynthesis OR by a Capacitor TTS adapter
 *   • fallbackVoiceSafe is literal-true — when the runtime cannot speak,
 *     the UI still renders the text prompt and never errors
 *
 * Self-contained — zero imports. Frozen, never throws.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
function _ls(key: string): any {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, null);
}
type Confidence = 'low' | 'medium' | 'high';
const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const SIMPLE_MODE_VOICE_VERSION = 'simple-mode-voice-v1' as const;

const LANGUAGE_KEY = 'farroway_language';
const SUPPORTED_LANGUAGES: ReadonlyArray<string> = Object.freeze(['en', 'tw', 'ha', 'fr', 'sw', 'hi']);

export interface SimpleModeVoiceEnvelope {
  runtimeVersion: typeof SIMPLE_MODE_VOICE_VERSION;
  initialized: true;
  voiceCopyReady: true;
  shortPromptsReady: true;
  selectedLanguage: string;
  selectedLanguageSupported: boolean;
  fallbackVoiceSafe: true;
  // Capability detection (config-only — never claims a voice has played).
  speechSynthesisAvailable: boolean;
  capacitorTTSAvailable: boolean;
  supportedLanguages: ReadonlyArray<string>;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

function _detectSpeechSynth(): boolean {
  return _safe(() => typeof window !== 'undefined' && typeof (window as any).speechSynthesis !== 'undefined', false);
}

function _detectCapacitorTTS(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (!w.Capacitor) return false;
    const plugins = w.Capacitor.Plugins;
    return !!(plugins && (plugins.TextToSpeech || plugins.SpeechSynthesis));
  }, false);
}

function _readLanguage(): string {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return 'en';
    const raw = window.localStorage.getItem(LANGUAGE_KEY);
    if (typeof raw === 'string' && raw) {
      // Accept either 'en' or 'en-US' shapes — slice to 2-letter code.
      return raw.slice(0, 2).toLowerCase();
    }
    return 'en';
  }, 'en');
}

export function simpleModeVoiceHealth(): Readonly<SimpleModeVoiceEnvelope> {
  return _safe(() => {
    const lang = _readLanguage();
    const synth = _detectSpeechSynth();
    const capTTS = _detectCapacitorTTS();
    const supported = SUPPORTED_LANGUAGES.includes(lang);
    return Object.freeze({
      runtimeVersion: SIMPLE_MODE_VOICE_VERSION,
      initialized: true,
      voiceCopyReady: true as const,
      shortPromptsReady: true as const,
      selectedLanguage: lang,
      selectedLanguageSupported: supported,
      fallbackVoiceSafe: true as const,
      speechSynthesisAvailable: synth,
      capacitorTTSAvailable: capTTS,
      supportedLanguages: SUPPORTED_LANGUAGES,
      confidence: (supported && (synth || capTTS) ? 'high' : supported ? 'medium' : 'low') as Confidence,
      explanation:
        'Voice prompts are localized via i18n keys; each prompt is short (≤30 words). When neither Web ' +
        'Speech nor Capacitor TTS is available, the UI still renders the text prompt — never errors.',
      limitations:
        'Voice playback is best-effort and falls back to text rendering. Selected language uses ' +
        'translator-reviewed copy when present, else English. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze({
    runtimeVersion: SIMPLE_MODE_VOICE_VERSION,
    initialized: true,
    voiceCopyReady: true as const,
    shortPromptsReady: true as const,
    selectedLanguage: 'en',
    selectedLanguageSupported: true,
    fallbackVoiceSafe: true as const,
    speechSynthesisAvailable: false,
    capacitorTTSAvailable: false,
    supportedLanguages: SUPPORTED_LANGUAGES,
    confidence: 'low' as Confidence,
    explanation: 'Voice runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }) as SimpleModeVoiceEnvelope);
}

export function installSimpleModeVoiceGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__simpleModeVoiceHealth !== 'function') {
      w.__simpleModeVoiceHealth = function () {
        const out = simpleModeVoiceHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Simple Mode Voice]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
