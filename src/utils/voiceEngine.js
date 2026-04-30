/**
 * voiceEngine.js — thin façade over the browser's
 * SpeechRecognition + SpeechSynthesis APIs.
 *
 * Strict-rule audit
 *   • No backend / network calls — pure browser-side.
 *   • Every helper guards its own try/catch so a missing API,
 *     denied permission, or locked-down context never crashes
 *     the React tree.
 *   • Caller decides what to DO with the recognized text — the
 *     engine only emits transcripts. Routing lives in
 *     voiceIntents.js.
 *
 * Browser support matrix (April 2026):
 *   • Chrome / Edge desktop + Android → full support
 *   • Safari iOS 14.5+               → full support
 *   • Firefox                        → SpeechSynthesis yes,
 *                                      SpeechRecognition no
 *
 * Locale tags we pass to the browser:
 *   en → 'en-US'   (most reliable across vendors)
 *   tw → 'en-GH'   (Twi has no BCP-47 row in most engines;
 *                   fall back to en-GH so the engine still
 *                   accepts pidgin-style inputs)
 *   ha → 'ha-NG'   (Chrome ships this; others fall back to
 *                   en-NG transparently)
 */

const LOCALE_TAG = Object.freeze({
  en: 'en-US',
  tw: 'en-GH',
  ha: 'ha-NG',
  fr: 'fr-FR',
  es: 'es-ES',
  hi: 'hi-IN',
  sw: 'sw-KE',
});

function tagFor(lang) {
  return LOCALE_TAG[String(lang || 'en').toLowerCase()] || 'en-US';
}

// ─── Capability detection ────────────────────────────────────
function getRecognitionCtor() {
  try {
    if (typeof window === 'undefined') return null;
    return window.SpeechRecognition
      || window.webkitSpeechRecognition
      || null;
  } catch { return null; }
}

function getSynthesis() {
  try {
    if (typeof window === 'undefined') return null;
    return window.speechSynthesis || null;
  } catch { return null; }
}

/**
 * detectVoiceSupport — what's available on this device for the
 * given language.
 *
 *   {
 *     recognition:    boolean,
 *     synthesis:      boolean,
 *     synthesisVoice: SpeechSynthesisVoice | null,
 *     synthesisLangFallback: string | null,
 *   }
 *
 * synthesisLangFallback names the locale we'd actually use if
 * the requested language has no matching voice — e.g. Twi
 * commonly falls back to 'en-GH' or 'en'.
 */
export function detectVoiceSupport(lang = 'en') {
  const recognition = !!getRecognitionCtor();
  const synth = getSynthesis();

  let synthesis = false;
  let synthesisVoice = null;
  let synthesisLangFallback = null;

  if (synth && typeof synth.getVoices === 'function') {
    synthesis = true;
    const want = tagFor(lang).toLowerCase();
    const wantHead = String(lang || 'en').toLowerCase();
    let voices = [];
    try { voices = synth.getVoices() || []; } catch { voices = []; }
    // Exact lang tag match first.
    synthesisVoice = voices.find((v) => String(v.lang || '').toLowerCase() === want)
      || voices.find((v) => String(v.lang || '').toLowerCase().startsWith(wantHead + '-'))
      || null;
    if (!synthesisVoice && voices.length) {
      // Fall back to en-* for unsupported langs.
      synthesisVoice = voices.find((v) => /^en/i.test(v.lang || '')) || voices[0];
      synthesisLangFallback = synthesisVoice
        ? String(synthesisVoice.lang || 'en')
        : 'en';
    }
  }

  return {
    recognition,
    synthesis,
    synthesisVoice,
    synthesisLangFallback,
    requestedTag: tagFor(lang),
  };
}

// ─── Recognition ─────────────────────────────────────────────
let _activeRecognition = null;

/**
 * startListening — open a one-shot recognition session.
 *
 *   const handle = startListening({
 *     lang: 'en',
 *     onResult: (text, isFinal) => {},
 *     onError:  (code) => {},   // 'unsupported' | 'denied' |
 *                                // 'no-speech'   | 'aborted'   |
 *                                // 'network'     | 'unknown'
 *     onEnd:    () => {},
 *   });
 *   handle.stop();
 *
 * @returns {{ stop: () => void } | null}  null when SR isn't
 *   supported on this device.
 */
