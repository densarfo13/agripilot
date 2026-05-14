/**
 * voicePreferences — user-controlled voice-guidance settings.
 *
 *   import {
 *     getVoiceEnabled, setVoiceEnabled,
 *     getPreferredVoiceLanguage, setPreferredVoiceLanguage,
 *     getAutoReadScanResult, setAutoReadScanResult,
 *     resolveVoiceLanguage,
 *   } from '../lib/voice/voicePreferences.js';
 *
 *   if (!getVoiceEnabled()) return null;
 *   const lang = resolveVoiceLanguage({ uiLang: 'en' });
 *
 * Why a dedicated preferences module
 *   The existing voiceGuide / voiceEngine pair (utils/voiceGuide.js +
 *   voice/voiceEngine.js) handles the TTS PLAYBACK side. The Voice
 *   Guide V1 spec adds USER settings on top: an On/Off toggle, a
 *   preferred-language picker, and a default-off "auto-read scan
 *   result" flag. This module is the canonical read/write surface
 *   for those settings so the future Settings page wires them in
 *   one place + the rest of the app reads them without
 *   re-implementing localStorage logic.
 *
 *   Defaults (per spec):
 *     voiceEnabled            : true   ("On" is the default)
 *     preferredVoiceLanguage  : 'auto' (uses app language / region)
 *     autoReadScanResult      : false  (must be explicitly opt-in)
 *
 * Strict-rule audit
 *   * Pure synchronous reads / SSR-safe / never throw.
 *   * No React imports. The Settings page wraps these in useState.
 *   * Language resolver falls back gracefully — never returns null.
 */

const KEY_ENABLED        = 'farroway_voice_enabled_v1';
const KEY_LANGUAGE       = 'farroway_voice_language_v1';
const KEY_AUTO_READ_SCAN = 'farroway_voice_auto_read_scan_v1';

/**
 * Voice-language registry — mirrors the spec's multilingual prep
 * list. The codes here are the user-facing PREFERENCE keys; the
 * playback engine maps each to the closest available browser voice
 * (e.g. 'tw-GH' falls back to 'en-GH' if no Twi voice is installed).
 */
export const SUPPORTED_VOICE_LANGUAGES = Object.freeze([
  { code: 'auto', label: 'Auto (match app language)' },
  { code: 'en',   label: 'English',          tag: 'en-US' },
  { code: 'en-GH', label: 'English (Ghana)', tag: 'en-GH' },
  { code: 'tw',   label: 'Twi',              tag: 'tw-GH' },
  { code: 'ha',   label: 'Hausa',            tag: 'ha-NG' },
  { code: 'fr',   label: 'Français',         tag: 'fr-FR' },
  { code: 'sw',   label: 'Kiswahili',        tag: 'sw-KE' },
  { code: 'hi',   label: 'Hindi',            tag: 'hi-IN' },
]);

const _CODE_TO_TAG = new Map(
  SUPPORTED_VOICE_LANGUAGES
    .filter((e) => e.tag)
    .map((e) => [e.code, e.tag]),
);

function _safeGet(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _safeSet(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (value == null) localStorage.removeItem(key);
    else               localStorage.setItem(key, String(value));
  } catch { /* swallow */ }
}

// ─── voiceEnabled (master on/off) ─────────────────────────────

export function getVoiceEnabled() {
  const v = _safeGet(KEY_ENABLED);
  if (v === '0' || v === 'false' || v === 'off') return false;
  // Default: ON.
  return true;
}

export function setVoiceEnabled(enabled) {
  _safeSet(KEY_ENABLED, enabled ? '1' : '0');
}

// ─── preferredVoiceLanguage ───────────────────────────────────

export function getPreferredVoiceLanguage() {
  const raw = _safeGet(KEY_LANGUAGE);
  if (!raw) return 'auto';
  const norm = String(raw).trim().toLowerCase();
  const ok = SUPPORTED_VOICE_LANGUAGES.some((e) => e.code === norm);
  return ok ? norm : 'auto';
}

export function setPreferredVoiceLanguage(code) {
  const norm = typeof code === 'string' ? code.trim().toLowerCase() : '';
  const ok = SUPPORTED_VOICE_LANGUAGES.some((e) => e.code === norm);
  _safeSet(KEY_LANGUAGE, ok ? norm : 'auto');
}

// ─── autoReadScanResult ───────────────────────────────────────

export function getAutoReadScanResult() {
  const v = _safeGet(KEY_AUTO_READ_SCAN);
  // Default: OFF (spec §8 — auto-read must be explicit opt-in).
  return v === '1' || v === 'true' || v === 'on';
}

export function setAutoReadScanResult(enabled) {
  _safeSet(KEY_AUTO_READ_SCAN, enabled ? '1' : '0');
}

// ─── Language resolver ───────────────────────────────────────

/**
 * Resolve the effective voice language tag (e.g. 'en-US', 'tw-GH')
 * to feed the speech-synthesis engine. Order:
 *   1. Explicit user preference (when not 'auto')
 *   2. Caller-supplied uiLang (the active app language)
 *   3. Fallback 'en-US'
 *
 * Never returns null — the engine always gets a valid BCP-47 tag.
 *
 * @param {object} [input]
 * @param {string} [input.uiLang]  active app language code
 * @returns {string} BCP-47 language tag
 */
export function resolveVoiceLanguage(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const pref = getPreferredVoiceLanguage();
  if (pref && pref !== 'auto') {
    return _CODE_TO_TAG.get(pref) || 'en-US';
  }
  const uiLang = typeof safe.uiLang === 'string' ? safe.uiLang.trim().toLowerCase() : '';
  if (uiLang) {
    if (_CODE_TO_TAG.has(uiLang)) return _CODE_TO_TAG.get(uiLang);
    // Allow a raw BCP-47 tag like 'fr-FR' through.
    if (/^[a-z]{2}(-[A-Z]{2})?$/.test(safe.uiLang)) return safe.uiLang;
  }
  return 'en-US';
}

/** Test seam — flushes every preference key. */
export function _resetVoicePreferences() {
  _safeSet(KEY_ENABLED,        null);
  _safeSet(KEY_LANGUAGE,       null);
  _safeSet(KEY_AUTO_READ_SCAN, null);
}

const _module = {
  SUPPORTED_VOICE_LANGUAGES,
  getVoiceEnabled,
  setVoiceEnabled,
  getPreferredVoiceLanguage,
  setPreferredVoiceLanguage,
  getAutoReadScanResult,
  setAutoReadScanResult,
  resolveVoiceLanguage,
  _resetVoicePreferences,
};
export default _module;
