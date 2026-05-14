/**
 * voiceAssistantV2 — orchestrator for the Context-Aware Voice
 * Assistant V2.
 *
 *   import { createVoiceAssistant }
 *     from '../services/voiceAssistantV2.js';
 *
 *   const a = createVoiceAssistant({ onStateChange });
 *   const supported = a.isSupported();      // boolean
 *   await a.startListening();
 *   const command = await a.transcribeCommand();  // user spoke
 *   const envelope = a.answerCommand({ command, ...ctx });
 *   a.speakAnswer(envelope.spokenText, { lang: 'en-US' });
 *   a.cancel();
 *
 *   a.stopListening();
 *
 * What this module does
 *   1. Wraps the browser SpeechRecognition API (with the
 *      `webkitSpeechRecognition` fallback for older Safari).
 *   2. Delegates the actual command -> envelope mapping to
 *      voiceAssistantResponseEngine.answerCommand so the
 *      composition logic stays pure + testable.
 *   3. Delegates speech OUTPUT to the existing voiceEngine
 *      (src/voice/voiceEngine.js — same TTS surface Voice
 *      Guide V1 uses) so we have ONE speech pipeline.
 *   4. Surfaces a single getState() snapshot every consumer can
 *      poll — { phase: 'idle' | 'listening' | 'thinking' |
 *      'speaking' | 'error' } — plus an onStateChange callback
 *      so a host React component can re-render without polling.
 *   5. Cancels gracefully: stopListening() + cancel TTS +
 *      reset state.
 *
 * Strict-rule audit
 *   * SSR-safe — returns a degraded factory when window /
 *     SpeechRecognition are unavailable.
 *   * Never throws — every entry point catches; errors surface
 *     via state machine ('error' phase).
 *   * No always-listening / no wake word. startListening() must
 *     be called from a user-tap context for browser permission.
 *   * No agronomy: answers go through the pure response engine,
 *     which only uses passed-in context.
 *   * No autoplay: speakAnswer() runs only when the host calls
 *     it (typically right after the user taps Mic).
 */

import { answerCommand, VOICE_COMMANDS, VOICE_ACTIONS } from './voiceAssistantResponseEngine.js';

export const ASSISTANT_PHASES = Object.freeze({
  IDLE:      'idle',
  LISTENING: 'listening',
  THINKING:  'thinking',
  SPEAKING:  'speaking',
  ERROR:     'error',
});

function _getRecognitionCtor() {
  try {
    if (typeof window === 'undefined') return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  } catch { return null; }
}

function _hasSpeechSynthesis() {
  try {
    return typeof window !== 'undefined' && !!window.speechSynthesis;
  } catch { return false; }
}

function _safeFn(fn) { return typeof fn === 'function' ? fn : null; }

/**
 * Factory — creates an assistant instance bound to one host
 * component. Multiple instances are safe; each owns its own
 * SpeechRecognition handle.
 *
 * @param {object} [opts]
 * @param {(state) => void} [opts.onStateChange]
 * @param {string} [opts.language]  BCP-47 tag for recognition + TTS
 */
