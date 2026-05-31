/**
 * Farroway · Voice Assistant Readiness (voice-assistant-readiness-v1)
 *
 * Composition-only, self-contained decision-support runtime.
 * It NEVER imports a project module. It reads ONLY real stored data via the
 * `_probe()` / `_ls()` / `_winVar()` helpers below, and never fabricates a
 * voice that the browser does not actually report.
 *
 * It reports, honestly, whether a usable speech voice exists for the farmer's
 * selected language — and, when no NATIVE voice is present (common for Twi or
 * Hausa), it discloses the fallback voice rather than pretending one exists.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

function _ls(key: string): any {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return null;
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : null;
  }, null);
}

// --- internal pure helpers (never throw) ---------------------------------

function _arr(v: any): any[] {
  return Array.isArray(v) ? v : [];
}

function _obj(v: any): any {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

function _winVar(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    return (window as any)[name] ?? null;
  }, null);
}

type Confidence = 'low' | 'medium' | 'high';

const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const VOICE_ASSISTANT_READINESS_VERSION = 'voice-assistant-readiness-v1';

// Supported language codes for the voice assistant.
const SUPPORTED_LANGUAGES = ['en', 'tw', 'ha', 'fr', 'sw', 'hi'] as const;

export interface VoiceAssistantPerLanguage {
  nativeVoiceConfigured: boolean;
}

export interface VoiceAssistantEnvelope {
  runtimeVersion: 'voice-assistant-readiness-v1';
  initialized: true;
  selectedLanguage: string;
  voiceAvailable: boolean;
  fallbackVoice: string | null;
  lowLiteracyPromptsReady: boolean;
  nativeVoiceConfigured: boolean;
  limitations: string;
  perLanguage: Record<string, VoiceAssistantPerLanguage>;
  confidence: Confidence;
  dataSources: string[];
  explanation: string;
}

// --- detect the selected language (real, defensively) --------------------

function _selectedLanguage(): string {
  return _safe(() => {
    const lh = _obj(_probe('__languageHealth'));
    let raw: any = null;
    if (lh) {
      raw =
        lh.selectedLanguage ??
        lh.currentLanguage ??
        lh.activeLanguage ??
        lh.current ??
        lh.selected ??
        null;
    }
    if (raw == null) {
      raw =
        _ls('farroway_language') ??
        _ls('language') ??
        null;
    }
    if (raw == null) return 'en';
    const code = String(raw).trim().toLowerCase().slice(0, 2);
    return SUPPORTED_LANGUAGES.indexOf(code as any) >= 0 ? code : 'en';
  }, 'en');
}

// --- read the REAL list of speech voices the browser reports -------------

function _voiceLangs(): string[] {
  return _safe(() => {
    if (typeof window === 'undefined') return [];
    const w = window as any;
    if (!w.speechSynthesis || typeof w.speechSynthesis.getVoices !== 'function')
      return [];
    const voices = _safe(() => w.speechSynthesis.getVoices(), []);
    const out: string[] = [];
    for (let i = 0; i < _arr(voices).length; i++) {
      const v: any = voices[i];
      const lang = _safe(() => {
        const l = v && (v.lang ?? v.language ?? null);
        return l != null && String(l).trim() ? String(l).trim().toLowerCase() : null;
      }, null);
      if (lang) out.push(lang);
    }
    return out;
  }, []);
}

function _hasNativeVoice(code: string, voiceLangs: string[]): boolean {
  return _safe(() => {
    const c = String(code).toLowerCase();
    for (let i = 0; i < voiceLangs.length; i++) {
      if (voiceLangs[i].indexOf(c) === 0) return true;
    }
    return false;
  }, false);
}

export function voiceAssistantHealth(): VoiceAssistantEnvelope {
  return _safe(
    () => {
      const speechSynthesisPresent = _safe(
        () =>
          typeof window !== 'undefined' &&
          !!(window as any).speechSynthesis &&
          typeof (window as any).speechSynthesis.getVoices === 'function',
        false,
      );

      const selectedLanguage = _selectedLanguage();
      const voiceLangs = _voiceLangs();
      const anyVoiceReported = voiceLangs.length > 0;

      // --- real per-language native readiness ---
      const perLanguage: Record<string, VoiceAssistantPerLanguage> = {};
      for (let i = 0; i < SUPPORTED_LANGUAGES.length; i++) {
        const code = SUPPORTED_LANGUAGES[i];
        perLanguage[code] = Object.freeze({
          nativeVoiceConfigured: _hasNativeVoice(code, voiceLangs),
        });
      }

      // --- native voice for the SELECTED language (no pretending) ---
      const nativeVoiceConfigured = _hasNativeVoice(selectedLanguage, voiceLangs);

      // Fallback follows English (or the browser default) when the selected
      // language has no native voice but other voices do exist.
      const englishNative = _hasNativeVoice('en', voiceLangs);
      const fallbackVoice: string | null = nativeVoiceConfigured
        ? null
        : anyVoiceReported
          ? englishNative
            ? 'en'
            : 'browser-default'
          : null;

      // A usable voice exists if a native voice for the selected language is
      // present, OR any fallback voice is available.
      const voiceAvailable = nativeVoiceConfigured || fallbackVoice != null;

      // Low-literacy prompts ride on the selected language being usable in some
      // form (native or fallback) so prompts can actually be spoken aloud.
      const lowLiteracyPromptsReady = voiceAvailable;

      // --- honest data sources (only what we actually observed) ---
      const dataSources: string[] = [];
      if (_probe('__languageHealth')) dataSources.push('__languageHealth');
      if (_ls('farroway_language')) dataSources.push('farroway_language');
      if (_ls('language')) dataSources.push('language');
      if (speechSynthesisPresent) dataSources.push('window.speechSynthesis');

      // --- honest fallback: nothing at all could be determined ---
      if (!speechSynthesisPresent && !anyVoiceReported) {
        return Object.freeze({
          runtimeVersion: VOICE_ASSISTANT_READINESS_VERSION,
          initialized: true as const,
          selectedLanguage,
          voiceAvailable: false,
          fallbackVoice: null,
          lowLiteracyPromptsReady: false,
          nativeVoiceConfigured: false,
          limitations:
            'Not enough data yet — this device has not reported any speech ' +
            'voices, so voice readiness cannot be checked. Voice support ' +
            'depends on the device and browser, and may differ elsewhere. ' +
            GUIDANCE_TAIL,
          perLanguage: Object.freeze(perLanguage) as Record<
            string,
            VoiceAssistantPerLanguage
          >,
          confidence: 'low' as Confidence,
          dataSources: Object.freeze(dataSources) as unknown as string[],
          explanation: 'Not enough data yet',
        }) as VoiceAssistantEnvelope;
      }

      // --- limitations (honest, disclose fallback when native is missing) ---
      let limitations =
        'Voice support depends on the voices this device and browser actually ' +
        'provide, and may differ on other devices. ';
      if (!nativeVoiceConfigured) {
        if (fallbackVoice != null) {
          limitations +=
            'No native voice for the selected language (' +
            selectedLanguage +
            ') was found on this device, so prompts would likely use a ' +
            'fallback voice (' +
            fallbackVoice +
            '). Pronunciation may not match the language. ';
        } else {
          limitations +=
            'No native voice for the selected language (' +
            selectedLanguage +
            ') and no fallback voice were found on this device, so spoken ' +
            'prompts may be unavailable here. ';
        }
      }
      limitations += GUIDANCE_TAIL;

      // --- confidence is a LABEL, never a number ---
      const confidence: Confidence = nativeVoiceConfigured
        ? 'high'
        : voiceAvailable
          ? 'medium'
          : 'low';

      // --- explanation (safe wording only) ---
      let explanation: string;
      if (nativeVoiceConfigured) {
        explanation =
          'A native voice for the selected language (' +
          selectedLanguage +
          ') is available on this device, so spoken prompts are likely ready.';
      } else if (voiceAvailable) {
        explanation =
          'No native voice for the selected language (' +
          selectedLanguage +
          ') was found, so a fallback voice (' +
          fallbackVoice +
          ') would likely be used for spoken prompts. Watch for pronunciation ' +
          'that may not match the language.';
      } else {
        explanation =
          'No usable voice was found for the selected language (' +
          selectedLanguage +
          ') on this device. Spoken prompts may be unavailable here.';
      }

      return Object.freeze({
        runtimeVersion: VOICE_ASSISTANT_READINESS_VERSION,
        initialized: true as const,
        selectedLanguage,
        voiceAvailable,
        fallbackVoice,
        lowLiteracyPromptsReady,
        nativeVoiceConfigured,
        limitations,
        perLanguage: Object.freeze(perLanguage) as Record<
          string,
          VoiceAssistantPerLanguage
        >,
        confidence,
        dataSources: Object.freeze(dataSources) as unknown as string[],
        explanation,
      }) as VoiceAssistantEnvelope;
    },
    // --- absolute fallback if anything above throws ---
    Object.freeze({
      runtimeVersion: VOICE_ASSISTANT_READINESS_VERSION,
      initialized: true as const,
      selectedLanguage: 'en',
      voiceAvailable: false,
      fallbackVoice: null,
      lowLiteracyPromptsReady: false,
      nativeVoiceConfigured: false,
      limitations:
        'Not enough data yet — voice readiness could not be checked on this ' +
        'device. Voice support depends on the device and browser, and may ' +
        'differ elsewhere. ' +
        GUIDANCE_TAIL,
      perLanguage: Object.freeze({
        en: Object.freeze({ nativeVoiceConfigured: false }),
        tw: Object.freeze({ nativeVoiceConfigured: false }),
        ha: Object.freeze({ nativeVoiceConfigured: false }),
        fr: Object.freeze({ nativeVoiceConfigured: false }),
        sw: Object.freeze({ nativeVoiceConfigured: false }),
        hi: Object.freeze({ nativeVoiceConfigured: false }),
      }) as Record<string, VoiceAssistantPerLanguage>,
      confidence: 'low' as Confidence,
      dataSources: Object.freeze([]) as unknown as string[],
      explanation: 'Not enough data yet',
    }) as VoiceAssistantEnvelope,
  );
}

export function installVoiceAssistantHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__voiceAssistantHealth !== 'function') {
      w.__voiceAssistantHealth = function () {
        const out = voiceAssistantHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Voice Assistant Readiness]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
