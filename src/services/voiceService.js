/**
 * Voice Service — production voice system for farmer guidance.
 *
 * Single entry point for ALL voice playback in the app.
 * No component should call browser speechSynthesis directly.
 *
 * Fallback order (per request):
 *   1. Prerecorded clip  — native speaker .mp3 (primarily Twi)
 *   2. Provider TTS      — server-side neural TTS (en, fr, sw)
 *   3. Browser TTS       — window.speechSynthesis (last resort)
 *
 * Features:
 *   - Client-side blob cache (avoids re-fetching provider audio)
 *   - Non-blocking playback (returns immediately, audio plays async)
 *   - Singleton audio element (no resource leaks)
 *   - Provider availability cached on init (one /tts/status call)
 *   - Graceful degradation (always plays something if speech is available)
 */

import { getVoicePrompt, getPromptClip, getPromptText, resolvePromptId } from './voicePrompts.js';
import { isAdminContext } from '../lib/voice/adminGuard.js';

// ─── Constants ───────────────────────────────────────────────

/** Languages where we attempt provider TTS */
const PROVIDER_LANGS = new Set(['en', 'fr', 'sw']);

/** Languages where we always try prerecorded clips first */
const PRERECORDED_LANGS = new Set(['tw']);

/** Browser TTS tuning */
const BROWSER_TTS_RATE = 0.85;
const BROWSER_TTS_PITCH = 0.9;

/** Provider TTS max text length */
const MAX_TTS_TEXT = 500;

// ─── State ───────────────────────────────────────────────────

/** Blob URL cache: key → blobUrl (persists for session) */
const _blobCache = new Map();

/** Provider availability per language (fetched once) */
let _providerStatus = null;
let _providerStatusPromise = null;

/** Singleton audio element for clip/provider playback */
let _audioEl = null;

/** Currently playing source for dedup */
let _currentSource = null;

// ─── Preferred voice selection (browser TTS) ─────────────────

const PREFERRED_VOICE_PATTERNS = [
  /google.*natural/i,
  /google.*wavenet/i,
  /google.*neural/i,
  /samantha/i, /daniel/i, /thomas/i, /amelie/i,
  /neural/i, /enhanced/i, /premium/i, /natural/i, /hd$/i,
];

const LANG_TAGS = { en: 'en', fr: 'fr', sw: 'sw', ha: 'ha', tw: 'ak' };

let _voiceCache = new Map();
let _voiceListVersion = 0;

function scoreVoice(voice) {
  let score = 0;
  const name = voice.name || '';
  if (voice.localService) score += 5;
  for (let i = 0; i < PREFERRED_VOICE_PATTERNS.length; i++) {
    if (PREFERRED_VOICE_PATTERNS[i].test(name)) { score += 20 - i; break; }
  }
  if (/compact/i.test(name)) score -= 10;
  if (/espeak/i.test(name)) score -= 15;
  return score;
}

function selectBestVoice(langTag) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const version = voices.length;
  if (version !== _voiceListVersion) { _voiceCache = new Map(); _voiceListVersion = version; }
  if (_voiceCache.has(langTag)) return _voiceCache.get(langTag);
  const langVoices = voices.filter(v => v.lang.startsWith(langTag));
  let best = null;
  if (langVoices.length > 0) {
    best = langVoices.reduce((a, b) => scoreVoice(b) > scoreVoice(a) ? b : a);
  } else {
    const enVoices = voices.filter(v => v.lang.startsWith('en'));
    if (enVoices.length > 0) best = enVoices.reduce((a, b) => scoreVoice(b) > scoreVoice(a) ? b : a);
  }
  if (best) _voiceCache.set(langTag, best);
  return best;
}

// ─── Audio element management ────────────────────────────────

function getAudioEl() {
  if (!_audioEl && typeof Audio !== 'undefined') {
    _audioEl = new Audio();
    _audioEl.preload = 'auto';
  }
  return _audioEl;
}

/**
 * Play an audio URL (blob URL, prerecorded path, or data URL).
 * Returns a promise that resolves when playback starts.
 */
function playAudioUrl(url) {
  return new Promise((resolve, reject) => {
    const el = getAudioEl();
    if (!el) return reject(new Error('No Audio support'));

    _currentSource = url;
    el.src = url;

    const onPlay = () => { cleanup(); resolve(true); };
    const onError = () => { cleanup(); reject(new Error('Audio playback failed')); };
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Audio load timeout')); }, 5000);

    function cleanup() {
      el.removeEventListener('playing', onPlay);
      el.removeEventListener('error', onError);
      clearTimeout(timeout);
    }

    el.addEventListener('playing', onPlay, { once: true });
    el.addEventListener('error', onError, { once: true });
    el.play().catch(onError);
  });
}

// ─── Provider TTS ────────────────────────────────────────────

/**
 * Fetch provider availability (cached for session).
 */