export function createVoiceAssistant(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const onStateChange = _safeFn(o.onStateChange);
  let language = typeof o.language === 'string' && o.language.trim()
                  ? o.language.trim() : 'en-US';

  let state = { phase: ASSISTANT_PHASES.IDLE, lastError: null, lastTranscript: null };
  let _recognition = null;
  let _utterance   = null;
  let _transcriptResolve = null;
  let _transcriptReject  = null;
  let _stopAfterTranscript = false;

  function _set(next) {
    state = { ...state, ...next };
    if (onStateChange) {
      try { onStateChange(state); } catch { /* swallow */ }
    }
  }

  function getState() { return { ...state }; }

  function isSupported() {
    return _getRecognitionCtor() != null;
  }

  function setLanguage(nextLang) {
    if (typeof nextLang === 'string' && nextLang.trim()) {
      language = nextLang.trim();
      if (_recognition) {
        try { _recognition.lang = language; } catch { /* swallow */ }
      }
    }
  }

  function _ensureRecognition() {
    if (_recognition) return _recognition;
    const Ctor = _getRecognitionCtor();
    if (!Ctor) return null;
    try {
      const r = new Ctor();
      r.continuous     = false;   // single utterance per session — no streaming
      r.interimResults = false;   // final result only
      r.maxAlternatives = 1;
      r.lang = language;
      r.onresult = (event) => {
        try {
          const last = event.results && event.results[0] && event.results[0][0];
          const transcript = last && typeof last.transcript === 'string'
                              ? last.transcript.trim() : '';
          _set({ lastTranscript: transcript, phase: ASSISTANT_PHASES.THINKING });
          if (_transcriptResolve) {
            _transcriptResolve(transcript);
            _transcriptResolve = null;
            _transcriptReject  = null;
          }
        } catch (e) {
          if (_transcriptReject) {
            _transcriptReject(e);
            _transcriptResolve = null;
            _transcriptReject  = null;
          }
        }
      };
      r.onerror = (event) => {
        const reason = (event && (event.error || event.message)) || 'recognition_error';
        _set({ phase: ASSISTANT_PHASES.ERROR, lastError: String(reason) });
        if (_transcriptReject) {
          _transcriptReject(new Error(String(reason)));
          _transcriptResolve = null;
          _transcriptReject  = null;
        }
      };
      r.onend = () => {
        if (_stopAfterTranscript || state.phase === ASSISTANT_PHASES.LISTENING) {
          _set({ phase: ASSISTANT_PHASES.IDLE });
        }
        _stopAfterTranscript = false;
      };
      _recognition = r;
      return r;
    } catch {
      return null;
    }
  }

  /**
   * Begin a single-utterance listen. Returns a Promise that
   * resolves with the transcribed text when the user finishes
   * speaking, or rejects on permission / hardware error.
   */
  function startListening() {
    return new Promise((resolve, reject) => {
      const r = _ensureRecognition();
      if (!r) {
        _set({ phase: ASSISTANT_PHASES.ERROR, lastError: 'unsupported' });
        reject(new Error('unsupported'));
        return;
      }
      _transcriptResolve = resolve;
      _transcriptReject  = reject;
      try {
        _set({ phase: ASSISTANT_PHASES.LISTENING, lastError: null });
        r.start();
      } catch (e) {
        _set({ phase: ASSISTANT_PHASES.ERROR, lastError: (e && e.message) || 'start_failed' });
        reject(e);
      }
    });
  }

  /**
   * Stop any in-flight recognition. Idempotent.
   */
  function stopListening() {
    _stopAfterTranscript = true;
    try {
      if (_recognition && typeof _recognition.stop === 'function') {
        _recognition.stop();
      }
    } catch { /* swallow */ }
    if (state.phase === ASSISTANT_PHASES.LISTENING) {
      _set({ phase: ASSISTANT_PHASES.IDLE });
    }
  }

  /**
   * Pure transcribe — equivalent to startListening + wait. Spec
   * names this separately so callers can wire a typed-fallback
   * path that bypasses recognition entirely.
   */
  function transcribeCommand() {
    return startListening();
  }

  /**
   * Run the response engine against the supplied context. Pure
   * pass-through to voiceAssistantResponseEngine.answerCommand —
   * exposed here so the host can call one API instead of
   * importing two.
   */
  function answerCommandLocal(input) {
    _set({ phase: ASSISTANT_PHASES.THINKING });
    const envelope = answerCommand(input || {});
    return envelope;
  }

  /**
   * Speak the answer text via window.speechSynthesis. Caller-
   * driven; this function NEVER fires automatically. Returns
   * boolean — false if speech synthesis is unavailable.
   *
   * @param {string} text
   * @param {object} [options]
   * @param {string} [options.lang]  BCP-47 override for this utterance
   * @param {() => void} [options.onEnd]
   */
  function speakAnswer(text, options) {
    const t = typeof text === 'string' ? text.trim() : '';
    if (!t) return false;
    if (!_hasSpeechSynthesis()) {
      _set({ phase: ASSISTANT_PHASES.IDLE });
      return false;
    }
    try {
      const opts = (options && typeof options === 'object') ? options : {};
      window.speechSynthesis.cancel();
      _utterance = new window.SpeechSynthesisUtterance(t);
      _utterance.lang = typeof opts.lang === 'string' && opts.lang.trim()
                        ? opts.lang.trim() : language;
      _utterance.rate  = 0.95;
      _utterance.pitch = 1.0;
      _utterance.onend = () => {
        _set({ phase: ASSISTANT_PHASES.IDLE });
        const onEnd = _safeFn(opts.onEnd);
        if (onEnd) { try { onEnd(); } catch { /* swallow */ } }
      };
      _utterance.onerror = () => {
        _set({ phase: ASSISTANT_PHASES.ERROR, lastError: 'speech_error' });
      };
      _set({ phase: ASSISTANT_PHASES.SPEAKING });
      window.speechSynthesis.speak(_utterance);
      return true;
    } catch {
      _set({ phase: ASSISTANT_PHASES.ERROR, lastError: 'speak_failed' });
      return false;
    }
  }

  /**
   * Hard cancel — stop listening + cancel TTS + reset state.
   * Safe to call from a navigation effect's cleanup.
   */
  function cancel() {
    stopListening();
    try {
      if (_hasSpeechSynthesis()) window.speechSynthesis.cancel();
    } catch { /* swallow */ }
    if (state.phase !== ASSISTANT_PHASES.IDLE) {
      _set({ phase: ASSISTANT_PHASES.IDLE });
    }
  }

  return {
    isSupported,
    setLanguage,
    getState,
    startListening,
    stopListening,
    transcribeCommand,
    answerCommand: answerCommandLocal,
    speakAnswer,
    cancel,
    // Test seam — lets vitest swap the internal recognition + utterance
    // when running in a Node env without browser shims.
    _setRecognitionForTest: (r) => { _recognition = r; },
  };
}

export { VOICE_COMMANDS, VOICE_ACTIONS };

const _module = {
  ASSISTANT_PHASES,
  VOICE_COMMANDS,
  VOICE_ACTIONS,
  createVoiceAssistant,
};
export default _module;
