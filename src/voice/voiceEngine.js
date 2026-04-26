/**
 * voiceEngine.js — speech I/O layer for the low-literacy farmer UI.
 *
 * Public API (used by VoiceButton, MicInput, IconActionCard):
 *   • speak(text, lang)              — speak arbitrary already-translated text
 *   • speakKey(key, lang, text)      — speak an i18n key, preferring the
 *                                       prerecorded-clip / provider-TTS path
 *                                       when the key maps to a known prompt
 *   • startListening(onResult, lang) — one-shot speech recognition
 *   • stopSpeaking()
 *   • isSpeakSupported() / isListenSupported()
 *
 * Why two speak helpers
 * ─────────────────────
 * The earlier version only used `window.speechSynthesis`. That is
 * fine for English / French / Hindi / Swahili (devices ship a
 * matching voice) but BAD for Twi (no browser voice exists) and
 * imperfect for Hausa (limited devices ship `ha-NG`). Farroway
 * already has a richer pipeline at `src/services/voiceService.js`:
 *
 *     1. Prerecorded native-speaker mp3   (primary path for Twi)
 *     2. Provider neural TTS              (en / fr / sw)
 *     3. Browser speechSynthesis          (last-resort fallback)
 *
 * `speakKey()` taps into that pipeline when the caller passes an
 * i18n key — `voiceService.speakPrompt(key, lang)` resolves the key
 * to a prompt id via the prompt library's bridge map, which then
 * unlocks prerecorded Twi clips and the provider TTS path. When the
 * key has no matching prompt entry we transparently fall through to
 * `speak()` so the caller never has to branch.
 *
 * `speak()` itself also delegates to `voiceService.speakText()` when
 * available — that gives us better voice picking (matches "google
 * natural", "neural", "samantha", etc.) than picking the first
 * BCP-47 match. When voiceService isn't reachable for some reason
 * we still call `window.speechSynthesis` directly, so this module
 * never hard-depends on the service: feature detection only.
 *
 * Language map (short → BCP-47)
 * ─────────────────────────────
 *   en → en-US      hi → hi-IN
 *   fr → fr-FR      sw → sw-KE
 *   ha → ha-NG      (proper Hausa-Nigeria; some Android voices ship it)
 *   tw → ak         (Akan is the BCP-47 macrolanguage tag for Twi —
 *                    rarely shipped but at least correct; voiceService
 *                    handles tw → prerecorded clip ahead of this anyway)
 *
 * Rules (unchanged)
 * ─────────────────
 *   • Never throw. Every browser API is feature-detected.
 *   • Cancel any in-flight utterance before starting a new one.
 *   • Use a slow rate (≈0.85–0.9) for low-literacy listeners.
 *   • When unsupported, helpers no-op silently.
 */

import voiceService from '../services/voiceService.js';
import { resolvePromptId, getPromptClip } from '../services/voicePrompts.js';
import { nativeAudioFor } from './nativeVoiceManifest.js';

// Singleton <Audio> for native-tier playback. One element keeps
// background tabs from accumulating elements across taps and lets
// us cancel in-flight playback before starting a new one.
let _nativeAudioEl = null;
function _getNativeAudio() {
  if (typeof Audio === 'undefined') return null;
  if (!_nativeAudioEl) {
    try { _nativeAudioEl = new Audio(); _nativeAudioEl.preload = 'auto'; }
    catch { _nativeAudioEl = null; }
  }
  return _nativeAudioEl;
}

function _isDevEnv() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) return true;
  } catch { /* SSR */ }
  return false;
}

/**
 * Tier 0 — native voice manifest. Returns true when playback was
 * initiated (the underlying <Audio> resolves async; we don't block
 * the caller). Returns false when no manifest entry, no Audio API,
 * or the file fails to load — in any of those cases the caller
 * MUST fall through to the next tier.
 */
function _tryNativeManifest(key, lang) {
  if (!key) return false;
  const path = nativeAudioFor(lang, key);
  if (!path) {
    // Dev-only warning when a non-English farmer language has NO
    // native recording for a key the UI is asking to speak. Helps
    // the recording team prioritise the missing slots.
    if (_isDevEnv() && (lang === 'tw' || lang === 'ha')) {
      try { console.warn('[voice missing native audio]', lang, key); }
      catch { /* ignore */ }
    }
    return false;
  }
  const el = _getNativeAudio();
  if (!el) return false;
  try {
    // Cancel anything currently playing before starting the new clip.
    try { voiceService.stop && voiceService.stop(); } catch { /* ignore */ }
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { /* ignore */ }
    try { el.pause(); el.currentTime = 0; } catch { /* ignore */ }
    el.src = path;
    // play() returns a Promise that rejects on missing file / autoplay
    // block. We swallow rejection — caller already returned `true`
    // optimistically. Treating a rejection as "fall back" would race
    // with the tier-1 attempt; instead, log in dev and accept silence.
    el.play().catch((err) => {
      if (_isDevEnv()) {
        try { console.warn('[voice native playback failed]', lang, key, err && err.message); }
        catch { /* ignore */ }
      }
    });
    return true;
  } catch {
    return false;
  }
}

