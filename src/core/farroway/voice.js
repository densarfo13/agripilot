/**
 * voice.js — Farroway core safe speech wrapper.
 *
 *   speak(text, opts?)
 *     opts.lang  — BCP-47 tag (en, fr, sw, ha, tw, hi). Defaults
 *                  to the active i18n language via getLanguage().
 *     opts.rate  — playback rate (0.1–10). Default 1.0.
 *
 * Behaviour
 *   * Fire-and-forget. Never throws.
 *   * Picks the best matching SpeechSynthesisVoice for the
 *     active language so a Swahili farmer doesn't hear an
 *     English voice mangling Kiswahili pronunciation.
 *   * Silently no-ops when:
 *       - speechSynthesis is unavailable (server / older browsers)
 *       - text is empty
 *       - the synthesizer throws mid-call
 *   * Strict-rule fallback (per the Voice/Offline/Low-Literacy
 *     spec): if voice fails the calling component still has the
 *     visible text — speak() returning silently is the contract,
 *     not an error to surface.
 *
 * No external dependencies, no permission prompts.
 */

import { getLanguage } from '../../i18n/index.js';

// BCP-47 mapping for the six launch locales. Browsers expect
// tags like 'en-US' / 'fr-FR'; using the language code alone
// (`en`) is also accepted but lets the OS pick a regional
// variant we don't control. Explicit tags are more predictable.
const VOICE_LANG_TAGS = Object.freeze({
  en: 'en-US',
  fr: 'fr-FR',
  sw: 'sw-KE',   // Kenyan Swahili — closest TTS coverage
  ha: 'ha-NG',   // Nigerian Hausa
  tw: 'ak-GH',   // Akan (Ghana) — Twi is part of the Akan group
  hi: 'hi-IN',
});

function _resolveLang(opts) {
  const explicit = opts && opts.lang ? String(opts.lang).toLowerCase() : '';
  if (explicit) return VOICE_LANG_TAGS[explicit] || explicit;
  let active = 'en';
  try { active = (getLanguage() || 'en').toLowerCase(); }
  catch { /* keep en */ }
  return VOICE_LANG_TAGS[active] || 'en-US';
}

function _pickVoice(langTag) {
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;
    if (typeof window.speechSynthesis.getVoices !== 'function') return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || !voices.length) return null;
    // Exact match first (e.g. en-US), then language-prefix
    // match (en-*), then null so the engine falls back to its
    // default voice.
    const lower = String(langTag).toLowerCase();
    const prefix = lower.split('-')[0];
    const exact = voices.find((v) => String(v.lang).toLowerCase() === lower);
    if (exact) return exact;
    const prefixed = voices.find((v) =>
      String(v.lang).toLowerCase().startsWith(prefix + '-')
      || String(v.lang).toLowerCase() === prefix);
    return prefixed || null;
  } catch { return null; }
}

export function speak(text, opts = {}) {
  if (!text) return;
  try {
    if (typeof window === 'undefined') return;
    if (!window.speechSynthesis) return;
    if (typeof SpeechSynthesisUtterance !== 'function') return;
    // Don't stack up a queue of the same task spoken N times.
    // The synthesizer's own cancel() flushes pending utterances
    // so a rapid series of speak() calls (Listen tap + auto-play
    // via Simple Mode + voice praise on Done) doesn't pile up.
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }

    const u = new SpeechSynthesisUtterance(String(text));
    const langTag = _resolveLang(opts);
    u.lang = langTag;
    if (Number.isFinite(opts.rate)) u.rate = opts.rate;
    const v = _pickVoice(langTag);
    if (v) u.voice = v;

    window.speechSynthesis.speak(u);
  } catch { /* never throw from a notification path */ }
}

/**
 * stopSpeech — flush any in-flight utterance. Useful when the
 * farmer navigates away from a screen mid-speech (the auto-play
 * voice on Today shouldn't trail into Settings).
 */
export function stopSpeech() {
  try {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  } catch { /* swallow */ }
}

export default speak;