async function getProviderStatus() {
  if (_providerStatus) return _providerStatus;
  if (_providerStatusPromise) return _providerStatusPromise;

  _providerStatusPromise = (async () => {
    try {
      // V2 auth is httpOnly-cookie-based; `credentials: 'include'`
      // is the source of truth. The `farroway_token` (underscore,
      // not colon) bearer header is the V1 admin session fallback
      // — kept for back-compat with admin-tools call sites that
      // never migrated to cookies. NOTE: prior versions read
      // `farroway:token` (colon) which is NEVER written anywhere,
      // so the auth header was always empty and provider-TTS auth
      // silently fell back to the unauthenticated path.
      const token = (typeof localStorage !== 'undefined' &&
        localStorage.getItem('farroway_token')) || '';
      const res = await fetch('/api/v2/tts/status', {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      _providerStatus = data.providers || {};
      return _providerStatus;
    } catch {
      // Server unreachable — no provider TTS available
      _providerStatus = {};
      return _providerStatus;
    }
  })();

  return _providerStatusPromise;
}

/**
 * Request neural TTS from server. Returns blob URL or null.
 */
async function fetchProviderAudio(text, lang) {
  const cacheKey = `provider:${lang}:${text}`;
  if (_blobCache.has(cacheKey)) return _blobCache.get(cacheKey);

  try {
    // Same auth pattern as getProviderStatus above — cookie-first
    // via credentials: 'include', with a bearer-token fallback for
    // V1 admin sessions. `farroway_token` (underscore) is the
    // canonical V1 key; the older `farroway:token` (colon) was
    // never written anywhere and produced an empty header.
    const token = (typeof localStorage !== 'undefined' &&
      localStorage.getItem('farroway_token')) || '';
    const res = await fetch('/api/v2/tts/synthesize', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text: text.slice(0, MAX_TTS_TEXT), lang }),
    });

    if (res.status === 204 || !res.ok) return null;

    const blob = await res.blob();
    if (!blob.size) return null;

    const blobUrl = URL.createObjectURL(blob);
    _blobCache.set(cacheKey, blobUrl);
    return blobUrl;
  } catch {
    return null;
  }
}

// ─── Prerecorded clips ───────────────────────────────────────

/**
 * Try to play a prerecorded clip. Returns true if playback started.
 */
async function tryPrerecordedClip(promptId, lang) {
  const clipUrl = getPromptClip(promptId, lang);
  if (!clipUrl) return false;

  const cacheKey = `clip:${clipUrl}`;
  if (_blobCache.has(cacheKey)) {
    try {
      await playAudioUrl(_blobCache.get(cacheKey));
      return true;
    } catch {
      return false;
    }
  }

  try {
    // Fetch and cache the clip as a blob for offline reuse
    const res = await fetch(clipUrl);
    if (!res.ok) return false;
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    _blobCache.set(cacheKey, blobUrl);
    await playAudioUrl(blobUrl);
    return true;
  } catch {
    return false;
  }
}

// ─── Browser TTS fallback ────────────────────────────────────

function speakBrowserTTS(text, lang) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  if (!text) return false;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = BROWSER_TTS_RATE;
  utterance.pitch = BROWSER_TTS_PITCH;
  utterance.volume = 1.0;

  const langTag = LANG_TAGS[lang] || lang || 'en';
  const bestVoice = selectBestVoice(langTag);
  if (bestVoice) utterance.voice = bestVoice;
  utterance.lang = langTag;

  // Chrome voiceschanged fix
  if (window.speechSynthesis.getVoices().length === 0) {
    const retry = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', retry);
      const voice = selectBestVoice(langTag);
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
    };
    window.speechSynthesis.addEventListener('voiceschanged', retry);
    setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', retry);
      if (!window.speechSynthesis.speaking) window.speechSynthesis.speak(utterance);
    }, 500);
  } else {
    window.speechSynthesis.speak(utterance);
  }

  return true;
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Speak a voice prompt by key.
 *
 * Accepts any key: prompt ID ('task.water'), VOICE_MAP key ('home.welcome'),
 * i18n voice key ('task.voice.watering'), or weather voice key ('wx.safeVoice').
 * All are resolved to canonical prompt IDs via resolvePromptId().
 *
 * Follows the 3-tier fallback:
 *   1. Prerecorded clip (if available for this prompt + lang)
 *   2. Provider TTS (if server has a neural provider for this lang)
 *   3. Browser speechSynthesis (last resort)
 *
 * Non-blocking: returns true if any tier initiated playback.
 *
 * @param {string} key - any voice key (prompt ID, VOICE_MAP key, i18n key, wx.* key)
 * @param {string} lang - 'en'|'fr'|'sw'|'ha'|'tw'
 * @returns {boolean} true if playback was initiated
 */
export function speakPrompt(key, lang = 'en') {
  // Admin-context guard — no AudioContext, no SpeechSynthesis, no
  // provider fetch. See src/lib/voice/adminGuard.js.
  if (isAdminContext()) return false;
  const promptId = resolvePromptId(key) || key;
  const text = getPromptText(promptId, lang);
  if (!text) return false;

  stop();

  // Fire-and-forget async chain
  _speakWithFallback(promptId, text, lang);
  return true;
}