const LANG_BCP47 = Object.freeze({
  en: 'en-US',
  hi: 'hi-IN',
  fr: 'fr-FR',
  sw: 'sw-KE',
  ha: 'ha-NG',
  tw: 'ak',
});

function _shortLang(lang) {
  return String(lang || 'en').slice(0, 2).toLowerCase();
}

function _bcp47(short) {
  if (!short) return 'en-US';
  const key = _shortLang(short);
  return LANG_BCP47[key] || 'en-US';
}

function _hasSpeechSynthesis() {
  try { return typeof window !== 'undefined' && 'speechSynthesis' in window; }
  catch { return false; }
}

function _SpeechRecognitionCtor() {
  try {
    if (typeof window === 'undefined') return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  } catch { return null; }
}

function _voiceServiceAvailable() {
  try {
    return !!(voiceService
      && typeof voiceService.speakText === 'function'
      && typeof voiceService.isAvailable === 'function'
      && voiceService.isAvailable());
  } catch { return false; }
}

/** True if any speech-out path (clip, provider, browser) is reachable. */
export function isSpeakSupported() {
  if (_voiceServiceAvailable()) return true;
  return _hasSpeechSynthesis();
}

/** True if Web Speech recognition is available (still browser-only). */
export function isListenSupported() {
  return !!_SpeechRecognitionCtor();
}

// ─── Internal: direct browser-TTS path, used as last-resort when
//    voiceService is unreachable. Keeps the original "Use browser
//    APIs" contract from the spec while still picking the best voice
//    the OS provides. Logic mirrors voiceService.selectBestVoice so
//    we don't duplicate state.

const PREFERRED_VOICE_PATTERNS = [
  /google.*(natural|wavenet|neural)/i,
  /samantha|daniel|thomas|amelie/i,
  /(neural|enhanced|premium|natural|hd$)/i,
];

function _scoreVoice(voice) {
  let score = 0;
  const name = voice.name || '';
  if (voice.localService) score += 5;
  for (let i = 0; i < PREFERRED_VOICE_PATTERNS.length; i++) {
    if (PREFERRED_VOICE_PATTERNS[i].test(name)) { score += 20 - i; break; }
  }
  if (/compact/i.test(name)) score -= 10;
  if (/espeak/i.test(name))  score -= 15;
  return score;
}

function _pickVoice(synth, langTag) {
  try {
    const voices = synth.getVoices ? synth.getVoices() : [];
    if (!Array.isArray(voices) || voices.length === 0) return null;
    const tag = (langTag || '').toLowerCase();
    const exact = voices.filter(v => (v.lang || '').toLowerCase() === tag);
    const prefix = exact.length
      ? exact
      : voices.filter(v => (v.lang || '').toLowerCase().startsWith(tag.slice(0, 2)));
    if (prefix.length === 0) return null;
    return prefix.reduce((a, b) => (_scoreVoice(b) > _scoreVoice(a) ? b : a));
  } catch { return null; }
}

function _speakBrowserDirect(text, lang) {
  if (!_hasSpeechSynthesis()) return false;
  try {
    const synth = window.speechSynthesis;
    try { synth.cancel(); } catch { /* ignore */ }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang   = _bcp47(lang);
    utter.rate   = 0.9;
    utter.pitch  = 1.0;
    utter.volume = 1.0;
    const v = _pickVoice(synth, utter.lang);
    if (v) utter.voice = v;
    utter.onerror = () => { /* ignore — usually "interrupted" */ };
    synth.speak(utter);
    return true;
  } catch { return false; }
}

/**
 * Speak an already-translated string. Prefers the 3-tier voiceService
 * pipeline (provider TTS for en/fr/sw, smart voice selection for the
 * rest); falls through to direct browser speechSynthesis if the
 * service is offline.
 *
 * Note: This path skips prerecorded clips (no prompt id).
 * For a prerecorded-friendly path use `speakKey(key, lang, fallback)`.
 */
export function speak(text, lang = 'en') {
  if (!text || typeof text !== 'string') return false;
  const short = _shortLang(lang);

  if (_voiceServiceAvailable()) {
    try {
      // voiceService.speakText: cancels current playback, runs the
      // 2/3 tier fallback chain (provider → browser), non-blocking.
      const ok = voiceService.speakText(text, short);
      if (ok) return true;
    } catch { /* fall through to direct browser */ }
  }
  return _speakBrowserDirect(text, short);
}

/**
 * Speak using an i18n / prompt key when one is available.
 * Routes through `voiceService.speakPrompt(key, lang)` so:
 *   • Twi  → prerecorded native-speaker mp3 (when the key bridges
 *             to a prompt id with a `clip.tw` entry)
 *   • en/fr/sw → provider neural TTS
 *   • ha   → provider TTS where supported, then browser ha-NG voice
 *   • all others → browser TTS with smart voice selection
 *
 * If the key has no bridge to a known prompt, we fall through to
 * `speak(fallbackText, lang)` so callers don't have to branch.
 *
 * @param {string} key            the i18n key (e.g. 'farmerActions.scanCrop')
 * @param {string} lang           short language code
 * @param {string} fallbackText   already-translated text shown to the user;
 *                                used when the key has no prompt mapping
 * @returns {boolean}             true when a play attempt was started
 */