export function startListening({
  lang = 'en',
  onResult,
  onError,
  onEnd,
} = {}) {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    if (typeof onError === 'function') {
      try { onError('unsupported'); } catch { /* swallow */ }
    }
    return null;
  }
  // Stop any prior session — only one active at a time.
  stopListening();

  let rec;
  try { rec = new Ctor(); } catch {
    if (typeof onError === 'function') onError('unsupported');
    return null;
  }
  rec.lang = tagFor(lang);
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  rec.onresult = (event) => {
    if (typeof onResult !== 'function') return;
    try {
      const last = event.results[event.results.length - 1];
      const transcript = last && last[0] && last[0].transcript;
      if (transcript) onResult(String(transcript), !!(last && last.isFinal));
    } catch { /* swallow */ }
  };
  rec.onerror = (event) => {
    if (typeof onError !== 'function') return;
    let code = 'unknown';
    const e = String(event && event.error || '');
    if (e === 'not-allowed' || e === 'service-not-allowed') code = 'denied';
    else if (e === 'no-speech') code = 'no-speech';
    else if (e === 'aborted')   code = 'aborted';
    else if (e === 'network')   code = 'network';
    try { onError(code); } catch { /* swallow */ }
  };
  rec.onend = () => {
    _activeRecognition = null;
    if (typeof onEnd === 'function') {
      try { onEnd(); } catch { /* swallow */ }
    }
  };

  try { rec.start(); } catch {
    if (typeof onError === 'function') onError('unknown');
    return null;
  }
  _activeRecognition = rec;
  return {
    stop() {
      try { rec.stop(); } catch { /* ignore */ }
    },
  };
}

/**
 * stopListening — abort the current recognition session, if any.
 */
export function stopListening() {
  if (!_activeRecognition) return;
  try { _activeRecognition.abort(); } catch { /* ignore */ }
  _activeRecognition = null;
}

// ─── Synthesis (text → speech) ───────────────────────────────
let _activeUtterance = null;

/**
 * speakAnswer — read `text` aloud in the requested language.
 *
 *   speakAnswer('Today, check your maize field.', 'en', {
 *     onEnd: () => {},
 *     onError: (code) => {},
 *   })
 *
 * Returns:
 *   { ok: true,  fallbackLang?: string }  spoken
 *   { ok: false, reason: 'unsupported' | 'no-voice' | 'empty' }
 */
export function speakAnswer(text, lang = 'en', { onEnd, onError } = {}) {
  if (!text || !String(text).trim()) {
    return { ok: false, reason: 'empty' };
  }
  const synth = getSynthesis();
  if (!synth) return { ok: false, reason: 'unsupported' };

  // Cancel any prior utterance to keep the surface single-track.
  stopSpeaking();

  let utter;
  try { utter = new SpeechSynthesisUtterance(String(text)); }
  catch { return { ok: false, reason: 'unsupported' }; }

  const support = detectVoiceSupport(lang);
  if (support.synthesisVoice) {
    utter.voice = support.synthesisVoice;
    utter.lang = support.synthesisVoice.lang || tagFor(lang);
  } else {
    utter.lang = tagFor(lang);
  }
  utter.rate = 0.95;   // farmer-friendly; not too fast
  utter.pitch = 1;
  utter.volume = 1;

  utter.onend = () => {
    _activeUtterance = null;
    if (typeof onEnd === 'function') { try { onEnd(); } catch { /* ignore */ } }
  };
  utter.onerror = (event) => {
    _activeUtterance = null;
    if (typeof onError === 'function') {
      try { onError(String(event?.error || 'unknown')); }
      catch { /* swallow */ }
    }
  };

  try { synth.speak(utter); } catch {
    return { ok: false, reason: 'unsupported' };
  }
  _activeUtterance = utter;
  return {
    ok: true,
    fallbackLang: support.synthesisLangFallback || null,
  };
}

/**
 * stopSpeaking — cancel any active utterance.
 */
export function stopSpeaking() {
  const synth = getSynthesis();
  if (!synth) return;
  try { synth.cancel(); } catch { /* ignore */ }
  _activeUtterance = null;
}

/**
 * fallbackToText — sentinel marker for callers that need a
 * "voice path failed, render text instead" branch. Keeps the
 * caller code symmetric with the spec's named function.
 */
export function fallbackToText(reason = 'voice-unavailable') {
  return { ok: false, reason, fallback: 'text' };
}

// ─── Question normalisation ──────────────────────────────────

/**
 * normalizeFarmerQuestion — lowercase + strip punctuation +
 * collapse whitespace + drop common filler words, so a
 * farmer's "Hello, will it rain today please?" matches the
 * intent pattern "will it rain".
 */
const FILLER_WORDS = new Set([
  'please', 'farroway', 'hey', 'hi', 'hello', 'ok', 'um', 'uh',
  'so', 'just', 'kindly', 'pls', 'plz',
]);

export function normalizeFarmerQuestion(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
    .replace(/[^a-z0-9\u00C0-\u024F\u0900-\u097F\u4e00-\u9fff'\s-]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !FILLER_WORDS.has(w))
    .join(' ')
    .trim();
}

// Re-exported here so callers have a single import target —
// matches the spec's listing for voiceEngine.ts.
export { routeVoiceIntent } from './voiceIntents.js';
