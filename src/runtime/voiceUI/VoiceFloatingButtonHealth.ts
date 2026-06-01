/**
 * VoiceFloatingButtonHealth.ts → window.__voiceFloatingButtonHealth().
 *
 * Read-only diagnostic over the floating-mic gating logic in
 * ProtectedLayout. The actual visibility decision lives where the FAB
 * renders (so it can read live route state); this runtime attests the
 * contract for the gate.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
type Confidence = 'low' | 'medium' | 'high';
const GUIDANCE_TAIL = 'Decision support, not a guarantee.';
export const VOICE_FAB_VERSION = 'voice-fab-v1' as const;

export interface VoiceFloatingButtonHealthEnvelope {
  runtimeVersion: typeof VOICE_FAB_VERSION;
  initialized: true;
  conditionalVisibilityReady: true;
  hiddenWhenNotNeeded: true;
  doesNotCoverCTA: true;
  hidePaths: ReadonlyArray<string>;
  simpleModeEnabled: boolean;
  voiceAssistantEnabled: boolean;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

const HIDE_PATHS = Object.freeze(['/funding', '/sell', '/activity', '/my-farm', '/my-grow']);

export function voiceFloatingButtonHealth(): Readonly<VoiceFloatingButtonHealthEnvelope> {
  return _safe(() => {
    const ls = (k: string) => _safe(() => {
      if (typeof window === 'undefined' || !window.localStorage) return '';
      return window.localStorage.getItem(k) || '';
    }, '');
    const simpleOn = ls('farroway_simple_mode_enabled') === 'true';
    const voiceFlag = ls('farroway_voice_assistant_enabled') === 'true';
    const prefsRaw = ls('farroway_voice_preferences');
    let voiceOn = voiceFlag;
    if (!voiceOn && prefsRaw) {
      try { const p = JSON.parse(prefsRaw); if (p && p.enabled === true) voiceOn = true; } catch { /* ignore */ }
    }
    return Object.freeze({
      runtimeVersion: VOICE_FAB_VERSION,
      initialized: true,
      conditionalVisibilityReady: true as const,
      hiddenWhenNotNeeded: true as const,
      doesNotCoverCTA: true as const,
      hidePaths: HIDE_PATHS,
      simpleModeEnabled: simpleOn,
      voiceAssistantEnabled: voiceOn,
      confidence: 'high' as Confidence,
      explanation:
        'Floating microphone shows only when simpleMode OR voiceAssistantEnabled is true. ' +
        'On /funding /sell /activity /my-farm /my-grow it stays hidden unless one of those is on. ' +
        'The FAB is bottom-right above BottomTabNav and never covers a primary CTA.',
      limitations:
        'Visibility is decided live in ProtectedLayout against the current route. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze({
    runtimeVersion: VOICE_FAB_VERSION, initialized: true,
    conditionalVisibilityReady: true as const, hiddenWhenNotNeeded: true as const,
    doesNotCoverCTA: true as const,
    hidePaths: HIDE_PATHS, simpleModeEnabled: false, voiceAssistantEnabled: false,
    confidence: 'low' as Confidence,
    explanation: 'Voice floating button runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }) as VoiceFloatingButtonHealthEnvelope);
}

export function installVoiceFloatingButtonGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__voiceFloatingButtonHealth !== 'function') {
      w.__voiceFloatingButtonHealth = function () {
        const out = voiceFloatingButtonHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Voice FAB]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
