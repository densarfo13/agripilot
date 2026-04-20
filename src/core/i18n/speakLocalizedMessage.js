/**
 * speakLocalizedMessage.js — voice-first layer (Section 5).
 *
 * Reads aloud the SAME text the screen shows by rendering
 * the payload through renderLocalizedMessage first, then
 * passing it to the Web Speech API.
 *
 * Design rules:
 *   • voice reads the LOCALIZED string, not a separate
 *     engine-generated English string (Section 7)
 *   • never autoplay — always requires an explicit call
 *   • graceful fallback when SpeechSynthesis is missing
 *     (returns {ok:false, reason:'unsupported'} without throwing)
 *   • pure async — easy to mock in tests via an injectable
 *     `synth` parameter
 *
 * Locale mapping: the Web Speech API uses BCP-47 tags. We
 * map the project's 9-locale ids to the closest standard tags.
 */

import { renderLocalizedMessage, looksLikeRawKey } from './renderLocalizedMessage.js';

const LOCALE_TO_BCP47 = Object.freeze({
  en: 'en-US',
  hi: 'hi-IN',
  tw: 'ak-GH', // Twi/Akan, Ghana — browsers with no Akan voice fall back to en
  es: 'es-ES',
  pt: 'pt-BR',
  fr: 'fr-FR',
  ar: 'ar-SA',
  sw: 'sw-KE',
  id: 'id-ID',
});

/** Resolve the best browser voice tag for a locale id. */
export function localeToVoiceTag(locale) {
  if (!locale || typeof locale !== 'string') return 'en-US';
  return LOCALE_TO_BCP47[locale] || 'en-US';
}

/**
 * getSynth — get the SpeechSynthesis reference safely.
 * Returns null when unavailable (SSR, older WebView).
 */
export function getSynth() {
  if (typeof window === 'undefined') return null;
  return window.speechSynthesis || null;
}

/**
 * speakLocalizedMessage — reads the localized payload aloud.
 *
 *   payload — LocalizedPayload (or plain string for escape hatches)
 *   locale  — farroway locale id (e.g. 'hi')
 *   t       — translation function
 *   opts    — { rate?: number, pitch?: number, synth?: injected mock }
 *
 * Returns a plain object:
 *   { ok: true,  spoken: '<text>', tag: 'hi-IN' }           on success
 *   { ok: false, reason: 'unsupported' | 'empty' | 'error' } otherwise
 *
 * Never throws. Never autoplays. Explicit interaction only.
 */
export function speakLocalizedMessage(payload, locale, t, opts = {}) {
  const text = renderLocalizedMessage(payload, t);
  if (!text || typeof text !== 'string') {
    return { ok: false, reason: 'empty' };
  }
  // Never read a bare i18n key aloud — that's useless noise when
  // the translation is missing. The visible UI still shows the key
  // so developers can notice; voice stays silent.
  if (looksLikeRawKey(text)) {
    return { ok: false, reason: 'empty' };
  }
  const synth = opts.synth || getSynth();
  if (!synth) return { ok: false, reason: 'unsupported' };

  const UtteranceCtor = (typeof window !== 'undefined' && window.SpeechSynthesisUtterance)
    || opts.UtteranceCtor;
  if (typeof UtteranceCtor !== 'function') return { ok: false, reason: 'unsupported' };

  try {
    // Stop any prior utterance so taps replace — not queue.
    if (typeof synth.cancel === 'function') synth.cancel();
    const u = new UtteranceCtor(text);
    u.lang = localeToVoiceTag(locale);
    if (typeof opts.rate === 'number')  u.rate  = opts.rate;
    if (typeof opts.pitch === 'number') u.pitch = opts.pitch;
    synth.speak(u);
    return { ok: true, spoken: text, tag: u.lang };
  } catch (err) {
    return { ok: false, reason: 'error', message: err?.message || 'speak_failed' };
  }
}

/** Stop any in-flight utterance. No-op when unsupported. */
export function cancelSpeak(opts = {}) {
  const synth = opts.synth || getSynth();
  if (!synth || typeof synth.cancel !== 'function') return false;
  try { synth.cancel(); return true; }
  catch { return false; }
}

export const _internal = { LOCALE_TO_BCP47 };