export function speakKey(key, lang = 'en', fallbackText = '') {
  const short = _shortLang(lang);

  // ─── Tier 0 — native voice manifest ─────────────────────────
  // Highest fidelity: a hand-recorded native-speaker mp3 indexed
  // directly by the i18n key. When present, this beats every other
  // tier (no provider TTS or browser TTS can match a real voice).
  // When absent, we fall through to the existing 3-tier pipeline.
  if (_tryNativeManifest(key, short)) {
    return true;
  }

  // Try the prompt path first — gets us the prerecorded Twi clip
  // when one exists, and provider TTS for en/fr/sw automatically.
  if (key && _voiceServiceAvailable()) {
    try {
      const promptId = resolvePromptId(key);
      if (promptId) {
        // Best-case: there is a prerecorded clip in this language
        // OR voiceService.speakPrompt will resolve the prompt's
        // canonical text and apply the 3-tier fallback for us.
        const ok = typeof voiceService.speakPrompt === 'function'
          ? voiceService.speakPrompt(key, short)
          : false;
        if (ok) return true;

        // Edge case: speakPrompt returned false (no text in this
        // language for this prompt). If a clip exists, play it
        // directly via speakText with empty fallback — clip-only
        // tier is reached when the prompt has a clip but the lang
        // has no provider/browser-readable text.
        if (getPromptClip(promptId, short) && fallbackText) {
          const ok2 = voiceService.speakText(fallbackText, short);
          if (ok2) return true;
        }
      }
    } catch { /* fall through */ }
  }
  // No prompt mapping (or service unavailable) — speak the
  // already-translated text directly.
  if (fallbackText) return speak(fallbackText, short);
  return false;
}

/**
 * Stop any in-flight speech immediately (clip + browser TTS).
 */
export function stopSpeaking() {
  // Stop the tier-0 native <Audio> element first — it's the only
  // path the voiceService.stop() chain doesn't cover.
  try {
    if (_nativeAudioEl) {
      _nativeAudioEl.pause();
      _nativeAudioEl.currentTime = 0;
    }
  } catch { /* ignore */ }
  try {
    if (_voiceServiceAvailable() && typeof voiceService.stop === 'function') {
      voiceService.stop();
      return;
    }
  } catch { /* ignore */ }
  try {
    if (_hasSpeechSynthesis()) window.speechSynthesis.cancel();
  } catch { /* ignore */ }
}

/**
 * Start a one-shot speech-recognition session.
 *
 * @param {(text: string) => void} onResult  best transcript handler
 * @param {string} lang  short code; mapped via LANG_BCP47
 * @param {object} [opts]
 * @param {(err: string) => void} [opts.onError]
 * @returns {() => void}  abort fn (no-op if unsupported)
 */
export function startListening(onResult, lang = 'en', opts = {}) {
  const Ctor = _SpeechRecognitionCtor();
  if (!Ctor) {
    if (typeof opts.onError === 'function') {
      try { opts.onError('unsupported'); } catch { /* ignore */ }
    }
    return () => {};
  }
  let recognizer;
  try {
    recognizer = new Ctor();
    recognizer.lang = _bcp47(lang);
    recognizer.interimResults = false;
    recognizer.maxAlternatives = 1;
    recognizer.continuous = false;
  } catch {
    if (typeof opts.onError === 'function') {
      try { opts.onError('init_failed'); } catch { /* ignore */ }
    }
    return () => {};
  }
  let aborted = false;
  recognizer.onresult = (event) => {
    if (aborted) return;
    try {
      const result = event?.results?.[0]?.[0];
      const text = result?.transcript ? String(result.transcript).trim() : '';
      if (text && typeof onResult === 'function') onResult(text);
    } catch { /* ignore */ }
  };
  recognizer.onerror = (event) => {
    if (aborted) return;
    if (typeof opts.onError === 'function') {
      try { opts.onError(event?.error || 'unknown'); } catch { /* ignore */ }
    }
  };
  recognizer.onend = () => { /* result handler already fired */ };
  try { recognizer.start(); }
  catch {
    if (typeof opts.onError === 'function') {
      try { opts.onError('start_failed'); } catch { /* ignore */ }
    }
  }
  return function abort() {
    aborted = true;
    try { recognizer.abort(); } catch { /* ignore */ }
  };
}

// Tiny named export so tests can verify the language mapping without
// exercising the full Web Speech API.
export const _internal = Object.freeze({ LANG_BCP47, _bcp47, _pickVoice });

export default { speak, speakKey, stopSpeaking, startListening, isSpeakSupported, isListenSupported };
