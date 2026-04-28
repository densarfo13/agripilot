/**
 * speak.js — public path the No-Reading-Required spec calls
 * out for the safe TTS wrapper.
 *
 *   import { speak, stopSpeech } from '../voice/speak.js';
 *
 * Wraps the existing src/core/farroway/voice.js helpers — no
 * parallel implementation, no duplicated speechSynthesis
 * handling. The core module already:
 *   * resolves the active i18n language to a BCP-47 tag and
 *     picks the best matching SpeechSynthesisVoice on the OS
 *   * cancels any in-flight utterance so a Listen+Done burst
 *     doesn't pile up
 *   * is fully fire-and-forget; never throws
 *
 * The thin wrapper here adds:
 *   * an explicit `lang` parameter that overrides the active
 *     i18n language for one call (useful when the caller has
 *     already resolved the script via getTaskVoiceScript and
 *     wants the utterance to match that script's locale even
 *     if the UI is in a different language)
 *   * default rate of 0.85 — matches the spec's call for a
 *     calmer cadence in Simple Mode
 *
 * Strict-rule audit
 *   * No parallel speechSynthesis logic — single source of
 *     truth stays in src/core/farroway/voice.js
 *   * Never throws (delegates to the core wrapper which
 *     swallows everything)
 *   * SSR-safe: a missing window short-circuits in the core
 */

import { speak as coreSpeak, stopSpeech as coreStopSpeech }
  from '../core/farroway/voice.js';

/**
 * speak(text, lang?) → void
 *
 * Two-arg shape per the spec: `speak("Hello", "tw")`. The
 * second argument is optional; when omitted the core wrapper
 * uses the active i18n language. Defensive: a non-string lang
 * is dropped + the core wrapper falls back to active i18n.
 */
export function speak(text, lang) {
  if (!text) return;
  const opts = { rate: 0.85 };
  if (lang && typeof lang === 'string') opts.lang = lang;
  try { coreSpeak(text, opts); }
  catch (err) {
    // The core wrapper swallows errors itself; we only get here
    // if something exotic happens during the function call (a
    // mocked-out import returning undefined, e.g.). Keep the
    // contract: speak NEVER throws.
    try { console.warn('[voice failed]', err && err.message); }
    catch { /* console missing — never propagate */ }
  }
}

/**
 * stopSpeech() → void
 *
 * Flushes any in-flight utterance. Safe to call on unmount —
 * navigating from /today to /settings should cancel an
 * auto-play in progress so it doesn't trail into the new page.
 */
export function stopSpeech() {
  try { coreStopSpeech(); }
  catch { /* never propagate */ }
}

export default speak;