/**
 * Speak arbitrary text (not from the prompt map).
 *
 * Follows the same fallback but skips prerecorded clips (no prompt ID).
 *
 * @param {string} text - Text to speak
 * @param {string} lang - Language code
 * @returns {boolean} true if playback was initiated
 */
export function speakText(text, lang = 'en') {
  if (isAdminContext()) return false;
  if (!text) return false;
  stop();
  _speakTextWithFallback(text, lang);
  return true;
}

/**
 * Speak using the voiceGuide VOICE_MAP key system (backward compat).
 *
 * Resolves the key through the unified KEY_TO_PROMPT bridge first
 * (covers VOICE_MAP keys, task.voice.*, and wx.* keys).
 * Falls through to the VOICE_MAP text lookup, then browser TTS.
 *
 * @param {string} voiceMapKey - e.g. 'onboarding.welcome', 'task.voice.watering'
 * @param {string} lang
 * @param {Object} voiceMapTexts - The VOICE_MAP entry { en: '...', fr: '...' }
 * @returns {boolean}
 */
export function speakVoiceMapKey(voiceMapKey, lang, voiceMapTexts) {
  if (isAdminContext()) return false;
  stop();

  // Unified resolution: prompt ID, VOICE_MAP key, i18n key, or wx.* key
  const promptId = resolvePromptId(voiceMapKey);
  if (promptId) {
    const text = getPromptText(promptId, lang);
    if (text) {
      _speakWithFallback(promptId, text, lang);
      return true;
    }
  }

  // Fall through to VOICE_MAP text (for keys not yet in the prompt library)
  const text = voiceMapTexts?.[lang] || voiceMapTexts?.en;
  if (text) {
    _speakTextWithFallback(text, lang);
    return true;
  }

  return false;
}

/**
 * Stop all voice playback (audio element + browser TTS).
 */
export function stop() {
  _currentSource = null;
  const el = getAudioEl();
  if (el) { el.pause(); el.currentTime = 0; el.src = ''; }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Check if any voice playback method is available.
 */
export function isAvailable() {
  return typeof window !== 'undefined' && (
    typeof Audio !== 'undefined' ||
    'speechSynthesis' in window
  );
}

/**
 * Check if currently speaking/playing.
 */
export function isSpeaking() {
  const el = getAudioEl();
  const audioPlaying = el && !el.paused && !el.ended && el.currentTime > 0;
  const ttsPlaying = typeof window !== 'undefined' && window.speechSynthesis?.speaking;
  return audioPlaying || ttsPlaying;
}

/**
 * Pre-warm: fetch provider status and pre-load voice list.
 * Call once at app startup.
 */
export function warmup() {
  // Admin surfaces never speak — skip the provider availability
  // ping AND the browser getVoices() warm-up. This keeps admin
  // pages off /tts/status in telemetry and avoids spinning up
  // the browser voice list on load.
  if (isAdminContext()) return;
  // Fetch provider availability in background
  getProviderStatus().catch(() => {});
  // Trigger browser voice list load (Chrome fix)
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.getVoices();
  }
}

// ─── Internal async fallback chains ──────────────────────────

async function _speakWithFallback(promptId, text, lang) {
  // Tier 1: Prerecorded clip
  if (PRERECORDED_LANGS.has(lang) || getPromptClip(promptId, lang)) {
    try {
      const played = await tryPrerecordedClip(promptId, lang);
      if (played) return;
    } catch {}
  }

  // Tier 2: Provider TTS
  if (PROVIDER_LANGS.has(lang)) {
    try {
      const status = await getProviderStatus();
      if (status[lang]) {
        const blobUrl = await fetchProviderAudio(text, lang);
        if (blobUrl) {
          await playAudioUrl(blobUrl);
          return;
        }
      }
    } catch {}
  }

  // Tier 3: Browser TTS
  speakBrowserTTS(text, lang);
}

async function _speakTextWithFallback(text, lang) {
  // No prompt ID → skip prerecorded, go straight to provider
  if (PROVIDER_LANGS.has(lang)) {
    try {
      const status = await getProviderStatus();
      if (status[lang]) {
        const blobUrl = await fetchProviderAudio(text, lang);
        if (blobUrl) {
          await playAudioUrl(blobUrl);
          return;
        }
      }
    } catch {}
  }

  // Browser TTS fallback
  speakBrowserTTS(text, lang);
}

// ─── Re-exports for backward compatibility ───────────────────

/** @deprecated Use speakText() instead */
export const speakRaw = speakText;

/** @deprecated Use stop() instead */
export const stopSpeaking = stop;

/** @deprecated Use isAvailable() instead */
export const canUseTTS = isAvailable;

export default {
  speakPrompt,
  speakText,
  speakVoiceMapKey,
  stop,
  isAvailable,
  isSpeaking,
  warmup,
};
