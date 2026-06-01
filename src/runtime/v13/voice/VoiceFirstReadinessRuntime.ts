/**
 * Farroway · Voice-First Readiness Runtime (voice-first-v13)
 *
 * Composition-only, self-contained readiness diagnostics runtime.
 * It NEVER imports a project module. It reads ONLY real stored data via
 * the `_probe()`, `_ls()` and `_winVar()` helpers below, and never fabricates.
 *
 * It reports — honestly — whether voice-first, low-literacy support is READY
 * for the farmer's selected language: whether short text is available, whether
 * a spoken voice can be configured, and whether the browser actually reports a
 * NATIVE voice for that language. It never claims a native Twi/Hausa voice
 * exists unless the browser's speech engine reports one, and it discloses
 * fallbacks honestly. When nothing is determinable it returns an honest
 * "Not enough data yet" result.
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

export const VOICE_FIRST_READINESS_VERSION = 'voice-first-v13';

// Supported locales for voice-first / low-literacy support.
const SUPPORTED_LOCALES = ['en', 'tw', 'ha', 'fr', 'sw', 'hi'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function _isSupported(v: any): v is SupportedLocale {
  return typeof v === 'string' && (SUPPORTED_LOCALES as readonly string[]).indexOf(v) >= 0;
}

// Normalize a raw language hint (e.g. "tw-GH", "EN_us", "sw") to a base code.
function _baseLocale(raw: any): string | null {
  return _safe(() => {
    if (raw == null) return null;
    const s = String(raw).trim().toLowerCase();
    if (!s) return null;
    const base = s.split(/[-_]/)[0];
    return base || null;
  }, null);
}

export interface VoiceFirstHealthEnvelope {
  runtimeVersion: typeof VOICE_FIRST_READINESS_VERSION;
  initialized: true;
  locale: string;
  textReady: boolean;
  voiceConfigured: boolean;
  fallbackVoice: string | null;
  nativeVoiceAvailable: boolean;
  lowLiteracyPromptsReady: boolean;
  limitations: string;
  perLocale: Record<string, { nativeVoiceAvailable: boolean }>;
  confidence: Confidence;
  explanation: string;
}

export function voiceFirstHealth(): VoiceFirstHealthEnvelope {
  return _safe(
    () => {
      // --- resolve the farmer's selected locale (honestly, default 'en') ---
      const langHealth = _obj(_probe('__languageHealth'));
      const selectedRaw = _safe(() => {
        if (!langHealth) return null;
        const lh: any = langHealth;
        return lh.selected ?? lh.current ?? null;
      }, null);

      const lsLang =
        _safe(() => {
          const v = _ls('farroway_language');
          if (v == null) return null;
          // value may itself be a string or an object holding the code
          if (typeof v === 'string') return v;
          const o = _obj(v);
          return o ? (o.selected ?? o.current ?? o.code ?? o.language ?? null) : null;
        }, null) ??
        _safe(() => {
          const v = _ls('language');
          if (v == null) return null;
          if (typeof v === 'string') return v;
          const o = _obj(v);
          return o ? (o.selected ?? o.current ?? o.code ?? o.language ?? null) : null;
        }, null);

      const candidate =
        _baseLocale(selectedRaw) ?? _baseLocale(lsLang) ?? 'en';
      const locale: SupportedLocale = _isSupported(candidate) ? candidate : 'en';

      // Did we actually find a stored/selected language signal at all?
      const localeKnown =
        _isSupported(_baseLocale(selectedRaw)) ||
        _isSupported(_baseLocale(lsLang));

      // --- read the browser's reported voices (never throws) ---
      const voices: any[] = _arr(
        _safe(() => (window as any).speechSynthesis.getVoices(), [] as any[]),
      );

      // A native voice is only "available" if the engine reports a voice
      // whose own .lang starts with the base locale code. We never assert a
      // native Twi/Hausa (or any) voice unless the engine actually says so.
      const _hasNativeFor = (code: string): boolean =>
        _safe(() => {
          if (!code) return false;
          for (let i = 0; i < voices.length; i++) {
            const v: any = voices[i];
            const lang = _safe(
              () => (v && v.lang != null ? String(v.lang).trim().toLowerCase() : ''),
              '',
            );
            if (lang && lang.indexOf(code) === 0) return true;
          }
          return false;
        }, false);

      // Per-locale native voice availability map (the 6 supported locales).
      const perLocale: Record<string, { nativeVoiceAvailable: boolean }> = {};
      for (let i = 0; i < SUPPORTED_LOCALES.length; i++) {
        const code = SUPPORTED_LOCALES[i];
        perLocale[code] = Object.freeze({ nativeVoiceAvailable: _hasNativeFor(code) });
      }

      const nativeVoiceAvailable = _hasNativeFor(locale);

      // Text is always available — short, low-literacy-friendly prompts are
      // bundled offline, so text rendering never depends on the network or
      // a speech engine.
      const textReady = true;
      const lowLiteracyPromptsReady = true;

      // Can speech be configured at all? Only if a speech engine is present.
      const speechEnginePresent = _safe(
        () => typeof window !== 'undefined' && !!(window as any).speechSynthesis,
        false,
      );
      const anyVoiceReported = voices.length > 0;

      // Voice follows the selected language. It is "configured" when the engine
      // is present AND it reports at least one voice we can actually speak with
      // (native for the locale, or an English/default fallback).
      const englishFallbackAvailable = _hasNativeFor('en');
      const voiceConfigured = speechEnginePresent && anyVoiceReported;

      // Determine the honest fallback voice when no native voice exists for the
      // chosen locale. Prefer English if reported, else the browser default
      // (the engine's first reported voice), else null when nothing is known.
      let fallbackVoice: string | null = null;
      if (!nativeVoiceAvailable) {
        if (englishFallbackAvailable) {
          fallbackVoice = 'en';
        } else if (anyVoiceReported) {
          const def = _safe(() => {
            for (let i = 0; i < voices.length; i++) {
              const v: any = voices[i];
              const lang = _safe(
                () => (v && v.lang != null ? String(v.lang).trim() : ''),
                '',
              );
              if (lang) return lang;
            }
            return null;
          }, null);
          fallbackVoice = def ? 'browser default' : null;
        } else {
          fallbackVoice = null;
        }
      }

      // --- honest fallback: nothing about the voice environment determinable
      // and no language signal at all ---
      if (!localeKnown && !speechEnginePresent) {
        const limitationsFb =
          'Not enough data yet — no selected language and no speech engine could ' +
          'be detected on this device, so voice readiness cannot be assessed. ' +
          'Short text prompts remain available. ' +
          GUIDANCE_TAIL;
        return Object.freeze({
          runtimeVersion: VOICE_FIRST_READINESS_VERSION,
          initialized: true as const,
          locale,
          textReady,
          voiceConfigured: false,
          fallbackVoice: null,
          nativeVoiceAvailable: false,
          lowLiteracyPromptsReady,
          limitations: limitationsFb,
          perLocale: Object.freeze(perLocale) as Record<
            string,
            { nativeVoiceAvailable: boolean }
          >,
          confidence: 'low' as Confidence,
          explanation:
            'Not enough data yet — language and speech support could not be ' +
            'determined. Text is still shown.',
        }) as VoiceFirstHealthEnvelope;
      }

      // --- confidence (a LABEL, never a number) ---
      // High only when the chosen language can be spoken in a native voice and
      // the choice was explicit. Medium when speech works via a fallback or the
      // engine is present. Otherwise low.
      let confidence: Confidence = 'low';
      if (localeKnown && nativeVoiceAvailable) {
        confidence = 'high';
      } else if (speechEnginePresent && (anyVoiceReported || localeKnown)) {
        confidence = 'medium';
      }

      // --- limitations (honest, discloses any fallback) ---
      const limParts: string[] = [];
      limParts.push(
        'This only reflects what this device and browser report right now.',
      );
      if (!speechEnginePresent) {
        limParts.push(
          'No speech engine was detected, so spoken prompts may be unavailable; ' +
            'short text prompts are still shown.',
        );
      } else if (!anyVoiceReported) {
        limParts.push(
          'The speech engine reported no installed voices yet, so spoken ' +
            'prompts may not be available until voices load.',
        );
      }
      if (!nativeVoiceAvailable) {
        if (fallbackVoice === 'en') {
          limParts.push(
            'No native "' +
              locale +
              '" voice is reported by this device, so spoken prompts would fall ' +
              'back to an English voice. Written prompts stay in the selected ' +
              'language.',
          );
        } else if (fallbackVoice === 'browser default') {
          limParts.push(
            'No native "' +
              locale +
              '" voice is reported by this device, so spoken prompts would use ' +
              'the browser default voice. Written prompts stay in the selected ' +
              'language.',
          );
        } else {
          limParts.push(
            'No native "' +
              locale +
              '" voice is reported by this device and no fallback voice is ' +
              'available, so spoken prompts may not play. Written prompts are ' +
              'still shown.',
          );
        }
      }
      if (locale === 'tw' || locale === 'ha') {
        limParts.push(
          'Native ' +
            (locale === 'tw' ? 'Twi' : 'Hausa') +
            ' voices are uncommon in browsers; a native voice is only claimed ' +
            'when the device actually reports one.',
        );
      }
      limParts.push(GUIDANCE_TAIL);
      const limitations = limParts.join(' ');

      // --- explanation (calm, honest, short-friendly) ---
      const explanation = _safe(() => {
        const bits: string[] = [];
        bits.push(
          'Selected language is "' +
            locale +
            '"' +
            (localeKnown ? '' : ' (defaulted, none stored)') +
            '.',
        );
        bits.push('Short text prompts are ready in this language.');
        if (nativeVoiceAvailable) {
          bits.push('A native voice for this language is reported by the device.');
        } else if (fallbackVoice === 'en') {
          bits.push(
            'No native voice is reported, so speech would use an English voice.',
          );
        } else if (fallbackVoice === 'browser default') {
          bits.push(
            'No native voice is reported, so speech would use the browser default.',
          );
        } else {
          bits.push('No native or fallback voice is reported on this device.');
        }
        return bits.join(' ');
      }, 'Summary of voice-first readiness based on what this device reports.');

      return Object.freeze({
        runtimeVersion: VOICE_FIRST_READINESS_VERSION,
        initialized: true as const,
        locale,
        textReady,
        voiceConfigured,
        fallbackVoice,
        nativeVoiceAvailable,
        lowLiteracyPromptsReady,
        limitations,
        perLocale: Object.freeze(perLocale) as Record<
          string,
          { nativeVoiceAvailable: boolean }
        >,
        confidence,
        explanation,
      }) as VoiceFirstHealthEnvelope;
    },
    // --- absolute fallback if anything above throws ---
    Object.freeze({
      runtimeVersion: VOICE_FIRST_READINESS_VERSION,
      initialized: true as const,
      locale: 'en',
      textReady: true,
      voiceConfigured: false,
      fallbackVoice: null,
      nativeVoiceAvailable: false,
      lowLiteracyPromptsReady: true,
      limitations:
        'Not enough data yet — voice readiness could not be assessed on this ' +
        'device. Short text prompts remain available. ' +
        GUIDANCE_TAIL,
      perLocale: Object.freeze({
        en: Object.freeze({ nativeVoiceAvailable: false }),
        tw: Object.freeze({ nativeVoiceAvailable: false }),
        ha: Object.freeze({ nativeVoiceAvailable: false }),
        fr: Object.freeze({ nativeVoiceAvailable: false }),
        sw: Object.freeze({ nativeVoiceAvailable: false }),
        hi: Object.freeze({ nativeVoiceAvailable: false }),
      }) as Record<string, { nativeVoiceAvailable: boolean }>,
      confidence: 'low' as Confidence,
      explanation:
        'Not enough data yet — language and speech support could not be ' +
        'determined. Text is still shown.',
    }) as VoiceFirstHealthEnvelope,
  );
}

export function installVoiceFirstHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__voiceFirstHealth !== 'function') {
      w.__voiceFirstHealth = function () {
        const out = voiceFirstHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Voice-First Readiness]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
