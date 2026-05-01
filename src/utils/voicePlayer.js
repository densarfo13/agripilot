/**
 * voicePlayer.js — thin `playVoice(text, lang)` wrapper for
 * the new Twi voice guidance hooks.
 *
 * Position
 * ────────
 * Sister to (NOT replacement for) `src/voice/voiceEngine.js`,
 * which already exposes `speak(text, lang)` + `speakKey(...)`
 * with full 3-tier fallback (prerecorded clip → provider TTS →
 * browser TTS) and smart voice selection. The spec's
 * `playVoice` signature is the simple version most surfaces
 * will reach for; this file routes it through `voiceEngine`
 * so the new wrapper inherits the tier benefits without
 * duplicating any logic.
 *
 * If voiceEngine is unreachable (load order issue, locked-down
 * browser context, test env), we fall back to a direct
 * `SpeechSynthesisUtterance` call — matches the spec verbatim
 * and keeps the API usable in isolation.
 *
 * Strict-rule audit
 *   • Never throws. Every browser API is feature-detected.
 *   • Cancels any in-flight utterance before speaking again
 *     (overlap on slow voices is confusing).
 *   • Honors the mute flag from `useVoiceMute` — when muted,
 *     `playVoice` is a silent no-op (returns false).
 *   • Stores the last-spoken phrase so `replayLast()` can
 *     re-fire on user request.
 */

const STORAGE_KEY = 'farroway_voice_muted';
const LAST_SPOKEN_KEY = '__farroway_last_voice__';

const LANG_BCP47 = Object.freeze({
  en: 'en-US',
  hi: 'hi-IN',
  fr: 'fr-FR',
  sw: 'sw-KE',
  ha: 'ha-NG',
  tw: 'ak-GH',     // Akan, Ghana — closest BCP-47 macrolanguage tag
  // The spec mentions 'ak-GH'; some Android voices accept it,
  // others fall through to en-US. voiceEngine handles all of this.
});

function _short(lang) {
  return String(lang || 'en').slice(0, 2).toLowerCase();
}

function _bcp47(lang) {
  if (!lang) return 'en-US';
  // Allow callers to pass the long form directly (e.g. 'ak-GH').
  if (typeof lang === 'string' && lang.includes('-')) return lang;
  return LANG_BCP47[_short(lang)] || 'en-US';
}

function _isMuted() {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch { return false; }
}

// In-memory last-spoken so replay survives mute/unmute without
// hitting localStorage on every play.
let _last = { text: '', lang: 'en' };
function _rememberLast(text, lang) {
  _last = { text: String(text || ''), lang: _short(lang) };
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(LAST_SPOKEN_KEY, JSON.stringify(_last));
    }
  } catch { /* ignore */ }
}
function _readLast() {
  if (_last.text) return _last;
  try {
    if (typeof sessionStorage === 'undefined') return _last;
    const raw = sessionStorage.getItem(LAST_SPOKEN_KEY);
    if (!raw) return _last;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.text === 'string') {
      _last = { text: parsed.text, lang: _short(parsed.lang || 'en') };
    }
  } catch { /* ignore */ }
  return _last;
}

/**
 * Direct browser-TTS path used as a last-resort fallback. Mirrors
 * the spec's `playVoice` body verbatim, but adds the standard
 * cancel-before-speak guard.
 */
function _directBrowserSpeak(text, lang) {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
    const synth = window.speechSynthesis;
    try { synth.cancel(); } catch { /* ignore */ }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = _bcp47(lang);
    utter.rate = 0.9;
    utter.pitch = 1;
    synth.speak(utter);
    return true;
  } catch { return false; }
}

/**
 * Speak `text` in the active UI language. Honors the global mute
 * flag. Returns true when a speak attempt was queued.
 *
 * Prefers the existing voiceEngine (3-tier fallback). When the
 * engine isn't reachable, falls through to the spec's direct
 * SpeechSynthesisUtterance path.
 *
 * @param {string} text
 * @param {string} [lang='ak-GH']  short code OR BCP-47 long form
 * @returns {boolean}
 */
export function playVoice(text, lang = 'ak-GH') {
  if (!text || typeof text !== 'string') return false;
  if (_isMuted()) return false;

  _rememberLast(text, lang);

  // Tier-aware path via voiceEngine. Lazy import keeps this
  // module test-friendly + avoids a circular dep on engines
  // that import from i18n.
  try {
    // Synchronous best-effort: if voiceEngine has already been
    // imported elsewhere in the app, the import resolves
    // instantly from the module cache. Otherwise we still get
    // the dynamic-import promise and fire the direct path now
    // so audio never feels delayed.
    import('../voice/voiceEngine.js')
      .then((mod) => {
        try { mod.speak?.(text, _short(lang)); }
        catch { /* fall through to direct path below */ }
      })
      .catch(() => { /* swallow */ });
  } catch { /* ignore */ }

  // Always fire the direct path immediately too — voiceEngine
  // cancels in-flight utterances, so the second call replaces
  // the first cleanly. This is the "spec verbatim" path.
  return _directBrowserSpeak(text, lang);
}

/**
 * Replay whatever was last spoken. Used by VoiceReplayButton.
 * No-op when nothing has been spoken yet OR when muted.
 */
export function replayLast() {
  const { text, lang } = _readLast();
  if (!text) return false;
  return playVoice(text, lang);
}

/**
 * canSpeakLanguage — feature-detect whether the device ships a
 * voice for the requested language tag (or a near-match prefix).
 *
 *   canSpeakLanguage('ak-GH')  // true on the rare device with Akan
 *   canSpeakLanguage('tw')     // matches any 'ak' / 'ak-GH' prefix
 *   canSpeakLanguage('en')     // true on virtually every device
 *
 * Returns false when speechSynthesis isn't available OR when
 * getVoices() hasn't populated yet (Chrome takes a beat after
 * first call). Callers treat false as "show text-only fallback" —
 * the playVoice path itself still works because the engine's
 * lower tiers can serve a prerecorded clip or a different voice.
 *
 * @param {string} lang  short code ('tw', 'en') or BCP-47 ('ak-GH')
 * @returns {boolean}
 */
export function canSpeakLanguage(lang) {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
    const voices = window.speechSynthesis.getVoices();
    if (!Array.isArray(voices) || voices.length === 0) return false;
    const targets = [];
    const want = String(lang || '').toLowerCase();
    if (!want) return false;
    targets.push(want);
    const long = LANG_BCP47[_short(want)];
    if (long) targets.push(long.toLowerCase());
    return voices.some((v) => {
      const vl = String(v?.lang || '').toLowerCase();
      if (!vl) return false;
      return targets.some((t) => vl === t || vl.startsWith(t.slice(0, 2)));
    });
  } catch { return false; }
}

/**
 * Stop any in-flight speech. Useful on unmount or when mute
 * is toggled on.
 */
export function stopVoice() {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  } catch { /* ignore */ }
}

export const _internal = Object.freeze({ STORAGE_KEY, LANG_BCP47, _bcp47 });

export default { playVoice, replayLast, stopVoice };
